-- A heartbeat: touches the database, reads nothing in it.
--
-- Supabase's free tier pauses a project after about a week with no activity,
-- and a scheduled ping is what keeps it awake. The obvious ping — an anonymous
-- read of a real table — is refused, and rightly: the policies there call
-- membership helpers that anonymous callers are forbidden to execute.
-- Loosening that to make a health check pass would be the wrong trade.
--
-- So this is the one thing an anonymous caller may run. It is security
-- invoker, has an empty search_path, and touches no table: there is nothing
-- here to leak.
create or replace function public.ping()
returns timestamptz
language sql stable security invoker set search_path = ''
as $$ select pg_catalog.now() $$;

revoke execute on function public.ping() from public;
grant execute on function public.ping() to anon, authenticated;
