import { authorizeStaff } from '@/src/lib/server/authorization';
import { getSupabaseAdmin } from '@/src/lib/server/billing';
import { getWorkflowAssignees, isWorkflowAssignee } from '@/src/lib/server/workflow-assignees';
import { getErrorMessage } from '@/src/lib/errors';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const allowedStatuses = ['reviewing', 'needs_information', 'approved', 'rejected'] as const;
const assignmentRoles = ['administration_bureau'];
const assignmentPermissions = ['manage_residents'];

export async function GET(request: Request) {
  try {
    const authorized = await authorizeStaff(request, 'manage_profile_changes');
    if (!authorized) return Response.json({ error: '管理局の住民情報変更対応権限が必要です。' }, { status: 403 });

    const admin = getSupabaseAdmin();
    const { data: requests, error } = await admin
      .from('profile_change_requests')
      .select('id, user_id, requested_changes, reason, status, staff_response, assigned_to, due_at, created_at, updated_at')
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) throw error;

    const userIds = [...new Set((requests ?? []).map((item) => item.user_id))];
    const [profilesResult, assignees] = await Promise.all([
      userIds.length
        ? admin.from('profiles').select('id, full_name, email').in('id', userIds)
        : Promise.resolve({ data: [], error: null }),
      getWorkflowAssignees(admin, assignmentRoles, assignmentPermissions),
    ]);
    const { data: profiles, error: profilesError } = profilesResult;
    if (profilesError) throw profilesError;
    const profilesById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
    return Response.json({
      requests: (requests ?? []).map((item) => ({
        ...item,
        resident: profilesById.get(item.user_id) ?? null,
      })),
      assignees,
    });
  } catch (error) {
    console.error('住民情報変更申請の取得に失敗しました:', error);
    return Response.json({ error: getErrorMessage(error, '住民情報変更申請を取得できませんでした。') }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const authorized = await authorizeStaff(request, 'manage_profile_changes');
    if (!authorized) return Response.json({ error: '管理局の住民情報変更対応権限が必要です。' }, { status: 403 });

    const body = await request.json() as {
      requestId?: unknown;
      status?: unknown;
      response?: unknown;
      assignedTo?: unknown;
      dueAt?: unknown;
    };
    if (
      typeof body.requestId !== 'string'
      || !uuidPattern.test(body.requestId)
      || typeof body.status !== 'string'
      || !allowedStatuses.includes(body.status as (typeof allowedStatuses)[number])
      || typeof body.response !== 'string'
      || body.response.length > 2000
      || (body.assignedTo !== undefined && body.assignedTo !== null
        && (typeof body.assignedTo !== 'string' || !uuidPattern.test(body.assignedTo)))
      || (body.dueAt !== undefined && body.dueAt !== null
        && (typeof body.dueAt !== 'string' || !Number.isFinite(Date.parse(body.dueAt))))
    ) {
      return Response.json({ error: '申請の更新内容を確認してください。' }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    const { data: target, error: targetError } = await admin
      .from('profile_change_requests')
      .select('user_id')
      .eq('id', body.requestId)
      .maybeSingle();
    if (targetError) throw targetError;
    if (!target) return Response.json({ error: '申請が見つかりません。' }, { status: 404 });

    const assignment: { assigned_to?: string | null; due_at?: string | null } = {};
    if (typeof body.assignedTo === 'string') {
      if (!await isWorkflowAssignee(admin, body.assignedTo, assignmentRoles, assignmentPermissions)) {
        return Response.json({ error: '担当者には管理局の職員を指定してください。' }, { status: 400 });
      }
      assignment.assigned_to = body.assignedTo;
    } else if (body.assignedTo === null) {
      assignment.assigned_to = null;
    }
    if (body.dueAt !== undefined) assignment.due_at = body.dueAt as string | null;
    if (Object.keys(assignment).length) {
      const { error } = await admin
        .from('profile_change_requests')
        .update(assignment)
        .eq('id', body.requestId);
      if (error) throw error;
    }

    const { error } = await admin.rpc('review_profile_change_request', {
      request_id: body.requestId,
      new_status: body.status,
      response: body.response,
      reviewer_id: authorized.user.id,
    });
    if (error) throw error;
    return Response.json({ updated: true });
  } catch (error) {
    console.error('住民情報変更申請を更新できませんでした:', error);
    return Response.json({ error: getErrorMessage(error, '申請を更新できませんでした。') }, { status: 500 });
  }
}
