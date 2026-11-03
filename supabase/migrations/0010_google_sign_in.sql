-- "Continue with Google": a Google sign-up has no first_name / last_name in
-- its metadata — Google sends given_name / family_name, or only a full name.
-- Fall back through those so a Google account gets a real name and a
-- username by the usual scheme (last name + first initial), not "user1a2b3c".
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  full_name text := trim(coalesce(meta ->> 'full_name', meta ->> 'name', ''));
  fn text := coalesce(
    nullif(meta ->> 'first_name', ''),
    nullif(meta ->> 'given_name', ''),
    split_part(full_name, ' ', 1)
  );
  ln text := coalesce(
    nullif(meta ->> 'last_name', ''),
    nullif(meta ->> 'family_name', ''),
    nullif(trim(substr(full_name, length(split_part(full_name, ' ', 1)) + 1)), ''),
    ''
  );
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
  values (new.id, candidate, fn, ln, nullif(meta ->> 'accent', ''));
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from authenticated;
