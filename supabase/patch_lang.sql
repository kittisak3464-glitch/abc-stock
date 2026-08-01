-- Patch 2026-08-01: 4 UI languages (en/zh/th/my) + users may change their own lang
alter table public.profiles drop constraint profiles_lang_check;
alter table public.profiles add constraint profiles_lang_check
  check (lang in ('en', 'zh', 'th', 'my'));

-- Users can change ONLY their own language (not role/branch/name)
create or replace function public.set_my_lang(p_lang text) returns void
language plpgsql security definer set search_path = public as
$$
begin
  if p_lang not in ('en', 'zh', 'th', 'my') then
    raise exception 'Unknown language';
  end if;
  update profiles set lang = p_lang where user_id = auth.uid();
end;
$$;
