alter table public.profiles
  add column if not exists police_org_role text not null default '一般'
    check (police_org_role in ('教官', '学生', '一般', '指令'));

create or replace function public.protect_profile_roles()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('postgres', 'service_role', 'supabase_admin') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.id is distinct from auth.uid() then
      raise exception 'Users can only create their own profile';
    end if;
    if coalesce(new.is_admin, false)
      or coalesce(new.is_super_admin, false)
      or coalesce(new.is_police_staff, false)
      or new.police_org_role is distinct from '一般' then
      raise exception 'Profile roles can only be assigned by an administrator';
    end if;
    return new;
  end if;

  if new.is_admin is distinct from old.is_admin
    or new.is_super_admin is distinct from old.is_super_admin
    or new.is_police_staff is distinct from old.is_police_staff
    or new.police_org_role is distinct from old.police_org_role then
    raise exception 'Profile roles can only be changed through an administrator function';
  end if;

  return new;
end;
$$;

create or replace function public.set_profile_roles(
  target_user_id uuid,
  new_is_admin boolean,
  new_is_police_staff boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_is_admin boolean := false;
  caller_is_super_admin boolean := false;
  target_is_admin boolean;
  target_is_super_admin boolean;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required';
  end if;
  if new_is_admin is null or new_is_police_staff is null then
    raise exception 'Role values must be true or false';
  end if;

  select coalesce(profile.is_admin, false), coalesce(profile.is_super_admin, false)
  into caller_is_admin, caller_is_super_admin
  from public.profiles as profile
  where profile.id = auth.uid();
  if not caller_is_admin then
    raise exception 'Administrator access is required';
  end if;

  select coalesce(profile.is_admin, false), coalesce(profile.is_super_admin, false)
  into target_is_admin, target_is_super_admin
  from public.profiles as profile
  where profile.id = target_user_id
  for update;
  if not found then
    raise exception 'Target profile was not found';
  end if;
  if target_is_super_admin then
    raise exception 'The chief administrator role cannot be changed';
  end if;
  if not caller_is_super_admin and new_is_admin is distinct from target_is_admin then
    raise exception 'Only the chief administrator can change administrator access';
  end if;

  update public.profiles
  set is_admin = case when caller_is_super_admin then new_is_admin else is_admin end,
      is_police_staff = new_is_police_staff,
      police_org_role = case when new_is_police_staff then police_org_role else '一般' end
  where id = target_user_id;
end;
$$;

create or replace function public.set_police_organization_role(
  target_user_id uuid,
  new_role text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_is_admin boolean := false;
  target_is_police_staff boolean := false;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required';
  end if;
  if new_role is null or new_role not in ('教官', '学生', '一般', '指令') then
    raise exception 'Invalid police organization role';
  end if;

  select coalesce(profile.is_admin, false)
  into caller_is_admin
  from public.profiles as profile
  where profile.id = auth.uid();
  if not caller_is_admin then
    raise exception 'Administrator access is required';
  end if;

  select coalesce(profile.is_police_staff, false)
  into target_is_police_staff
  from public.profiles as profile
  where profile.id = target_user_id
  for update;
  if not found or not target_is_police_staff then
    raise exception 'Target is not a police staff member';
  end if;

  update public.profiles
  set police_org_role = new_role
  where id = target_user_id;
end;
$$;

revoke all on function public.protect_profile_roles() from public, anon, authenticated;
revoke all on function public.set_profile_roles(uuid, boolean, boolean) from public, anon;
revoke all on function public.set_police_organization_role(uuid, text) from public, anon;
grant execute on function public.set_profile_roles(uuid, boolean, boolean) to authenticated;
grant execute on function public.set_police_organization_role(uuid, text) to authenticated;
