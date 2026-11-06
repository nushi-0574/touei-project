'use client';

import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import Header from '../components/Header';
import Breadcrumbs from '../components/Breadcrumbs';
import Toast from '../components/Toast';
import { getErrorMessage } from '../../lib/errors';

export default function ToeikenAuthPage() {
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [loadingProvider, setLoadingProvider] = useState<'discord' | 'google' | null>(null);

  const handleAuth = async (provider: 'discord' | 'google') => {
    setLoadingProvider(provider);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/toeiken/dashboard`,
        },
      });
      if (error) throw error;
    } catch (error) {
      setToast({ message: `${provider}認証エラー: ` + getErrorMessage(error, '不明なエラー'), type: 'error' });
      setLoadingProvider(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 flex flex-col font-sans">
      <Header />
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8 flex-1 w-full">
        <Breadcrumbs items={[{ label: '東栄県ユーザー認証' }]} />

        <div className="bg-white border border-slate-300 rounded shadow-sm p-8">
          <div className="mb-6 pb-4 border-b border-slate-200">
            <h1 className="text-xl font-bold text-slate-900">東栄県ユーザー専用ポータル ログイン</h1>
            <p className="text-xs text-slate-500 mt-1">
              東栄プロジェクト（東栄県）の住民・関係者向け認証画面です。アカウントを選択してログインしてください。
            </p>
          </div>

          <div className="my-6 space-y-4">
            {/* Google認証ボタン */}
            <div className="border border-slate-200 rounded p-5 bg-slate-50/50 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-slate-900 text-sm">Google アカウント</span>
                  <span className="text-[10px] bg-slate-200 text-slate-700 border border-slate-300 px-2 py-0.5 rounded font-medium">
                    基本ログイン
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed mb-4">
                  Googleアカウントを用いてポータルへサインインします（初回は自動的にアカウントが作成されます）。
                </p>
              </div>
              <button
                onClick={() => handleAuth('google')}
                disabled={loadingProvider !== null}
                className="w-full py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded shadow-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span>{loadingProvider === 'google' ? '認証中...' : 'Googleでログイン'}</span>
              </button>
            </div>

            {/* Discord認証ボタン */}
            <div className="border border-indigo-200 rounded p-5 bg-indigo-50/30 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-slate-900 text-sm">Discord アカウント</span>
                  <span className="text-[10px] bg-indigo-100 text-indigo-800 border border-indigo-300 px-2 py-0.5 rounded font-medium">
                    住民連携
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed mb-4">
                  Discordアカウントで直接サインイン、またはログイン後のマイページから紐づけを行います。
                </p>
              </div>
              <button
                onClick={() => handleAuth('discord')}
                disabled={loadingProvider !== null}
                className="w-full py-2.5 bg-[#5865F2] hover:bg-[#4752C4] text-white text-xs font-semibold rounded shadow-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <svg className="w-4 h-4 shrink-0 fill-current" viewBox="0 0 127.14 96.36">
                  <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1,105.25,105.25,0,0,0,32.19-16.14c2.64-27.38-4.51-51.11-18.91-72.15ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74c6.51,0,11.62,5.78,11.44,12.74C53.89,60,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74c6.5,0,11.62,5.78,11.44,12.74C96.13,60,91.2,65.69,84.69,65.69Z" />
                </svg>
                <span>{loadingProvider === 'discord' ? '認証中...' : 'Discordでログイン'}</span>
              </button>
            </div>
          </div>
        </div>
      </main>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}