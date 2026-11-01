// Optional Supabase backend: signs the viewer in with their thirdweb wallet (Sign in with Web3),
// syncs My List and watch progress across devices, and asks the `entitlement` Edge Function
// whether the wallet owns the pass. Without VITE_SUPABASE_URL the app is local-only.

import { CONFIG } from "./config.js";
import { buildSiweMessage } from "./siwe.js";
import * as store from "./store.js";

export const enabled = !!(CONFIG.supabaseUrl && CONFIG.supabaseKey);

let client = null;
let userId = null;
let changeListener = () => {};
const timers = new Map();

export function onSynced(fn) { changeListener = fn; }
export const signedIn = () => !!userId;

// Tests pass a fake client; the app loads the real one on first use.
export async function init(injected) {
  if (injected) return (client = injected);
  if (client) return client;
  if (!enabled) return null;
  const { createClient } = await import("@supabase/supabase-js");
  client = createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  });
  return client;
}

/** Signs in with Supabase by having the thirdweb account sign a SIWE message. Reuses a saved session. */
export async function signIn(account) {
  if (!(await init())) return false;
  const { data: existing } = await client.auth.getSession();
  if (existing?.session) {
    const { data } = await client.auth.getUser();
    // A saved session for a different wallet must not be reused.
    if (data?.user && ownsWallet(data.user, account.address)) return start(data.user.id);
    await client.auth.signOut();
  }
  const message = buildSiweMessage({
    domain: location.host,
    uri: location.origin + location.pathname,
    address: account.address,
    chainId: CONFIG.chainId,
    statement: "Sign in to Nollywood. This does not cost anything.",
  });
  const signature = await account.signMessage({ message });
  const { data, error } = await client.auth.signInWithWeb3({ chain: "ethereum", message, signature });
  if (error) throw error;
  return start(data.user.id);
}

function ownsWallet(user, address) {
  const target = address.toLowerCase();
  return (user.identities || []).some((i) => i.provider === "web3" && JSON.stringify(i).toLowerCase().includes(target));
}

async function start(id) {
  userId = id;
  store.setHooks({ list: pushList, progress: pushProgress });
  await syncDown();
  return true;
}

export async function signOut() {
  for (const t of timers.values()) clearTimeout(t);
  timers.clear();
  userId = null;
  store.setHooks({});
  if (client) await client.auth.signOut().catch(() => {});
}

/** Pulls remote data, merges it into the local store, and uploads anything only the device has. */
export async function syncDown() {
  if (!client || !userId) return;
  const [list, progress] = await Promise.all([
    client.from("my_list").select("title_id, added_at"),
    client.from("progress").select("title_id, seconds, duration, updated_at"),
  ]);
  if (list.error || progress.error) return; // keep working offline
  const remoteList = list.data.sort((a, b) => b.added_at.localeCompare(a.added_at)).map((r) => r.title_id);
  const remoteProgress = Object.fromEntries(
    progress.data.map((r) => [r.title_id, { t: r.seconds, d: r.duration, at: Date.parse(r.updated_at) }]),
  );
  const { newList, newProgress, changed } = store.merge(remoteList, remoteProgress);
  if (newList.length) await client.from("my_list").upsert(newList.map((title_id) => ({ title_id })), { onConflict: "user_id,title_id", ignoreDuplicates: true });
  if (newProgress.length) await client.from("progress").upsert(newProgress.map(([id, p]) => row(id, p)), { onConflict: "user_id,title_id" });
  if (changed) changeListener();
}

const row = (id, p) => ({ title_id: id, seconds: p.t, duration: p.d, updated_at: new Date(p.at).toISOString() });

async function pushList(id, added) {
  if (!client || !userId) return;
  if (added) await client.from("my_list").upsert({ title_id: id }, { onConflict: "user_id,title_id", ignoreDuplicates: true });
  else await client.from("my_list").delete().eq("title_id", id);
}

// Progress is saved every few seconds while playing; upload at most once per 15 s per title.
function pushProgress(id, p) {
  if (!client || !userId) return;
  clearTimeout(timers.get(id));
  const send = async () => {
    timers.delete(id);
    if (p) await client.from("progress").upsert(row(id, p), { onConflict: "user_id,title_id" });
    else await client.from("progress").delete().eq("title_id", id);
  };
  timers.set(id, setTimeout(send, p ? 15000 : 0));
}

/** Asks the server whether the signed-in wallet owns the pass. Returns null when it can't tell. */
export async function checkPass() {
  if (!client || !userId) return null;
  const { data, error } = await client.functions.invoke("entitlement", { method: "POST" });
  if (error || typeof data?.hasPass !== "boolean") return null;
  return data.hasPass;
}
