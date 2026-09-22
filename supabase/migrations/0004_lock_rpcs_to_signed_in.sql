-- The later migration's grants re-opened these to anon. Both refuse an
-- anonymous caller in their own body, but nothing unauthenticated should be
-- able to reach them at all.
revoke execute on function public.create_class(uuid, text, jsonb, text, text, text) from anon, public;
revoke execute on function public.invite_to_class(uuid, text) from anon, public;
