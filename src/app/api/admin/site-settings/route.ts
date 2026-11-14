import { getAuthenticatedUser, getSupabaseAdmin } from '@/src/lib/server/billing';
import { getErrorMessage } from '@/src/lib/errors';

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return Response.json({ error: 'ログインが必要です。' }, { status: 401 });

    const supabaseAdmin = getSupabaseAdmin();
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .maybeSingle();

    if (!profile?.is_admin) {
      return Response.json({ error: '管理者権限が必要です。' }, { status: 403 });
    }

    const body = await request.json() as {
      site_title?: string;
      announcement_text?: string;
      support_email?: string;
      footer_text?: string;
    };

    const { error } = await supabaseAdmin
      .from('site_settings')
      .upsert({
        id: 1,
        ...(body.site_title !== undefined ? { site_title: body.site_title.trim() } : {}),
        ...(body.announcement_text !== undefined ? { announcement_text: body.announcement_text.trim() } : {}),
        ...(body.support_email !== undefined ? { support_email: body.support_email.trim() } : {}),
        ...(body.footer_text !== undefined ? { footer_text: body.footer_text.trim() } : {}),
        updated_at: new Date().toISOString(),
      });

    if (error) throw error;

    return Response.json({ success: true, message: 'サイト情報を更新しました。' });
  } catch (error) {
    console.error('Site settings update failed:', error);
    return Response.json({ error: getErrorMessage(error, 'サイト情報の更新に失敗しました。') }, { status: 500 });
  }
}
