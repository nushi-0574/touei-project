'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';
import { useRouter } from 'next/navigation';
import Header from '../components/Header';
import Toast from '../components/Toast';
import { getErrorMessage } from '../../lib/errors';

type FieldErrors = { email?: string; password?: string };

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
      });
      if (error) throw error;

      if (data.session) {
        router.replace('/dashboard');
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
    setOauthLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/dashboard`,
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
      const { error } = await supabase.auth.resend({ type: 'signup', email: email.trim() });
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
    <div className="min-h-screen bg-slate-100 text-slate-800 flex flex-col">
      <Header />
      <main id="main-content" className="flex-1 flex items-center justify-center px-4 py-8 sm:py-12">
        <section className="max-w-md w-full bg-white border border-slate-200 rounded p-5 sm:p-8">
          <div className="mb-6 border-b border-slate-100 pb-4">
            <h1 className="text-xl font-bold text-slate-900">新規アカウント登録</h1>
            <p className="text-xs text-slate-500 mt-1">メールアドレスを確認して、東栄ポータルを利用開始します。</p>
          </div>

          {success ? (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded text-sm text-blue-900 space-y-3">
              <p className="font-semibold">確認メールを送信しました。</p>
              <p><span className="font-semibold">{email.trim()}</span> の受信箱をご確認ください。</p>
              <ol className="list-decimal space-y-1 pl-5 text-xs leading-relaxed">
                <li>確認メールを開き、記載されたリンクを選択します。</li>
                <li>ログイン後、マイページから必要な住民プロフィールを登録します。</li>
              </ol>
              {resendNotice && (
                <p role="status" className="rounded border border-blue-200 bg-white p-2 text-xs">{resendNotice}</p>
              )}
              <div className="flex flex-col gap-2 pt-2 sm:flex-row">
                <Link href="/login" className="flex-1 rounded bg-[#0046ff] py-2 text-center text-xs font-semibold text-white">
                  ログイン画面へ
                </Link>
                <button
                  type="button"
                  onClick={() => void handleResendConfirmation()}
                  disabled={resendLoading}
                  className="flex-1 rounded border border-blue-300 bg-white py-2 text-xs font-semibold text-blue-800 disabled:opacity-50"
                >
                  {resendLoading ? '再送信中...' : '確認メールを再送信'}
                </button>
              </div>
            </div>
          ) : (
            <>
              <button
                onClick={handleGoogleLogin}
                type="button"
                disabled={oauthLoading || loading}
                className="w-full mb-6 min-h-11 px-4 border border-slate-300 rounded text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                {oauthLoading ? 'Googleで認証中...' : 'Googleで登録・ログイン'}
              </button>

              <div className="relative mb-6 text-center">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200" /></div>
                <span className="relative bg-white px-2 text-[10px] text-slate-500">またはメールアドレスで登録</span>
              </div>

              <form noValidate onSubmit={handleSignup} className="space-y-4">
                {formError && (
                  <p role="alert" className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">
                    {formError}
                  </p>
                )}
                <div>
                  <label htmlFor="signup-email" className="mb-1 block text-sm font-semibold text-slate-700">メールアドレス</label>
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
                    className="min-h-11 w-full rounded border border-slate-300 bg-white px-3 py-2 text-base text-slate-800 focus:border-[#0046ff] focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                  {fieldErrors.email && <p id="signup-email-error" className="mt-1 text-xs text-red-700">{fieldErrors.email}</p>}
                </div>

                <div>
                  <label htmlFor="signup-password" className="mb-1 block text-sm font-semibold text-slate-700">パスワード</label>
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
                      className="min-h-11 min-w-0 flex-1 rounded-l border border-r-0 border-slate-300 bg-white px-3 py-2 text-base text-slate-800 focus:z-10 focus:border-[#0046ff] focus:outline-none focus:ring-2 focus:ring-blue-100"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((visible) => !visible)}
                      aria-pressed={showPassword}
                      className="min-h-11 rounded-r border border-slate-300 bg-slate-50 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                    >
                      {showPassword ? '隠す' : '表示'}
                    </button>
                  </div>
                  {fieldErrors.password
                    ? <p id="signup-password-error" className="mt-1 text-xs text-red-700">{fieldErrors.password}</p>
                    : <p id="signup-password-help" className="mt-1 text-xs text-slate-500">8文字以上で設定してください。</p>}
                </div>

                <p className="rounded bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
                  氏名・住所・生年月日などは登録後にマイページから必要な範囲で登録できます。アカウント作成時にはメールアドレスとパスワードのみを使用します。
                </p>

                <button
                  type="submit"
                  disabled={loading || oauthLoading}
                  className="min-h-11 w-full rounded bg-[#0046ff] py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? 'アカウントを作成しています...' : '登録する'}
                </button>
              </form>
            </>
          )}

          {!success && (
            <p className="mt-6 text-center text-sm text-slate-600">
              すでにアカウントをお持ちですか？{' '}
              <Link href="/login" className="font-semibold text-[#0046ff] hover:underline">ログイン</Link>
            </p>
          )}
        </section>
      </main>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
