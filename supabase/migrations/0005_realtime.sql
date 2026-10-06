-- Live updates between the two sides of a class.
--
-- The browser never trusts a payload from here: an event is only a signal to
-- re-read, and that read goes back through row-level security like any other.
-- Adding a table to the publication therefore exposes nothing new — it only
-- lets a client know that something it is already allowed to read has moved.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'progress'
  ) then
    alter publication supabase_realtime add table public.progress;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'checkpoint_grades'
  ) then
    alter publication supabase_realtime add table public.checkpoint_grades;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'enrollments'
  ) then
    alter publication supabase_realtime add table public.enrollments;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'classes'
  ) then
    alter publication supabase_realtime add table public.classes;
  end if;
end $$;
