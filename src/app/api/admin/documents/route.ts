import { authorizeStaff } from '@/src/lib/server/authorization';
import { getSupabaseAdmin } from '@/src/lib/server/billing';
import { getWorkflowAssignees, isWorkflowAssignee } from '@/src/lib/server/workflow-assignees';
import { getErrorMessage } from '@/src/lib/errors';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const allowedStatuses = ['reviewing', 'needs_information', 'approved', 'rejected'] as const;
const assignmentRoles = ['administration_bureau'];
const assignmentPermissions = ['manage_applications', 'manage_residents'];

export async function GET(request: Request) {
  try {
    const authorized = await authorizeStaff(request, 'manage_documents');
    if (!authorized) return Response.json({ error: '公的書類の審査権限が必要です。' }, { status: 403 });

    const admin = getSupabaseAdmin();
    const { data: requests, error } = await admin
      .from('resident_document_requests')
      .select('id, user_id, document_type, purpose, status, staff_response, assigned_to, due_at, document_number, verification_token, issued_at, created_at')
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) throw error;

    const userIds = [...new Set((requests ?? []).map((item) => item.user_id))];
    const [profilesResult, assignees] = await Promise.all([
      userIds.length
        ? admin.from('profiles').select('id, full_name, email, address, birth_date').in('id', userIds)
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
    console.error('公的書類申請の取得に失敗しました:', error);
    return Response.json({ error: getErrorMessage(error, '公的書類申請を取得できませんでした。') }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const authorized = await authorizeStaff(request, 'manage_documents');
    if (!authorized) return Response.json({ error: '公的書類の審査権限が必要です。' }, { status: 403 });

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
      return Response.json({ error: '書類申請の更新内容を確認してください。' }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    if (typeof body.assignedTo === 'string'
      && !await isWorkflowAssignee(admin, body.assignedTo, assignmentRoles, assignmentPermissions)) {
      return Response.json({ error: '担当者には書類審査権限のある職員を指定してください。' }, { status: 400 });
    }
    const { data: current, error: currentError } = await admin
      .from('resident_document_requests')
      .select('id, user_id, status')
      .eq('id', body.requestId)
      .maybeSingle();
    if (currentError) throw currentError;
    if (!current) return Response.json({ error: '書類申請が見つかりません。' }, { status: 404 });
    if (current.status === 'approved' || current.status === 'rejected' || current.status === 'withdrawn') {
      return Response.json({ error: '処理済みの書類申請は変更できません。' }, { status: 409 });
    }

    const update: Record<string, string | null> = {
      status: body.status,
      staff_response: body.response.trim() || null,
      issued_by: body.status === 'approved' ? authorized.user.id : null,
    };
    if (body.assignedTo !== undefined) update.assigned_to = body.assignedTo as string | null;
    if (body.dueAt !== undefined) update.due_at = body.dueAt as string | null;
    const { data: updated, error } = await admin
      .from('resident_document_requests')
      .update(update)
      .eq('id', body.requestId)
      .select('id, user_id, status, document_number')
      .maybeSingle();
    if (error) throw error;
    if (!updated) return Response.json({ error: '書類申請が見つかりません。' }, { status: 404 });

    const { error: auditError } = await admin.from('staff_audit_logs').insert({
      actor_id: authorized.user.id,
      action: body.status.toUpperCase(),
      resource_type: 'resident_document_requests',
      resource_id: updated.id,
      target_user_id: updated.user_id,
      changed_fields: ['status', 'assigned_to', 'due_at', 'document_number'],
    });
    if (auditError) {
      console.error('書類を発行しましたが、監査記録を保存できませんでした:', auditError);
      return Response.json({
        issued: true,
        documentNumber: updated.document_number,
        error: '書類は発行されましたが、監査記録の保存に失敗しました。重複発行を避けるため再申請しないでください。',
      }, { status: 500 });
    }
    return Response.json({ updated: true, documentNumber: updated.document_number });
  } catch (error) {
    console.error('公的書類申請を更新できませんでした:', error);
    return Response.json({ error: getErrorMessage(error, '書類申請を更新できませんでした。') }, { status: 500 });
  }
}
