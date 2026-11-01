# Supabase backend (optional)

Adds synced **My List** and **watch progress**, and a server-side check of the **Nollywood Pass**. Without it the app works as before, with data kept on the device.

| File | What it does |
| --- | --- |
| `migrations/20261101000000_nollywood_backend.sql` | Tables `my_list`, `progress`, `entitlements` with Row Level Security. Each viewer sees only their own rows; nobody can grant themselves a pass. |
| `functions/entitlement/` | Edge Function. Reads the signed-in wallet from the verified session, checks `balanceOf` on the pass contract and caches the answer in `entitlements`. |
| `tests/rls.sql` | 18 checks of the access rules, run on plain Postgres. |
| `../src/backend.js`, `../src/siwe.js` | App side: sign in with the thirdweb wallet, sync, pass check. |

## How sign-in works

1. The viewer signs in on the TV with the thirdweb email wallet, as before.
2. The app builds a Sign-In with Ethereum (EIP-4361) message, the wallet signs it, and `supabase.auth.signInWithWeb3({ chain: "ethereum", message, signature })` returns a session.
3. Every request carries that session, so the database rules use `auth.uid()`.
4. A failed backend sign-in never blocks watching: the app keeps working locally.

## Set up

Use a **new** Supabase project for this app (your other projects are not touched).

1. Create the project at https://supabase.com/dashboard.
2. Apply the schema: paste the migration into the SQL editor, or run `supabase link --project-ref <ref>` then `supabase db push`.
3. **Authentication → Providers → Web3 Wallet**: enable **Ethereum**.
4. **Authentication → URL Configuration → Redirect URLs**: add the address of the web app (for example `https://tv.example.com/**`) **and** `https://appassets.androidplatform.net/**`, the origin the Fire TV app runs on. Supabase rejects sign-in messages whose domain and URI are not on this list.
5. **Authentication → Rate Limits**: keep the Web3 limit low, and turn on CAPTCHA if abuse appears. Wallet accounts are free to create.
6. Set the function secrets and deploy it (RPC_URL is a Base RPC endpoint, for example from your thirdweb dashboard or `https://sepolia.base.org` for the testnet):

```bash
supabase secrets set PASS_CONTRACT=0xYourEditionDrop PASS_TOKEN_ID=0 RPC_URL=https://sepolia.base.org
```

```bash
supabase functions deploy entitlement
```

7. In `.env` set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` (Project settings → API; the publishable/anon key only, never the service-role key), then rebuild.

## Test

The access rules (needs Postgres 16 and a local server; see the comment at the top of the file):

```bash
psql -v ON_ERROR_STOP=1 -f supabase/tests/rls.sql
```

The app logic (no network needed):

```bash
npm run test:unit
```

## Not verified yet (needs a real project)

- That Supabase accepts the SIWE message from the Fire TV WebView origin (`appassets.androidplatform.net`) and from the TV's real host.
- The exact field Supabase stores the wallet in. `chain.ts` checks `identity_data.address`, the claims, and the address inside `provider_id`, and the unit tests cover those shapes. Confirm with one real sign-in.
- The Edge Function itself has never run on Supabase (Deno is not available in this sandbox); only its helper functions are tested.
- The TV still decides what to unlock from its own `balanceOf` check. The function's answer is for server-side use, such as issuing signed playback links (next step).
