-- Toei Project: consolidated, repeatable Supabase setup.
-- Run in Supabase SQL Editor using a project owner/admin role.
-- Requires the original portal schema tables: profiles, site_settings,
-- custom_pages, police_exam_results, related service tables, and Supabase auth/storage.
-- Existing exact-name policies are replaced; supported IF NOT EXISTS objects are skipped.
-- Changes run in one transaction and roll back if any statement fails.
-- This script does not create missing legacy core tables; see README for prerequisites.

BEGIN;

DO $preflight$
DECLARE
  missing_tables text;
BEGIN
  SELECT string_agg(required.table_name, ', ' ORDER BY required.table_name)
  INTO missing_tables
  FROM (VALUES
    ('public.profiles'),
    ('public.site_settings'),
    ('public.custom_pages'),
    ('public.police_exam_results')
  ) AS required(table_name)
  WHERE to_regclass(required.table_name) IS NULL;

  IF missing_tables IS NOT NULL THEN
    RAISE EXCEPTION 'Missing required legacy portal tables: %. Restore/create the original portal schema first; no setup changes were applied.', missing_tables;
  END IF;
END;
$preflight$;

-- -----------------------------------------------------------------------------
-- 20261106000000_lookup_police_exam_result.sql
-- -----------------------------------------------------------------------------
alter table public.police_exam_results
  add column if not exists name text not null default '',
  add column if not exists exam_name text not null default '';

create or replace function public.lookup_police_exam_result(
  p_exam_number text,
  p_birth_date text
)
returns table (
  exam_number text,
  name text,
  exam_name text,
  result text
)
language sql
stable
security definer
set search_path = ''
as $function$
  select
    result_row.exam_number::text,
    result_row.name::text,
    result_row.exam_name::text,
    result_row.result::text
  from public.police_exam_results as result_row
  where translate(trim(result_row.exam_number::text), '０１２３４５６７８９　- ', '0123456789') = translate(trim(p_exam_number), '０１２３４５６７８９　- ', '0123456789')
    and result_row.birth_date::text = trim(p_birth_date)
  limit 1;
$function$;

revoke all on function public.lookup_police_exam_result(text, text) from public;
grant execute on function public.lookup_police_exam_result(text, text) to anon, authenticated;

revoke select on table public.police_exam_results from public, anon;


-- -----------------------------------------------------------------------------
-- 20261106010000_police_roles_command_system.sql
-- -----------------------------------------------------------------------------
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


-- -----------------------------------------------------------------------------
-- 20261106020000_custom_pages_metadata.sql
-- -----------------------------------------------------------------------------
alter table public.custom_pages
  add column if not exists description text not null default '',
  add column if not exists keywords text not null default '',
  add column if not exists category text not null default '一般案内',
  add column if not exists is_published boolean not null default true,
  add column if not exists display_order integer not null default 0,
  add column if not exists updated_at timestamptz not null default now();


-- -----------------------------------------------------------------------------
-- 20261106030000_promote_chief_administrator.sql
-- -----------------------------------------------------------------------------
alter table public.profiles
  add column if not exists is_admin boolean not null default false,
  add column if not exists is_super_admin boolean not null default false;

do $promotion$
declare
  target_user_id uuid;
begin
  select id into target_user_id
  from auth.users
  where lower(btrim(email)) = 'reimari.nusi@gmail.com'
  limit 1;

  if target_user_id is null then
    raise notice 'Chief administrator account is not present; promotion skipped.';
  else
    update public.profiles
    set is_admin = true, is_super_admin = true
    where id = target_user_id;
    if not found then
      raise notice 'Chief administrator profile is missing; promotion skipped. Sign in/create the profile, then rerun this script.';
    end if;
  end if;
end;
$promotion$;

select auth_user.email, profile.is_admin, profile.is_super_admin
from public.profiles as profile
join auth.users as auth_user on auth_user.id = profile.id
where lower(btrim(auth_user.email)) = 'reimari.nusi@gmail.com';


-- -----------------------------------------------------------------------------
-- 20261107000000_billing_subscriptions.sql
-- -----------------------------------------------------------------------------
create table if not exists public.billing_subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text not null,
  stripe_subscription_id text not null unique,
  status text not null,
  price_id text,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.billing_subscriptions enable row level security;

revoke all on table public.billing_subscriptions from public, anon, authenticated;
grant select on table public.billing_subscriptions to authenticated;
grant all on table public.billing_subscriptions to service_role;

drop policy if exists "Users can read their own billing subscription" on public.billing_subscriptions;
create policy "Users can read their own billing subscription"
  on public.billing_subscriptions
  for select
  to authenticated
  using (auth.uid() = user_id);


-- -----------------------------------------------------------------------------
-- 20261107000100_resident_services.sql
-- -----------------------------------------------------------------------------
alter table public.profiles
  add column if not exists resident_status text not null default 'active'
    check (resident_status in ('active', 'inactive', 'pending')),
  add column if not exists preferred_locale text not null default 'ja'
    check (preferred_locale in ('ja', 'en', 'zh-CN', 'ko'));

alter table public.custom_pages
  add column if not exists translations jsonb not null default '{}'::jsonb;

create table if not exists public.staff_permissions (
  user_id uuid not null references auth.users(id) on delete cascade,
  permission text not null check (permission in (
    'manage_residents',
    'manage_applications',
    'manage_events',
    'moderate_community',
    'manage_support',
    'manage_map',
    'manage_recruitment',
    'send_notifications',
    'manage_staff'
  )),
  assigned_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (user_id, permission)
);

create or replace function public.is_portal_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and is_admin is true
  );
$$;

create or replace function public.has_staff_permission(required_permission text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_portal_admin() or exists (
    select 1
    from public.staff_permissions
    where user_id = (select auth.uid())
      and permission = required_permission
  );
$$;

create or replace function public.is_active_resident()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and resident_status = 'active'
  );
$$;

revoke all on function public.is_portal_admin() from public, anon;
revoke all on function public.has_staff_permission(text) from public, anon;
revoke all on function public.is_active_resident() from public, anon;
grant execute on function public.is_portal_admin() to authenticated, service_role;
grant execute on function public.has_staff_permission(text) to authenticated, service_role;
grant execute on function public.is_active_resident() to authenticated, service_role;

alter table public.staff_permissions enable row level security;
drop policy if exists "Users can read their own staff permissions" on public.staff_permissions;
create policy "Users can read their own staff permissions"
  on public.staff_permissions for select to authenticated
  using (user_id = (select auth.uid()) or public.has_staff_permission('manage_staff'));
drop policy if exists "Chief administrators manage staff permissions" on public.staff_permissions;
create policy "Chief administrators manage staff permissions"
  on public.staff_permissions for all to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and is_super_admin is true
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and is_super_admin is true
    )
  );
grant select on public.staff_permissions to authenticated;
grant all on public.staff_permissions to service_role;

create table if not exists public.service_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  application_type text not null check (application_type in ('resident_service', 'permit', 'other')),
  subject text not null check (char_length(subject) between 1 and 200),
  details jsonb not null default '{}'::jsonb,
  status text not null default 'submitted'
    check (status in ('submitted', 'reviewing', 'needs_information', 'approved', 'rejected', 'withdrawn')),
  staff_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.service_applications enable row level security;
drop policy if exists "Residents read and submit their applications" on public.service_applications;
create policy "Residents read and submit their applications"
  on public.service_applications for select to authenticated
  using (
    (user_id = (select auth.uid()) and public.is_active_resident())
    or public.has_staff_permission('manage_applications')
  );
drop policy if exists "Residents submit applications" on public.service_applications;
create policy "Residents submit applications"
  on public.service_applications for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and public.is_active_resident()
    and status = 'submitted'
    and staff_note is null
  );
drop policy if exists "Residents withdraw and staff process applications" on public.service_applications;
create policy "Residents withdraw and staff process applications"
  on public.service_applications for update to authenticated
  using (
    (user_id = (select auth.uid()) and public.is_active_resident() and status in ('submitted', 'needs_information'))
    or public.has_staff_permission('manage_applications')
  )
  with check (
    (user_id = (select auth.uid()) and public.is_active_resident() and status = 'withdrawn')
    or public.has_staff_permission('manage_applications')
  );
grant select, insert, update on public.service_applications to authenticated;
grant all on public.service_applications to service_role;

create or replace function public.protect_service_application()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('postgres', 'service_role', 'supabase_admin')
    or public.has_staff_permission('manage_applications') then
    return new;
  end if;
  if new.user_id is distinct from old.user_id
    or new.application_type is distinct from old.application_type
    or new.subject is distinct from old.subject
    or new.details is distinct from old.details
    or new.staff_note is distinct from old.staff_note
    or new.created_at is distinct from old.created_at
    or new.status <> 'withdrawn'
    or old.status not in ('submitted', 'needs_information') then
    raise exception 'Residents can only withdraw an open application';
  end if;
  return new;
end;
$$;
drop trigger if exists protect_service_application_update on public.service_applications;
create trigger protect_service_application_update
before update on public.service_applications
for each row execute function public.protect_service_application();

create table if not exists public.resident_cards (
  user_id uuid primary key references auth.users(id) on delete cascade,
  verification_token uuid not null unique default gen_random_uuid(),
  issued_at timestamptz not null default now(),
  revoked_at timestamptz
);
alter table public.resident_cards enable row level security;
drop policy if exists "Residents and authorized staff read resident cards" on public.resident_cards;
create policy "Residents and authorized staff read resident cards"
  on public.resident_cards for select to authenticated
  using (
    (user_id = (select auth.uid()) and public.is_active_resident())
    or public.has_staff_permission('manage_residents')
  );
grant select on public.resident_cards to authenticated;
grant all on public.resident_cards to service_role;

create or replace function public.protect_resident_status()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('postgres', 'service_role', 'supabase_admin') then
    return new;
  end if;
  if tg_op = 'INSERT' and new.resident_status <> 'active' then
    raise exception 'Resident status can only be assigned by authorized staff';
  end if;
  if tg_op = 'UPDATE' and new.resident_status is distinct from old.resident_status then
    raise exception 'Resident status can only be changed by authorized staff';
  end if;
  return new;
end;
$$;
drop trigger if exists protect_resident_status on public.profiles;
create trigger protect_resident_status
before insert or update on public.profiles
for each row execute function public.protect_resident_status();

