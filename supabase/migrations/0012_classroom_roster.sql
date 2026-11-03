-- M3: the class's students and their turn-ins, as Google Classroom has them.
--
-- A cache, not a record (ADR-009). Classroom is the truth; these rows let the
-- grid draw at once and tell a teacher's other open screens when something
-- changed. They go when the class is deleted (cascade) or Google is
-- disconnected (the disconnect route). Students have no accounts here, so
-- they are keyed by Classroom's own user id, not by a profile.
create table public.classroom_roster (
  class_id    uuid not null references public.classes (id) on delete cascade,
  user_id     text not null,
  name        text not null,
  updated_at  timestamptz not null default now(),
  primary key (class_id, user_id)
);
alter table public.classroom_roster enable row level security;

create policy "classroom roster: teacher only" on public.classroom_roster
  for all using (private.is_class_teacher(class_id))
  with check (private.is_class_teacher(class_id));

create trigger classroom_roster_touch before update on public.classroom_roster
  for each row execute function public.touch_updated_at();

-- item_key is the same key as classroom_links. The grades are held for M4.
create table public.classroom_submissions (
  class_id        uuid not null references public.classes (id) on delete cascade,
  user_id         text not null,
  item_key        text not null,
  state           text not null,
  late            boolean not null default false,
  assigned_grade  numeric,
  draft_grade     numeric,
  updated_at      timestamptz not null default now(),
  primary key (class_id, user_id, item_key)
);
alter table public.classroom_submissions enable row level security;

create policy "classroom submissions: teacher only" on public.classroom_submissions
  for all using (private.is_class_teacher(class_id))
  with check (private.is_class_teacher(class_id));

create trigger classroom_submissions_touch before update on public.classroom_submissions
  for each row execute function public.touch_updated_at();

-- So a pull on the teacher's laptop shows up on the projector.
alter publication supabase_realtime add table public.classroom_roster;
alter publication supabase_realtime add table public.classroom_submissions;
