-- Two-way sync with Google Classroom (ADR-012).
--
-- To tell who changed what, each link remembers two things:
--
--   sent       what the curriculum said when it last reached Classroom
--   classroom  what Classroom said when we last looked
--
-- The curriculum differing from `sent` is an edit here, and goes to Classroom.
-- Classroom differing from `sent` is an edit there, and is left alone. Null on
-- links made before this: the next sync fills them in without pushing anything.
alter table public.classroom_links
  add column sent jsonb,
  add column classroom jsonb;

-- KEPT: removed from the curriculum, but students have work on it, so it stays
-- in Classroom. (Deleting it would delete their submissions.)
alter table public.classroom_links drop constraint classroom_links_state_check;
alter table public.classroom_links add constraint classroom_links_state_check
  check (state in ('DRAFT', 'SCHEDULED', 'PUBLISHED', 'GONE', 'KEPT'));

-- external: an assignment the teacher posted by hand. Read for the grid only;
-- Classroom's API won't let this app edit what it did not create.
alter table public.classroom_links drop constraint classroom_links_kind_check;
alter table public.classroom_links add constraint classroom_links_kind_check
  check (kind in ('topic', 'material', 'assignment', 'external'));

-- So a change found on one screen reaches the teacher's others.
alter publication supabase_realtime add table public.classroom_links;
