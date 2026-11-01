-- Row Level Security test. Runs on plain Postgres against stubs of Supabase's auth schema:
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/rls.sql
\set ON_ERROR_STOP on
drop schema if exists public cascade; create schema public;
drop schema if exists auth cascade; create schema auth;
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable
  as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth, public to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated;
grant select on auth.users to authenticated;
grant all on schema public to service_role;

\i supabase/migrations/20261101000000_nollywood_backend.sql
grant all on all tables in schema public to service_role;

insert into auth.users values ('00000000-0000-0000-0000-00000000000a'), ('00000000-0000-0000-0000-00000000000b');

drop schema if exists testlog cascade; create schema testlog;
create table testlog.results (name text, ok boolean);
create function testlog.expect_error(sql text) returns boolean language plpgsql as $$
begin execute sql; return false; exception when others then return true; end $$;
grant usage on schema testlog to anon, authenticated, service_role;
grant all on testlog.results to anon, authenticated, service_role;
grant execute on function testlog.expect_error(text) to anon, authenticated, service_role;

-- Alice adds to her list and saves progress.
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
insert into public.my_list (title_id) values ('eko-after-dark'), ('nkiru');
insert into public.progress (title_id, seconds, duration) values ('nkiru', 120, 6000);
insert into testlog.results select 'alice sees her 2 list rows', count(*) = 2 from public.my_list;
insert into testlog.results select 'user_id defaults to auth.uid()', bool_and(user_id = '00000000-0000-0000-0000-00000000000a') from public.my_list;
insert into testlog.results select 'alice cannot insert a row for bob', testlog.expect_error($q$insert into public.my_list (user_id, title_id) values ('00000000-0000-0000-0000-00000000000b', 'x')$q$);
insert into testlog.results select 'alice cannot grant herself a pass', testlog.expect_error($q$insert into public.entitlements values ('00000000-0000-0000-0000-00000000000a', '0x0000000000000000000000000000000000000001', '0x0000000000000000000000000000000000000001', 0, 1)$q$);

-- Bob sees nothing of Alice's, and cannot touch it.
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
insert into testlog.results select 'bob sees 0 of alice''s list rows', count(*) = 0 from public.my_list;
insert into testlog.results select 'bob sees 0 of alice''s progress rows', count(*) = 0 from public.progress;
with d as (delete from public.my_list returning 1) insert into testlog.results select 'bob deletes 0 rows', count(*) = 0 from d;
with u as (update public.progress set seconds = 0 returning 1) insert into testlog.results select 'bob updates 0 rows', count(*) = 0 from u;
insert into testlog.results select 'bob cannot move a row to himself', testlog.expect_error($q$update public.progress set user_id = '00000000-0000-0000-0000-00000000000b'$q$) or not exists (select 1 from public.progress);
insert into testlog.results select 'bad progress rejected (duration 0)', testlog.expect_error($q$insert into public.progress (title_id, seconds, duration) values ('x', 1, 0)$q$);

-- Signed-out (anon) visitors get nothing and cannot write.
set role anon; reset request.jwt.claim.sub;
insert into testlog.results select 'anon cannot read list', testlog.expect_error('select * from public.my_list');
insert into testlog.results select 'anon cannot write list', testlog.expect_error($q$insert into public.my_list (user_id, title_id) values ('00000000-0000-0000-0000-00000000000a', 'x')$q$);

-- The Edge Function (service role) writes the entitlement; the user can read only their own.
reset role; set role service_role;
insert into public.entitlements values ('00000000-0000-0000-0000-00000000000a', '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd', '0x0000000000000000000000000000000000000001', 0, 1);
insert into testlog.results select 'service role can write entitlement', true;
insert into testlog.results select 'wallet must be lowercase hex', testlog.expect_error($q$insert into public.entitlements values ('00000000-0000-0000-0000-00000000000b', '0xABCDEFABCDEFABCDEFABCDEFABCDEFABCDEFABCD', 'c', 0, 1)$q$);
reset role; set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
insert into testlog.results select 'alice reads her entitlement', count(*) = 1 from public.entitlements;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
insert into testlog.results select 'bob cannot read alice''s entitlement', count(*) = 0 from public.entitlements;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
insert into testlog.results select 'alice cannot edit her entitlement (no UPDATE privilege)', testlog.expect_error($q$update public.entitlements set balance = 99$q$);
insert into testlog.results select 'alice cannot delete her entitlement', testlog.expect_error($q$delete from public.entitlements$q$);

reset role;
select case when ok then 'PASS' else 'FAIL' end as result, name from testlog.results;
select count(*) filter (where ok) || '/' || count(*) as passed from testlog.results;
do $$ begin if exists (select 1 from testlog.results where not ok) then raise exception 'RLS test failed'; end if; end $$;
