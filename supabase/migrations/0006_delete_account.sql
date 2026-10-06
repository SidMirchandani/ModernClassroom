-- Deleting your own account, for real.
--
-- Everything hangs off auth.users by `on delete cascade`, so removing that one
-- row takes the profile, the classes taught, their enrolments, progress,
-- grades and aliases with it. The one thing cascade will not do on its own is
-- decide what happens to a class you teach — that is other people's work, so
-- it is spelled out here rather than left to a foreign key nobody reads.

create or replace function public.delete_account()
returns void
language plpgsql security definer set search_path = public, auth
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then raise exception 'not signed in'; end if;

  -- Classes this person teaches go with them, and so does the work done in
  -- them: a class with no teacher is unreachable, and leaving orphaned student
  -- records behind would be keeping data we have just been asked to erase.
  -- This is stated plainly in the privacy policy and confirmed in the UI.
  delete from public.classes where teacher_id = me;

  -- Seats held for an address that is going away.
  delete from public.invites
    where lower(handle) in (
      select lower(email) from auth.users where id = me
      union
      select lower(username) from public.profiles where id = me
    );

  -- The rest cascades from here: profile, enrolments, progress, grades.
  delete from auth.users where id = me;
end;
$$;

revoke execute on function public.delete_account() from anon, public;
grant execute on function public.delete_account() to authenticated;
