alter table public.profiles
  add column if not exists is_super_admin boolean not null default false,
  add column if not exists is_police_staff boolean not null default false;

alter table public.site_settings
  add column if not exists command_system_url text;

update public.profiles
set is_admin = true,
    is_super_admin = true
where lower(email) = 'reimari.nusi@gmail.com';

create or replace function public.protect_profile_roles()
returns trigger
language plpgsql
set search_path = public, auth
as $$
begin
  if current_user in ('postgres', 'service_role', 'supabase_admin') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.id is distinct from auth.uid() then
      raise exception 'Users can only create their own profile';
    end if;

    if lower(coalesce(auth.jwt() ->> 'email', '')) = 'reimari.nusi@gmail.com' then
      new.is_admin := true;
      new.is_super_admin := true;
    elsif coalesce(new.is_admin, false)
      or coalesce(new.is_super_admin, false)
      or coalesce(new.is_police_staff, false) then
      raise exception 'Profile roles can only be assigned by an administrator';
    end if;

    return new;
  end if;

  if new.is_admin is distinct from old.is_admin
    or new.is_super_admin is distinct from old.is_super_admin
    or new.is_police_staff is distinct from old.is_police_staff then
    raise exception 'Profile roles can only be changed through the administrator function';
  end if;

  return new;
end;
$$;

drop trigger if exists protect_profile_roles on public.profiles;
create trigger protect_profile_roles
before insert or update on public.profiles
for each row execute function public.protect_profile_roles();

create or replace function public.set_profile_roles(
  target_user_id uuid,
  new_is_admin boolean,
  new_is_police_staff boolean
)
returns void
language plpgsql
security definer
set search_path = public, auth
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

  select coalesce(is_admin, false), coalesce(is_super_admin, false)
  into caller_is_admin, caller_is_super_admin
  from public.profiles
  where id = auth.uid();

  caller_is_admin := coalesce(caller_is_admin, false);
  caller_is_super_admin := coalesce(caller_is_super_admin, false);
  caller_is_super_admin := caller_is_super_admin
    or lower(coalesce(auth.jwt() ->> 'email', '')) = 'reimari.nusi@gmail.com';
  caller_is_admin := caller_is_admin or caller_is_super_admin;

  if not caller_is_admin then
    raise exception 'Administrator access is required';
  end if;

  select coalesce(is_admin, false), coalesce(is_super_admin, false)
  into target_is_admin, target_is_super_admin
  from public.profiles
  where id = target_user_id
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
      is_police_staff = new_is_police_staff
  where id = target_user_id;
end;
$$;

revoke all on function public.protect_profile_roles() from public, anon, authenticated;
revoke all on function public.set_profile_roles(uuid, boolean, boolean) from public, anon;
grant execute on function public.set_profile_roles(uuid, boolean, boolean) to authenticated;
