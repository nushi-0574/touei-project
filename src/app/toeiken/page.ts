'use client';

import { useState } from 'react';
import Header from '../components/Header';
import Breadcrumbs from '../components/Breadcrumbs';
import Toast from '../components/Toast';

export default function ToeikenAuthPage() {
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const handleDiscordAuth = () => {
    // Discord OAuth認証のエンドポイントへリダイレクト（将来的なSupabase連携や外部連携のプレースホルダー）
    setToast({ message: 'Discord認証機能へ接続します...', type: 'info' });
    // window.location.href = 'DiscordのOAuthURL';
  };

  const handleRobloxAuth = () => {
    // Roblox Open Cloud / OAuth認証のエンドポイントへリダイレクト
    setToast({ message: 'Roblox認証機能へ接続します...', type: 'info' });
    // window.location.href = 'RobloxのOAuthURL';
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 flex flex-col">
      <Header />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 flex-1 w-full">
        <Breadcrumbs items={[{ label: '東栄県ユーザー認証' }]} />

        <div className="bg-white border border-slate-200 rounded p-8">
          <div className="mb-6 pb-4 border-b border-slate-100">
            <h1 className="text-xl font-bold text-slate-900">東栄県ユーザー専用ポータル</h1>
            <p className="text-xs text-slate-500 mt-1">
              東栄プロジェクト（東栄県）の住民・関係者向けのアカウント登録およびログインを行います。
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-8">
            {/* Discord認証ボックス */}
            <div className="border border-slate-200 rounded p-6 flex flex-col justify-between bg-slate-50/50">
              <div>
                <div className="flex items-center justify-space mb-3">
                  <span className="font-bold text-slate-900 text-base">Discord アカウント</span>
                  <span className="text-[10px] bg-indigo-50 text-indigo-600 border border-indigo-200 px-2 py-0.5 rounded font-medium ml-auto">
                    コミュニティ連携
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed mb-6">
                  東栄プロジェクトの公式Discordサーバーアカウントを使用して、新規登録およびログインを行います。
                </p>
              </div>
              <button
                onClick={handleDiscordAuth}
                className="w-full py-2.5 bg-[#5865F2] hover:bg-[#4752C4] text-white text-xs font-medium rounded transition-colors text-center"
              >
                Discordで登録・ログイン
              </button>
            </div>

            {/* Roblox認証ボックス */}
            <div className="border border-slate-200 rounded p-6 flex flex-col justify-between bg-slate-50/50">
              <div>
                <div className="flex items-center justify-space mb-3">
                  <span className="font-bold text-slate-900 text-base">Roblox アカウント</span>
                  <span className="text-[10px] bg-red-50 text-red-600 border border-red-200 px-2 py-0.5 rounded font-medium ml-auto">
                    バーチャル空間連携
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed mb-6">
                  東栄県（Roblox環境）のアカウント情報を使用して、身元確認およびポータルへのログインを行います。
                </p>
              </div>
              <button
                onClick={handleRobloxAuth}
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded transition-colors text-center"
              >
                Robloxで登録・ログイン
              </button>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4 text-center">
            <p className="text-xs text-slate-500">
              通常のポータルアカウント（メール / Google）に戻る場合は{' '}
              <a href="/login" className="text-[#0046ff] font-medium hover:underline">
                通常ログイン画面
              </a>{' '}
              へお戻りください。
            </p>
          </div>
        </div>
      </main>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}