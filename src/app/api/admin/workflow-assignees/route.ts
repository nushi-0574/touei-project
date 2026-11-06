import { authorizeStaff } from '@/src/lib/server/authorization';
import { getSupabaseAdmin } from '@/src/lib/server/billing';
import { getWorkflowAssignees } from '@/src/lib/server/workflow-assignees';
import { getErrorMessage } from '@/src/lib/errors';

export async function GET(request: Request) {
  const workItemType = new URL(request.url).searchParams.get('workItemType');
  try {
    if (workItemType === 'support') {
      const authorized = await authorizeStaff(request, 'manage_support');
      if (!authorized) return Response.json({ error: '問い合わせ対応権限が必要です。' }, { status: 403 });
      const admin = getSupabaseAdmin();
      const [{ data: profile, error: profileError }, { data: roleRows, error: rolesError }, { data: permissionRows, error: permissionsError }] = await Promise.all([
        admin.from('profiles').select('is_admin').eq('id', authorized.user.id).maybeSingle(),
        admin.from('staff_roles').select('role').eq('user_id', authorized.user.id),
        admin.from('staff_permissions').select('permission').eq('user_id', authorized.user.id),
      ]);
      if (profileError) throw profileError;
      if (rolesError) throw rolesError;
      if (permissionsError) throw permissionsError;
      const roles = new Set((roleRows ?? []).map((item) => item.role as string));
      const permissions = new Set((permissionRows ?? []).map((item) => item.permission as string));
      const canManageAll = profile?.is_admin === true || permissions.has('manage_support');
      const categoryRoles: Record<string, string> = {
        operations_question: 'operations_bureau',
        operations_proposal: 'operations_bureau',
        development_question: 'development_bureau',
        development_proposal: 'development_bureau',
        appeal: 'administration_bureau',
      };
      const categories = canManageAll
        ? Object.keys(categoryRoles)
        : Object.entries(categoryRoles).filter(([, role]) => roles.has(role)).map(([category]) => category);
      if (!canManageAll && !categories.length) {
        return Response.json({ error: '担当する問い合わせ窓口がありません。' }, { status: 403 });
      }

      const assigneesByCategory: Record<string, Awaited<ReturnType<typeof getWorkflowAssignees>>> = {};
      await Promise.all(categories.map(async (category) => {
        const role = categoryRoles[category];
        assigneesByCategory[category] = await getWorkflowAssignees(
          admin,
          canManageAll ? [role] : [role],
          canManageAll ? ['manage_support'] : [],
        );
      }));
      if (canManageAll) {
        assigneesByCategory.general = await getWorkflowAssignees(admin, [], ['manage_support']);
      }
      return Response.json({ assigneesByCategory });
    }

    if (workItemType !== 'application') {
      return Response.json({ error: '業務種別の指定が不正です。' }, { status: 400 });
    }
    const authorized = await authorizeStaff(request, 'manage_applications');
    if (!authorized) return Response.json({ error: '申請審査権限が必要です。' }, { status: 403 });

    const assignees = await getWorkflowAssignees(
      getSupabaseAdmin(),
      ['administration_bureau'],
      ['manage_applications'],
    );
    return Response.json({ assignees });
  } catch (error) {
    console.error('業務担当者一覧を取得できませんでした:', error);
    return Response.json({ error: getErrorMessage(error, '業務担当者一覧を取得できませんでした。') }, { status: 500 });
  }
}
