// Unit tests for the backend logic. Run with: npm run test:unit
import test from "node:test";
import assert from "node:assert/strict";

// Minimal browser stubs so the app modules load in Node.
const mem = new Map();
globalThis.localStorage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
globalThis.location = { host: "tv.nollywood.example", origin: "https://tv.nollywood.example", pathname: "/index.html" };

const { buildSiweMessage } = await import("../src/siwe.js");
const store = await import("../src/store.js");
const backend = await import("../src/backend.js");
const chain = await import("../supabase/functions/entitlement/chain.ts");

const ADDR = "0x1234567890AbcdEF1234567890aBcdef12345678";

test("SIWE message follows EIP-4361 layout", () => {
  const msg = buildSiweMessage({ domain: "tv.example", uri: "https://tv.example/", address: ADDR, chainId: 8453, statement: "Sign in.", now: new Date("2026-11-01T10:00:00Z"), nonceValue: "abcd1234efgh5678" });
  assert.equal(msg, [
    "tv.example wants you to sign in with your Ethereum account:", ADDR, "", "Sign in.", "",
    "URI: https://tv.example/", "Version: 1", "Chain ID: 8453", "Nonce: abcd1234efgh5678", "Issued At: 2026-11-01T10:00:00.000Z",
  ].join("\n"));
});
test("SIWE message rejects bad addresses and uses fresh alphanumeric nonces", () => {
  assert.throws(() => buildSiweMessage({ domain: "d", uri: "u", address: "0x12", chainId: 1, statement: "s" }));
  const nonce = (m) => m.match(/Nonce: (.+)/)[1];
  const a = nonce(buildSiweMessage({ domain: "d", uri: "u", address: ADDR, chainId: 1, statement: "s" }));
  const b = nonce(buildSiweMessage({ domain: "d", uri: "u", address: ADDR, chainId: 1, statement: "s" }));
  assert.match(a, /^[0-9a-z]{16}$/);
  assert.notEqual(a, b);
});

test("balanceOf call data is ABI-correct", () => {
  const data = chain.encodeBalanceOf(ADDR, 7n);
  assert.equal(data, "0x00fdd58e" + "0".repeat(24) + "1234567890abcdef1234567890abcdef12345678" + "0".repeat(63) + "7");
  assert.equal(data.length, 2 + 8 + 64 + 64);
  assert.throws(() => chain.encodeBalanceOf("nope", 0n));
  assert.throws(() => chain.encodeBalanceOf(ADDR, -1n));
});
test("RPC results decode", () => {
  assert.equal(chain.decodeUint("0x" + "0".repeat(63) + "1"), 1n);
  assert.equal(chain.decodeUint("0x"), 0n);
  assert.throws(() => chain.decodeUint("oops"));
  assert.throws(() => chain.decodeUint(null));
});
test("wallet is read from the web3 identity only, lowercased", () => {
  const lower = ADDR.toLowerCase();
  assert.equal(chain.walletFromIdentities([{ provider: "web3", identity_data: { address: ADDR } }]), lower);
  assert.equal(chain.walletFromIdentities([{ provider: "web3", provider_id: "web3:ethereum:" + ADDR, identity_data: {} }]), lower);
  assert.equal(chain.walletFromIdentities([{ provider: "email", identity_data: { address: ADDR } }]), null);
  assert.equal(chain.walletFromIdentities([]), null);
  assert.equal(chain.walletFromIdentities(null), null);
});

