-- The client mints class ids, so a class created offline has an id to hang
-- everything else on before the server has heard of it.
drop function public.create_class(text, jsonb, text, text, text);
create or replace function public.create_class(
  p_id uuid,
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

  insert into public.classes (id, name, code, teacher_id, units, block_section_id, color, icon)
  values (coalesce(p_id, gen_random_uuid()), p_name, candidate, auth.uid(),
          coalesce(p_units, '[]'::jsonb), p_block_section_id, p_color, p_icon)
  on conflict (id) do nothing
  returning * into c;
  if c.id is null then
    select * into c from public.classes where id = p_id;
  end if;
  return c;
end;
$$;
grant execute on function public.create_class(uuid, text, jsonb, text, text, text) to authenticated;

-- A null expected version means "no check" — the curriculum editor's ordinary
-- saves are last-write-wins. The AI import passes the version it reviewed.
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
  if p_expected_version is not null and current_version <> p_expected_version then
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

-- Inviting someone who already has an account seats them at once; anyone
-- else is held as an invite until they sign up. The lookup happens here so
-- the client never needs to search accounts by email.
create or replace function public.invite_to_class(p_class_id uuid, p_handle text)
returns text
language plpgsql security definer set search_path = public as $$
declare
  h text := lower(trim(p_handle));
  uid uuid;
  teacher uuid;
begin
  if not public.is_class_teacher(p_class_id) then raise exception 'not allowed'; end if;
  if h = '' then raise exception 'Email or username required'; end if;

  select teacher_id into teacher from public.classes where id = p_class_id;

  select u.id into uid from auth.users u where lower(u.email) = h;
  if uid is null then
    select p.id into uid from public.profiles p where lower(p.username) = h;
  end if;

  if uid is not null then
    if uid = teacher then raise exception 'The class teacher cannot be added as a student'; end if;
    insert into public.enrollments (class_id, student_id) values (p_class_id, uid)
      on conflict do nothing;
    return 'enrolled';
  end if;

  if not exists (select 1 from public.invites where class_id = p_class_id and lower(handle) = h) then
    insert into public.invites (class_id, handle) values (p_class_id, trim(p_handle));
  end if;
  return 'invited';
end;
$$;
grant execute on function public.invite_to_class(uuid, text) to authenticated;
