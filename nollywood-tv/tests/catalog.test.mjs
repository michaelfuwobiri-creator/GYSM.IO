// Tests for the catalogue API loader. Run with: npm run test:unit
import test from "node:test";
import assert from "node:assert/strict";

const mem = new Map();
const storage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)) };
globalThis.localStorage = storage;

const { parseCatalog, loadCatalog, requestHeaders } = await import("../src/catalog-api.js");
const catalog = await import("../src/catalog.js");

const good = (over = {}) => ({ id: "eko", title: "Eko", kind: "movie", year: 2026, rating: "16+", runtime: "1h 40m", genres: ["Drama"], cast: ["A B"], logline: "x", stream: "https://cdn.example.com/eko.m3u8", ...over });

test("a valid title keeps its fields and gets defaults", () => {
  const { titles } = parseCatalog({ titles: [good()] });
  const t = titles[0];
  assert.equal(t.id, "eko");
  assert.equal(t.premium, false);
  assert.equal(t.match, 90);
  assert.ok(t.hue >= 0 && t.hue <= 360);
  assert.ok(["grid", "dots", "lines", "sun", "adire", "waves"].includes(t.motif));
});

test("bad titles are skipped with a warning, good ones kept", () => {
  const doc = { titles: [good(), good({ id: "Bad Id!" }), good({ id: "no-stream", stream: "http://insecure.example.com/x.mp4" }), good({ id: "js", stream: "javascript:alert(1)" }), good({ id: "untitled", title: "" }), good(), null, 5] };
  const { titles, warnings } = parseCatalog(doc);
  assert.deepEqual(titles.map((t) => t.id), ["eko"]);
  assert.equal(warnings.length, 7);
});

test("a catalogue with no valid titles is rejected", () => {
  assert.throws(() => parseCatalog({ titles: [] }));
  assert.throws(() => parseCatalog({ titles: [good({ stream: "ftp://x" })] }));
  assert.throws(() => parseCatalog(null));
  assert.throws(() => parseCatalog({}));
});

test("images must be https and cannot break out of CSS url('...')", () => {
  assert.equal(parseCatalog({ titles: [good({ image: "https://img.example.com/a.jpg" })] }).titles[0].image, "https://img.example.com/a.jpg");
  for (const image of ["http://img.example.com/a.jpg", "https://x.example.com/a'); background:red;/*", "https://x.example.com/a(b).jpg", "data:image/png;base64,AAAA"]) {
    assert.equal(parseCatalog({ titles: [good(), good({ id: "b", image })] }).titles.length, 1, image);
  }
  // Quotes and spaces are percent-encoded by the URL parser, so what is stored can't close the CSS string.
  const kept = parseCatalog({ titles: [good({ image: 'https://x.example.com/a b"c.jpg' })] }).titles[0].image;
  assert.equal(kept, "https://x.example.com/a%20b%22c.jpg");
});

test("odd values fall back to safe defaults instead of reaching the page", () => {
  const t = parseCatalog({ titles: [good({ rating: "<img src=x onerror=1>", year: "2026", hue: "red", motif: "x;y", match: 500, kind: "podcast", genres: ["ok", 5, null], cast: "nope" })] }).titles[0];
  assert.equal(t.rating, "NR");
  assert.equal(t.motif.includes(";"), false);
  assert.equal(t.match, 90);
  assert.equal(t.kind, "movie");
  assert.deepEqual(t.genres, ["ok"]);
  assert.deepEqual(t.cast, []);
  assert.equal(typeof t.hue, "number");
});

test("rows and featured ignore unknown ids and unsafe row ids", () => {
  const { rows, featured } = parseCatalog({
    titles: [good(), good({ id: "two", title: "Two" })],
    rows: [{ id: "a", title: "A", ids: ["eko", "ghost", "two"] }, { id: 'x"><script>', title: "Bad", ids: ["eko"] }, { id: "empty", title: "Empty", ids: ["ghost"] }, { id: "top", title: "Top", top10: true, ids: ["two"] }],
    featured: ["ghost", "two"],
  });
  assert.deepEqual(rows.map((r) => r.id), ["a", "top"]);
  assert.deepEqual(rows[0].items.map((t) => t.id), ["eko", "two"]);
  assert.equal(rows[1].top10, true);
  assert.deepEqual(featured.map((t) => t.id), ["two"]);
});

test("rows are built from genres when the API sends none", () => {
  const titles = ["a", "b", "c", "d"].map((id) => good({ id, genres: ["Comedy"], premium: id === "a" }));
  const { rows, featured } = parseCatalog({ titles });
  assert.deepEqual(rows.map((r) => r.id), ["all", "pass", "genre-comedy"]);
  assert.equal(featured.length, 4);
});

test("API key goes in Authorization as a Bearer token, or raw in a custom header", () => {
  assert.deepEqual(requestHeaders({}), { accept: "application/json" });
  assert.equal(requestHeaders({ catalogKey: "k1" }).Authorization, "Bearer k1");
  assert.equal(requestHeaders({ catalogKey: "k1", catalogKeyHeader: "authorization" }).authorization, "Bearer k1");
  assert.equal(requestHeaders({ catalogKey: "k1", catalogKeyHeader: "x-api-key" })["x-api-key"], "k1");
});

const okResponse = (body) => ({ ok: true, status: 200, text: async () => JSON.stringify(body) });
const config = { catalogUrl: "https://api.example.com/catalog.json", catalogKey: "secret" };

test("loading from the API applies it, sends the key, and caches it", async () => {
  mem.clear();
  let seen;
  const fetchImpl = async (url, opts) => { seen = { url, opts }; return okResponse({ titles: [good({ id: "from-api", title: "From API" })] }); };
  const r = await loadCatalog({ config, fetchImpl, storage });
  assert.equal(r.source, "network");
  assert.equal(seen.url, config.catalogUrl);
  assert.equal(seen.opts.headers.Authorization, "Bearer secret");
  assert.deepEqual(catalog.TITLES.map((t) => t.id), ["from-api"]);
  assert.equal(catalog.byId("from-api").title, "From API");
  assert.ok(mem.get("nollywood.catalog.v1").includes("from-api"));
});

test("when the API is down the last good copy is used", async () => {
  const fetchImpl = async () => { throw new Error("offline"); };
  const r = await loadCatalog({ config, fetchImpl, storage });
  assert.equal(r.source, "cache");
  assert.deepEqual(catalog.TITLES.map((t) => t.id), ["from-api"]);
});

test("an API error status or invalid body also falls back", async () => {
  const r1 = await loadCatalog({ config, fetchImpl: async () => ({ ok: false, status: 401, text: async () => "" }), storage });
  assert.equal(r1.source, "cache");
  mem.set("nollywood.catalog.v1", "{not json");
  const r2 = await loadCatalog({ config, fetchImpl: async () => okResponse({ titles: "nope" }), storage });
  assert.equal(r2.source, "sample");
  assert.ok(catalog.TITLES.length >= 16, "built-in sample is restored");
});

test("no API configured uses the built-in sample", async () => {
  catalog.setCatalog({ titles: [], rows: [], featured: [] });
  const r = await loadCatalog({ config: {}, storage });
  assert.equal(r.source, "sample");
  assert.ok(catalog.TITLES.length >= 16 && catalog.ROWS.length > 0 && catalog.FEATURED.length > 0);
});
