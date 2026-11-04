'use client';

import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import Header from '../components/Header';
import Breadcrumbs from '../components/Breadcrumbs';
import Toast from '../components/Toast';

export default function ToeikenAuthPage() {
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const handleDiscordAuth = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'discord',
      options: {
        redirectTo: `${window.location.origin}/toeiken/dashboard`,
      },
    });

    if (error) {
      setToast({ message: 'Discord認証エラー: ' + error.message, type: 'error' });
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 flex flex-col">
      <Header />
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-6 flex-1 w-full">
        <Breadcrumbs items={[{ label: '東栄県ユーザー認証' }]} />

        <div className="bg-white border border-slate-200 rounded p-8">
          <div className="mb-6 pb-4 border-b border-slate-100">
            <h1 className="text-xl font-bold text-slate-900">東栄県ユーザー専用ポータル ログイン</h1>
            <p className="text-xs text-slate-500 mt-1">
              東栄プロジェクト（東栄県）の住民・関係者向け認証画面です。
            </p>
          </div>

          <div className="my-8">
            <div className="border border-emerald-200 rounded p-6 bg-emerald-50/30 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="font-bold text-slate-900 text-base">Discord アカウント連携</span>
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded font-medium">
                    公式認証
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed mb-6">
                  東栄プロジェクト公式Discordサーバーのアカウントを使用して登録・ログインを行います。
                </p>
              </div>
              <button
                onClick={handleDiscordAuth}
                className="w-full py-2.5 bg-[#5865F2] hover:bg-[#4752C4] text-white text-xs font-semibold rounded transition-colors text-center"
              >
                Discordで登録・ログイン
              </button>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4 text-center">
            <p className="text-xs text-slate-500">
              通常ポータルに戻る場合は{' '}
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