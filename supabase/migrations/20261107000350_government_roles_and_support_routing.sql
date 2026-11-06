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
create policy "Residents and assigned offices read tickets"
  on public.support_tickets for select to authenticated
  using (
    (user_id = (select auth.uid()) and public.is_active_resident())
    or public.can_manage_support_category(category)
  );

drop policy if exists "Support staff update tickets" on public.support_tickets;
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
