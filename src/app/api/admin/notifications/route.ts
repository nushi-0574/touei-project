import { authorizeStaff } from '@/src/lib/server/authorization';
import { getSupabaseAdmin } from '@/src/lib/server/billing';
import { getErrorMessage } from '@/src/lib/errors';

export async function GET(request: Request) {
  try {
    const authorized = await authorizeStaff(request, 'send_notifications');
    if (!authorized) return Response.json({ error: '通知配信権限が必要です。' }, { status: 403 });

    const { data, error } = await getSupabaseAdmin()
      .from('profiles')
      .select('id, full_name, resident_status')
      .eq('resident_status', 'active')
      .order('full_name')
      .limit(1000);
    if (error) throw error;
    return Response.json({ recipients: data });
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

    const { error } = await admin.from('resident_notifications').insert({
      user_id: body.userId,
      category: typeof body.category === 'string' ? body.category.slice(0, 100) : 'service',
      title: body.title.trim(),
      body: body.body.trim(),
      href,
    });
    if (error) throw error;
    return Response.json({ sent: true }, { status: 201 });
  } catch (error) {
    console.error('住民通知を配信できませんでした:', error);
    return Response.json({ error: getErrorMessage(error, '住民通知を配信できませんでした。') }, { status: 500 });
  }
}