create or replace function public.issue_resident_card()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.resident_cards (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;
drop trigger if exists issue_resident_card_after_profile_insert on public.profiles;
create trigger issue_resident_card_after_profile_insert
after insert on public.profiles
for each row execute function public.issue_resident_card();
insert into public.resident_cards (user_id)
select id from public.profiles
on conflict (user_id) do nothing;

create or replace function public.verify_resident_card(card_token uuid)
returns table (resident_name text, resident_status text, issued_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select p.full_name::text, p.resident_status::text, c.issued_at
  from public.resident_cards c
  join public.profiles p on p.id = c.user_id
  where c.verification_token = card_token
    and c.revoked_at is null
    and p.resident_status = 'active'
  limit 1;
$$;
revoke all on function public.verify_resident_card(uuid) from public;
grant execute on function public.verify_resident_card(uuid) to anon, authenticated;

create table if not exists public.resident_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null default 'service',
  title text not null check (char_length(title) between 1 and 200),
  body text not null check (char_length(body) between 1 and 5000),
  href text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.resident_notifications enable row level security;
drop policy if exists "Residents read and update their own notifications" on public.resident_notifications;
create policy "Residents read and update their own notifications"
  on public.resident_notifications for select to authenticated
  using (user_id = (select auth.uid()) and public.is_active_resident());
drop policy if exists "Residents mark their own notifications read" on public.resident_notifications;
create policy "Residents mark their own notifications read"
  on public.resident_notifications for update to authenticated
  using (user_id = (select auth.uid()) and public.is_active_resident())
  with check (user_id = (select auth.uid()) and public.is_active_resident());
drop policy if exists "Authorized staff send notifications" on public.resident_notifications;
create policy "Authorized staff send notifications"
  on public.resident_notifications for insert to authenticated
  with check (public.has_staff_permission('send_notifications'));
grant select, update, insert on public.resident_notifications to authenticated;
grant all on public.resident_notifications to service_role;

create or replace function public.protect_resident_notification()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.user_id is distinct from old.user_id
    or new.category is distinct from old.category
    or new.title is distinct from old.title
    or new.body is distinct from old.body
    or new.href is distinct from old.href
    or new.created_at is distinct from old.created_at then
    raise exception 'Residents can only update notification read status';
  end if;
  return new;
end;
$$;
drop trigger if exists protect_resident_notification_update on public.resident_notifications;
create trigger protect_resident_notification_update
before update on public.resident_notifications
for each row execute function public.protect_resident_notification();

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 200),
  description text not null default '',
  location text not null default '',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  capacity integer check (capacity is null or capacity > 0),
  status text not null default 'draft' check (status in ('draft', 'published', 'cancelled')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
alter table public.events enable row level security;
drop policy if exists "Residents read published events" on public.events;
create policy "Residents read published events"
  on public.events for select to authenticated
  using (
    (status = 'published' and public.is_active_resident())
    or public.has_staff_permission('manage_events')
  );
drop policy if exists "Authorized staff manage events" on public.events;
create policy "Authorized staff manage events"
  on public.events for all to authenticated
  using (public.has_staff_permission('manage_events'))
  with check (public.has_staff_permission('manage_events'));
grant select, insert, update, delete on public.events to authenticated;
grant all on public.events to service_role;

create table if not exists public.event_registrations (
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'registered' check (status in ('registered', 'cancelled', 'attended')),
  registered_at timestamptz not null default now(),
  primary key (event_id, user_id)
);
alter table public.event_registrations enable row level security;
drop policy if exists "Residents and event staff read registrations" on public.event_registrations;
create policy "Residents and event staff read registrations"
  on public.event_registrations for select to authenticated
  using (
    (user_id = (select auth.uid()) and public.is_active_resident())
    or public.has_staff_permission('manage_events')
  );
drop policy if exists "Residents register for published events" on public.event_registrations;
create policy "Residents register for published events"
  on public.event_registrations for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and public.is_active_resident()
    and status = 'registered'
    and exists (
      select 1 from public.events
      where id = event_id and status = 'published' and starts_at > now()
    )
  );
drop policy if exists "Residents cancel their registration" on public.event_registrations;
create policy "Residents cancel their registration"
  on public.event_registrations for update to authenticated
  using (
    (user_id = (select auth.uid()) and public.is_active_resident())
    or public.has_staff_permission('manage_events')
  )
  with check (
    public.has_staff_permission('manage_events')
    or (user_id = (select auth.uid()) and public.is_active_resident() and status = 'cancelled')
  );
grant select, insert, update on public.event_registrations to authenticated;
grant all on public.event_registrations to service_role;

create or replace function public.enforce_event_capacity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_capacity integer;
  current_registrations integer;
begin
  if new.status <> 'registered' then
    return new;
  end if;

  select capacity into event_capacity
  from public.events
  where id = new.event_id and status = 'published' and starts_at > now()
  for update;
  if not found then
    raise exception 'Event registration is closed';
  end if;
  if event_capacity is not null then
    select count(*) into current_registrations
    from public.event_registrations
    where event_id = new.event_id
      and status = 'registered'
      and user_id <> new.user_id;
    if current_registrations >= event_capacity then
      raise exception 'Event is full';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists enforce_event_capacity_before_write on public.event_registrations;
create trigger enforce_event_capacity_before_write
before insert or update on public.event_registrations
for each row execute function public.enforce_event_capacity();

create or replace function public.protect_event_registration()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    return new;
  end if;
  if public.has_staff_permission('manage_events')
    or current_user in ('postgres', 'service_role', 'supabase_admin') then
    return new;
  end if;
  if new.event_id is distinct from old.event_id
    or new.user_id is distinct from old.user_id
    or new.registered_at is distinct from old.registered_at
    or old.status <> 'registered'
    or new.status <> 'cancelled' then
    raise exception 'Residents can only cancel their own event registration';
  end if;
  return new;
end;
$$;
drop trigger if exists protect_event_registration_update on public.event_registrations;
create trigger protect_event_registration_update
before update on public.event_registrations
for each row execute function public.protect_event_registration();

create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  body text not null check (char_length(body) between 1 and 10000),
  status text not null default 'pending' check (status in ('pending', 'published', 'hidden')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.community_posts enable row level security;
drop policy if exists "Residents read published posts and their own" on public.community_posts;
create policy "Residents read published posts and their own"
  on public.community_posts for select to authenticated
  using (
    ((status = 'published' or user_id = (select auth.uid())) and public.is_active_resident())
    or public.has_staff_permission('moderate_community')
  );
drop policy if exists "Residents submit posts for moderation" on public.community_posts;
create policy "Residents submit posts for moderation"
  on public.community_posts for insert to authenticated
  with check (user_id = (select auth.uid()) and public.is_active_resident() and status = 'pending');
drop policy if exists "Authors edit pending posts and moderators" on public.community_posts;
create policy "Authors edit pending posts and moderators"
  on public.community_posts for update to authenticated
  using (
    (user_id = (select auth.uid()) and public.is_active_resident() and status = 'pending')
    or public.has_staff_permission('moderate_community')
  )
  with check (
    (user_id = (select auth.uid()) and public.is_active_resident() and status = 'pending')
    or public.has_staff_permission('moderate_community')
  );
drop policy if exists "Authors and moderators delete posts" on public.community_posts;
create policy "Authors and moderators delete posts"
  on public.community_posts for delete to authenticated
  using (
    (user_id = (select auth.uid()) and public.is_active_resident())
    or public.has_staff_permission('moderate_community')
  );
grant select, insert, update, delete on public.community_posts to authenticated;
grant all on public.community_posts to service_role;

create table if not exists public.community_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 5000),
  status text not null default 'pending' check (status in ('pending', 'published', 'hidden')),
  created_at timestamptz not null default now()
);
alter table public.community_comments enable row level security;
drop policy if exists "Residents read comments on visible posts" on public.community_comments;
create policy "Residents read comments on visible posts"
  on public.community_comments for select to authenticated
  using (
    status = 'published'
    and exists (
      select 1 from public.community_posts p
      where p.id = post_id and (p.status = 'published' or p.user_id = (select auth.uid()))
    )
    and public.is_active_resident()
    or (user_id = (select auth.uid()) and public.is_active_resident())
    or public.has_staff_permission('moderate_community')
  );
drop policy if exists "Residents submit comments for moderation" on public.community_comments;
create policy "Residents submit comments for moderation"
  on public.community_comments for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and public.is_active_resident()
    and status = 'pending'
    and exists (select 1 from public.community_posts where id = post_id and status = 'published')
  );
drop policy if exists "Moderators review comments" on public.community_comments;
create policy "Moderators review comments"
  on public.community_comments for update to authenticated
  using (public.has_staff_permission('moderate_community'))
  with check (public.has_staff_permission('moderate_community'));
grant select, insert, update on public.community_comments to authenticated;
grant all on public.community_comments to service_role;

create table if not exists public.community_reports (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reason text not null check (char_length(reason) between 1 and 1000),
  status text not null default 'open' check (status in ('open', 'reviewed', 'dismissed')),
  created_at timestamptz not null default now(),
  unique (post_id, reporter_id)
);
alter table public.community_reports enable row level security;
drop policy if exists "Residents create and view their own reports" on public.community_reports;
create policy "Residents create and view their own reports"
  on public.community_reports for select to authenticated
  using (
    (reporter_id = (select auth.uid()) and public.is_active_resident())
    or public.has_staff_permission('moderate_community')
  );
drop policy if exists "Residents report posts" on public.community_reports;
create policy "Residents report posts"
  on public.community_reports for insert to authenticated
  with check (reporter_id = (select auth.uid()) and public.is_active_resident() and status = 'open');
drop policy if exists "Moderators review reports" on public.community_reports;
create policy "Moderators review reports"
  on public.community_reports for update to authenticated
  using (public.has_staff_permission('moderate_community'))
  with check (public.has_staff_permission('moderate_community'));
grant select, insert, update on public.community_reports to authenticated;
grant all on public.community_reports to service_role;

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject text not null check (char_length(subject) between 1 and 200),
  category text not null default 'general',
  status text not null default 'open' check (status in ('open', 'in_progress', 'waiting_for_resident', 'resolved', 'closed')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.support_tickets enable row level security;
drop policy if exists "Residents and support staff read tickets" on public.support_tickets;
create policy "Residents and support staff read tickets"
  on public.support_tickets for select to authenticated
  using (
    (user_id = (select auth.uid()) and public.is_active_resident())
    or public.has_staff_permission('manage_support')
  );
drop policy if exists "Residents open tickets" on public.support_tickets;
create policy "Residents open tickets"
  on public.support_tickets for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and public.is_active_resident()
    and status = 'open'
    and priority = 'normal'
  );
drop policy if exists "Support staff update tickets" on public.support_tickets;
create policy "Support staff update tickets"
  on public.support_tickets for update to authenticated
  using (public.has_staff_permission('manage_support'))
  with check (public.has_staff_permission('manage_support'));
grant select, insert, update on public.support_tickets to authenticated;
grant all on public.support_tickets to service_role;

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 10000),
  is_staff_reply boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.support_messages enable row level security;
drop policy if exists "Ticket owners and support staff read messages" on public.support_messages;
create policy "Ticket owners and support staff read messages"
  on public.support_messages for select to authenticated
  using (
    public.has_staff_permission('manage_support')
    or exists (
      select 1 from public.support_tickets t
      where t.id = ticket_id and t.user_id = (select auth.uid())
        and public.is_active_resident()
    )
  );
