import { authorizeStaff } from '@/src/lib/server/authorization';
import { getSupabaseAdmin } from '@/src/lib/server/billing';
import { getErrorMessage } from '@/src/lib/errors';

const notificationCategories = ['service', 'news', 'emergency', 'community', 'account'] as const;

export async function GET(request: Request) {
  try {
    const authorized = await authorizeStaff(request, 'send_notifications');
    if (!authorized) return Response.json({ error: '通知配信権限が必要です。' }, { status: 403 });

    const admin = getSupabaseAdmin();
    const [{ data, error }, { data: history, error: historyError }] = await Promise.all([
      admin
      .from('profiles')
      .select('id, full_name, resident_status')
      .eq('resident_status', 'active')
      .order('full_name')
      .limit(1000),
      admin
        .from('resident_notifications')
        .select('id, user_id, category, title, body, created_at')
        .eq('created_by', authorized.user.id)
        .order('created_at', { ascending: false })
        .limit(100),
    ]);
    if (error) throw error;
    if (historyError) throw historyError;
    return Response.json({ recipients: data, history });
  } catch (error) {
    console.error('通知配信先の取得に失敗しました:', error);
    return Response.json({ error: getErrorMessage(error, '通知配信先を取得できませんでした。') }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const authorized = await authorizeStaff(request, 'send_notifications');
    if (!authorized) return Response.json({ error: '通知配信権限が必要です。' }, { status: 403 });

    const body = await request.json() as {
      userId?: unknown;
      category?: unknown;
      title?: unknown;
      body?: unknown;
      href?: unknown;
    };
    if (
      typeof body.userId !== 'string'
      || typeof body.title !== 'string'
      || typeof body.body !== 'string'
      || body.title.trim().length < 1
      || body.title.length > 200
      || body.body.trim().length < 1
      || body.body.length > 5000
    ) {
      return Response.json({ error: '配信先、件名、本文を正しく入力してください。' }, { status: 400 });
    }
    const href = typeof body.href === 'string' && body.href.trim() ? body.href.trim() : null;
    if (href && (!href.startsWith('/') || href.startsWith('//'))) {
      return Response.json({ error: 'リンク先にはサイト内パスを指定してください。' }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    const { data: recipient, error: recipientError } = await admin
      .from('profiles')
      .select('resident_status')
      .eq('id', body.userId)
      .maybeSingle();
    if (recipientError) throw recipientError;
    if (!recipient || recipient.resident_status !== 'active') {
      return Response.json({ error: '有効な配信先住民が見つかりません。' }, { status: 404 });
    }

    const category = typeof body.category === 'string' ? body.category.trim() : 'service';
    if (!notificationCategories.includes(category as (typeof notificationCategories)[number])) {
      return Response.json({ error: '通知カテゴリを正しく入力してください。' }, { status: 400 });
    }
    if (category !== 'emergency') {
      const { data: preference, error: preferenceError } = await admin
        .from('resident_notification_preferences')
        .select('enabled')
        .eq('user_id', body.userId)
        .eq('category', category)
        .maybeSingle();
      if (preferenceError) throw preferenceError;
      if (preference?.enabled === false) {
        return Response.json({ error: 'この住民は該当カテゴリの通知を受け取らない設定です。' }, { status: 409 });
      }
    }

    const { data: notification, error } = await admin.from('resident_notifications').insert({
      user_id: body.userId,
      created_by: authorized.user.id,
      category,
      title: body.title.trim(),
      body: body.body.trim(),
      href,
    }).select('id, user_id, category, title, body, created_at').single();
    if (error) throw error;
    const { error: auditError } = await admin.from('staff_audit_logs').insert({
      actor_id: authorized.user.id,
      action: 'INSERT',
      resource_type: 'resident_notifications',
      resource_id: notification.id,
      target_user_id: notification.user_id,
      changed_fields: ['category', 'title', 'body', 'href'],
    });
    if (auditError) {
      console.error('通知は配信されましたが、監査記録を保存できませんでした:', auditError);
      return Response.json({
        sent: true,
        error: '通知は配信されましたが、監査記録の保存に失敗しました。重複配信を避けるため再送しないでください。',
      }, { status: 500 });
    }
    return Response.json({ sent: true, notification }, { status: 201 });
  } catch (error) {
    console.error('住民通知を配信できませんでした:', error);
    return Response.json({ error: getErrorMessage(error, '住民通知を配信できませんでした。') }, { status: 500 });
  }
}
