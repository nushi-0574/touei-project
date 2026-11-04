'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useRouter } from 'next/navigation';
import Header from '../components/Header';
import Toast from '../components/Toast';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  
  // 初期値は固定の年（例: 2000年）にしておき、マウント後に現在の年に合わせる
  const [currentYear, setCurrentYear] = useState(2026);
  const [birthYear, setBirthYear] = useState('2006');
  const [birthMonth, setBirthMonth] = useState('1');
  const [birthDay, setBirthDay] = useState('1');

  const [gender, setGender] = useState('未選択');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const year = new Date().getFullYear();
    setCurrentYear(year);
    setBirthYear(String(year - 20));
  }, []);

  const years = Array.from({ length: 101 }, (_, i) => currentYear - i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const days = Array.from({ length: 31 }, (_, i) => i + 1);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const formattedMonth = String(birthMonth).padStart(2, '0');
    const formattedDay = String(birthDay).padStart(2, '0');
    const birthDate = `${birthYear}-${formattedMonth}-${formattedDay}`;

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          birth_date: birthDate,
          gender: gender,
        }
      }
    });

    if (error) {
      setToast({ message: error.message, type: 'error' });
      setLoading(false);
    } else {
      if (data.user) {
        await supabase.from('profiles').upsert({
          id: data.user.id,
          email: email,
          full_name: fullName,
          birth_date: birthDate,
          gender: gender,
          role: 'customer'
        });
      }
      setSuccess(true);
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/dashboard`
      }
    });
    if (error) {
      setToast({ message: error.message, type: 'error' });
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
              <a
                href="/login"
                className="block text-center bg-[#0046ff] text-white py-2 rounded font-medium mt-4"
              >
                ログイン画面へ戻る
              </a>
            </div>
          ) : (
            <>
              <button
                onClick={handleGoogleLogin}
                type="button"
                className="w-full mb-6 py-2 px-4 border border-slate-300 rounded text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 transition-colors flex items-center justify-center space-x-2"
              >
                <span>Googleで登録・ログイン</span>
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
                      onChange={(e) => setBirthYear(e.target.value)}
                      className="px-2 py-2 bg-white border border-slate-300 rounded text-xs text-slate-800 focus:outline-none focus:border-[#0046ff]"
                    >
                      {years.map((y) => (
                        <option key={y} value={y}>{y}年</option>
                      ))}
                    </select>

                    <select
                      value={birthMonth}
                      onChange={(e) => setBirthMonth(e.target.value)}
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
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-sm text-slate-800 focus:outline-none focus:border-[#0046ff]"
                  >
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
                  disabled={loading}
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
              <a href="/login" className="text-[#0046ff] font-medium hover:underline">
                ログイン
              </a>
            </p>
          )}
        </div>
      </div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}