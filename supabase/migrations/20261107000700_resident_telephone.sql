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
begin
  if final_status not in ('completed', 'cancelled') then
    raise exception 'Invalid telephone call status';
  end if;
  select * into target_call
  from public.phone_calls
  where id = target_call_id
  for update;
  if not found or target_call.status not in ('queued', 'connecting') then
    raise exception 'This telephone call is no longer active';
  end if;
  if final_status = 'cancelled' then
    if target_call.caller_id <> (select auth.uid()) then
      raise exception 'Only the caller can cancel this call';
    end if;
  elsif target_call.assigned_to is distinct from (select auth.uid()) then
    raise exception 'Only the assigned staff member can end this call';
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

do $realtime$
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
$realtime$;