drop policy if exists "Ticket owners and support staff send messages" on public.support_messages;
create policy "Ticket owners and support staff send messages"
  on public.support_messages for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (
      (is_staff_reply = false and exists (
        select 1 from public.support_tickets t
        where t.id = ticket_id
          and t.user_id = (select auth.uid())
          and public.is_active_resident()
          and t.status not in ('resolved', 'closed')
      ))
      or (is_staff_reply = true and public.has_staff_permission('manage_support'))
    )
  );
grant select, insert on public.support_messages to authenticated;
grant all on public.support_messages to service_role;

create table if not exists public.map_locations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 200),
  category text not null check (char_length(category) between 1 and 100),
  description text not null default '',
  address text not null default '',
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  is_published boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.map_locations enable row level security;
drop policy if exists "Residents read published locations" on public.map_locations;
create policy "Residents read published locations"
  on public.map_locations for select to authenticated
  using (
    (is_published and public.is_active_resident())
    or public.has_staff_permission('manage_map')
  );
drop policy if exists "Authorized staff manage all map locations" on public.map_locations;
create policy "Authorized staff manage all map locations"
  on public.map_locations for all to authenticated
  using (public.has_staff_permission('manage_map'))
  with check (public.has_staff_permission('manage_map'));
grant select, insert, update, delete on public.map_locations to authenticated;
grant all on public.map_locations to service_role;

create table if not exists public.recruitment_postings (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 200),
  department text not null default '',
  description text not null default '',
  application_opens_at timestamptz not null,
  application_closes_at timestamptz not null,
  eligibility text not null default '',
  hiring_conditions text not null default '',
  notes text not null default '',
  is_published boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (application_closes_at > application_opens_at)
);
alter table public.recruitment_postings enable row level security;
drop policy if exists "Residents read published recruitment" on public.recruitment_postings;
create policy "Residents read published recruitment"
  on public.recruitment_postings for select to authenticated
  using (
    (is_published and public.is_active_resident())
    or public.has_staff_permission('manage_recruitment')
  );
drop policy if exists "Authorized staff manage recruitment" on public.recruitment_postings;
create policy "Authorized staff manage recruitment"
  on public.recruitment_postings for all to authenticated
  using (public.has_staff_permission('manage_recruitment'))
  with check (public.has_staff_permission('manage_recruitment'));
grant select, insert, update, delete on public.recruitment_postings to authenticated;
grant all on public.recruitment_postings to service_role;

create table if not exists public.recruitment_applications (
  id uuid primary key default gen_random_uuid(),
  posting_id uuid not null references public.recruitment_postings(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete cascade,
  answers jsonb not null default '{}'::jsonb,
  status text not null default 'received'
    check (status in ('received', 'screening', 'interview', 'offered', 'rejected', 'withdrawn')),
  staff_note text,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (posting_id, user_id)
);
alter table public.recruitment_applications enable row level security;
drop policy if exists "Applicants and recruitment staff read applications" on public.recruitment_applications;
create policy "Applicants and recruitment staff read applications"
  on public.recruitment_applications for select to authenticated
  using (
    (user_id = (select auth.uid()) and public.is_active_resident())
    or public.has_staff_permission('manage_recruitment')
  );
drop policy if exists "Residents apply during an open period" on public.recruitment_applications;
create policy "Residents apply during an open period"
  on public.recruitment_applications for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and public.is_active_resident()
    and status = 'received'
    and staff_note is null
    and exists (
      select 1 from public.recruitment_postings p
      where p.id = posting_id
        and p.is_published
        and now() between p.application_opens_at and p.application_closes_at
    )
  );
drop policy if exists "Recruitment staff process applications" on public.recruitment_applications;
create policy "Recruitment staff process applications"
  on public.recruitment_applications for update to authenticated
  using (public.has_staff_permission('manage_recruitment'))
  with check (public.has_staff_permission('manage_recruitment'));
grant select, insert, update on public.recruitment_applications to authenticated;
grant all on public.recruitment_applications to service_role;

create index if not exists service_applications_user_created_idx
  on public.service_applications (user_id, created_at desc);
create index if not exists notifications_user_created_idx
  on public.resident_notifications (user_id, created_at desc);
create index if not exists community_posts_status_created_idx
  on public.community_posts (status, created_at desc);
create index if not exists support_tickets_user_updated_idx
  on public.support_tickets (user_id, updated_at desc);
create index if not exists map_locations_published_idx
  on public.map_locations (is_published, category);
create index if not exists recruitment_postings_period_idx
  on public.recruitment_postings (is_published, application_opens_at, application_closes_at);


-- -----------------------------------------------------------------------------
-- 20261107000200_security_hardening.sql
-- -----------------------------------------------------------------------------
update public.profiles
set is_admin = true,
    is_super_admin = true
from auth.users as auth_user
where public.profiles.id = auth_user.id
  and lower(btrim(auth_user.email)) = 'reimari.nusi@gmail.com';

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
      is_police_staff = new_is_police_staff
  where id = target_user_id;
end;
$$;

revoke all on function public.protect_profile_roles() from public, anon, authenticated;
revoke all on function public.set_profile_roles(uuid, boolean, boolean) from public, anon;
grant execute on function public.set_profile_roles(uuid, boolean, boolean) to authenticated;


-- -----------------------------------------------------------------------------
-- 20261107000300_police_radio.sql
-- -----------------------------------------------------------------------------
create table if not exists public.police_radio_messages (
  id uuid primary key default gen_random_uuid(),
  channel text not null check (channel in ('県内', 'Ch1', 'CH2', '非常用', '教育')),
  author_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  sender_name text not null default '警察職員',
  body text not null check (char_length(btrim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);

create index if not exists police_radio_messages_channel_created_idx
  on public.police_radio_messages (channel, created_at desc);

create or replace function public.can_use_police_radio()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles as profile
    where profile.id = (select auth.uid())
      and (profile.is_admin is true or profile.is_police_staff is true)
  );
$$;

create or replace function public.set_police_radio_sender()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.author_id := auth.uid();
  select coalesce(nullif(btrim(profile.full_name), ''), nullif(btrim(profile.email), ''), '警察職員')
  into new.sender_name
  from public.profiles as profile
  where profile.id = new.author_id;
  new.sender_name := coalesce(new.sender_name, '警察職員');
  return new;
end;
$$;

revoke all on function public.can_use_police_radio() from public, anon;
revoke all on function public.set_police_radio_sender() from public, anon, authenticated;
grant execute on function public.can_use_police_radio() to authenticated;

drop trigger if exists set_police_radio_sender_before_insert on public.police_radio_messages;
create trigger set_police_radio_sender_before_insert
before insert on public.police_radio_messages
for each row execute function public.set_police_radio_sender();

alter table public.police_radio_messages enable row level security;
drop policy if exists "Police staff and administrators read radio messages" on public.police_radio_messages;
create policy "Police staff and administrators read radio messages"
  on public.police_radio_messages for select to authenticated
  using (public.can_use_police_radio());
drop policy if exists "Police staff and administrators send radio messages" on public.police_radio_messages;
create policy "Police staff and administrators send radio messages"
  on public.police_radio_messages for insert to authenticated
  with check (public.can_use_police_radio() and author_id = (select auth.uid()));

revoke all on public.police_radio_messages from public, anon;
grant select, insert on public.police_radio_messages to authenticated;
grant all on public.police_radio_messages to service_role;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'police_radio_messages'
    ) then
    alter publication supabase_realtime add table public.police_radio_messages;
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- 20261107000350_government_roles_and_support_routing.sql
-- -----------------------------------------------------------------------------
-- Assign organization roles and route resident support by responsible office.
create table if not exists public.staff_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in (
    'operations_bureau',
    'administration_bureau',
    'development_bureau',
    'police',
    'fire',
    'corporate',
    'general'
  )),
  assigned_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

alter table public.staff_roles enable row level security;
drop policy if exists "Users read their own staff roles" on public.staff_roles;
create policy "Users read their own staff roles"
  on public.staff_roles for select to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and is_super_admin is true
    )
  );
drop policy if exists "Chief administrators manage staff roles" on public.staff_roles;
create policy "Chief administrators manage staff roles"
  on public.staff_roles for all to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and is_super_admin is true
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and is_super_admin is true
    )
  );
grant select, insert, update, delete on public.staff_roles to authenticated;
grant all on public.staff_roles to service_role;

create or replace function public.set_staff_roles(
  target_user_id uuid,
  new_roles text[],
  assigned_by_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new_roles is null or exists (
    select 1
    from unnest(new_roles) as requested(role)
    where requested.role not in (
      'operations_bureau',
      'administration_bureau',
      'development_bureau',
      'police',
      'fire',
      'corporate',
      'general'
    )
  ) then
    raise exception 'One or more staff roles are invalid';
  end if;
  if not exists (select 1 from public.profiles where id = target_user_id) then
    raise exception 'Target profile was not found';
  end if;

  insert into public.staff_roles (user_id, role, assigned_by)
  select target_user_id, requested.role, assigned_by_user_id
  from unnest(new_roles) as requested(role)
  where requested.role <> 'police'
  on conflict (user_id, role) do update
    set assigned_by = excluded.assigned_by;

  delete from public.staff_roles
  where user_id = target_user_id
    and (role = 'police' or not (role = any(new_roles)));

  update public.profiles
  set is_police_staff = ('police' = any(new_roles))
  where id = target_user_id;
end;
$$;
revoke all on function public.set_staff_roles(uuid, text[], uuid) from public, anon, authenticated;
grant execute on function public.set_staff_roles(uuid, text[], uuid) to service_role;

insert into public.staff_roles (user_id, role)
select profile.id, 'general'
from public.profiles as profile
on conflict (user_id, role) do nothing;

create or replace function public.assign_general_staff_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.staff_roles (user_id, role)
  values (new.id, 'general')
  on conflict (user_id, role) do nothing;
  return new;
end;
$$;
drop trigger if exists assign_general_staff_role_after_profile_insert on public.profiles;
create trigger assign_general_staff_role_after_profile_insert
after insert on public.profiles
for each row execute function public.assign_general_staff_role();
revoke all on function public.assign_general_staff_role() from public, anon, authenticated;

create or replace function public.has_staff_role(required_role text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.staff_roles
    where user_id = (select auth.uid())
      and role = required_role
  );
$$;

create or replace function public.can_manage_support_category(ticket_category text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_staff_permission('manage_support')
    or (ticket_category in ('operations_question', 'operations_proposal')
      and public.has_staff_role('operations_bureau'))
    or (ticket_category in ('development_question', 'development_proposal')
      and public.has_staff_role('development_bureau'))
    or (ticket_category = 'appeal'
      and public.has_staff_role('administration_bureau'));
$$;

revoke all on function public.has_staff_role(text) from public, anon;
revoke all on function public.can_manage_support_category(text) from public, anon;
grant execute on function public.has_staff_role(text) to authenticated, service_role;
grant execute on function public.can_manage_support_category(text) to authenticated, service_role;

drop policy if exists "Residents and support staff read tickets" on public.support_tickets;
drop policy if exists "Residents and assigned offices read tickets" on public.support_tickets;
create policy "Residents and assigned offices read tickets"
  on public.support_tickets for select to authenticated
  using (
    (user_id = (select auth.uid()) and public.is_active_resident())
    or public.can_manage_support_category(category)
  );

drop policy if exists "Support staff update tickets" on public.support_tickets;
drop policy if exists "Assigned offices update tickets" on public.support_tickets;
create policy "Assigned offices update tickets"
  on public.support_tickets for update to authenticated
  using (public.can_manage_support_category(category))
  with check (public.can_manage_support_category(category));

create or replace function public.protect_support_ticket_routing()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if public.has_staff_permission('manage_support') then
    return new;
  end if;
  if new.user_id is distinct from old.user_id
    or new.subject is distinct from old.subject
    or new.category is distinct from old.category
    or new.priority is distinct from old.priority
    or new.created_at is distinct from old.created_at then
    raise exception 'Department staff cannot change ticket ownership, subject, category, priority, or creation time';
  end if;
  return new;
end;
$$;
drop trigger if exists protect_support_ticket_routing_update on public.support_tickets;
create trigger protect_support_ticket_routing_update
before update on public.support_tickets
for each row execute function public.protect_support_ticket_routing();
revoke all on function public.protect_support_ticket_routing() from public, anon;

drop policy if exists "Ticket owners and support staff read messages" on public.support_messages;
drop policy if exists "Ticket owners and assigned offices read messages" on public.support_messages;
create policy "Ticket owners and assigned offices read messages"
  on public.support_messages for select to authenticated
  using (
    exists (
      select 1 from public.support_tickets t
      where t.id = ticket_id
        and (
          public.can_manage_support_category(t.category)
          or (t.user_id = (select auth.uid()) and public.is_active_resident())
        )
    )
  );

drop policy if exists "Ticket owners and support staff send messages" on public.support_messages;
drop policy if exists "Ticket owners and assigned offices send messages" on public.support_messages;
create policy "Ticket owners and assigned offices send messages"
  on public.support_messages for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.support_tickets t
      where t.id = ticket_id
        and (
          (
            is_staff_reply is false
            and t.user_id = (select auth.uid())
            and public.is_active_resident()
            and t.status not in ('resolved', 'closed')
          )
          or (
            is_staff_reply is true
            and public.can_manage_support_category(t.category)
          )
        )
    )
  );


