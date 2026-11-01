# Backend options: auth, database and encrypted storage

Research notes (November 2026) for adding a backend to Nollywood TV. Check the linked docs before building, because the SDK APIs change quickly.

## Recommendation

| Need | Use | Why |
| --- | --- | --- |
| Sign-in on the TV | Keep the thirdweb **in-app wallet** with email codes | Already built. Works with a remote, no seed phrase. |
| Server-verified session | **Supabase Auth "Sign in with Web3"** (SIWE, EIP-4361), signed by the thirdweb account | No auth server of our own. Supabase issues the session, so Row Level Security (RLS) uses `auth.uid()`. |
| Database | **Supabase Postgres + RLS** | Syncs My List, watch progress and profiles across devices, and caches pass status. |
| Who has the pass | **On-chain `balanceOf`**, checked on the server | The chain is the source of truth. Cache the result in the database; never trust a flag sent by the client. |
| Protecting premium video | **Signed playback URLs** (Mux or Cloudflare Stream), issued by an Edge Function after it checks the pass, plus **DRM** for studio content | Video has to be encrypted by the streaming service; app code can't protect it. |
| Secrets (thirdweb secret key, admin key, Mux keys) | **Supabase Vault** or Edge Function secrets | Never ship them in the TV bundle. |
| Personal data at rest | Supabase's default encryption at rest | Enough for most needs; Supabase says it covers SOC 2 and HIPAA. Avoid pgsodium column encryption, which is pending deprecation. |

### Session flow

1. The viewer signs in on the TV with the thirdweb in-app wallet, as now.
2. The app builds a SIWE message, signs it with `account.signMessage`, and calls `supabase.auth.signInWithWeb3({ chain: "ethereum", message, signature })`.
3. Supabase returns a session. Every table has RLS keyed on `auth.uid()`.
4. An Edge Function, `entitlement`, reads `balanceOf` for the user's wallet on the pass contract, updates `entitlements`, and returns signed playback URLs for premium titles.

Check first: Supabase's docs listed Ethereum Web3 sign-in as "coming soon" at one point, so confirm it is enabled for your project.

**Fallback if it isn't available:** run thirdweb Auth on a small server or Edge Function: `createAuth` → `generatePayload` → `signLoginPayload` (client) → `verifyPayload` → `generateJWT`. Then configure Supabase to accept that JWT (third-party auth, or an imported asymmetric signing key published via JWKS), with the lowercased wallet address in `sub`.

### Suggested tables

- `profiles(id uuid = auth.uid(), wallet text unique, email text, created_at)`
- `my_list(user_id, title_id, added_at)` and `progress(user_id, title_id, seconds, duration, updated_at)`
- `entitlements(user_id, pass_contract, token_id, balance, checked_at)`, written only by the Edge Function (service role)

## What not to use, and why

- **IPFS for private data.** It is public by default and has no access control. Anything stored there must be encrypted on the client first, and key rotation then becomes your problem.
- **Lit Protocol for video.** It can gate decryption keys on an ERC-1155 balance (`balanceOf` > 0), but the decrypted bytes still reach the device, and it adds a network dependency to every play. It could suit small premium files such as scripts or behind-the-scenes PDFs, but not streaming.
- **pgsodium / Transparent Column Encryption.** Supabase recommends against using it in new projects.

## Sources

- [thirdweb in-app wallet](https://portal.thirdweb.com/references/typescript/v5/inAppWallet)
- [thirdweb custom auth](https://portal.thirdweb.com/wallets/custom-auth) and [custom JWT auth server](https://portal.thirdweb.com/connect/in-app-wallet/custom-auth/custom-jwt-auth-server)
- [thirdweb Auth (SIWE, JWT)](https://portal.thirdweb.com/typescript/v5/auth) and [createAuth](https://portal.thirdweb.com/references/typescript/v5/createAuth)
- [Supabase Sign in with Web3](https://supabase.com/docs/guides/auth/auth-web3) and [signInWithWeb3](https://supabase.com/docs/reference/javascript/auth-signinwithweb3)
- [Supabase JWTs and third-party auth](https://supabase.com/docs/guides/auth/auth-deep-dive/auth-deep-dive-jwts)
- [Supabase pgsodium deprecation and Vault](https://supabase.com/docs/guides/database/column-encryption)
- [Lit Protocol ERC-1155 conditions](https://developer.litprotocol.com/sdk/access-control/evm/basic-examples)
