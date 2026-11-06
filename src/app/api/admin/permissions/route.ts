import { authorizeStaff, isStaffPermission, STAFF_PERMISSIONS } from '@/src/lib/server/authorization';
import { getSupabaseAdmin } from '@/src/lib/server/billing';
import { getErrorMessage } from '@/src/lib/errors';

export async function PUT(request: Request) {
  try {
    const authorized = await authorizeStaff(request, 'manage_staff');
    if (!authorized?.isSuperAdmin) {
      return Response.json({ error: '主任管理者のみ職員権限を変更できます。' }, { status: 403 });
    }

    const body = await request.json() as { userId?: unknown; permissions?: unknown };
    if (typeof body.userId !== 'string' || !Array.isArray(body.permissions)) {
      return Response.json({ error: 'ユーザーと権限の指定が不正です。' }, { status: 400 });
    }
    const permissions = [...new Set(body.permissions)];
    if (!permissions.every(isStaffPermission)) {
      return Response.json({ error: '設定できない権限が含まれています。' }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    const { data: target, error: targetError } = await admin
      .from('profiles')
      .select('is_super_admin')
      .eq('id', body.userId)
      .maybeSingle();
    if (targetError) throw targetError;
    if (!target) return Response.json({ error: '対象のユーザーが見つかりません。' }, { status: 404 });
    if (target.is_super_admin) {
      return Response.json({ error: '主任管理者の権限は変更できません。' }, { status: 400 });
    }

    if (permissions.length) {
      const { error: insertError } = await admin.from('staff_permissions').upsert(
        permissions.map((permission) => ({
          user_id: body.userId,
          permission,
          assigned_by: authorized.user.id,
        })),
        { onConflict: 'user_id,permission' },
      );
      if (insertError) {
        console.error('職員権限の保存に失敗しました:', insertError);
        return Response.json(
          { error: `権限を保存できませんでした。${STAFF_PERMISSIONS.length}種類の権限を確認し、再試行してください。` },
          { status: 500 },
        );
      }
    }
    let deleteQuery = admin.from('staff_permissions').delete().eq('user_id', body.userId);
    if (permissions.length) {
      deleteQuery = deleteQuery.not('permission', 'in', `(${permissions.join(',')})`);
    }
    const { error: deleteError } = await deleteQuery;
    if (deleteError) throw deleteError;
    return Response.json({ success: true });
  } catch (error) {
    console.error('職員権限の更新に失敗しました:', error);
    return Response.json({ error: getErrorMessage(error, '職員権限を更新できませんでした。') }, { status: 500 });
  }
}
