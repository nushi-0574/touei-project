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
create policy "Users can read their own staff permissions"
  on public.staff_permissions for select to authenticated
  using (user_id = (select auth.uid()) or public.has_staff_permission('manage_staff'));
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
create policy "Residents read and submit their applications"
  on public.service_applications for select to authenticated
  using (
    (user_id = (select auth.uid()) and public.is_active_resident())
    or public.has_staff_permission('manage_applications')
  );
create policy "Residents submit applications"
  on public.service_applications for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and public.is_active_resident()
    and status = 'submitted'
    and staff_note is null
  );
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
create policy "Residents read and update their own notifications"
  on public.resident_notifications for select to authenticated
  using (user_id = (select auth.uid()) and public.is_active_resident());
create policy "Residents mark their own notifications read"
  on public.resident_notifications for update to authenticated
  using (user_id = (select auth.uid()) and public.is_active_resident())
  with check (user_id = (select auth.uid()) and public.is_active_resident());
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
create policy "Residents read published events"
  on public.events for select to authenticated
  using (
    (status = 'published' and public.is_active_resident())
    or public.has_staff_permission('manage_events')
  );
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
create policy "Residents and event staff read registrations"
  on public.event_registrations for select to authenticated
  using (
    (user_id = (select auth.uid()) and public.is_active_resident())
    or public.has_staff_permission('manage_events')
  );
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
create policy "Residents read published posts and their own"
  on public.community_posts for select to authenticated
  using (
    ((status = 'published' or user_id = (select auth.uid())) and public.is_active_resident())
    or public.has_staff_permission('moderate_community')
  );
create policy "Residents submit posts for moderation"
  on public.community_posts for insert to authenticated
  with check (user_id = (select auth.uid()) and public.is_active_resident() and status = 'pending');
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
create policy "Residents submit comments for moderation"
  on public.community_comments for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and public.is_active_resident()
    and status = 'pending'
    and exists (select 1 from public.community_posts where id = post_id and status = 'published')
  );
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
create policy "Residents create and view their own reports"
  on public.community_reports for select to authenticated
  using (
    (reporter_id = (select auth.uid()) and public.is_active_resident())
    or public.has_staff_permission('moderate_community')
  );
create policy "Residents report posts"
  on public.community_reports for insert to authenticated
  with check (reporter_id = (select auth.uid()) and public.is_active_resident() and status = 'open');
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
create policy "Residents and support staff read tickets"
  on public.support_tickets for select to authenticated
  using (
    (user_id = (select auth.uid()) and public.is_active_resident())
    or public.has_staff_permission('manage_support')
  );
create policy "Residents open tickets"
  on public.support_tickets for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and public.is_active_resident()
    and status = 'open'
    and priority = 'normal'
  );
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
create policy "Residents read published locations"
  on public.map_locations for select to authenticated
  using (
    (is_published and public.is_active_resident())
    or public.has_staff_permission('manage_map')
  );
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
create policy "Residents read published recruitment"
  on public.recruitment_postings for select to authenticated
  using (
    (is_published and public.is_active_resident())
    or public.has_staff_permission('manage_recruitment')
  );
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
create policy "Applicants and recruitment staff read applications"
  on public.recruitment_applications for select to authenticated
  using (
    (user_id = (select auth.uid()) and public.is_active_resident())
    or public.has_staff_permission('manage_recruitment')
  );
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
