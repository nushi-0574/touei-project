'use client';

import { useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';
import { useRouter } from 'next/navigation';
import Header from '../components/Header';
import Toast from '../components/Toast';
import { getDaysInMonth } from '../../lib/dates';
import { getErrorMessage } from '../../lib/errors';
import { useCurrentYear } from '../../lib/useCurrentYear';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  
  const currentYear = useCurrentYear();
  const [birthYear, setBirthYear] = useState(String(currentYear - 20));
  const [birthMonth, setBirthMonth] = useState('1');
  const [birthDay, setBirthDay] = useState('1');

  const [gender, setGender] = useState('');
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  const years = Array.from({ length: 121 }, (_, i) => currentYear - i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const days = Array.from({ length: getDaysInMonth(Number(birthYear), Number(birthMonth)) }, (_, i) => i + 1);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const birthDate = `${birthYear}-${String(birthMonth).padStart(2, '0')}-${String(birthDay).padStart(2, '0')}`;

    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            birth_date: birthDate,
            gender,
          },
        },
      });
      if (error) throw error;

      if (data.user) {
        const { error: profileError } = await supabase.from('profiles').upsert({
          id: data.user.id,
          email: email.trim(),
          full_name: fullName.trim(),
          birth_date: birthDate,
          gender,
        });
        if (profileError) {
          console.error('プロフィールの初期登録に失敗しました:', profileError);
          setToast({
            message: `アカウントは作成されましたが、プロフィールの初期登録に失敗しました: ${profileError.message}`,
            type: 'error',
          });
        }
      }
      if (data.session) {
        router.replace('/dashboard');
        router.refresh();
      } else {
        setSuccess(true);
      }
    } catch (error) {
      setToast({ message: getErrorMessage(error, 'アカウントの作成に失敗しました。'), type: 'error' });
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

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 flex flex-col">
      <Header />
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded p-8">
          <div className="mb-6 border-b border-slate-100 pb-4">
            <h1 className="text-xl font-bold text-slate-900">新規アカウント登録</h1>
            <p className="text-xs text-slate-500 mt-1">東栄ポータルの利用を開始します</p>
          </div>

          {success ? (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800 space-y-3">
              <p className="font-semibold">確認メールを送信しました。</p>
              <p>メールボックスをご確認いただき、記載されたリンクからアカウントを有効化してください。</p>
              <Link
                href="/login"
                className="block text-center bg-[#0046ff] text-white py-2 rounded font-medium mt-4"
              >
                ログイン画面へ戻る
              </Link>
            </div>
          ) : (
            <>
              <button
                onClick={handleGoogleLogin}
                type="button"
                disabled={oauthLoading || loading}
                className="w-full mb-6 py-2 px-4 border border-slate-300 rounded text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 transition-colors flex items-center justify-center space-x-2 disabled:opacity-50"
              >
                <span>{oauthLoading ? '処理中...' : 'Googleで登録・ログイン'}</span>
              </button>

              <div className="relative mb-6 text-center">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200"></div></div>
                <span className="relative bg-white px-2 text-[10px] text-slate-400 uppercase">またはメールアドレスで登録</span>
              </div>

              <form onSubmit={handleSignup} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">氏名</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    placeholder="東栄 太郎"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-sm text-slate-800 focus:outline-none focus:border-[#0046ff]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">生年月日</label>
                  <div className="grid grid-cols-3 gap-2">
                    <select
                      value={birthYear}
                      onChange={(e) => {
                        const year = e.target.value;
                        setBirthYear(year);
                        setBirthDay(String(Math.min(Number(birthDay), getDaysInMonth(Number(year), Number(birthMonth)))));
                      }}
                      className="px-2 py-2 bg-white border border-slate-300 rounded text-xs text-slate-800 focus:outline-none focus:border-[#0046ff]"
                    >
                      {years.map((y) => (
                        <option key={y} value={y}>{y}年</option>
                      ))}
                    </select>

                    <select
                      value={birthMonth}
                      onChange={(e) => {
                        const month = e.target.value;
                        setBirthMonth(month);
                        setBirthDay(String(Math.min(Number(birthDay), getDaysInMonth(Number(birthYear), Number(month)))));
                      }}
                      className="px-2 py-2 bg-white border border-slate-300 rounded text-xs text-slate-800 focus:outline-none focus:border-[#0046ff]"
                    >
                      {months.map((m) => (
                        <option key={m} value={m}>{m}月</option>
                      ))}
                    </select>

                    <select
                      value={birthDay}
                      onChange={(e) => setBirthDay(e.target.value)}
                      className="px-2 py-2 bg-white border border-slate-300 rounded text-xs text-slate-800 focus:outline-none focus:border-[#0046ff]"
                    >
                      {days.map((d) => (
                        <option key={d} value={d}>{d}日</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">性別</label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-sm text-slate-800 focus:outline-none focus:border-[#0046ff]"
                  >
                    <option value="" disabled>選択してください</option>
                    <option value="男性">男性</option>
                    <option value="女性">女性</option>
                    <option value="その他">その他</option>
                    <option value="回答しない">回答しない</option>
                  </select>
                </div>

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
                  {loading ? '処理中...' : '登録する'}
                </button>
              </form>
            </>
          )}

          {!success && (
            <p className="mt-6 text-center text-xs text-slate-500">
              すでにアカウントをお持ちですか？{' '}
              <Link href="/login" className="text-[#0046ff] font-medium hover:underline">
                ログイン
              </Link>
            </p>
          )}
        </div>
      </div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}