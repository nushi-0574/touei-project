'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

export default function Header() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    async function checkUser() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setUser(session.user);
        const { data } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .single();
        if (data) setProfile(data);
      }
    }
    checkUser();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    router.push('/login');
  };

  return (
    <header className="bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Image
            src="/logo.png"
            alt="東栄ポータル ロゴ"
            width={28}
            height={28}
            className="object-contain"
          />
          <span className="font-semibold text-slate-900 text-sm tracking-tight">
            東栄ポータル
          </span>
        </div>

        <nav className="flex items-center space-x-6 text-sm">
          {user ? (
            <>
              <a
                href="/dashboard"
                className="text-slate-600 hover:text-[#0046ff] font-medium transition-colors"
              >
                メインメニュー
              </a>
              {profile?.role === 'admin' && (
                <a
                  href="/admin"
                  className="text-[#0046ff] hover:text-blue-700 font-medium transition-colors"
                >
                  管理者機能
                </a>
              )}
              <button
                onClick={handleLogout}
                className="text-slate-500 hover:text-slate-800 transition-colors"
              >
                ログアウト
              </button>
            </>
          ) : (
            <>
              <a
                href="/login"
                className="text-slate-600 hover:text-slate-900 font-medium"
              >
                ログイン
              </a>
              <a
                href="/signup"
                className="bg-[#0046ff] hover:bg-blue-700 text-white font-medium px-3.5 py-1.5 rounded text-xs transition-colors"
              >
                新規登録
              </a>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}