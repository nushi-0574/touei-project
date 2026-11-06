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
import { getLegalConsentUrl } from '../../lib/legalConsent';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [acceptedPolicies, setAcceptedPolicies] = useState(false);
  const [consentError, setConsentError] = useState('');
  const emailRef = useRef<HTMLInputElement>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setFormError('');

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw error;
      router.replace(getAuthRedirectPath(window.location.search));
      router.refresh();
    } catch (error) {
      setFormError(getErrorMessage(error, 'メールアドレスまたはパスワードを確認してください。'));
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
          ),
        },
      });
      if (error) throw error;
    } catch (error) {
      setToast({ message: getErrorMessage(error, 'Google認証に失敗しました。'), type: 'error' });
      setOauthLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col text-slate-800">
      <Header />
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded p-8">
          <div className="mb-6 border-b border-slate-100 pb-4">
            <h1 className="text-xl font-bold text-slate-900">ログイン</h1>
            <p className="text-xs text-slate-500 mt-1">東栄ポータルへのサインイン</p>
          </div>

          <div className="mb-4">
            <LegalConsentField
              checked={acceptedPolicies}
              onChange={(checked) => {
                setAcceptedPolicies(checked);
                setConsentError('');
              }}
              disabled={oauthLoading || loading}
              error={consentError}
            />
          </div>
          <button
            onClick={handleGoogleLogin}
            type="button"
            disabled={oauthLoading || loading}
            className="w-full mb-6 py-2 px-4 border border-slate-300 rounded text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 transition-colors flex items-center justify-center space-x-2 disabled:opacity-50"
          >
            <span>{oauthLoading ? '処理中...' : 'Googleでログイン'}</span>
          </button>

          <div className="relative mb-6 text-center">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200"></div></div>
            <span className="relative bg-white px-2 text-[10px] text-slate-400 uppercase">またはメールアドレスでログイン</span>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            {formError && <p role="alert" className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">{formError}</p>}
            <div>
              <label htmlFor="login-email" className="block text-sm font-semibold text-slate-700 mb-1">メールアドレス</label>
              <input
                ref={emailRef}
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setFormError(''); }}
                required
                autoComplete="email"
                inputMode="email"
                placeholder="name@example.com"
                className="min-h-11 w-full px-3 py-2 bg-white border border-slate-300 rounded text-base text-slate-800 focus:outline-none focus:border-[#0046ff] focus:ring-2 focus:ring-blue-100"
              />
            </div>
            <div>
              <label htmlFor="login-password" className="block text-sm font-semibold text-slate-700 mb-1">パスワード</label>
              <div className="flex">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setFormError(''); }}
                  required
                  autoComplete="current-password"
                  placeholder="パスワードを入力"
                  className="min-h-11 min-w-0 flex-1 rounded-l border border-r-0 border-slate-300 bg-white px-3 py-2 text-base text-slate-800 focus:z-10 focus:border-[#0046ff] focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
                <button type="button" onClick={() => setShowPassword((visible) => !visible)} aria-pressed={showPassword} className="min-h-11 rounded-r border border-slate-300 bg-slate-50 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-100">
                  {showPassword ? '隠す' : '表示'}
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={loading || oauthLoading}
              className="min-h-11 w-full py-2 bg-[#0046ff] hover:bg-blue-700 text-white font-semibold text-sm rounded transition-colors disabled:opacity-50 mt-2"
            >
              {loading ? '処理中...' : 'ログイン'}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-slate-500">
            アカウントをお持ちではありませんか？{' '}
            <Link
              href="/signup"
              onClick={(event) => {
                const destination = getAuthPageHref('/signup', window.location.search);
                if (destination !== '/signup') {
                  event.preventDefault();
                  router.push(destination);
                }
              }}
              className="text-[#0046ff] font-medium hover:underline"
            >
              新規登録
            </Link>
          </p>
        </div>
      </div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}