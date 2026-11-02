// Loads the catalogue from an API (VITE_CATALOG_URL) and checks it before the app uses it.
//
// The response is untrusted input: every field is type-checked and limited, bad titles are skipped
// (not the whole catalogue), and anything that ends up in HTML or CSS is restricted to safe values.
// If the API can't be reached, the last good copy is used; with no copy, the built-in sample.

import { CONFIG } from "./config.js";
import { setCatalog, useSampleCatalog } from "./catalog.js";

const CACHE_KEY = "nollywood.catalog.v1";
const MOTIFS = ["grid", "dots", "lines", "sun", "adire", "waves"];
const KINDS = ["movie", "series"];

const text = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const int = (v, min, max, fallback) => (Number.isInteger(v) && v >= min && v <= max ? v : fallback);
const list = (v, maxItems, maxLen) =>
  Array.isArray(v) ? v.filter((x) => typeof x === "string" && x.trim()).slice(0, maxItems).map((x) => x.trim().slice(0, maxLen)) : [];

const hash = (s) => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7);

// Only https URLs, and none of the characters that could break out of CSS url('...') or HTML.
function safeUrl(v) {
  if (typeof v !== "string") return null;
  try {
    const u = new URL(v);
    if (u.protocol !== "https:" || /['"()\\<>\s]/.test(u.href) || u.href.length > 1000) return null;
    return u.href;
  } catch {
    return null;
  }
}

function parseTitle(raw) {
  if (!raw || typeof raw !== "object") return { error: "not an object" };
  const id = text(raw.id, 80);
  if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(id)) return { error: "id must be lowercase letters, digits and dashes" };
  const title = text(raw.title, 120);
  if (!title) return { error: "missing title", id };
  const stream = safeUrl(raw.stream);
  if (!stream) return { error: "stream must be an https URL", id };
  const kind = KINDS.includes(raw.kind) ? raw.kind : "movie";
  const image = raw.image == null ? null : safeUrl(raw.image);
  if (raw.image != null && !image) return { error: "image must be an https URL", id };
  const rating = text(raw.rating, 8);
  const out = {
    id, title, kind, stream,
    year: int(raw.year, 1900, 2100, new Date().getFullYear()),
    rating: /^[A-Za-z0-9+ ]{1,8}$/.test(rating) ? rating : "NR",
    runtime: text(raw.runtime, 24),
    genres: list(raw.genres, 6, 30),
    cast: list(raw.cast, 8, 60),
    logline: text(raw.logline, 600),
    premium: raw.premium === true,
    match: int(raw.match, 0, 100, 90),
    hue: int(raw.hue, 0, 360, hash(id) % 360),
    motif: MOTIFS.includes(raw.motif) ? raw.motif : MOTIFS[hash(id) % MOTIFS.length],
  };
  if (kind === "series") out.seasons = int(raw.seasons, 1, 50, 1);
  if (image) out.image = image;
  return { title: out };
}

/** Validates a catalogue document. Returns { titles, rows, featured, warnings } or throws. */
export function parseCatalog(doc) {
  if (!doc || typeof doc !== "object" || !Array.isArray(doc.titles)) throw new Error("catalogue must have a titles array");
  const warnings = [];
  const titles = [];
  const seen = new Set();
  for (const raw of doc.titles.slice(0, 500)) {
    const r = parseTitle(raw);
    if (r.error) { warnings.push(`skipped ${r.id ?? "a title"}: ${r.error}`); continue; }
    if (seen.has(r.title.id)) { warnings.push(`skipped duplicate ${r.title.id}`); continue; }
    seen.add(r.title.id);
    titles.push(r.title);
  }
  if (!titles.length) throw new Error("catalogue has no valid titles");
  const byId = new Map(titles.map((t) => [t.id, t]));
  const pick = (ids) => (Array.isArray(ids) ? ids.map((id) => byId.get(id)).filter(Boolean) : []);

  let rows = (Array.isArray(doc.rows) ? doc.rows : []).slice(0, 30).map((r) => ({
    id: /^[a-z0-9-]{1,40}$/.test(r?.id) ? r.id : null,
    title: text(r?.title, 80),
    items: pick(r?.ids),
    ...(r?.top10 === true && { top10: true }),
    ...(r?.premium === true && { premium: true }),
  })).filter((r) => r.id && r.title && r.items.length);

  if (!rows.length) {
    // No rows supplied: build them from the titles.
    rows = [{ id: "all", title: "Watch now", items: titles.slice(0, 20) }];
    const premium = titles.filter((t) => t.premium);
    if (premium.length) rows.push({ id: "pass", title: "Only with Nollywood Pass", premium: true, items: premium });
    for (const g of [...new Set(titles.flatMap((t) => t.genres))].slice(0, 6)) {
      const items = titles.filter((t) => t.genres.includes(g));
      if (items.length >= 3) rows.push({ id: "genre-" + g.toLowerCase().replace(/[^a-z0-9]+/g, "-"), title: g, items });
    }
  }
  let featured = pick(doc.featured).slice(0, 6);
  if (!featured.length) featured = titles.slice(0, 4);
  return { titles, rows, featured, warnings };
}

// Sends the API key (if any) from VITE_CATALOG_API_KEY. A key in an app bundle can be read by anyone
// with the app, so it must be a read-only, catalogue-only key.
export function requestHeaders(config = CONFIG) {
  const headers = { accept: "application/json" };
  if (config.catalogKey) {
    const name = config.catalogKeyHeader || "Authorization";
    headers[name] = name.toLowerCase() === "authorization" ? `Bearer ${config.catalogKey}` : config.catalogKey;
  }
  return headers;
}

/**
 * Loads the catalogue and applies it. Returns { source: "network" | "cache" | "sample", warnings }.
 * Dependencies are injectable for tests.
 */
export async function loadCatalog({ config = CONFIG, fetchImpl = globalThis.fetch, storage = globalThis.localStorage, timeoutMs = 3500 } = {}) {
  const apply = (parsed, source) => { setCatalog(parsed); return { source, warnings: parsed.warnings }; };
  if (!config.catalogUrl) { useSampleCatalog(); return { source: "sample", warnings: [] }; }

  try {
    const res = await fetchImpl(config.catalogUrl, { headers: requestHeaders(config), signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) throw new Error(`catalogue request failed (${res.status})`);
    const body = await res.text();
    const parsed = parseCatalog(JSON.parse(body));
    try { storage?.setItem(CACHE_KEY, body); } catch { /* storage full or unavailable */ }
    return apply(parsed, "network");
  } catch (err) {
    console.warn("Catalogue unavailable:", err.message);
  }
  try {
    const cached = storage?.getItem(CACHE_KEY);
    if (cached) return apply(parseCatalog(JSON.parse(cached)), "cache");
  } catch { /* corrupt cache: fall through */ }
  useSampleCatalog();
  return { source: "sample", warnings: [] };
}
