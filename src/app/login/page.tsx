'use client';

import { useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';
import { useRouter } from 'next/navigation';
import Header from '../components/Header';
import Toast from '../components/Toast';
import { getErrorMessage } from '../../lib/errors';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw error;
      router.push('/dashboard');
      router.refresh();
    } catch (error) {
      setToast({ message: getErrorMessage(error, 'ログインに失敗しました。'), type: 'error' });
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

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col text-slate-800">
      <Header />
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded p-8">
          <div className="mb-6 border-b border-slate-100 pb-4">
            <h1 className="text-xl font-bold text-slate-900">ログイン</h1>
            <p className="text-xs text-slate-500 mt-1">東栄ポータルへのサインイン</p>
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
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">メールアドレス</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="name@example.com"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-sm text-slate-800 focus:outline-none focus:border-[#0046ff]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">パスワード</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-sm text-slate-800 focus:outline-none focus:border-[#0046ff]"
              />
            </div>
            <button
              type="submit"
              disabled={loading || oauthLoading}
              className="w-full py-2 bg-[#0046ff] hover:bg-blue-700 text-white font-medium text-xs rounded transition-colors disabled:opacity-50 mt-2"
            >
              {loading ? '処理中...' : 'ログイン'}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-slate-500">
            アカウントをお持ちではありませんか？{' '}
            <Link href="/signup" className="text-[#0046ff] font-medium hover:underline">
              新規登録
            </Link>
          </p>
        </div>
      </div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}