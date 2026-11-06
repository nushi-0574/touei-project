import { authorizeStaff } from '@/src/lib/server/authorization';
import { getSupabaseAdmin } from '@/src/lib/server/billing';
import { getErrorMessage } from '@/src/lib/errors';

const STAFF_ROLES = [
  'operations_bureau',
  'administration_bureau',
  'development_bureau',
  'police',
  'fire',
  'corporate',
  'general',
] as const;

export async function PUT(request: Request) {
  try {
    const authorized = await authorizeStaff(request, 'manage_staff');
    if (!authorized?.isSuperAdmin) {
      return Response.json({ error: '主任管理者のみロールを変更できます。' }, { status: 403 });
    }

    const body = await request.json() as { userId?: unknown; roles?: unknown };
    if (
      typeof body.userId !== 'string'
      || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.userId)
      || !Array.isArray(body.roles)
      || !body.roles.every((role): role is (typeof STAFF_ROLES)[number] =>
        typeof role === 'string' && STAFF_ROLES.includes(role as (typeof STAFF_ROLES)[number]))
    ) {
      return Response.json({ error: 'ユーザーまたはロールの指定が不正です。' }, { status: 400 });
    }

    const roles = [...new Set(body.roles)];
    const admin = getSupabaseAdmin();
    const { data: target, error: targetError } = await admin
      .from('profiles')
      .select('id')
      .eq('id', body.userId)
      .maybeSingle();
    if (targetError) throw targetError;
    if (!target) return Response.json({ error: '対象のユーザーが見つかりません。' }, { status: 404 });

    const { error } = await admin.rpc('set_staff_roles', {
      target_user_id: body.userId,
      new_roles: roles,
      assigned_by_user_id: authorized.user.id,
    });
    if (error) throw error;
    return Response.json({ success: true });
  } catch (error) {
    console.error('職員ロールの更新に失敗しました:', error);
    return Response.json({ error: getErrorMessage(error, '職員ロールを更新できませんでした。') }, { status: 500 });
  }
}
