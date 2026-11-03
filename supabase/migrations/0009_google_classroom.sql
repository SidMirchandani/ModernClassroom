-- The Google Classroom connection (docs/Classroom-Connect.md, M2).
--
-- Three things are stored:
--
--   google_connections  one teacher's Google grant. The refresh token is the
--                       keys to her Classroom, so this table has RLS on and NO
--                       policies: no signed-in caller can read or write it.
--                       Only the server, with the service-role key, touches it
--                       (ADR in docs/adapt/adapt-05-test.md: "server-only").
--
--   classes.classroom_* which Google Classroom course a class posts into, and
--                       the posting rule the teacher picked.
--
--   classroom_links     curriculum item -> the Classroom item made for it.
--                       The API can only edit items this app created, so the
--                       link is the only way back to one (ADR-007).

create table public.google_connections (
  user_id        uuid primary key references public.profiles (id) on delete cascade,
  google_email   text,
  refresh_token  text not null,
  scopes         text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
alter table public.google_connections enable row level security;
revoke all on public.google_connections from anon, authenticated;

create trigger google_connections_touch before update on public.google_connections
  for each row execute function public.touch_updated_at();

alter table public.classes
  add column classroom_course_id text,
  add column posting_rule text not null default 'lesson_day'
    check (posting_rule in ('lesson_day', 'unit_start', 'manual'));

-- item_key is stable across re-imports because the ids it is built from are:
-- "unit:<unit id>", "learn:<track id>", "practice:<track id>", "checkpoint:<id>".
create table public.classroom_links (
  class_id       uuid not null references public.classes (id) on delete cascade,
  item_key       text not null,
  kind           text not null check (kind in ('topic', 'material', 'assignment')),
  course_id      text not null,
  classroom_id   text not null,
  -- What we last told Classroom: DRAFT, SCHEDULED or PUBLISHED. GONE when the
  -- teacher deleted it in Classroom — Classroom wins, so it is not recreated.
  state          text not null check (state in ('DRAFT', 'SCHEDULED', 'PUBLISHED', 'GONE')),
  scheduled_for  timestamptz,
  updated_at     timestamptz not null default now(),
  primary key (class_id, item_key)
);
alter table public.classroom_links enable row level security;

create policy "classroom links: teacher only" on public.classroom_links
  for all using (private.is_class_teacher(class_id))
  with check (private.is_class_teacher(class_id));

create trigger classroom_links_touch before update on public.classroom_links
  for each row execute function public.touch_updated_at();