// ---- Sync, using a fake Supabase client
function fakeClient({ list = [], progress = [], user = { id: "u1", identities: [{ provider: "web3", identity_data: { address: ADDR } }] }, session = false } = {}) {
  const calls = [];
  const tables = { my_list: list, progress };
  const query = (table) => ({
    select: async () => ({ data: structuredClone(tables[table]), error: null }),
    upsert: async (rows, opts) => { calls.push(["upsert", table, rows, opts]); return { error: null }; },
    delete: () => ({ eq: async (col, val) => { calls.push(["delete", table, col, val]); return { error: null }; } }),
  });
  return {
    calls,
    from: query,
    auth: {
      getSession: async () => ({ data: { session: session ? {} : null } }),
      getUser: async () => ({ data: { user } }),
      signInWithWeb3: async (args) => { calls.push(["signInWithWeb3", args]); return { data: { user }, error: null }; },
      signOut: async () => { calls.push(["signOut"]); },
    },
    functions: { invoke: async (name) => ({ data: { hasPass: name === "entitlement" }, error: null }) },
  };
}
const account = { address: ADDR, signMessage: async ({ message }) => "0xsigned:" + message.length };

test("sign-in signs a SIWE message and merges local and remote data", async () => {
  mem.clear();
  store.toggleList("local-only");
  store.saveProgress("local-newer", 100, 1000);
  const remote = fakeClient({
    list: [{ title_id: "remote-only", added_at: "2026-10-01T00:00:00Z" }],
    progress: [{ title_id: "local-newer", seconds: 5, duration: 1000, updated_at: "2020-01-01T00:00:00Z" },
               { title_id: "remote-only", seconds: 300, duration: 900, updated_at: "2026-10-30T00:00:00Z" }],
  });
  await backend.init(remote);
  let redraws = 0; backend.onSynced(() => redraws++);
  const ok = await backend.signIn(account);
  assert.equal(ok, true);

  const signIn = remote.calls.find((c) => c[0] === "signInWithWeb3")[1];
  assert.equal(signIn.chain, "ethereum");
  assert.ok(signIn.message.includes(ADDR) && signIn.message.includes("tv.nollywood.example wants you to sign in"));
  assert.match(signIn.signature, /^0xsigned:/);

  assert.deepEqual(store.myList().sort(), ["local-only", "remote-only"]);
  assert.equal(store.progressOf("remote-only").t, 300);
  assert.equal(store.progressOf("local-newer").t, 100, "newer local progress wins");
  assert.equal(redraws, 1);
  // Only what the server lacked is uploaded.
  assert.deepEqual(remote.calls.find((c) => c[0] === "upsert" && c[1] === "my_list")[2], [{ title_id: "local-only" }]);
  assert.deepEqual(remote.calls.find((c) => c[0] === "upsert" && c[1] === "progress")[2].map((r) => r.title_id), ["local-newer"]);
});

test("list changes are uploaded and removed", async () => {
  const remote = fakeClient();
  await backend.init(remote);
  await backend.signIn(account);
  remote.calls.length = 0;
  store.toggleList("nkiru"); // add
  store.toggleList("nkiru"); // remove
  await new Promise((r) => setTimeout(r, 20));
  assert.deepEqual(remote.calls.map((c) => c.slice(0, 2).join(":")), ["upsert:my_list", "delete:my_list"]);
});

test("a saved session for another wallet is not reused", async () => {
  mem.clear();
  const other = { id: "u2", identities: [{ provider: "web3", identity_data: { address: "0x" + "9".repeat(40) } }] };
  const remote = fakeClient({ user: other, session: true });
  await backend.init(remote);
  await backend.signIn(account);
  const names = remote.calls.map((c) => c[0]);
  assert.ok(names.indexOf("signOut") !== -1 && names.indexOf("signOut") < names.indexOf("signInWithWeb3"));
});

test("a saved session for the same wallet is reused without signing again", async () => {
  mem.clear();
  const remote = fakeClient({ session: true });
  await backend.init(remote);
  await backend.signIn(account);
  assert.ok(!remote.calls.some((c) => c[0] === "signInWithWeb3"));
});

test("nothing is uploaded after sign-out; pass check needs a session", async () => {
  const remote = fakeClient();
  await backend.init(remote);
  await backend.signIn(account);
  assert.equal(await backend.checkPass(), true);
  await backend.signOut();
  remote.calls.length = 0;
  store.toggleList("after-signout");
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(remote.calls.filter((c) => c[0] === "upsert" || c[0] === "delete").length, 0);
  assert.equal(await backend.checkPass(), null);
});
