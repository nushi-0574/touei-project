'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';
import { useRouter } from 'next/navigation';
import Header from '../components/Header';
import Toast from '../components/Toast';
import { getErrorMessage } from '../../lib/errors';
import { getAuthPageHref, getAuthRedirectPath } from '../../lib/authRedirect';
import LegalConsentField from '../components/LegalConsentField';
import { getLegalConsentPath, getLegalConsentUrl, PRIVACY_POLICY_VERSION, TERMS_VERSION } from '../../lib/legalConsent';
import { ShieldCheck, Mail } from 'lucide-react';

type FieldErrors = { email?: string; password?: string };

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newsletterConsent, setNewsletterConsent] = useState(false);
  const [acceptedPolicies, setAcceptedPolicies] = useState(false);
  const [consentError, setConsentError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendNotice, setResendNotice] = useState('');
  const [formError, setFormError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [success, setSuccess] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const handleSignup = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError('');
    setFieldErrors({});

    const nextErrors: FieldErrors = {};
    if (!acceptedPolicies) {
      setConsentError('利用規約とプライバシーポリシーへの同意が必要です。');
      setFormError('アカウントを作成するには、利用規約とプライバシーポリシーへの同意が必要です。');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      nextErrors.email = '有効なメールアドレスを入力してください。';
    }
    if (password.length < 8) {
      nextErrors.password = 'パスワードは8文字以上で入力してください。';
    }
    if (Object.keys(nextErrors).length) {
      setFieldErrors(nextErrors);
      requestAnimationFrame(() => {
        if (nextErrors.email) emailRef.current?.focus();
        else passwordRef.current?.focus();
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: getLegalConsentUrl(
            window.location.origin,
            getAuthRedirectPath(window.location.search),
            { newsletter: String(newsletterConsent), newsletter_source: 'email' },
          ),
          data: {
            newsletter_consent: newsletterConsent,
            terms_version: TERMS_VERSION,
            privacy_policy_version: PRIVACY_POLICY_VERSION,
            terms_accepted_at: new Date().toISOString(),
          },
        },
      });
      if (error) throw error;

      if (data.session) {
        router.replace(getLegalConsentPath(
          getAuthRedirectPath(window.location.search),
          { newsletter: String(newsletterConsent), newsletter_source: 'email' },
        ));
        router.refresh();
      } else {
        setSuccess(true);
      }
    } catch (error) {
      console.error('アカウントの作成に失敗しました:', error);
      setFormError(getErrorMessage(error, 'アカウントの作成に失敗しました。入力内容をご確認ください。'));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (!acceptedPolicies) {
      setConsentError('Googleで続行する前に、利用規約とプライバシーポリシーへの同意が必要です。');
      return;
    }
    setOauthLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: getLegalConsentUrl(
            window.location.origin,
            getAuthRedirectPath(window.location.search),
            { newsletter: String(newsletterConsent), newsletter_source: 'google' },
          ),
        },
      });
      if (error) throw error;
    } catch (error) {
      setToast({ message: getErrorMessage(error, 'Google認証に失敗しました。'), type: 'error' });
      setOauthLoading(false);
    }
  };

  const handleResendConfirmation = async () => {
    setResendLoading(true);
    setResendNotice('');
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email.trim(),
        options: {
          emailRedirectTo: getLegalConsentUrl(
            window.location.origin,
            getAuthRedirectPath(window.location.search),
            { newsletter: String(newsletterConsent), newsletter_source: 'email' },
          ),
        },
      });
      if (error) throw error;
      setResendNotice('確認メールを再送信しました。受信箱をご確認ください。');
    } catch (error) {
      console.error('確認メールを再送信できませんでした:', error);
      setResendNotice(getErrorMessage(error, '確認メールを再送信できませんでした。時間をおいて再度お試しください。'));
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col font-sans">
      <Header />
      <main id="main-content" className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-12">

        {/* 7:3 非対称レイアウト */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-8 items-start">

          {/* 左側説明案内エリア (7割) */}
          <div className="space-y-6">
            <div className="bg-slate-900 text-white p-8 rounded-sm border border-slate-800 space-y-3">
              <span className="text-xs font-semibold text-emerald-400 bg-slate-800 border border-slate-700 px-2.5 py-0.5 inline-block">
                東栄アカウント 新規登録
              </span>
              <h1 className="text-2xl font-bold tracking-tight text-white">
                東栄県ポータル 新規アカウント作成
              </h1>
              <p className="text-[13px] text-slate-300 leading-relaxed">
                東栄アカウントを作成すると、住民サービス申請、イベント申込、コミュニティ掲示板への投稿、内部電話窓口等の全機能を利用できます。
              </p>
            </div>

            <div className="bg-white border border-slate-300 p-6 rounded-sm space-y-4">
              <h2 className="text-sm font-bold text-slate-900 border-b border-slate-200 pb-2 tracking-tight">
                登録手続きと個人情報の保護について
              </h2>
              <ul className="space-y-2.5 text-[13px] text-slate-700 leading-relaxed">
                <li className="flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 text-slate-600 shrink-0 mt-0.5" />
                  <span>登録に必要な情報はメールアドレスおよびパスワードのみです。</span>
                </li>
                <li className="flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 text-slate-600 shrink-0 mt-0.5" />
                  <span>氏名、住所、生年月日等の追加情報は登録完了後、必要に応じてマイページから登録いただけます。</span>
                </li>
                <li className="flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 text-slate-600 shrink-0 mt-0.5" />
                  <span>登録完了後、入力されたメールアドレスに確認用リンクが送信されます。</span>
                </li>
              </ul>
            </div>
          </div>

          {/* 右側登録フォーム (3割 - 420px) */}
          <div className="bg-white border border-slate-300 rounded-sm p-6 space-y-5">
            <div className="border-b border-slate-200 pb-3">
              <h2 className="text-base font-bold text-slate-900 tracking-tight">アカウント登録フォーム</h2>
              <p className="text-[13px] text-slate-600 mt-0.5">登録内容を入力してください。</p>
            </div>

            {success ? (
              <div className="p-4 bg-slate-100 border border-slate-300 rounded-sm text-[13px] text-slate-900 space-y-3 font-sans">
                <p className="font-bold flex items-center gap-1.5 text-blue-900">
                  <Mail className="w-4 h-4 text-blue-700" />
                  <span>確認メールを送信しました。</span>
                </p>
                <p><span className="font-mono font-bold">{email.trim()}</span> の受信箱をご確認ください。</p>
                <ol className="list-decimal space-y-1.5 pl-5 text-xs text-slate-700 leading-relaxed">
                  <li>確認メール内の認証URLを選択します。</li>
                  <li>ログイン完了後、必要に応じてマイページにてプロフィールを設定します。</li>
                </ol>
                {resendNotice && (
                  <p role="status" className="border border-slate-300 bg-white p-2.5 text-xs text-slate-800">{resendNotice}</p>
                )}
                <div className="flex flex-col gap-2 pt-2">
                  <Link
                    href="/login"
                    onClick={(event) => {
                      const destination = getAuthPageHref('/login', window.location.search);
                      if (destination !== '/login') {
                        event.preventDefault();
                        router.push(destination);
                      }
                    }}
                    className="w-full rounded-sm bg-slate-900 py-2.5 text-center text-xs font-semibold text-white"
                  >
                    ログイン画面へ移動
                  </Link>
                  <button
                    type="button"
                    onClick={() => void handleResendConfirmation()}
                    disabled={resendLoading}
                    className="w-full rounded-sm border border-slate-300 bg-white py-2 text-xs font-semibold text-slate-800 disabled:opacity-50"
                  >
                    {resendLoading ? '再送信中...' : '確認メールを再送信'}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <LegalConsentField
                  checked={acceptedPolicies}
                  onChange={(checked) => {
                    setAcceptedPolicies(checked);
                    setConsentError('');
                    if (checked) setFormError('');
                  }}
                  disabled={loading || oauthLoading}
                  error={consentError}
                />

                <div className="rounded-sm border border-slate-200 bg-slate-50 p-3.5 space-y-2 text-xs">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold text-slate-800">メールマガジンの配信希望</span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={newsletterConsent}
                      aria-label="メールマガジンを受け取る"
                      onClick={() => setNewsletterConsent((current) => !current)}
                      disabled={loading || oauthLoading}
                      className={`px-3 py-1 text-xs font-bold rounded-sm border transition-colors ${
                        newsletterConsent ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-300'
                      }`}
                    >
                      {newsletterConsent ? '希望する' : '希望しない'}
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    ※メールマガジンの受信設定は任意であり、アカウント作成の必須条件ではありません。
                  </p>
                </div>

                <button
                  onClick={handleGoogleLogin}
                  type="button"
                  disabled={oauthLoading || loading}
                  className="w-full py-2.5 px-4 border border-slate-300 rounded-sm text-[13px] font-semibold text-slate-800 bg-slate-50 hover:bg-slate-100 transition-colors disabled:opacity-50"
                >
                  {oauthLoading ? 'Google認証中...' : 'Googleアカウントで登録・ログイン'}
                </button>

                <div className="relative text-center my-4">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200" /></div>
                  <span className="relative bg-white px-2 text-[11px] text-slate-500 font-mono">またはメールアドレスで作成</span>
                </div>

                <form noValidate onSubmit={handleSignup} className="space-y-4">
                  {formError && (
                    <p role="alert" className="border border-red-300 bg-red-50 p-3 text-[13px] text-red-800 rounded-sm">
                      {formError}
                    </p>
                  )}
                  <div>
                    <label htmlFor="signup-email" className="block text-[13px] font-semibold text-slate-800 mb-1">メールアドレス</label>
                    <input
                      ref={emailRef}
                      id="signup-email"
                      type="email"
                      value={email}
                      onChange={(event) => {
                        setEmail(event.target.value);
                        setFieldErrors((current) => ({ ...current, email: undefined }));
                      }}
                      required
                      autoComplete="email"
                      inputMode="email"
                      aria-invalid={Boolean(fieldErrors.email)}
                      aria-describedby={fieldErrors.email ? 'signup-email-error' : undefined}
                      className="min-h-[44px] w-full border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 rounded-sm focus:outline-none focus:border-slate-800"
                    />
                    {fieldErrors.email && <p id="signup-email-error" className="mt-1 text-xs text-red-700">{fieldErrors.email}</p>}
                  </div>

                  <div>
                    <label htmlFor="signup-password" className="block text-[13px] font-semibold text-slate-800 mb-1">パスワード</label>
                    <div className="flex">
                      <input
                        ref={passwordRef}
                        id="signup-password"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(event) => {
                          setPassword(event.target.value);
                          setFieldErrors((current) => ({ ...current, password: undefined }));
                        }}
                        required
                        minLength={8}
                        autoComplete="new-password"
                        aria-invalid={Boolean(fieldErrors.password)}
                        aria-describedby={fieldErrors.password ? 'signup-password-error' : 'signup-password-help'}
                        className="min-h-[44px] min-w-0 flex-1 rounded-l-sm border border-r-0 border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-slate-800"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((visible) => !visible)}
                        aria-pressed={showPassword}
                        className="min-h-[44px] rounded-r-sm border border-slate-300 bg-slate-100 px-3 text-[13px] font-semibold text-slate-700 hover:bg-slate-200"
                      >
                        {showPassword ? '非表示' : '表示'}
                      </button>
                    </div>
                    {fieldErrors.password
                      ? <p id="signup-password-error" className="mt-1 text-xs text-red-700">{fieldErrors.password}</p>
                      : <p id="signup-password-help" className="mt-1 text-xs text-slate-500">※8文字以上で設定してください。</p>}
                  </div>

                  <button
                    type="submit"
                    disabled={loading || oauthLoading}
                    className="min-h-[44px] w-full rounded-sm bg-slate-900 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-slate-800 disabled:opacity-50 mt-2"
                  >
                    {loading ? 'アカウントを作成しています...' : 'アカウントを作成する'}
                  </button>
                </form>
              </>
            )}

            {!success && (
              <div className="pt-3 border-t border-slate-200 text-center text-[13px] text-slate-600">
                すでにアカウントをお持ちですか？{' '}
                <Link
                  href="/login"
                  onClick={(event) => {
                    const destination = getAuthPageHref('/login', window.location.search);
                    if (destination !== '/login') {
                      event.preventDefault();
                      router.push(destination);
                    }
                  }}
                  className="font-semibold text-blue-800 hover:underline"
                >
                  ログイン
                </Link>
              </div>
            )}
          </div>

        </div>
      </main>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}