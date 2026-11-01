-- Nollywood TV backend: synced My List, watch progress and pass entitlement.
-- Users sign in with Supabase "Sign in with Web3"; auth.uid() identifies them.

create table public.my_list (
  user_id  uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title_id text not null check (char_length(title_id) between 1 and 80),
  added_at timestamptz not null default now(),
  primary key (user_id, title_id)
);

create table public.progress (
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title_id   text not null check (char_length(title_id) between 1 and 80),
  seconds    real not null check (seconds >= 0),
  duration   real not null check (duration > 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, title_id)
);

-- Written only by the `entitlement` Edge Function (service role); users can read their own row.
create table public.entitlements (
  user_id       uuid primary key references auth.users (id) on delete cascade,
  wallet        text not null check (wallet ~ '^0x[0-9a-f]{40}$'),
  pass_contract text not null,
  token_id      numeric not null,
  balance       numeric not null default 0 check (balance >= 0),
  checked_at    timestamptz not null default now()
);

alter table public.my_list      enable row level security;
alter table public.progress     enable row level security;
alter table public.entitlements enable row level security;

create policy "own list: read"    on public.my_list  for select to authenticated using ((select auth.uid()) = user_id);
create policy "own list: add"     on public.my_list  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "own list: remove"  on public.my_list  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "own progress: read"   on public.progress for select to authenticated using ((select auth.uid()) = user_id);
create policy "own progress: add"    on public.progress for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "own progress: update" on public.progress for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own progress: remove" on public.progress for delete to authenticated using ((select auth.uid()) = user_id);

create policy "own entitlement: read" on public.entitlements for select to authenticated using ((select auth.uid()) = user_id);
-- No insert/update/delete policies on entitlements: clients can never grant themselves a pass.

revoke all on public.my_list, public.progress, public.entitlements from anon;
grant select, insert, delete on public.my_list to authenticated;
grant select, insert, update, delete on public.progress to authenticated;
grant select on public.entitlements to authenticated;
