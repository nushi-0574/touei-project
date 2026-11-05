'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';

export default function Header() {
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    async function checkAuth() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);

        // profiles テーブルから管理者権限（is_admin）をチェック
        const { data: profile } = await supabase
          .from('profiles')
          .select('is_admin')
          .eq('id', session.user.id)
          .single();

        if (profile && profile.is_admin === true) {
          setIsAdmin(true);
        }
      }
    }
    checkAuth();
  }, []);

  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  return (
    <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
        
        {/* ロゴ・タイトル */}
        <div className="flex items-center gap-2">
          <Link href="/" className="text-sm font-bold tracking-wider hover:text-slate-300">
            東栄県公式ポータル
          </Link>
        </div>

        {/* PC用ナビゲーション */}
        <nav className="hidden md:flex items-center gap-4 text-xs">
          <Link href="/" className="hover:text-blue-400 transition-colors">ホーム</Link>
          <Link href="/toeiken" className="hover:text-blue-400 transition-colors">住民ポータル</Link>
          <Link href="/toeiken/police-result" className="hover:text-blue-400 transition-colors">合否照会</Link>
          
          {/* 管理者権限がある場合のみ表示 */}
          {isAdmin && (
            <Link href="/admin" className="text-amber-400 hover:text-amber-300 font-semibold transition-colors">
              管理者パネル
            </Link>
          )}

          {/* メールアドレス・マイページ情報の表示（復活） */}
          {user ? (
            <div className="flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded border border-slate-700 text-slate-300">
              <span className="text-[11px] font-mono text-slate-300">{user.email}</span>
              <Link href="/toeiken/dashboard" className="text-blue-400 hover:underline font-semibold">マイページ</Link>
            </div>
          ) : (
            <Link href="/toeiken" className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded text-white font-semibold transition-colors">
              ログイン
            </Link>
          )}
        </nav>

        {/* モバイル用ハンバーガーボタン */}
        <button
          onClick={toggleMenu}
          className="md:hidden p-2 text-slate-300 hover:text-white focus:outline-none"
          aria-label="メニューを開閉"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {isOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {/* モバイル用ドロップダウンメニュー（ハンバーガー展開時） */}
      {isOpen && (
        <nav className="md:hidden bg-slate-800 border-t border-slate-700 px-4 py-4 space-y-3 text-xs">
          <Link
            href="/"
            onClick={() => setIsOpen(false)}
            className="block py-2 text-slate-200 hover:text-white border-b border-slate-700/50"
          >
            ホーム
          </Link>
          <Link
            href="/toeiken"
            onClick={() => setIsOpen(false)}
            className="block py-2 text-slate-200 hover:text-white border-b border-slate-700/50"
          >
            住民ポータル・マイページ
          </Link>
          <Link
            href="/toeiken/police-result"
            onClick={() => setIsOpen(false)}
            className="block py-2 text-slate-200 hover:text-white border-b border-slate-700/50"
          >
            警察官採用試験 合否照会
          </Link>

          {/* 管理者権限がある場合のみ表示 */}
          {isAdmin && (
            <Link
              href="/admin"
              onClick={() => setIsOpen(false)}
              className="block py-2 text-amber-400 hover:text-amber-300 font-semibold border-b border-slate-700/50"
            >
              管理者パネル
            </Link>
          )}

          {/* モバイル用メール・ログイン情報 */}
          <div className="pt-2">
            {user ? (
              <div className="space-y-2 bg-slate-900/50 p-3 rounded border border-slate-700">
                <p className="text-[11px] text-slate-400 font-mono break-all">ログイン中: {user.email}</p>
                <Link
                  href="/toeiken/dashboard"
                  onClick={() => setIsOpen(false)}
                  className="block py-2 text-center bg-blue-600 hover:bg-blue-500 rounded text-white font-semibold transition-colors"
                >
                  マイページへ移動
                </Link>
              </div>
            ) : (
              <Link
                href="/toeiken"
                onClick={() => setIsOpen(false)}
                className="block py-2 text-center bg-blue-600 hover:bg-blue-500 rounded text-white font-semibold transition-colors"
              >
                ログイン・登録
              </Link>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}