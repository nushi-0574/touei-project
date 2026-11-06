import { authorizeStaff } from '@/src/lib/server/authorization';
import { getSupabaseAdmin } from '@/src/lib/server/billing';
import { getErrorMessage } from '@/src/lib/errors';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: Request) {
  try {
    const authorized = await authorizeStaff(request, 'manage_phone_numbers');
    if (!authorized) return Response.json({ error: '電話番号を管理する権限が必要です。' }, { status: 403 });

    const admin = getSupabaseAdmin();
    const { data: requests, error } = await admin.from('phone_number_requests')
      .select('id, user_id, preferred_number, status, staff_response, reviewed_by, reviewed_at, created_at')
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) throw error;

    const userIds = [...new Set((requests ?? []).map((item) => item.user_id))];
    if (!userIds.length) return Response.json({ requests: [] });
    const [{ data: profiles, error: profilesError }, { data: numbers, error: numbersError }] = await Promise.all([
      admin.from('profiles').select('id, full_name, email, resident_status').in('id', userIds),
      admin.from('phone_numbers').select('user_id, phone_number, status').in('user_id', userIds),
    ]);
    if (profilesError) throw profilesError;
    if (numbersError) throw numbersError;
    const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
    const numberByUserId = new Map((numbers ?? []).map((phone) => [phone.user_id, phone]));
    return Response.json({
      requests: (requests ?? []).map((item) => ({
        ...item,
        resident: profileById.get(item.user_id) ?? null,
        phone: numberByUserId.get(item.user_id) ?? null,
      })),
    });
  } catch (error) {
    console.error('電話番号申請の取得に失敗しました:', error);
    return Response.json({ error: getErrorMessage(error, '電話番号申請を取得できませんでした。') }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const authorized = await authorizeStaff(request, 'manage_phone_numbers');
    if (!authorized) return Response.json({ error: '電話番号を管理する権限が必要です。' }, { status: 403 });

    const body = await request.json() as { requestId?: unknown; status?: unknown; response?: unknown; usePreferredNumber?: unknown };
    if (
      typeof body.requestId !== 'string'
      || !uuidPattern.test(body.requestId)
      || (body.status !== 'approved' && body.status !== 'rejected')
      || typeof body.response !== 'string'
      || body.response.length > 2000
      || (body.usePreferredNumber !== undefined && typeof body.usePreferredNumber !== 'boolean')
    ) {
      return Response.json({ error: '審査内容を確認してください。' }, { status: 400 });
    }

    const { data, error } = await getSupabaseAdmin().rpc('review_phone_number_request', {
      target_request_id: body.requestId,
      new_status: body.status,
      response: body.response,
      reviewer_id: authorized.user.id,
      use_preferred_number: body.usePreferredNumber === true,
    });
    if (error?.code === '23505') {
      return Response.json({ error: '希望番号はすでに使用されています。自動発行で承認してください。' }, { status: 409 });
    }
    if (error) throw error;
    return Response.json({ reviewed: true, phoneNumber: data });
  } catch (error) {
    console.error('電話番号申請の審査に失敗しました:', error);
    return Response.json({ error: getErrorMessage(error, '電話番号申請を審査できませんでした。') }, { status: 500 });
  }
}