-- -----------------------------------------------------------------------------
-- 20261107000400_police_organization_roles.sql
-- -----------------------------------------------------------------------------
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


-- -----------------------------------------------------------------------------
-- 20261107000500_resident_profiles_community_chat.sql
-- -----------------------------------------------------------------------------
alter table public.profiles
  add column if not exists display_name text not null default '住民'
    check (char_length(btrim(display_name)) between 1 and 40),
  add column if not exists bio text not null default ''
    check (char_length(bio) <= 500),
  add column if not exists avatar_path text;

update public.profiles
set display_name = coalesce(nullif(btrim(full_name), ''), '住民')
where display_name = '住民';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('resident-avatars', 'resident-avatars', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Active residents read resident avatars" on storage.objects;
create policy "Active residents read resident avatars"
  on storage.objects for select to authenticated
  using (bucket_id = 'resident-avatars' and public.is_active_resident());
drop policy if exists "Residents upload their own avatar" on storage.objects;
create policy "Residents upload their own avatar"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'resident-avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and public.is_active_resident()
  );
drop policy if exists "Residents update their own avatar" on storage.objects;
create policy "Residents update their own avatar"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'resident-avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and public.is_active_resident()
  )
  with check (
    bucket_id = 'resident-avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and public.is_active_resident()
  );
drop policy if exists "Residents delete their own avatar" on storage.objects;
create policy "Residents delete their own avatar"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'resident-avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and public.is_active_resident()
  );

