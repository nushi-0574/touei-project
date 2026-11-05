'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function Header() {
  const [isOpen, setIsOpen] = useState(false);

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
          <Link href="/admin" className="hover:text-blue-400 transition-colors">管理者</Link>
        </nav>

        {/* モバイル用ハンバーガーボタン */}
        <button
          onClick={toggleMenu}
          className="md:hidden p-2 text-slate-300 hover:text-white focus:outline-none"
          aria-label="メニューを開閉"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {isOpen ? (
              // バツ印アイコン
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              // ハンバーガーアイコン（三本線）
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {/* モバイル用ドロップダウンメニュー */}
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
          <Link
            href="/admin"
            onClick={() => setIsOpen(false)}
            className="block py-2 text-slate-200 hover:text-white"
          >
            管理者パネル
          </Link>
        </nav>
      )}
    </header>
  );
}