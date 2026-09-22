-- Modern Classroom — initial schema.
--
-- One rule shapes everything here: a student's work is never deleted by
-- anything short of deleting the class itself. Progress is stored per track
-- (not per student) so two people touching the same section never overwrite
-- each other, and renumbering a section moves its rows rather than dropping
-- them.

-- ---------------------------------------------------------------------------
-- profiles — one row per auth user. No email column on purpose: the address
-- lives in auth.users, the client already has it from the session, and the
-- one server-side need (matching invites) is a security-definer function.
-- ---------------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  username    text not null,
  first_name  text not null default '',
  last_name   text not null default '',
  accent      text,
  created_at  timestamptz not null default now()
);
create unique index profiles_username_lower on public.profiles (lower(username));

-- Fills a profile from signup metadata. Usernames follow the app's own scheme
-- (last name + first initial, then a number if taken) so "PatelD" here means
-- what it meant before.
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  fn text := coalesce(new.raw_user_meta_data ->> 'first_name', '');
  ln text := coalesce(new.raw_user_meta_data ->> 'last_name', '');
  base text;
  candidate text;
  n int := 0;
begin
  base := regexp_replace(ln, '[^A-Za-z]', '', 'g') || upper(left(fn, 1));
  if base = '' then
    base := 'user' || left(replace(new.id::text, '-', ''), 6);
  end if;

  candidate := base;
  while exists (select 1 from public.profiles where lower(username) = lower(candidate)) loop
    n := n + 1;
    candidate := base || n::text;
  end loop;

  insert into public.profiles (id, username, first_name, last_name, accent)
  values (new.id, candidate, fn, ln, nullif(new.raw_user_meta_data ->> 'accent', ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- classes
-- ---------------------------------------------------------------------------
create table public.classes (
  id                   uuid primary key default gen_random_uuid(),
  name                 text not null,
  code                 char(6) not null unique,
  teacher_id           uuid not null references public.profiles (id) on delete cascade,
  units                jsonb not null default '[]'::jsonb,
  block_section_id     text,
  color                text,
  icon                 text,
  import_instructions  text,
  -- Bumped on every write to `units`. A curriculum edit and an AI-import apply
  -- can race; the loser is told rather than silently overwritten.
  version              int not null default 1,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index classes_teacher on public.classes (teacher_id);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
create trigger classes_touch before update on public.classes
  for each row execute function public.touch_updated_at();

create table public.enrollments (
  class_id    uuid not null references public.classes (id) on delete cascade,
  student_id  uuid not null references public.profiles (id) on delete cascade,
  joined_at   timestamptz not null default now(),
  primary key (class_id, student_id)
);
create index enrollments_student on public.enrollments (student_id);

create table public.invites (
  id          uuid primary key default gen_random_uuid(),
  class_id    uuid not null references public.classes (id) on delete cascade,
  handle      text not null,
  invited_at  timestamptz not null default now()
);
create index invites_class on public.invites (class_id);

-- ---------------------------------------------------------------------------
-- progress — one row per (student, section, track). A student marking their
-- guided notes and the teacher approving their textbook practice in the same
-- section touch different rows, so neither write can clobber the other.
-- ---------------------------------------------------------------------------
create table public.progress (
  class_id    uuid not null references public.classes (id) on delete cascade,
  student_id  uuid not null references public.profiles (id) on delete cascade,
  section_id  text not null,
  track_id    text not null,
  state       jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now(),
  primary key (class_id, student_id, section_id, track_id)
);
create index progress_class on public.progress (class_id);

create table public.checkpoint_grades (
  class_id       uuid not null references public.classes (id) on delete cascade,
  student_id     uuid not null references public.profiles (id) on delete cascade,
  checkpoint_id  text not null,
  score          numeric not null,
  out_of         numeric not null,
  updated_at     timestamptz not null default now(),
  primary key (class_id, student_id, checkpoint_id)
);

-- When a section is renumbered, a write that was queued offline under the old
-- number can still arrive afterwards. This redirects it.
create table public.section_aliases (
  class_id    uuid not null references public.classes (id) on delete cascade,
  old_id      text not null,
  current_id  text not null,
  primary key (class_id, old_id)
);

-- ---------------------------------------------------------------------------
-- Access helpers. Security definer so a policy never has to evaluate another
-- table's policies to answer — that is what turns RLS recursive and slow.
-- ---------------------------------------------------------------------------
create or replace function public.is_class_teacher(cid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.classes where id = cid and teacher_id = auth.uid());
$$;

create or replace function public.is_enrolled(cid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.enrollments where class_id = cid and student_id = auth.uid());
$$;

-- True when the caller and `uid` sit in at least one class together, in any
-- role. Lets a teacher see the roster's names and a student see the teacher's.
create or replace function public.shares_class_with(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from (
      select class_id from public.enrollments where student_id = auth.uid()
      union
      select id from public.classes where teacher_id = auth.uid()
    ) mine
    join (
      select class_id from public.enrollments where student_id = uid
      union
      select id from public.classes where teacher_id = uid
    ) theirs on theirs.class_id = mine.class_id
  );
$$;

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------
alter table public.profiles          enable row level security;
alter table public.classes           enable row level security;
alter table public.enrollments       enable row level security;
alter table public.invites           enable row level security;
alter table public.progress          enable row level security;
alter table public.checkpoint_grades enable row level security;
alter table public.section_aliases   enable row level security;

create policy "profiles: self or classmates" on public.profiles
  for select using (id = auth.uid() or public.shares_class_with(id));
create policy "profiles: edit self" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

create policy "classes: members read" on public.classes
  for select using (teacher_id = auth.uid() or public.is_enrolled(id));
create policy "classes: teacher writes" on public.classes
  for update using (teacher_id = auth.uid()) with check (teacher_id = auth.uid());
create policy "classes: teacher deletes" on public.classes
  for delete using (teacher_id = auth.uid());
-- Inserts go through create_class(), which mints the code.

create policy "enrollments: own or teacher" on public.enrollments
  for select using (student_id = auth.uid() or public.is_class_teacher(class_id));
create policy "enrollments: leave or remove" on public.enrollments
  for delete using (student_id = auth.uid() or public.is_class_teacher(class_id));
-- Inserts go through join_class() / accept_invites().

create policy "invites: teacher only" on public.invites
  for all using (public.is_class_teacher(class_id)) with check (public.is_class_teacher(class_id));

create policy "progress: own or teacher" on public.progress
  for select using (student_id = auth.uid() or public.is_class_teacher(class_id));
-- Writes go through upsert_track_progress(), which redirects renumbered ids.

create policy "grades: own or teacher" on public.checkpoint_grades
  for select using (student_id = auth.uid() or public.is_class_teacher(class_id));
-- Writes go through set_checkpoint_grade().

create policy "aliases: members read" on public.section_aliases
  for select using (public.is_class_teacher(class_id) or public.is_enrolled(class_id));

-- ---------------------------------------------------------------------------
-- RPCs. All security definer, all refuse anonymous callers.
-- ---------------------------------------------------------------------------

create or replace function public.create_class(
  p_name text,
  p_units jsonb,
  p_block_section_id text default null,
  p_color text default null,
  p_icon text default null
) returns public.classes
language plpgsql security definer set search_path = public as $$
declare
  c public.classes;
  candidate char(6);
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;

  loop
    candidate := lpad(floor(random() * 1000000)::int::text, 6, '0');
    exit when not exists (select 1 from public.classes where code = candidate);
  end loop;

  insert into public.classes (name, code, teacher_id, units, block_section_id, color, icon)
  values (p_name, candidate, auth.uid(), coalesce(p_units, '[]'::jsonb), p_block_section_id, p_color, p_icon)
  returning * into c;
  return c;
end;
$$;

create or replace function public.join_class(p_code text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  cid uuid;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;

  select id into cid from public.classes where code = regexp_replace(p_code, '\D', '', 'g');
  if cid is null then raise exception 'No class has that code'; end if;

  insert into public.enrollments (class_id, student_id) values (cid, auth.uid())
  on conflict do nothing;
  return cid;
end;
$$;

-- Turns invites addressed to the caller (by email or username) into seats.
create or replace function public.accept_invites()
returns int
language plpgsql security definer set search_path = public as $$
declare
  my_email text;
  my_username text;
  n int;
begin
  if auth.uid() is null then return 0; end if;

  select lower(email) into my_email from auth.users where id = auth.uid();
  select lower(username) into my_username from public.profiles where id = auth.uid();

  with matched as (
    delete from public.invites
    where lower(handle) in (my_email, my_username)
    returning class_id
  ), seated as (
    insert into public.enrollments (class_id, student_id)
    select distinct class_id, auth.uid() from matched
    on conflict do nothing
    returning 1
  )
  select count(*) into n from seated;
  return n;
end;
$$;

-- Follows renumberings so a write queued under an old section id still lands.
create or replace function public.resolve_section_id(p_class_id uuid, p_section_id text)
returns text
language plpgsql stable security definer set search_path = public as $$
declare
  cur text := p_section_id;
  nxt text;
  hops int := 0;
begin
  loop
    select current_id into nxt from public.section_aliases
      where class_id = p_class_id and old_id = cur;
    exit when nxt is null or hops >= 10;
    cur := nxt;
    hops := hops + 1;
  end loop;
  return cur;
end;
$$;

-- Many rows in one call: [{student_id, section_id, track_id, state}, ...].
-- A student may only write their own rows; a teacher may write any row of
-- their class. Later arrival wins — there are no client clocks to trust.
create or replace function public.upsert_track_progress(p_class_id uuid, p_rows jsonb)
returns int
language plpgsql security definer set search_path = public as $$
declare
  r jsonb;
  sid uuid;
  teacher boolean;
  n int := 0;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  teacher := public.is_class_teacher(p_class_id);

  for r in select * from jsonb_array_elements(p_rows) loop
    sid := (r ->> 'student_id')::uuid;
    if not teacher then
      if sid <> auth.uid() or not public.is_enrolled(p_class_id) then
        raise exception 'not allowed';
      end if;
    end if;

    insert into public.progress (class_id, student_id, section_id, track_id, state, updated_at)
    values (
      p_class_id, sid,
      public.resolve_section_id(p_class_id, r ->> 'section_id'),
      r ->> 'track_id',
      coalesce(r -> 'state', '{}'::jsonb),
      now()
    )
    on conflict (class_id, student_id, section_id, track_id)
      do update set state = excluded.state, updated_at = now();
    n := n + 1;
  end loop;
  return n;
end;
$$;

create or replace function public.set_checkpoint_grade(
  p_class_id uuid, p_student_id uuid, p_checkpoint_id text, p_score numeric, p_out_of numeric
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_class_teacher(p_class_id) then raise exception 'not allowed'; end if;

  if p_score is null then
    delete from public.checkpoint_grades
      where class_id = p_class_id and student_id = p_student_id and checkpoint_id = p_checkpoint_id;
  else
    insert into public.checkpoint_grades (class_id, student_id, checkpoint_id, score, out_of, updated_at)
    values (p_class_id, p_student_id, p_checkpoint_id, p_score, p_out_of, now())
    on conflict (class_id, student_id, checkpoint_id)
      do update set score = excluded.score, out_of = excluded.out_of, updated_at = now();
  end if;
end;
$$;

-- Writes a curriculum in one transaction. `p_remaps` is [{from, to}, ...]:
-- a section that was renumbered has its progress rows moved, the gate
-- follows, and an alias is recorded for writes still in flight. Nothing is
-- ever deleted from progress — a removed section leaves its rows behind,
-- invisible but intact, so bringing the section back brings the work back.
create or replace function public.apply_curriculum(
  p_class_id uuid, p_expected_version int, p_units jsonb, p_remaps jsonb default '[]'::jsonb
) returns int
language plpgsql security definer set search_path = public as $$
declare
  current_version int;
  r jsonb;
  f text;
  t text;
begin
  if not public.is_class_teacher(p_class_id) then raise exception 'not allowed'; end if;

  select version into current_version from public.classes where id = p_class_id for update;
  if current_version <> p_expected_version then
    raise exception 'stale' using errcode = 'P0002';
  end if;

  for r in select * from jsonb_array_elements(coalesce(p_remaps, '[]'::jsonb)) loop
    f := r ->> 'from';
    t := r ->> 'to';
    if f is null or t is null or f = t then continue; end if;

    update public.progress set section_id = t
      where class_id = p_class_id and section_id = f;
    update public.classes set block_section_id = t
      where id = p_class_id and block_section_id = f;

    -- Old aliases that pointed at `f` now point at `t`, then `f` itself.
    update public.section_aliases set current_id = t
      where class_id = p_class_id and current_id = f;
    insert into public.section_aliases (class_id, old_id, current_id) values (p_class_id, f, t)
      on conflict (class_id, old_id) do update set current_id = excluded.current_id;
    delete from public.section_aliases where class_id = p_class_id and old_id = t;
  end loop;

  update public.classes
    set units = p_units, version = version + 1
    where id = p_class_id;
  return current_version + 1;
end;
$$;

-- Dashboard rows for the caller: every class they teach or sit in, with the
-- counts a student is not otherwise allowed to compute.
create or replace function public.class_summaries()
returns table (
  id uuid, name text, code char(6), role text, color text, icon text,
  student_count bigint, subunit_count int
)
language sql stable security definer set search_path = public as $$
  with mine as (
    select c.*, 'teacher'::text as role from public.classes c where c.teacher_id = auth.uid()
    union all
    select c.*, 'student'::text from public.classes c
      join public.enrollments e on e.class_id = c.id and e.student_id = auth.uid()
  )
  select
    m.id, m.name, m.code, m.role, m.color, m.icon,
    (select count(*) from public.enrollments e where e.class_id = m.id and e.student_id <> m.teacher_id),
    (select coalesce(sum(jsonb_array_length(u -> 'subunits')), 0)::int
       from jsonb_array_elements(m.units) u)
  from mine m
  order by m.created_at;
$$;

-- Lock the RPCs to signed-in users.
revoke execute on all functions in schema public from anon, public;
grant execute on function
  public.create_class(text, jsonb, text, text, text),
  public.join_class(text),
  public.accept_invites(),
  public.upsert_track_progress(uuid, jsonb),
  public.set_checkpoint_grade(uuid, uuid, text, numeric, numeric),
  public.apply_curriculum(uuid, int, jsonb, jsonb),
  public.class_summaries(),
  public.is_class_teacher(uuid),
  public.is_enrolled(uuid),
  public.shares_class_with(uuid)
to authenticated;
