// Edge Function `entitlement`: checks whether the signed-in user's wallet owns the Nollywood Pass.
//
// The wallet comes from the verified Supabase session, never from the request body, so a viewer
// can't ask about someone else's wallet. The result is cached in public.entitlements, which only
// this function (service role) can write.
//
// Secrets (supabase secrets set ...): PASS_CONTRACT, PASS_TOKEN_ID, RPC_URL.
// SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.

import { createClient } from "npm:@supabase/supabase-js@2";
import { decodeUint, encodeBalanceOf, isAddress, walletFromIdentities } from "./chain.ts";

const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "content-type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const jwt = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!jwt) return json({ error: "sign in first" }, 401);

  const url = Deno.env.get("SUPABASE_URL")!;
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Verify the session token with Supabase Auth.
  const { data: auth, error: authError } = await createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!).auth.getUser(jwt);
  if (authError || !auth.user) return json({ error: "invalid session" }, 401);

  const { data: full, error: lookupError } = await admin.auth.admin.getUserById(auth.user.id);
  if (lookupError || !full.user) return json({ error: "user not found" }, 401);
  const wallet = walletFromIdentities(full.user.identities as any);
  if (!isAddress(wallet)) return json({ error: "this account has no wallet" }, 400);

  const contract = Deno.env.get("PASS_CONTRACT");
  const rpc = Deno.env.get("RPC_URL");
  const tokenId = BigInt(Deno.env.get("PASS_TOKEN_ID") ?? "0");
  if (!isAddress(contract) || !rpc) return json({ error: "server is not configured" }, 500);

  let balance: bigint;
  try {
    const res = await fetch(rpc, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1, method: "eth_call",
        params: [{ to: contract, data: encodeBalanceOf(wallet, tokenId) }, "latest"],
      }),
      signal: AbortSignal.timeout(8000),
    });
    const body = await res.json();
    if (body.error) throw new Error(body.error.message);
    balance = decodeUint(body.result);
  } catch (err) {
    console.error("balanceOf failed", err);
    return json({ error: "could not check the pass right now" }, 502);
  }

  const { error: writeError } = await admin.from("entitlements").upsert({
    user_id: auth.user.id, wallet, pass_contract: contract.toLowerCase(),
    token_id: tokenId.toString(), balance: balance.toString(), checked_at: new Date().toISOString(),
  });
  if (writeError) console.error("cache write failed", writeError);

  return json({ hasPass: balance > 0n, wallet, balance: balance.toString() });
});
