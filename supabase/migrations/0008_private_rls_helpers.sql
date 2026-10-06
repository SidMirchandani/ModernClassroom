-- Move the RLS helpers out of the exposed API schema.
--
-- is_class_teacher, is_enrolled and shares_class_with exist to answer one
-- question inside a policy: may this caller see this row? Policies run as the
-- caller, so the caller must be able to execute them — but anything a signed-in
-- user can execute in `public` is also published by PostgREST at
-- /rest/v1/rpc/<name>. That made shares_class_with(uid) a probe: any signed-in
-- user could ask whether they share a class with an arbitrary account.
--
-- `private` is not an exposed schema, so the functions keep working inside
-- policies while ceasing to exist as endpoints.
--
-- Verified when applied: every role saw exactly the same rows before and after
-- (teacher, enrolled student, outsider); all four RPCs still ran for the right
-- caller and still refused an outsider; the three endpoints went from HTTP 200
-- to 404; and the security advisor dropped from 12 findings to 9.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create or replace function private.is_class_teacher(cid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.classes where id = cid and teacher_id = auth.uid());
$$;

create or replace function private.is_enrolled(cid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.enrollments where class_id = cid and student_id = auth.uid());
$$;

create or replace function private.shares_class_with(uid uuid)
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

revoke all on function
  private.is_class_teacher(uuid), private.is_enrolled(uuid), private.shares_class_with(uuid)
from public;
grant execute on function
  private.is_class_teacher(uuid), private.is_enrolled(uuid), private.shares_class_with(uuid)
to authenticated;

-- Re-point every policy that used them. Same expressions, new schema.
drop policy "grades: own or teacher" on public.checkpoint_grades;
create policy "grades: own or teacher" on public.checkpoint_grades
  for select using (student_id = auth.uid() or private.is_class_teacher(class_id));

drop policy "classes: members read" on public.classes;
create policy "classes: members read" on public.classes
  for select using (teacher_id = auth.uid() or private.is_enrolled(id));

drop policy "enrollments: leave or remove" on public.enrollments;
create policy "enrollments: leave or remove" on public.enrollments
  for delete using (student_id = auth.uid() or private.is_class_teacher(class_id));

drop policy "enrollments: own or teacher" on public.enrollments;
create policy "enrollments: own or teacher" on public.enrollments
  for select using (student_id = auth.uid() or private.is_class_teacher(class_id));

drop policy "invites: teacher only" on public.invites;
create policy "invites: teacher only" on public.invites
  for all using (private.is_class_teacher(class_id))
  with check (private.is_class_teacher(class_id));

drop policy "profiles: self or classmates" on public.profiles;
create policy "profiles: self or classmates" on public.profiles
  for select using (id = auth.uid() or private.shares_class_with(id));

drop policy "progress: own or teacher" on public.progress;
create policy "progress: own or teacher" on public.progress
  for select using (student_id = auth.uid() or private.is_class_teacher(class_id));

drop policy "aliases: members read" on public.section_aliases;
create policy "aliases: members read" on public.section_aliases
  for select using (private.is_class_teacher(class_id) or private.is_enrolled(class_id));

-- The four RPCs call the helpers by qualified name. Rewrite their live
-- definitions rather than retyping them, so nothing drifts from what is
-- actually deployed. plpgsql bodies are NOT dependency-tracked — a bare,
-- unqualified reference would survive the drop below and fail only when a
-- student next clicked something — which is why every reference was checked
-- to be qualified before this was written.
do $$
declare
  r record;
  def text;
begin
  for r in
    select p.oid
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('apply_curriculum', 'invite_to_class',
                        'set_checkpoint_grade', 'upsert_track_progress')
  loop
    def := pg_get_functiondef(r.oid);
    def := regexp_replace(def, 'public\.(is_class_teacher|is_enrolled)\(', 'private.\1(', 'g');
    execute def;
  end loop;
end $$;

-- Last, and deliberately last: policies DO track dependencies, so if any were
-- missed above these drops fail and the whole migration rolls back.
drop function public.is_class_teacher(uuid);
drop function public.is_enrolled(uuid);
drop function public.shares_class_with(uuid);
