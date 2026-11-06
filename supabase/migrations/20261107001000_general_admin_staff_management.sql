-- Allow administrators to manage staff permissions, organization roles, and audit-log access.
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
