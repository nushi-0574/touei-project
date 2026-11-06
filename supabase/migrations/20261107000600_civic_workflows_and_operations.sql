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

alter table public.profile_change_requests
  add constraint profile_change_requests_payload_valid
  check (public.is_valid_profile_change_data(requested_changes));

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
create policy "Residents read their profile change requests"
  on public.profile_change_requests for select to authenticated
  using (user_id = (select auth.uid()) and public.is_active_resident());
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
create policy "Management bureau processes profile change requests"
  on public.profile_change_requests for all to authenticated
  using (public.can_manage_profile_changes())
  with check (public.can_manage_profile_changes());
grant select, insert, update on public.profile_change_requests to authenticated;
grant all on public.profile_change_requests to service_role;

alter table public.resident_document_requests enable row level security;
create policy "Residents read their document requests"
  on public.resident_document_requests for select to authenticated
  using (user_id = (select auth.uid()) and public.is_active_resident());
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
create policy "Residents manage their notification preferences"
  on public.resident_notification_preferences for all to authenticated
  using (user_id = (select auth.uid()) and public.is_active_resident())
  with check (user_id = (select auth.uid()) and public.is_active_resident());
grant select, insert, update, delete on public.resident_notification_preferences to authenticated;
grant all on public.resident_notification_preferences to service_role;

alter table public.emergency_alerts enable row level security;
create policy "Residents read active emergency alerts"
  on public.emergency_alerts for select to anon, authenticated
  using (
    (status = 'published' and starts_at <= now() and ends_at > now())
    or public.can_manage_emergency_alerts()
  );
create policy "Authorized staff manage emergency alerts"
  on public.emergency_alerts for all to authenticated
  using (public.can_manage_emergency_alerts())
  with check (public.can_manage_emergency_alerts());
grant select on public.emergency_alerts to anon, authenticated;
grant insert, update, delete on public.emergency_alerts to authenticated;
grant all on public.emergency_alerts to service_role;

alter table public.staff_audit_logs enable row level security;
create policy "Chief administrators read audit logs"
  on public.staff_audit_logs for select to authenticated
  using (exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and is_super_admin is true
  ));
grant select on public.staff_audit_logs to authenticated;
grant all on public.staff_audit_logs to service_role;

alter table public.staff_work_item_notes enable row level security;
create policy "Assigned staff read internal work notes"
  on public.staff_work_item_notes for select to authenticated
  using (public.can_manage_work_item(work_item_type, work_item_id));
create policy "Assigned staff write internal work notes"
  on public.staff_work_item_notes for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and public.can_manage_work_item(work_item_type, work_item_id)
  );
grant select, insert on public.staff_work_item_notes to authenticated;
grant all on public.staff_work_item_notes to service_role;

drop policy if exists "Residents read and submit their applications" on public.service_applications;
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

create trigger audit_service_applications
after insert or update or delete on public.service_applications
for each row execute function public.audit_civic_change('id');
create trigger audit_support_tickets
after insert or update or delete on public.support_tickets
for each row execute function public.audit_civic_change('id');
create trigger audit_profile_change_requests
after insert or update or delete on public.profile_change_requests
for each row execute function public.audit_civic_change('id');
create trigger audit_document_requests
after insert or update or delete on public.resident_document_requests
for each row execute function public.audit_civic_change('id');
create trigger audit_emergency_alerts
after insert or update or delete on public.emergency_alerts
for each row execute function public.audit_civic_change('id');
create trigger audit_profile_data
after update on public.profiles
for each row execute function public.audit_civic_change('id');
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
