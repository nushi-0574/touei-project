import { getAuthenticatedUser, getSupabaseAdmin } from '@/src/lib/server/supabase';
import { PRIVACY_POLICY_VERSION, TERMS_VERSION } from '@/src/lib/legalConsent';
import { getErrorMessage } from '@/src/lib/errors';

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return Response.json({ error: '同意の記録にはログインが必要です。' }, { status: 401 });

    const body: unknown = await request.json();
    if (
      typeof body !== 'object'
      || body === null
      || !('accepted' in body && body.accepted === true)
      || !('termsVersion' in body && body.termsVersion === TERMS_VERSION)
      || !('privacyPolicyVersion' in body && body.privacyPolicyVersion === PRIVACY_POLICY_VERSION)
    ) {
      return Response.json({ error: '利用規約とプライバシーポリシーへの同意を確認できません。' }, { status: 400 });
    }

    const { error } = await getSupabaseAdmin()
      .from('legal_consents')
      .upsert(
        {
          user_id: user.id,
          terms_version: TERMS_VERSION,
          privacy_policy_version: PRIVACY_POLICY_VERSION,
          accepted_at: new Date().toISOString(),
        },
        {
          onConflict: 'user_id,terms_version,privacy_policy_version',
          ignoreDuplicates: true,
        },
      );
    if (error) throw error;

    return Response.json({ success: true });
  } catch (error) {
    console.error('規約同意の記録に失敗しました:', error);
    return Response.json({ error: getErrorMessage(error, '規約同意を記録できませんでした。') }, { status: 500 });
  }
}
