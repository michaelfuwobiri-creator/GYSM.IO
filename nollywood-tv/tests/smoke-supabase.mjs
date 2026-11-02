// Manual smoke test against a real Supabase project, using a throwaway wallet.
//   SUPABASE_URL=... SUPABASE_KEY=... [SITE=http://localhost:3000] npm run smoke:supabase
// It signs in with Web3, writes and reads rows, and checks that a second wallet can't see them.
import { createClient } from "@supabase/supabase-js";
import { createThirdwebClient } from "thirdweb";
import { privateKeyToAccount } from "thirdweb/wallets";
import { buildSiweMessage } from "../src/siwe.js";

const { SUPABASE_URL, SUPABASE_KEY, SITE = "http://localhost:3000", CHAIN_ID = "84532" } = process.env;
if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error("Set SUPABASE_URL and SUPABASE_KEY (the publishable key).");
const site = new URL(SITE);
const tw = createThirdwebClient({ clientId: "smoke-test" });
const randomKey = () => "0x" + [...crypto.getRandomValues(new Uint8Array(32))].map((b) => b.toString(16).padStart(2, "0")).join("");

async function signedInClient() {
  const account = privateKeyToAccount({ client: tw, privateKey: randomKey() });
  const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const message = buildSiweMessage({ domain: site.host, uri: site.href, address: account.address, chainId: Number(CHAIN_ID), statement: "Smoke test sign-in." });
  const signature = await account.signMessage({ message });
  const { data, error } = await sb.auth.signInWithWeb3({ chain: "ethereum", message, signature });
  if (error) throw new Error("signInWithWeb3 failed: " + error.message);
  return { sb, account, user: data.user };
}

const results = [];
const check = (name, ok, extra = "") => { results.push(ok); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  — " + extra : ""}`); };

const a = await signedInClient();
check("wallet sign-in returns a session", !!a.user?.id, a.user?.id);
console.log("   identities:", JSON.stringify(a.user.identities?.map((i) => ({ provider: i.provider, provider_id: i.provider_id, identity_data: i.identity_data }))));

const ins = await a.sb.from("my_list").upsert({ title_id: "smoke-test" }, { onConflict: "user_id,title_id" });
check("user can add to My List", !ins.error, ins.error?.message);
const read = await a.sb.from("my_list").select("title_id");
check("user reads own list", read.data?.length === 1 && read.data[0].title_id === "smoke-test", JSON.stringify(read.data));
const prog = await a.sb.from("progress").upsert({ title_id: "smoke-test", seconds: 42, duration: 600 }, { onConflict: "user_id,title_id" });
check("user can save progress", !prog.error, prog.error?.message);
const grant = await a.sb.from("entitlements").insert({ user_id: a.user.id, wallet: a.account.address.toLowerCase(), pass_contract: "0x" + "1".repeat(40), token_id: 0, balance: 1 });
check("user cannot grant themselves a pass", !!grant.error, grant.error?.message);

const b = await signedInClient();
const other = await b.sb.from("my_list").select("title_id");
check("a different wallet sees none of those rows", !other.error && other.data.length === 0, JSON.stringify(other.data));
const stolen = await b.sb.from("progress").delete().eq("title_id", "smoke-test").select();
check("a different wallet cannot delete them", !stolen.error && stolen.data.length === 0);

const fn = await a.sb.functions.invoke("entitlement", { method: "POST" });
const fnBody = fn.error ? await fn.error.context?.json?.().catch(() => null) : fn.data;
console.log("   entitlement function:", JSON.stringify(fnBody ?? fn.error?.message));
check("entitlement function answers for a signed-in user", !!fnBody, "");

// Clean up the throwaway users' rows.
await a.sb.from("my_list").delete().eq("title_id", "smoke-test");
await a.sb.from("progress").delete().eq("title_id", "smoke-test");
console.log(`\n${results.filter(Boolean).length}/${results.length} passed`);
process.exit(results.every(Boolean) ? 0 : 1);
