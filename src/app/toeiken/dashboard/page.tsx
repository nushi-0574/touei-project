'use client';

import { useState, useEffect } from 'react';
import Header from '../../components/Header';
import Breadcrumbs from '../../components/Breadcrumbs';
import Toast from '../../components/Toast';
import { supabase } from '../../../lib/supabase';

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  useEffect(() => {
    async function loadUserData() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);

        // 1. プロファイルの取得
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();

        // 2. セッションからDiscordのIdentity（外部ID）を確認
        const discordIdentity = session.user.identities?.find((id: any) => id.provider === 'discord');
        const discordId = discordIdentity ? discordIdentity.id : null;

        if (profileData) {
          setProfile(profileData);

          // Discord認証から戻ってきた際、プロファイル側に未保存であれば自動同期
          if (discordId && !profileData.discord_id) {
            // 重複チェック
            const { data: existing } = await supabase
              .from('profiles')
              .select('id')
              .eq('discord_id', discordId)
              .neq('id', session.user.id);

            if (existing && existing.length > 0) {
              setToast({ message: 'このDiscordアカウントは既に別の東栄県アカウントに紐づけられています。', type: 'error' });
            } else {
              const { data: updated } = await supabase
                .from('profiles')
                .update({ discord_id: discordId })
                .eq('id', session.user.id)
                .select()
                .single();
              
              if (updated) setProfile(updated);
            }
          }
        } else {
          // プロファイルがなければ新規作成
          const { data: newProfile } = await supabase
            .from('profiles')
            .insert([{ id: session.user.id, email: session.user.email, discord_id: discordId }])
            .select()
            .single();

          if (newProfile) setProfile(newProfile);
        }
      }
      setLoading(false);
    }
    loadUserData();
  }, []);

  const handleLinkDiscord = async () => {
    const { error } = await supabase.auth.linkIdentity({
      provider: 'discord',
      options: {
        redirectTo: `${window.location.origin}/toeiken/dashboard`,
      },
    });

    if (error) {
      setToast({ message: 'Discord連携エラー: ' + error.message, type: 'error' });
    }
  };

  // 判定：セッションのidentitiesかプロファイルのdiscord_idがあれば連携済みとする
  const hasDiscordIdentity = user?.identities?.some((id: any) => id.provider === 'discord') || profile?.discord_id;

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 flex flex-col font-sans">
      <Header />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 flex-1 w-full">
        <Breadcrumbs items={[{ label: '東栄県住民マイページ' }]} />

        <div className="bg-white border border-slate-300 rounded shadow-sm p-6 space-y-6">
          <div className="border-b border-slate-200 pb-3">
            <h1 className="text-xl font-bold text-slate-900">東栄県民マイページ</h1>
            <p className="text-xs text-slate-500 mt-1">ご登録アカウントの情報確認および連携設定を行います。</p>
          </div>

          {loading ? (
            <p className="text-xs text-slate-500 text-center py-4">読み込み中...</p>
          ) : !user ? (
            <div className="text-center py-6">
              <p className="text-xs text-red-600 mb-3">ログインが必要です。</p>
              <a href="/toeiken" className="text-xs bg-slate-900 text-white px-4 py-2 rounded">ログイン画面へ</a>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="bg-slate-50 p-4 border border-slate-200 rounded text-xs space-y-2">
                <p><span className="font-bold text-slate-700">登録メールアドレス:</span> {user.email}</p>
                <p><span className="font-bold text-slate-700">ユーザーID:</span> {user.id}</p>
              </div>

              {/* 外部サービス連携設定 */}
              <div className="border border-slate-200 rounded p-5 space-y-4">
                <h2 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
                  外部サービス連携設定
                </h2>

                <div className="flex items-center justify-between bg-slate-50 p-3 rounded border border-slate-200">
                  <div className="flex items-center gap-3">
                    <svg className="w-5 h-5 shrink-0 fill-current text-[#5865F2]" viewBox="0 0 127.14 96.36">
                      <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1,105.25,105.25,0,0,0,32.19-16.14c2.64-27.38-4.51-51.11-18.91-72.15ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74c6.51,0,11.62,5.78,11.44,12.74C53.89,60,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74c6.5,0,11.62,5.78,11.44,12.74C96.13,60,91.2,65.69,84.69,65.69Z" />
                    </svg>
                    <div>
                      <p className="text-xs font-bold text-slate-800">Discord アカウント</p>
                      <p className="text-[11px] text-slate-500">
                        {hasDiscordIdentity ? '連携済み（以降の追加認証は不要です）' : '未連携'}
                      </p>
                    </div>
                  </div>

                  {hasDiscordIdentity ? (
                    <span className="text-[11px] bg-emerald-100 text-emerald-800 border border-emerald-300 px-3 py-1 rounded font-semibold">
                      連携済み（読込のみ）
                    </span>
                  ) : (
                    <button
                      onClick={handleLinkDiscord}
                      className="px-3 py-1.5 bg-[#5865F2] hover:bg-[#4752C4] text-white text-xs font-semibold rounded shadow transition-colors"
                    >
                      Discordを紐づける
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}