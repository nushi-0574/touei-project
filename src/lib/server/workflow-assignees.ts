import { getSupabaseAdmin } from './billing';

type Assignee = { id: string; full_name: string | null; email: string | null };
type AdminClient = ReturnType<typeof getSupabaseAdmin>;

export async function getWorkflowAssignees(
  admin: AdminClient,
  roles: string[],
  permissions: string[],
): Promise<Assignee[]> {
  const [roleResult, permissionResult, adminsResult] = await Promise.all([
    roles.length
      ? admin.from('staff_roles').select('user_id').in('role', roles)
      : Promise.resolve({ data: [], error: null }),
    permissions.length
      ? admin.from('staff_permissions').select('user_id').in('permission', permissions)
      : Promise.resolve({ data: [], error: null }),
    admin.from('profiles').select('id').eq('is_admin', true).limit(500),
  ]);
  if (roleResult.error) throw roleResult.error;
  if (permissionResult.error) throw permissionResult.error;
  if (adminsResult.error) throw adminsResult.error;

  const ids = [...new Set([
    ...(roleResult.data ?? []).map((item) => item.user_id),
    ...(permissionResult.data ?? []).map((item) => item.user_id),
    ...(adminsResult.data ?? []).map((item) => item.id),
  ])];
  if (!ids.length) return [];

  const { data, error } = await admin
    .from('profiles')
    .select('id, full_name, email')
    .in('id', ids)
    .order('full_name')
    .limit(500);
  if (error) throw error;
  return data ?? [];
}

export async function isWorkflowAssignee(
  admin: AdminClient,
  userId: string,
  roles: string[],
  permissions: string[],
): Promise<boolean> {
  const assignees = await getWorkflowAssignees(admin, roles, permissions);
  return assignees.some((assignee) => assignee.id === userId);
}
