-- Pin the trigger's search path, and keep internal helpers internal.
create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Only ever called from inside other definer functions / triggers.
revoke execute on function public.resolve_section_id(uuid, text) from authenticated;
revoke execute on function public.handle_new_user() from authenticated;
