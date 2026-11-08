'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '../../components/Header';
import { ContentSkeleton } from '../../components/LoadingScreen';
import { supabase } from '../../../lib/supabase';
import { getAuthRedirectPath } from '../../../lib/authRedirect';
import { PRIVACY_POLICY_VERSION, TERMS_VERSION } from '../../../lib/legalConsent';
import { getErrorMessage } from '../../../lib/errors';
import LegalConsentField from '../../components/LegalConsentField';

export default function LegalConsentPage() {
  const [message, setMessage] = useState('');
  const [processing, setProcessing] = useState(true);
  const [accepted, setAccepted] = useState(false);
  const [confirmRequested, setConfirmRequested] = useState(false);
  const router = useRouter();

  useEffect(() => {
    let active = true;

    async function recordConsent() {
      setProcessing(true);
      try {
        const query = window.location.search;
        const params = new URLSearchParams(query);
        const nextPath = getAuthRedirectPath(query);
        if (
          params.get('terms_version') !== TERMS_VERSION
          || params.get('privacy_policy_version') !== PRIVACY_POLICY_VERSION
        ) {
          throw new Error('同意内容のバージョンを確認できません。登録画面からもう一度お手続きください。');
        }
        const newsletterConsent = params.get('newsletter');
        const newsletterSource = params.get('newsletter_source');
        const hasNewsletterConsent = newsletterConsent !== null || newsletterSource !== null;
        if (hasNewsletterConsent && (
          (newsletterConsent !== 'true' && newsletterConsent !== 'false')
          || (newsletterSource !== 'email' && newsletterSource !== 'google')
        )) {
          throw new Error('メールマガジンの受信設定を確認できません。登録画面からもう一度お手続きください。');
        }

        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (!session) {
          const loginUrl = `/login?next=${encodeURIComponent(window.location.pathname + query)}`;
          router.replace(loginUrl);
          return;
        }

        if (!confirmRequested) {
          if (active) setProcessing(false);
          return;
        }

        setMessage('');
        const response = await fetch('/api/legal-consent', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            accepted: true,
            termsVersion: TERMS_VERSION,
            privacyPolicyVersion: PRIVACY_POLICY_VERSION,
          }),
        });
        const result: unknown = await response.json();
        if (!response.ok) {
          const errorMessage = typeof result === 'object' && result !== null
            && 'error' in result && typeof result.error === 'string'
            ? result.error
            : '同意を記録できませんでした。';
          throw new Error(errorMessage);
        }
        if (hasNewsletterConsent && newsletterSource === 'google') {
          const { error: newsletterError } = await supabase
            .from('newsletter_consents')
            .upsert({
              user_id: session.user.id,
              subscribed: newsletterConsent === 'true',
              source: newsletterSource,
              decision_at: new Date().toISOString(),
            }, { onConflict: 'user_id' });
          if (newsletterError) throw newsletterError;
        } else if (hasNewsletterConsent) {
          const { data: newsletterPreference, error: newsletterError } = await supabase
            .from('newsletter_consents')
            .select('user_id')
            .eq('user_id', session.user.id)
            .maybeSingle();
          if (newsletterError) throw newsletterError;
          if (!newsletterPreference) {
            throw new Error('メールマガジンの受信設定を記録できませんでした。データベース設定をご確認ください。');
          }
        }
        if (active) {
          router.replace(nextPath);
          router.refresh();
        }
      } catch (error) {
        console.error('アカウント作成時の同意処理に失敗しました:', error);
        if (active) {
          setMessage(getErrorMessage(error, 'アカウント作成時の同意と受信設定を記録できませんでした。'));
          setProcessing(false);
          setConfirmRequested(false);
        }
      }
    }

    void recordConsent();
    return () => {
      active = false;
    };
  }, [router, confirmRequested]);

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-sans flex flex-col">
      <Header />
      <main className="flex-1 max-w-xl mx-auto px-4 py-12 w-full">
        <section className="rounded-sm border border-slate-300 bg-white p-6 space-y-4">
          <h1 className="text-lg font-bold tracking-tight text-slate-900 border-b border-slate-200 pb-2">
            利用規約およびプライバシーポリシーへの同意
          </h1>
          {processing ? (
            <div className="mt-4"><ContentSkeleton rows={2} /></div>
          ) : (
            <div className="space-y-4 text-[13px]">
              <p className="leading-relaxed text-slate-700">
                アカウントを利用するには、利用規約とプライバシーポリシーの内容を確認し、同意を確定してください。
              </p>
              <LegalConsentField
                checked={accepted}
                onChange={(checked) => {
                  setAccepted(checked);
                  setMessage('');
                }}
                error={message}
              />
              <button
                type="button"
                onClick={() => setConfirmRequested(true)}
                disabled={!accepted}
                className="mt-4 w-full rounded-sm bg-slate-900 hover:bg-slate-800 px-4 py-3 text-[13px] font-semibold text-white transition-colors disabled:opacity-50"
              >
                同意してサービスを利用開始する
              </button>
              <p className="text-xs text-slate-500 leading-relaxed">
                ※同意履歴はアカウント情報と紐づけて記録・保管されます。
              </p>
              {message && (
                <p className="text-xs text-slate-700">
                  お手続きを再試行する場合は <Link href="/login" className="font-semibold text-blue-800 underline">ログイン画面</Link> からお進みください。
                </p>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
