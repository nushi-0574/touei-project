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
import { ShieldCheck, ChevronRight } from 'lucide-react';

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
    <div className="min-h-screen bg-[#f8fafc] flex flex-col text-slate-900 font-sans">
      <Header />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-12">

        {/* 7:3 非対称レイアウト */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-8 items-start">

          {/* 左側説明案内エリア (7割) */}
          <div className="space-y-6">
            <div className="bg-slate-900 text-white p-8 rounded-sm border border-slate-800 space-y-3">
              <span className="text-xs font-semibold text-emerald-400 bg-slate-800 border border-slate-700 px-2.5 py-0.5 inline-block">
                東栄県統合認証システム
              </span>
              <h1 className="text-2xl font-bold tracking-tight text-white">
                東栄アカウント ログイン
              </h1>
              <p className="text-[13px] text-slate-300 leading-relaxed">
                東栄県ポータルの住民サービス、行政手続き、各種相談窓口、および職員専用ポータルへアクセスするための統一認証画面です。
              </p>
            </div>

            <div className="bg-white border border-slate-300 p-6 rounded-sm space-y-4">
              <h2 className="text-sm font-bold text-slate-900 border-b border-slate-200 pb-2 tracking-tight">
                ログインにあたってのご留意事項
              </h2>
              <ul className="space-y-2 text-[13px] text-slate-700 leading-relaxed">
                <li className="flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 text-slate-600 shrink-0 mt-0.5" />
                  <span>Googleアカウントまたは登録済みのメールアドレス・パスワードで認証を行えます。</span>
                </li>
                <li className="flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 text-slate-600 shrink-0 mt-0.5" />
                  <span>初回ログイン時には、利用規約およびプライバシーポリシーへの明示的な同意が必要です。</span>
                </li>
                <li className="flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 text-slate-600 shrink-0 mt-0.5" />
                  <span>住民プロフィール・住所・連絡先情報は、ログイン後のマイページにて設定・確認できます。</span>
                </li>
              </ul>
            </div>
          </div>

          {/* 右側ログインフォーム (3割 - 400px) */}
          <div className="bg-white border border-slate-300 rounded-sm p-6 space-y-5">
            <div className="border-b border-slate-200 pb-3">
              <h2 className="text-base font-bold text-slate-900 tracking-tight">サインイン</h2>
              <p className="text-[13px] text-slate-600 mt-0.5">登録情報を入力してください。</p>
            </div>

            <LegalConsentField
              checked={acceptedPolicies}
              onChange={(checked) => {
                setAcceptedPolicies(checked);
                setConsentError('');
              }}
              disabled={oauthLoading || loading}
              error={consentError}
            />

            <button
              onClick={handleGoogleLogin}
              type="button"
              disabled={oauthLoading || loading}
              className="w-full py-2.5 px-4 border border-slate-300 rounded-sm text-[13px] font-semibold text-slate-800 bg-slate-50 hover:bg-slate-100 transition-colors flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              <span>{oauthLoading ? 'Google認証中...' : 'Googleアカウントでログイン'}</span>
            </button>

            <div className="relative text-center my-4">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200"></div></div>
              <span className="relative bg-white px-2 text-[11px] text-slate-500 font-mono">またはメールアドレスでログイン</span>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              {formError && <p role="alert" className="border border-red-300 bg-red-50 p-3 text-[13px] text-red-800 rounded-sm">{formError}</p>}
              <div>
                <label htmlFor="login-email" className="block text-[13px] font-semibold text-slate-800 mb-1">メールアドレス</label>
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
                  className="min-h-[44px] w-full px-3 py-2 bg-white border border-slate-300 rounded-sm text-sm text-slate-800 focus:outline-none focus:border-slate-800"
                />
              </div>
              <div>
                <label htmlFor="login-password" className="block text-[13px] font-semibold text-slate-800 mb-1">パスワード</label>
                <div className="flex">
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setFormError(''); }}
                    required
                    autoComplete="current-password"
                    placeholder="パスワードを入力"
                    className="min-h-[44px] min-w-0 flex-1 rounded-l-sm border border-r-0 border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-slate-800"
                  />
                  <button type="button" onClick={() => setShowPassword((visible) => !visible)} aria-pressed={showPassword} className="min-h-[44px] rounded-r-sm border border-slate-300 bg-slate-100 px-3 text-[13px] font-semibold text-slate-700 hover:bg-slate-200">
                    {showPassword ? '非表示' : '表示'}
                  </button>
                </div>
              </div>
              <button
                type="submit"
                disabled={loading || oauthLoading}
                className="min-h-[44px] w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-[13px] rounded-sm transition-colors disabled:opacity-50 mt-2"
              >
                {loading ? '認証処理中...' : 'ログイン'}
              </button>
            </form>

            <div className="pt-3 border-t border-slate-200 text-center text-[13px] text-slate-600">
              アカウントをお持ちでない方は{' '}
              <Link
                href="/signup"
                onClick={(event) => {
                  const destination = getAuthPageHref('/signup', window.location.search);
                  if (destination !== '/signup') {
                    event.preventDefault();
                    router.push(destination);
                  }
                }}
                className="text-blue-800 font-semibold hover:underline"
              >
                新規アカウント登録
              </Link>
            </div>
          </div>

        </div>
      </main>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}