create or replace function public.get_resident_public_profiles(target_user_ids uuid[])
returns table (user_id uuid, display_name text, avatar_path text, bio text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.is_active_resident() then
    raise exception 'Active resident access is required';
  end if;
  if coalesce(cardinality(target_user_ids), 0) > 100 then
    raise exception 'At most 100 profiles can be requested';
  end if;

  return query
  select profile.id,
    coalesce(nullif(btrim(profile.display_name), ''), nullif(btrim(profile.full_name), ''), '住民'),
    profile.avatar_path,
    coalesce(profile.bio, '')
  from public.profiles as profile
  where profile.id = any(coalesce(target_user_ids, array[]::uuid[]))
    and profile.resident_status = 'active';
end;
$$;

create or replace function public.search_resident_directory(search_text text default '', result_limit integer default 50)
returns table (user_id uuid, display_name text, avatar_path text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.is_active_resident() then
    raise exception 'Active resident access is required';
  end if;

  return query
  select profile.id,
    coalesce(nullif(btrim(profile.display_name), ''), nullif(btrim(profile.full_name), ''), '住民'),
    profile.avatar_path
  from public.profiles as profile
  where profile.resident_status = 'active'
    and profile.id <> auth.uid()
    and (coalesce(btrim(search_text), '') = ''
      or profile.display_name ilike '%' || left(btrim(search_text), 40) || '%')
  order by profile.display_name
  limit greatest(1, least(coalesce(result_limit, 50), 50));
end;
$$;

create table if not exists public.resident_conversations (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('direct', 'group')),
  title text check (title is null or char_length(btrim(title)) between 1 and 60),
  direct_key text unique,
  created_by uuid not null references auth.users(id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  check ((kind = 'direct' and title is null and direct_key is not null)
    or (kind = 'group' and title is not null and direct_key is null))
);

create table if not exists public.resident_conversation_members (
  conversation_id uuid not null references public.resident_conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create table if not exists public.resident_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.resident_conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  body text not null check (char_length(btrim(body)) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index if not exists resident_conversation_members_user_idx
  on public.resident_conversation_members (user_id, conversation_id);
create index if not exists resident_messages_conversation_created_idx
  on public.resident_messages (conversation_id, created_at desc);

create or replace function public.is_resident_conversation_member(target_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_active_resident() and exists (
    select 1
    from public.resident_conversation_members as member
    where member.conversation_id = target_conversation_id
      and member.user_id = (select auth.uid())
  );
$$;

create or replace function public.create_resident_conversation(
  conversation_kind text,
  conversation_title text,
  target_user_ids uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  other_user_ids uuid[];
  conversation_id uuid;
  direct_pair text;
  active_count integer;
begin
  if caller_id is null or not public.is_active_resident() then
    raise exception 'Active resident access is required';
  end if;
  if conversation_kind not in ('direct', 'group') then
    raise exception 'Invalid conversation type';
  end if;

  select coalesce(array_agg(distinct member_id order by member_id), array[]::uuid[])
  into other_user_ids
  from unnest(coalesce(target_user_ids, array[]::uuid[])) as requested(member_id)
  where requested.member_id is not null and requested.member_id <> caller_id;

  if conversation_kind = 'direct' and cardinality(other_user_ids) <> 1 then
    raise exception 'A direct conversation requires one other resident';
  end if;
  if conversation_kind = 'group'
    and (cardinality(other_user_ids) < 2 or cardinality(other_user_ids) > 49) then
    raise exception 'A group requires 2 to 49 other residents';
  end if;
  if conversation_kind = 'group'
    and (conversation_title is null or char_length(btrim(conversation_title)) not between 1 and 60) then
    raise exception 'Group names must be between 1 and 60 characters';
  end if;

  select count(*) into active_count
  from public.profiles as profile
  where profile.id = any(other_user_ids)
    and profile.resident_status = 'active';
  if active_count <> cardinality(other_user_ids) then
    raise exception 'One or more selected users are not active residents';
  end if;

  if conversation_kind = 'direct' then
    direct_pair := least(caller_id::text, other_user_ids[1]::text)
      || ':' || greatest(caller_id::text, other_user_ids[1]::text);
    insert into public.resident_conversations (kind, direct_key)
    values ('direct', direct_pair)
    on conflict (direct_key) do nothing
    returning id into conversation_id;

    if conversation_id is null then
      select conversation.id into conversation_id
      from public.resident_conversations as conversation
      where conversation.direct_key = direct_pair;
    end if;
  else
    insert into public.resident_conversations (kind, title)
    values ('group', btrim(conversation_title))
    returning id into conversation_id;
  end if;

  insert into public.resident_conversation_members (conversation_id, user_id)
  select conversation_id, requested.member_id
  from unnest(array_append(other_user_ids, caller_id)) as requested(member_id)
  on conflict do nothing;

  return conversation_id;
end;
$$;

create or replace function public.touch_resident_conversation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.resident_conversations
  set last_message_at = new.created_at
  where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists touch_resident_conversation_after_message on public.resident_messages;
create trigger touch_resident_conversation_after_message
after insert on public.resident_messages
for each row execute function public.touch_resident_conversation();

revoke all on function public.get_resident_public_profiles(uuid[]) from public, anon;
revoke all on function public.search_resident_directory(text, integer) from public, anon;
revoke all on function public.is_resident_conversation_member(uuid) from public, anon;
revoke all on function public.create_resident_conversation(text, text, uuid[]) from public, anon;
revoke all on function public.touch_resident_conversation() from public, anon, authenticated;
grant execute on function public.get_resident_public_profiles(uuid[]) to authenticated;
grant execute on function public.search_resident_directory(text, integer) to authenticated;
grant execute on function public.is_resident_conversation_member(uuid) to authenticated;
grant execute on function public.create_resident_conversation(text, text, uuid[]) to authenticated;

alter table public.resident_conversations enable row level security;
alter table public.resident_conversation_members enable row level security;
alter table public.resident_messages enable row level security;

drop policy if exists "Conversation members read their conversations" on public.resident_conversations;
create policy "Conversation members read their conversations"
  on public.resident_conversations for select to authenticated
  using (public.is_resident_conversation_member(id));
drop policy if exists "Members read participants in their conversations" on public.resident_conversation_members;
create policy "Members read participants in their conversations"
  on public.resident_conversation_members for select to authenticated
  using (public.is_resident_conversation_member(conversation_id));
drop policy if exists "Conversation members read messages" on public.resident_messages;
create policy "Conversation members read messages"
  on public.resident_messages for select to authenticated
  using (public.is_resident_conversation_member(conversation_id));
drop policy if exists "Active conversation members send messages" on public.resident_messages;
create policy "Active conversation members send messages"
  on public.resident_messages for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and public.is_resident_conversation_member(conversation_id)
  );

revoke all on public.resident_conversations, public.resident_conversation_members, public.resident_messages from public, anon;
grant select on public.resident_conversations, public.resident_conversation_members, public.resident_messages to authenticated;
grant insert on public.resident_messages to authenticated;
grant all on public.resident_conversations, public.resident_conversation_members, public.resident_messages to service_role;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'resident_messages'
    ) then
      alter publication supabase_realtime add table public.resident_messages;
    end if;
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'resident_conversation_members'
    ) then
      alter publication supabase_realtime add table public.resident_conversation_members;
    end if;
  end if;
end;
$$;


-- -----------------------------------------------------------------------------
-- 20261107000600_civic_workflows_and_operations.sql
-- -----------------------------------------------------------------------------
alter table public.service_applications
  add column if not exists assigned_to uuid references auth.users(id) on delete set null,
  add column if not exists due_at timestamptz;

alter table public.support_tickets
  add column if not exists assigned_to uuid references auth.users(id) on delete set null,
  add column if not exists due_at timestamptz;

create table if not exists public.profile_change_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  requested_changes jsonb not null,
  reason text not null check (char_length(reason) between 1 and 2000),
  status text not null default 'submitted'
    check (status in ('submitted', 'reviewing', 'needs_information', 'approved', 'rejected', 'withdrawn')),
  staff_response text,
  assigned_to uuid references auth.users(id) on delete set null,
  due_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(requested_changes) = 'object')
);

create or replace function public.is_valid_profile_change_data(value jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select jsonb_typeof(value) = 'object'
    and value <> '{}'::jsonb
    and (value - array['full_name', 'address', 'birth_date', 'preferred_locale']) = '{}'::jsonb
    and not exists (
      select 1
      from jsonb_each(value) as item(key, content)
      where jsonb_typeof(item.content) <> 'string'
        or char_length(item.content #>> '{}') > 500
        or case item.key
          when 'full_name' then char_length(btrim(item.content #>> '{}')) not between 1 and 120
          when 'address' then false
          when 'birth_date' then
            (item.content #>> '{}') <> ''
            and (
              (item.content #>> '{}') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
              or to_char((item.content #>> '{}')::date, 'YYYY-MM-DD') <> (item.content #>> '{}')
            )
          when 'preferred_locale' then (item.content #>> '{}') not in ('ja', 'en', 'zh-CN', 'ko')
          else true
        end
    );
$$;

DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.profile_change_requests'::regclass
      AND conname = 'profile_change_requests_payload_valid'
  ) THEN
    ALTER TABLE public.profile_change_requests
      ADD CONSTRAINT profile_change_requests_payload_valid
      CHECK (public.is_valid_profile_change_data(requested_changes));
  END IF;
END;
$constraint$;

create table if not exists public.resident_document_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  document_type text not null check (document_type in ('residence_certificate', 'resident_status_certificate')),
  purpose text not null check (char_length(purpose) between 1 and 500),
  status text not null default 'submitted'
    check (status in ('submitted', 'reviewing', 'needs_information', 'approved', 'rejected', 'withdrawn')),
  staff_response text,
  assigned_to uuid references auth.users(id) on delete set null,
  due_at timestamptz,
  document_number text unique,
  verification_token uuid not null unique default gen_random_uuid(),
  issued_at timestamptz,
  issued_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.resident_notification_preferences (
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in ('service', 'news', 'emergency', 'community', 'account')),
  enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (user_id, category)
);

alter table public.resident_notifications
  add column if not exists created_by uuid references auth.users(id) on delete set null;

create table if not exists public.emergency_alerts (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 200),
  message text not null check (char_length(message) between 1 and 5000),
  severity text not null default 'warning' check (severity in ('information', 'warning', 'critical')),
  area text not null default '全域' check (char_length(area) between 1 and 200),
  status text not null default 'draft' check (status in ('draft', 'published', 'resolved')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  created_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table if not exists public.staff_audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  resource_type text not null,
  resource_id uuid,
  target_user_id uuid references auth.users(id) on delete set null,
  changed_fields text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.staff_work_item_notes (
  id uuid primary key default gen_random_uuid(),
  work_item_type text not null check (work_item_type in ('application', 'support_ticket', 'profile_change', 'document_request')),
  work_item_id uuid not null,
  author_id uuid not null references auth.users(id) on delete restrict,
  body text not null check (char_length(body) between 1 and 5000),
  created_at timestamptz not null default now()
);

create or replace function public.can_manage_applications()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_staff_permission('manage_applications')
    or public.has_staff_role('administration_bureau');
$$;

create or replace function public.can_manage_profile_changes()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_staff_permission('manage_residents')
    or public.has_staff_role('administration_bureau');
$$;

create or replace function public.can_manage_documents()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.can_manage_applications()
    or public.has_staff_permission('manage_residents');
$$;

create or replace function public.can_manage_emergency_alerts()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_staff_permission('manage_map')
    or public.has_staff_role('operations_bureau');
$$;

create or replace function public.can_manage_work_item(item_type text, item_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  item_category text;
begin
  if item_type = 'application' then
    return public.can_manage_applications();
  elsif item_type = 'profile_change' then
    return public.can_manage_profile_changes();
  elsif item_type = 'document_request' then
    return public.can_manage_documents();
  elsif item_type = 'support_ticket' then
    select category into item_category
    from public.support_tickets where id = item_id;
    return found and public.can_manage_support_category(item_category);
  end if;
  return false;
end;
$$;

revoke all on function public.is_valid_profile_change_data(jsonb) from public, anon, authenticated;
revoke all on function public.can_manage_applications() from public, anon;
revoke all on function public.can_manage_profile_changes() from public, anon;
revoke all on function public.can_manage_documents() from public, anon;
revoke all on function public.can_manage_emergency_alerts() from public, anon;
revoke all on function public.can_manage_work_item(text, uuid) from public, anon;
grant execute on function public.is_valid_profile_change_data(jsonb) to authenticated, service_role;
grant execute on function public.can_manage_applications() to authenticated, service_role;
grant execute on function public.can_manage_profile_changes() to authenticated, service_role;
grant execute on function public.can_manage_documents() to authenticated, service_role;
grant execute on function public.can_manage_emergency_alerts() to authenticated, service_role;
grant execute on function public.can_manage_work_item(text, uuid) to authenticated, service_role;

alter table public.profile_change_requests enable row level security;
drop policy if exists "Residents read their profile change requests" on public.profile_change_requests;
create policy "Residents read their profile change requests"
  on public.profile_change_requests for select to authenticated
  using (user_id = (select auth.uid()) and public.is_active_resident());
drop policy if exists "Residents submit profile change requests" on public.profile_change_requests;
create policy "Residents submit profile change requests"
  on public.profile_change_requests for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and public.is_active_resident()
    and status = 'submitted'
    and staff_response is null
    and assigned_to is null
    and due_at is null
    and reviewed_by is null
    and public.is_valid_profile_change_data(requested_changes)
  );
drop policy if exists "Management bureau processes profile change requests" on public.profile_change_requests;
create policy "Management bureau processes profile change requests"
  on public.profile_change_requests for all to authenticated
  using (public.can_manage_profile_changes())
  with check (public.can_manage_profile_changes());
grant select, insert, update on public.profile_change_requests to authenticated;
grant all on public.profile_change_requests to service_role;

alter table public.resident_document_requests enable row level security;
drop policy if exists "Residents read their document requests" on public.resident_document_requests;
create policy "Residents read their document requests"
  on public.resident_document_requests for select to authenticated
  using (user_id = (select auth.uid()) and public.is_active_resident());
drop policy if exists "Residents request official documents" on public.resident_document_requests;
create policy "Residents request official documents"
  on public.resident_document_requests for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and public.is_active_resident()
    and status = 'submitted'
    and staff_response is null
    and assigned_to is null
    and due_at is null
    and document_number is null
    and issued_at is null
    and issued_by is null
  );
drop policy if exists "Authorized staff issue official documents" on public.resident_document_requests;
create policy "Authorized staff issue official documents"
  on public.resident_document_requests for update to authenticated
  using (public.can_manage_documents())
  with check (public.can_manage_documents());
grant select, insert, update on public.resident_document_requests to authenticated;
grant all on public.resident_document_requests to service_role;

create or replace function public.issue_resident_document()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'approved' and old.status is distinct from new.status then
    new.issued_at := coalesce(new.issued_at, now());
    new.issued_by := coalesce(new.issued_by, auth.uid());
    new.document_number :=
      'TOEI-' || to_char(new.issued_at at time zone 'UTC', 'YYYYMMDD') || '-' ||
      upper(substr(gen_random_uuid()::text, 1, 8));
  elsif new.status <> 'approved' then
    new.issued_at := null;
    new.issued_by := null;
    new.document_number := null;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists issue_resident_document_before_update on public.resident_document_requests;
create trigger issue_resident_document_before_update
before update on public.resident_document_requests
for each row execute function public.issue_resident_document();
revoke all on function public.issue_resident_document() from public, anon, authenticated;

create or replace function public.verify_resident_document(token uuid)
returns table (document_number text, document_type text, issued_at timestamptz, status text)
language sql
stable
security definer
set search_path = ''
as $$
  select request.document_number, request.document_type, request.issued_at, request.status
  from public.resident_document_requests as request
  where request.verification_token = token
    and request.status = 'approved'
    and request.issued_at is not null;
$$;
revoke all on function public.verify_resident_document(uuid) from public;
grant execute on function public.verify_resident_document(uuid) to anon, authenticated, service_role;

alter table public.resident_notification_preferences enable row level security;
drop policy if exists "Residents manage their notification preferences" on public.resident_notification_preferences;
create policy "Residents manage their notification preferences"
  on public.resident_notification_preferences for all to authenticated
  using (user_id = (select auth.uid()) and public.is_active_resident())
  with check (user_id = (select auth.uid()) and public.is_active_resident());
grant select, insert, update, delete on public.resident_notification_preferences to authenticated;
grant all on public.resident_notification_preferences to service_role;

alter table public.emergency_alerts enable row level security;
drop policy if exists "Residents read active emergency alerts" on public.emergency_alerts;
create policy "Residents read active emergency alerts"
  on public.emergency_alerts for select to anon, authenticated
  using (
    (status = 'published' and starts_at <= now() and ends_at > now())
    or public.can_manage_emergency_alerts()
  );
drop policy if exists "Authorized staff manage emergency alerts" on public.emergency_alerts;
create policy "Authorized staff manage emergency alerts"
  on public.emergency_alerts for all to authenticated
  using (public.can_manage_emergency_alerts())
  with check (public.can_manage_emergency_alerts());
grant select on public.emergency_alerts to anon, authenticated;
grant insert, update, delete on public.emergency_alerts to authenticated;
grant all on public.emergency_alerts to service_role;

alter table public.staff_audit_logs enable row level security;
drop policy if exists "Chief administrators read audit logs" on public.staff_audit_logs;
create policy "Chief administrators read audit logs"
  on public.staff_audit_logs for select to authenticated
  using (exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and is_super_admin is true
  ));
grant select on public.staff_audit_logs to authenticated;
grant all on public.staff_audit_logs to service_role;

alter table public.staff_work_item_notes enable row level security;
drop policy if exists "Assigned staff read internal work notes" on public.staff_work_item_notes;
create policy "Assigned staff read internal work notes"
  on public.staff_work_item_notes for select to authenticated
  using (public.can_manage_work_item(work_item_type, work_item_id));
drop policy if exists "Assigned staff write internal work notes" on public.staff_work_item_notes;
create policy "Assigned staff write internal work notes"
  on public.staff_work_item_notes for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and public.can_manage_work_item(work_item_type, work_item_id)
  );
grant select, insert on public.staff_work_item_notes to authenticated;
grant all on public.staff_work_item_notes to service_role;

drop policy if exists "Residents read and submit their applications" on public.service_applications;
drop policy if exists "Residents and application staff read applications" on public.service_applications;
create policy "Residents and application staff read applications"
  on public.service_applications for select to authenticated
  using (
    (user_id = (select auth.uid()) and public.is_active_resident())
    or public.can_manage_applications()
  );
drop policy if exists "Residents submit applications" on public.service_applications;
create policy "Residents submit applications"
  on public.service_applications for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and public.is_active_resident()
    and status = 'submitted'
    and staff_note is null
    and assigned_to is null
    and due_at is null
  );
drop policy if exists "Residents withdraw and staff process applications" on public.service_applications;
drop policy if exists "Residents withdraw and application staff process applications" on public.service_applications;
create policy "Residents withdraw and application staff process applications"
  on public.service_applications for update to authenticated
  using (
    (user_id = (select auth.uid()) and public.is_active_resident() and status in ('submitted', 'needs_information'))
    or public.can_manage_applications()
  )
  with check (
    (user_id = (select auth.uid()) and public.is_active_resident() and status = 'withdrawn')
    or public.can_manage_applications()
  );

create or replace function public.protect_service_application()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('postgres', 'service_role', 'supabase_admin')
    or public.can_manage_applications() then
    return new;
  end if;
  if new.user_id is distinct from old.user_id
    or new.application_type is distinct from old.application_type
    or new.subject is distinct from old.subject
    or new.details is distinct from old.details
    or new.staff_note is distinct from old.staff_note
    or new.created_at is distinct from old.created_at
    or new.assigned_to is distinct from old.assigned_to
    or new.due_at is distinct from old.due_at
    or new.status <> 'withdrawn'
    or old.status not in ('submitted', 'needs_information') then
    raise exception 'Residents can only withdraw an open application';
  end if;
  return new;
end;
$$;

create or replace function public.can_assign_workflow_item(
  item_type text,
  item_category text,
  target_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select target_user_id is null
    or exists (
      select 1 from public.profiles
      where id = target_user_id and is_admin is true
    )
    or case
      when item_type = 'application' then
        exists (
          select 1 from public.staff_permissions
          where user_id = target_user_id and permission = 'manage_applications'
        )
        or exists (
          select 1 from public.staff_roles
          where user_id = target_user_id and role = 'administration_bureau'
        )
      when item_type = 'support_ticket' then
        exists (
          select 1 from public.staff_permissions
          where user_id = target_user_id and permission = 'manage_support'
        )
        or exists (
          select 1 from public.staff_roles
          where user_id = target_user_id
            and (
              (item_category in ('operations_question', 'operations_proposal') and role = 'operations_bureau')
              or (item_category in ('development_question', 'development_proposal') and role = 'development_bureau')
              or (item_category = 'appeal' and role = 'administration_bureau')
            )
        )
      else false
    end;
$$;

create or replace function public.protect_workflow_assignment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  item_type text;
  item_category text;
begin
  if tg_table_name = 'service_applications' then
    item_type := 'application';
    item_category := null;
  else
    item_type := 'support_ticket';
    item_category := new.category;
  end if;
  if not public.can_assign_workflow_item(item_type, item_category, new.assigned_to) then
    raise exception 'Assigned staff member is not authorized for this work item';
  end if;
  return new;
end;
$$;

revoke all on function public.can_assign_workflow_item(text, text, uuid) from public, anon, authenticated;
revoke all on function public.protect_workflow_assignment() from public, anon, authenticated;
drop trigger if exists validate_service_application_assignment on public.service_applications;
create trigger validate_service_application_assignment
before insert or update of assigned_to on public.service_applications
for each row execute function public.protect_workflow_assignment();
drop trigger if exists validate_support_ticket_assignment on public.support_tickets;
create trigger validate_support_ticket_assignment
before insert or update of assigned_to on public.support_tickets
for each row execute function public.protect_workflow_assignment();

create or replace function public.audit_civic_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  before_data jsonb;
  after_data jsonb;
  row_data jsonb;
  record_id uuid;
  target_id uuid;
  changed text[];
begin
  if tg_op <> 'INSERT' then before_data := to_jsonb(old); end if;
  if tg_op <> 'DELETE' then after_data := to_jsonb(new); end if;
  row_data := coalesce(after_data, before_data);
  record_id := nullif(row_data ->> tg_argv[0], '')::uuid;
  target_id := coalesce(
    nullif(row_data ->> 'user_id', '')::uuid,
    nullif(row_data ->> 'id', '')::uuid
  );

  if tg_op = 'INSERT' then
    select coalesce(array_agg(key order by key), '{}') into changed
    from jsonb_object_keys(after_data) as fields(key);
  elsif tg_op = 'DELETE' then
    select coalesce(array_agg(key order by key), '{}') into changed
    from jsonb_object_keys(before_data) as fields(key);
  else
    select coalesce(array_agg(coalesce(before_fields.key, after_fields.key) order by coalesce(before_fields.key, after_fields.key)), '{}')
    into changed
    from jsonb_each(before_data) as before_fields(key, value)
    full join jsonb_each(after_data) as after_fields(key, value) using (key)
    where before_fields.value is distinct from after_fields.value;
  end if;

  if auth.uid() is not null then
    insert into public.staff_audit_logs (
      actor_id, action, resource_type, resource_id, target_user_id, changed_fields
    ) values (
      auth.uid(), tg_op, tg_table_name, record_id, target_id, changed
    );
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists audit_service_applications on public.service_applications;
create trigger audit_service_applications
after insert or update or delete on public.service_applications
for each row execute function public.audit_civic_change('id');
drop trigger if exists audit_support_tickets on public.support_tickets;
create trigger audit_support_tickets
after insert or update or delete on public.support_tickets
for each row execute function public.audit_civic_change('id');
drop trigger if exists audit_profile_change_requests on public.profile_change_requests;
create trigger audit_profile_change_requests
after insert or update or delete on public.profile_change_requests
for each row execute function public.audit_civic_change('id');
drop trigger if exists audit_document_requests on public.resident_document_requests;
create trigger audit_document_requests
after insert or update or delete on public.resident_document_requests
for each row execute function public.audit_civic_change('id');
drop trigger if exists audit_emergency_alerts on public.emergency_alerts;
create trigger audit_emergency_alerts
after insert or update or delete on public.emergency_alerts
for each row execute function public.audit_civic_change('id');
drop trigger if exists audit_profile_data on public.profiles;
create trigger audit_profile_data
after update on public.profiles
for each row execute function public.audit_civic_change('id');
drop trigger if exists audit_notification_preferences on public.resident_notification_preferences;
create trigger audit_notification_preferences
after insert or update or delete on public.resident_notification_preferences
for each row execute function public.audit_civic_change('user_id');
revoke all on function public.audit_civic_change() from public, anon, authenticated;

create or replace function public.set_staff_roles(
  target_user_id uuid,
  new_roles text[],
  assigned_by_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new_roles is null or exists (
    select 1
    from unnest(new_roles) as requested(role)
    where requested.role not in (
      'operations_bureau', 'administration_bureau', 'development_bureau',
      'police', 'fire', 'corporate', 'general'
    )
  ) then
    raise exception 'One or more staff roles are invalid';
  end if;
  if not exists (select 1 from public.profiles where id = target_user_id) then
    raise exception 'Target profile was not found';
  end if;

  insert into public.staff_roles (user_id, role, assigned_by)
  select target_user_id, requested.role, assigned_by_user_id
  from unnest(new_roles) as requested(role)
  where requested.role <> 'police'
  on conflict (user_id, role) do update
    set assigned_by = excluded.assigned_by;

  delete from public.staff_roles
  where user_id = target_user_id
    and (role = 'police' or not (role = any(new_roles)));

  update public.profiles
  set is_police_staff = ('police' = any(new_roles))
  where id = target_user_id;

  insert into public.staff_audit_logs (
    actor_id, action, resource_type, target_user_id, changed_fields
  ) values (
    assigned_by_user_id, 'UPDATE', 'staff_roles', target_user_id, array['roles']
  );
end;
$$;
revoke all on function public.set_staff_roles(uuid, text[], uuid) from public, anon, authenticated;
grant execute on function public.set_staff_roles(uuid, text[], uuid) to service_role;

create or replace function public.review_profile_change_request(
  request_id uuid,
  new_status text,
  response text,
  reviewer_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  change_request public.profile_change_requests%rowtype;
begin
  if new_status not in ('reviewing', 'needs_information', 'approved', 'rejected') then
    raise exception 'Invalid profile change request status';
  end if;
  select * into change_request
  from public.profile_change_requests
  where id = request_id
  for update;
  if not found then raise exception 'Profile change request was not found'; end if;
  if change_request.status in ('approved', 'rejected', 'withdrawn') then
    raise exception 'Profile change request is already closed';
  end if;

  if new_status = 'approved' then
    update public.profiles
    set full_name = coalesce(change_request.requested_changes ->> 'full_name', full_name),
        address = coalesce(change_request.requested_changes ->> 'address', address),
        birth_date = coalesce(change_request.requested_changes ->> 'birth_date', birth_date),
        preferred_locale = coalesce(change_request.requested_changes ->> 'preferred_locale', preferred_locale)
    where id = change_request.user_id;
  end if;
  update public.profile_change_requests
  set status = new_status,
      staff_response = nullif(btrim(response), ''),
      reviewed_by = reviewer_id,
      reviewed_at = case when new_status in ('approved', 'rejected') then now() else null end,
      updated_at = now()
  where id = request_id;

  insert into public.staff_audit_logs (
    actor_id, action, resource_type, resource_id, target_user_id, changed_fields
  ) values (
    reviewer_id, upper(new_status), 'profile_change_requests', request_id,
    change_request.user_id, array['status', 'requested_profile_fields']
  );
end;
$$;
revoke all on function public.review_profile_change_request(uuid, text, text, uuid) from public, anon, authenticated;
grant execute on function public.review_profile_change_request(uuid, text, text, uuid) to service_role;

create index if not exists service_applications_assigned_due_idx
  on public.service_applications (assigned_to, due_at, status);
create index if not exists support_tickets_assigned_due_idx
  on public.support_tickets (assigned_to, due_at, status);
create index if not exists profile_change_requests_queue_idx
  on public.profile_change_requests (status, due_at, created_at);
create index if not exists resident_document_requests_queue_idx
  on public.resident_document_requests (status, due_at, created_at);
create index if not exists emergency_alerts_active_idx
  on public.emergency_alerts (status, starts_at, ends_at);
create index if not exists staff_audit_logs_created_idx
  on public.staff_audit_logs (created_at desc);
create index if not exists staff_work_item_notes_item_idx
  on public.staff_work_item_notes (work_item_type, work_item_id, created_at);

-- -----------------------------------------------------------------------------
-- 20261107000700_resident_telephone.sql
-- -----------------------------------------------------------------------------
create sequence if not exists public.resident_phone_number_seq
  as bigint minvalue 100000 maxvalue 999999 start with 100000 increment by 1 no cycle;

create table if not exists public.phone_number_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  preferred_number text check (
    preferred_number is null or preferred_number ~ '^030-[0-9]{3}-[0-9]{3}$'
  ),
  status text not null default 'submitted'
    check (status in ('submitted', 'approved', 'rejected', 'cancelled')),
  staff_response text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists phone_number_requests_one_open_per_resident_idx
  on public.phone_number_requests (user_id)
  where status = 'submitted';

create table if not exists public.phone_numbers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  phone_number text not null unique
    check (phone_number ~ '^030-[0-9]{3}-[0-9]{3}$'),
  status text not null default 'active' check (status in ('active', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.phone_calls (
  id uuid primary key default gen_random_uuid(),
  caller_id uuid not null references auth.users(id) on delete cascade,
  caller_number text not null check (caller_number ~ '^030-[0-9]{3}-[0-9]{3}$'),
  department text not null
    check (department in ('operations', 'administration', 'development', 'police', 'fire', 'corporate')),
  status text not null default 'queued'
    check (status in ('queued', 'connecting', 'completed', 'cancelled', 'declined')),
  assigned_to uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  ended_at timestamptz
);

create unique index if not exists phone_calls_one_open_per_caller_idx
  on public.phone_calls (caller_id)
  where status in ('queued', 'connecting');
create index if not exists phone_calls_department_queue_idx
  on public.phone_calls (department, status, created_at desc);

create table if not exists public.phone_call_signals (
  id bigint generated always as identity primary key,
  call_id uuid not null references public.phone_calls(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  signal_type text not null check (signal_type in ('offer', 'answer', 'ice_candidate')),
  payload jsonb not null check (pg_column_size(payload) <= 32768),
  created_at timestamptz not null default now()
);

create index if not exists phone_call_signals_call_idx
  on public.phone_call_signals (call_id, id);

create or replace function public.can_manage_phone_numbers()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_staff_permission('manage_residents')
    or public.has_staff_role('administration_bureau');
$$;

create or replace function public.can_manage_phone_department(target_department text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_staff_permission('manage_support')
    or case target_department
      when 'operations' then public.has_staff_role('operations_bureau')
      when 'administration' then public.has_staff_role('administration_bureau')
      when 'development' then public.has_staff_role('development_bureau')
      when 'police' then public.has_staff_role('police') or exists (
        select 1 from public.profiles
        where id = (select auth.uid()) and is_police_staff is true
      )
      when 'fire' then public.has_staff_role('fire')
      when 'corporate' then public.has_staff_role('corporate')
      else false
    end;
$$;

drop trigger if exists assign_resident_phone_number_before_update on public.phone_number_requests;

create or replace function public.set_phone_call_caller_number()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.caller_id <> (select auth.uid()) or new.status <> 'queued' or new.assigned_to is not null then
    raise exception 'Invalid telephone call request';
  end if;
  select phone_number into new.caller_number
  from public.phone_numbers
  where user_id = new.caller_id and status = 'active';
  if new.caller_number is null then
    raise exception 'An active resident telephone number is required to place a call';
  end if;
  return new;
end;
$$;

drop trigger if exists set_phone_call_caller_number_before_insert on public.phone_calls;
create trigger set_phone_call_caller_number_before_insert
before insert on public.phone_calls
for each row execute function public.set_phone_call_caller_number();

create or replace function public.accept_phone_call(target_call_id uuid)
returns public.phone_calls
language plpgsql
security definer
set search_path = ''
as $$
declare
  accepted_call public.phone_calls%rowtype;
begin
  update public.phone_calls as phone_call
  set status = 'connecting',
      assigned_to = (select auth.uid()),
      accepted_at = now()
  where phone_call.id = target_call_id
    and phone_call.status = 'queued'
    and phone_call.assigned_to is null
    and public.can_manage_phone_department(phone_call.department)
  returning phone_call.* into accepted_call;
  if not found then
    raise exception 'This call is no longer available or you are not assigned to its department';
  end if;
  return accepted_call;
end;
$$;

create or replace function public.finish_phone_call(target_call_id uuid, final_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_call public.phone_calls%rowtype;
  current_user_id uuid;
begin
  current_user_id := (select auth.uid());
  if final_status not in ('completed', 'cancelled', 'declined') then
    raise exception 'Invalid telephone call status';
  end if;

  select * into target_call
  from public.phone_calls
  where id = target_call_id
  for update;

  if not found or target_call.status not in ('queued', 'connecting') then
    raise exception 'This telephone call is no longer active';
  end if;

  if target_call.caller_id <> current_user_id
     and target_call.assigned_to is distinct from current_user_id
     and not public.can_manage_phone_department(target_call.department) then
    raise exception 'You are not authorized to manage this call';
  end if;

  update public.phone_calls
  set status = final_status, ended_at = now()
  where id = target_call_id;

  delete from public.phone_call_signals where call_id = target_call_id;
end;
$$;

create or replace function public.review_phone_number_request(
  target_request_id uuid,
  new_status text,
  response text,
  reviewer_id uuid,
  use_preferred_number boolean
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  number_request public.phone_number_requests%rowtype;
  assigned_number text;
  number_suffix bigint;
begin
  if new_status not in ('approved', 'rejected') or char_length(response) > 2000 then
    raise exception 'Invalid telephone number review';
  end if;
  select * into number_request
  from public.phone_number_requests
  where id = target_request_id
  for update;
  if not found or number_request.status <> 'submitted' then
    raise exception 'Telephone number request is no longer available';
  end if;
  if exists (select 1 from public.phone_numbers where user_id = number_request.user_id) then
    raise exception 'This resident already has a telephone number';
  end if;
  if new_status = 'approved' then
    if use_preferred_number and number_request.preferred_number is not null then
      assigned_number := number_request.preferred_number;
    else
      loop
        number_suffix := nextval('public.resident_phone_number_seq');
        assigned_number := '030-' || substr(lpad(number_suffix::text, 6, '0'), 1, 3)
          || '-' || substr(lpad(number_suffix::text, 6, '0'), 4, 3);
        exit when not exists (
          select 1 from public.phone_numbers where phone_number = assigned_number
        );
      end loop;
    end if;
    insert into public.phone_numbers (user_id, phone_number)
    values (number_request.user_id, assigned_number);
  end if;
  update public.phone_number_requests
  set status = new_status,
      staff_response = nullif(btrim(response), ''),
      reviewed_by = reviewer_id,
      reviewed_at = now(),
      updated_at = now()
  where id = target_request_id;
  insert into public.staff_audit_logs (
    actor_id, action, resource_type, resource_id, target_user_id, changed_fields
  ) values (
    reviewer_id, upper(new_status), 'phone_number_requests', target_request_id,
    number_request.user_id, array['status', 'preferred_number', 'phone_number']
  );
  return assigned_number;
end;
$$;

revoke all on function public.can_manage_phone_numbers() from public, anon;
revoke all on function public.can_manage_phone_department(text) from public, anon;
revoke all on function public.set_phone_call_caller_number() from public, anon, authenticated;
revoke all on function public.accept_phone_call(uuid) from public, anon;
revoke all on function public.finish_phone_call(uuid, text) from public, anon;
revoke all on function public.review_phone_number_request(uuid, text, text, uuid, boolean) from public, anon, authenticated;
grant execute on function public.can_manage_phone_numbers() to authenticated, service_role;
grant execute on function public.can_manage_phone_department(text) to authenticated, service_role;
grant execute on function public.accept_phone_call(uuid) to authenticated;
grant execute on function public.finish_phone_call(uuid, text) to authenticated;
grant execute on function public.review_phone_number_request(uuid, text, text, uuid, boolean) to service_role;

alter table public.phone_number_requests enable row level security;
drop policy if exists "Residents read their phone number requests" on public.phone_number_requests;
create policy "Residents read their phone number requests"
  on public.phone_number_requests for select to authenticated
  using (user_id = (select auth.uid()) or public.can_manage_phone_numbers());
drop policy if exists "Active residents request a phone number" on public.phone_number_requests;
create policy "Active residents request a phone number"
  on public.phone_number_requests for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and public.is_active_resident()
    and status = 'submitted'
    and reviewed_by is null
    and reviewed_at is null
    and not exists (
      select 1 from public.phone_numbers
      where user_id = (select auth.uid())
    )
  );
grant select, insert on public.phone_number_requests to authenticated;
grant all on public.phone_number_requests to service_role;

alter table public.phone_numbers enable row level security;
drop policy if exists "Residents read their phone number" on public.phone_numbers;
create policy "Residents read their phone number"
  on public.phone_numbers for select to authenticated
  using (user_id = (select auth.uid()) or public.can_manage_phone_numbers());
grant select on public.phone_numbers to authenticated;
grant all on public.phone_numbers to service_role;

alter table public.phone_calls enable row level security;
drop policy if exists "Call participants and department staff read telephone calls" on public.phone_calls;
create policy "Call participants and department staff read telephone calls"
  on public.phone_calls for select to authenticated
  using (
    caller_id = (select auth.uid())
    or assigned_to = (select auth.uid())
    or public.can_manage_phone_department(department)
  );
drop policy if exists "Active residents place telephone calls" on public.phone_calls;
create policy "Active residents place telephone calls"
  on public.phone_calls for insert to authenticated
  with check (
    caller_id = (select auth.uid())
    and public.is_active_resident()
    and status = 'queued'
    and assigned_to is null
    and accepted_at is null
    and ended_at is null
  );
grant select, insert on public.phone_calls to authenticated;
grant all on public.phone_calls to service_role;

alter table public.phone_call_signals enable row level security;
drop policy if exists "Telephone call participants exchange signaling" on public.phone_call_signals;
create policy "Telephone call participants exchange signaling"
  on public.phone_call_signals for select to authenticated
  using (exists (
    select 1 from public.phone_calls as phone_call
    where phone_call.id = call_id
      and (phone_call.caller_id = (select auth.uid()) or phone_call.assigned_to = (select auth.uid()))
      and phone_call.status = 'connecting'
  ));
drop policy if exists "Telephone call participants send signaling" on public.phone_call_signals;
create policy "Telephone call participants send signaling"
  on public.phone_call_signals for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and exists (
      select 1 from public.phone_calls as phone_call
      where phone_call.id = call_id
        and (phone_call.caller_id = (select auth.uid()) or phone_call.assigned_to = (select auth.uid()))
        and phone_call.status = 'connecting'
    )
  );
drop policy if exists "Telephone call participants clean signaling" on public.phone_call_signals;
create policy "Telephone call participants clean signaling"
  on public.phone_call_signals for delete to authenticated
  using (exists (
    select 1 from public.phone_calls as phone_call
    where phone_call.id = call_id
      and (phone_call.caller_id = (select auth.uid()) or phone_call.assigned_to = (select auth.uid()))
  ));
grant select, insert, delete on public.phone_call_signals to authenticated;
grant all on public.phone_call_signals to service_role;

do $telephone_realtime$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'phone_calls'
    ) then
      alter publication supabase_realtime add table public.phone_calls;
    end if;
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'phone_call_signals'
    ) then
      alter publication supabase_realtime add table public.phone_call_signals;
    end if;
  end if;
end;
$telephone_realtime$;

-- -----------------------------------------------------------------------------
-- 20261107001000_general_admin_staff_management.sql
-- -----------------------------------------------------------------------------
alter table public.staff_permissions enable row level security;
drop policy if exists "Chief administrators manage staff permissions" on public.staff_permissions;
drop policy if exists "Administrators manage staff permissions" on public.staff_permissions;
create policy "Administrators manage staff permissions"
  on public.staff_permissions for all to authenticated
  using (public.is_portal_admin())
  with check (public.is_portal_admin());

alter table public.staff_roles enable row level security;
drop policy if exists "Users read their own staff roles" on public.staff_roles;
create policy "Users read their own staff roles"
  on public.staff_roles for select to authenticated
  using (user_id = (select auth.uid()) or public.is_portal_admin());
drop policy if exists "Chief administrators manage staff roles" on public.staff_roles;
drop policy if exists "Administrators manage staff roles" on public.staff_roles;
create policy "Administrators manage staff roles"
  on public.staff_roles for all to authenticated
  using (public.is_portal_admin())
  with check (public.is_portal_admin());

alter table public.staff_audit_logs enable row level security;
drop policy if exists "Chief administrators read audit logs" on public.staff_audit_logs;
drop policy if exists "Administrators read audit logs" on public.staff_audit_logs;
create policy "Administrators read audit logs"
  on public.staff_audit_logs for select to authenticated
  using (public.is_portal_admin());

-- -----------------------------------------------------------------------------
-- 20261107000900_police_radio_voice.sql
-- -----------------------------------------------------------------------------
-- Private voice signaling is restricted to police staff and administrators.
-- Disable "Allow public access" in Supabase Realtime settings to enforce private topics.
drop policy if exists "Police staff receive voice radio broadcasts" on realtime.messages;
create policy "Police staff receive voice radio broadcasts"
  on realtime.messages for select to authenticated
  using (
    (select realtime.topic()) like 'police-radio-voice:%'
    and realtime.messages.extension = 'broadcast'
    and (select public.can_use_police_radio())
  );

drop policy if exists "Police staff send voice radio broadcasts" on realtime.messages;
create policy "Police staff send voice radio broadcasts"
  on realtime.messages for insert to authenticated
  with check (
    (select realtime.topic()) like 'police-radio-voice:%'
    and realtime.messages.extension = 'broadcast'
    and (select public.can_use_police_radio())
  );

-- -----------------------------------------------------------------------------
-- 20261107001100_newsletter_consent.sql
-- -----------------------------------------------------------------------------
create table if not exists public.newsletter_consents (
  user_id uuid primary key references auth.users(id) on delete cascade,
  subscribed boolean not null,
  decision_at timestamptz not null default now(),
  source text not null check (source in ('email', 'google'))
);

create index if not exists newsletter_consents_subscribed_idx
  on public.newsletter_consents (decision_at)
  where subscribed;

alter table public.newsletter_consents enable row level security;
drop policy if exists "Users read their own newsletter preference" on public.newsletter_consents;
create policy "Users read their own newsletter preference"
  on public.newsletter_consents for select to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists "Users create their own newsletter preference" on public.newsletter_consents;
create policy "Users create their own newsletter preference"
  on public.newsletter_consents for insert to authenticated
  with check (user_id = (select auth.uid()));
drop policy if exists "Users update their own newsletter preference" on public.newsletter_consents;
create policy "Users update their own newsletter preference"
  on public.newsletter_consents for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
revoke all on public.newsletter_consents from public, anon;
grant select, insert, update on public.newsletter_consents to authenticated;
grant all on public.newsletter_consents to service_role;

create or replace function public.capture_signup_newsletter_consent()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if new.raw_user_meta_data ->> 'newsletter_consent' in ('true', 'false') then
    insert into public.newsletter_consents (user_id, subscribed, source)
    values (
      new.id,
      (new.raw_user_meta_data ->> 'newsletter_consent') = 'true',
      'email'
    )
    on conflict (user_id) do nothing;
  end if;

  return new;
end;
$function$;

revoke all on function public.capture_signup_newsletter_consent() from public, anon, authenticated;
drop trigger if exists capture_signup_newsletter_consent on auth.users;
create trigger capture_signup_newsletter_consent
  after insert on auth.users
  for each row execute function public.capture_signup_newsletter_consent();

-- -----------------------------------------------------------------------------
-- 20261107001200_legal_consent.sql
-- -----------------------------------------------------------------------------
create table if not exists public.legal_consents (
  user_id uuid not null references auth.users(id) on delete cascade,
  terms_version text not null,
  privacy_policy_version text not null,
  accepted_at timestamptz not null default now(),
  primary key (user_id, terms_version, privacy_policy_version)
);

alter table public.legal_consents enable row level security;
revoke all on public.legal_consents from public, anon, authenticated;
grant all on public.legal_consents to service_role;

-- -----------------------------------------------------------------------------
-- 20261107001300_police_dispatch_system.sql
-- -----------------------------------------------------------------------------
create table if not exists public.police_dispatch_incidents (
  id uuid primary key default gen_random_uuid(),
  incident_number text not null,
  title text not null,
  category text not null default 'その他',
  location text not null default '',
  reporter_name text not null default '',
  reporter_phone text not null default '',
  details text not null default '',
  priority text not null default '一般(C)',
  status text not null default '通報受付',
  assigned_unit text not null default '',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_police_dispatch_incidents_status on public.police_dispatch_incidents(status);
create index if not exists idx_police_dispatch_incidents_created_at on public.police_dispatch_incidents(created_at desc);

alter table public.police_dispatch_incidents enable row level security;

drop policy if exists "police_dispatch_incidents_select" on public.police_dispatch_incidents;
create policy "police_dispatch_incidents_select"
  on public.police_dispatch_incidents for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and (profiles.is_admin = true or profiles.is_police_staff = true)
    )
  );

drop policy if exists "police_dispatch_incidents_insert" on public.police_dispatch_incidents;
create policy "police_dispatch_incidents_insert"
  on public.police_dispatch_incidents for insert
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and (profiles.is_admin = true or profiles.is_police_staff = true)
    )
  );

drop policy if exists "police_dispatch_incidents_update" on public.police_dispatch_incidents;
create policy "police_dispatch_incidents_update"
  on public.police_dispatch_incidents for update
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and (profiles.is_admin = true or profiles.is_police_staff = true)
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and (profiles.is_admin = true or profiles.is_police_staff = true)
    )
  );

drop policy if exists "police_dispatch_incidents_delete" on public.police_dispatch_incidents;
create policy "police_dispatch_incidents_delete"
  on public.police_dispatch_incidents for delete
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and (profiles.is_admin = true or profiles.is_police_staff = true)
    )
  );

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'police_dispatch_incidents'
  ) then
    alter publication supabase_realtime add table public.police_dispatch_incidents;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 20261109000000_digital_products.sql
-- -----------------------------------------------------------------------------
create table if not exists public.digital_products (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text unique not null,
  description text not null default '',
  price_amount integer not null default 0,
  currency text not null default 'jpy',
  billing_type text not null default 'one_time',
  stripe_price_id text,
  file_path text,
  preview_audio_path text,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.digital_orders (
  id uuid primary key default gen_random_uuid(),
  order_number text unique not null,
  user_id uuid references public.profiles(id) on delete cascade,
  product_id uuid references public.digital_products(id) on delete restrict,
  stripe_session_id text unique,
  stripe_payment_intent text,
  amount_paid integer not null default 0,
  status text not null default 'completed',
  created_at timestamptz not null default now()
);

create table if not exists public.digital_licenses (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.digital_products(id) on delete cascade,
  order_id uuid references public.digital_orders(id) on delete set null,
  user_id uuid references public.profiles(id) on delete set null,
  license_key text not null,
  status text not null default 'available',
  assigned_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_digital_products_slug on public.digital_products(slug);
create index if not exists idx_digital_orders_user_id on public.digital_orders(user_id);
create index if not exists idx_digital_licenses_user_id on public.digital_licenses(user_id);

alter table public.digital_products enable row level security;
alter table public.digital_orders enable row level security;
alter table public.digital_licenses enable row level security;

drop policy if exists "digital_products_select_public" on public.digital_products;
create policy "digital_products_select_public"
  on public.digital_products for select
  using (is_published = true or exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

drop policy if exists "digital_products_admin_all" on public.digital_products;
create policy "digital_products_admin_all"
  on public.digital_products for all
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true))
  with check (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

drop policy if exists "digital_orders_select_own" on public.digital_orders;
create policy "digital_orders_select_own"
  on public.digital_orders for select
  using (user_id = auth.uid() or exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

drop policy if exists "digital_orders_insert_service" on public.digital_orders;
create policy "digital_orders_insert_service"
  on public.digital_orders for insert
  with check (user_id = auth.uid() or exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

drop policy if exists "digital_licenses_select_own" on public.digital_licenses;
create policy "digital_licenses_select_own"
  on public.digital_licenses for select
  using (user_id = auth.uid() or exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'digital_products'
  ) then
    alter publication supabase_realtime add table public.digital_products;
  end if;
end $$;

-- Final verification summary (false indicates a required migration object is absent).
SELECT object_name, to_regclass(object_name) IS NOT NULL AS installed
FROM (VALUES
  ('public.billing_subscriptions'),
  ('public.staff_permissions'),
  ('public.staff_roles'),
  ('public.police_radio_messages'),
  ('public.police_dispatch_incidents'),
  ('public.digital_products'),
  ('public.digital_orders'),
  ('public.digital_licenses'),
  ('public.resident_conversations'),
  ('public.resident_conversation_members'),
  ('public.resident_messages'),
  ('public.profile_change_requests'),
  ('public.resident_document_requests'),
  ('public.emergency_alerts'),
  ('public.staff_audit_logs'),
  ('public.staff_work_item_notes'),
  ('public.phone_number_requests'),
  ('public.phone_numbers'),
  ('public.phone_calls'),
  ('public.phone_call_signals'),
  ('public.newsletter_consents'),
  ('public.legal_consents')
) AS expected(object_name)
ORDER BY object_name;

SELECT email, is_admin, is_super_admin
FROM public.profiles
WHERE lower(btrim(email)) = 'reimari.nusi@gmail.com';

COMMIT;
