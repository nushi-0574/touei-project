alter table public.profiles
  add column if not exists is_admin boolean not null default false,
  add column if not exists is_super_admin boolean not null default false;

do $promotion$
declare
  target_user_id uuid;
  updated_rows integer;
begin
  select id
  into target_user_id
  from auth.users
  where lower(btrim(email)) = 'reimari.nusi@gmail.com'
  limit 1;

  if target_user_id is null then
    raise exception 'Supabase Auth user reimari.nusi@gmail.com was not found.';
  end if;

  update public.profiles
  set is_admin = true,
      is_super_admin = true
  where id = target_user_id;

  get diagnostics updated_rows = row_count;
  if updated_rows = 0 then
    raise exception 'Profile not found for the target account. Sign in once to create its profile, then run this SQL again.';
  end if;
end;
$promotion$;

select auth_user.email, profile.is_admin, profile.is_super_admin
from public.profiles as profile
join auth.users as auth_user on auth_user.id = profile.id
where lower(btrim(auth_user.email)) = 'reimari.nusi@gmail.com';
