'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useRouter } from 'next/navigation';
import Header from '../components/Header';
import Breadcrumbs from '../components/Breadcrumbs';

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function getUserData() {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        router.push('/login');
        return;
      }

      setUser(session.user);

      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (data) {
        setProfile(data);
      }
      setLoading(false);
    }

    getUserData();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center">
        <div className="w-6 h-6 border-2 border-slate-300 border-t-[#0046ff] rounded-full animate-spin mb-3"></div>
        <p className="text-slate-500 text-xs">読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800">
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <Breadcrumbs items={[{ label: 'メインメニュー' }]} />

        {/* 東栄県ユーザー誘導バナー */}
        <div className="bg-slate-900 text-white rounded p-6 mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <span className="text-[10px] bg-[#0046ff] text-white px-2 py-0.5 rounded font-medium uppercase tracking-wider">
              特別案内
            </span>
            <h2 className="text-base font-bold mt-1">東栄県ユーザーの方はこちら</h2>
            <p className="text-xs text-slate-300 mt-1">
              DiscordアカウントまたはRobloxアカウントを使用した東栄県専用の登録・ログインが行えます。
            </p>
          </div>
          <a
            href="/toeiken"
            className="px-4 py-2 bg-white text-slate-900 hover:bg-slate-100 text-xs font-semibold rounded transition-colors whitespace-nowrap"
          >
            専用ページへ移動
          </a>
        </div>

        <div className="bg-white border border-slate-200 rounded p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4 mb-4">
            <div>
              <h1 className="text-xl font-bold text-slate-900">メインメニュー</h1>
              <p className="text-xs text-slate-500 mt-1">東栄ポータル 機能一覧</p>
            </div>
            <div className="text-xs text-slate-600 bg-slate-50 border border-slate-200 px-3 py-2 rounded">
              <span>アカウント: </span>
              <span className="font-semibold text-slate-900">{user?.email}</span>
              <span className="ml-3 text-slate-400">|</span>
              <span className="ml-3">権限: </span>
              <span className="font-semibold text-slate-900">
                {profile?.role === 'admin' ? '管理者' : '一般ユーザー'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* システム管理パネル */}
            {profile?.role === 'admin' ? (
              <div className="border border-slate-200 rounded p-5 bg-white hover:border-[#0046ff] transition-colors flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="font-bold text-slate-900 text-base">システム管理パネル</h2>
                    <span className="text-xs bg-blue-50 text-[#0046ff] border border-blue-200 px-2 py-0.5 rounded font-medium">
                      管理者専用
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed mb-6">
                    登録ユーザーの一覧参照および権限（ロール）変更の手続きを行います。
                  </p>
                </div>
                <a
                  href="/admin"
                  className="block w-full text-center bg-[#0046ff] hover:bg-blue-700 text-white text-xs font-medium py-2 rounded transition-colors"
                >
                  管理画面を開く
                </a>
              </div>
            ) : (
              <div className="border border-slate-200 rounded p-5 bg-slate-50 opacity-60 flex flex-col justify-between">
                <div>
                  <h2 className="font-bold text-slate-700 text-base mb-2">システム管理パネル</h2>
                  <p className="text-xs text-slate-500 leading-relaxed mb-6">
                    管理者権限を持つアカウントのみ利用可能です。
                  </p>
                </div>
                <span className="block w-full text-center bg-slate-200 text-slate-500 text-xs font-medium py-2 rounded cursor-not-allowed">
                  アクセス権限なし
                </span>
              </div>
            )}

            {/* ドキュメントライブラリ */}
            <div className="border border-slate-200 rounded p-5 bg-white hover:border-[#0046ff] transition-colors flex flex-col justify-between">
              <div>
                <h2 className="font-bold text-slate-900 text-base mb-2">ドキュメントライブラリ</h2>
                <p className="text-xs text-slate-600 leading-relaxed mb-6">
                  プロジェクト関連資料、教本、各種ガイドラインの参照ができます。
                </p>
              </div>
              <button
                onClick={() => alert('準備中')}
                className="w-full text-center bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium py-2 rounded border border-slate-300 transition-colors"
              >
                資料を閲覧する
              </button>
            </div>

            {/* 決済・契約管理 */}
            <div className="border border-slate-200 rounded p-5 bg-white hover:border-[#0046ff] transition-colors flex flex-col justify-between">
              <div>
                <h2 className="font-bold text-slate-900 text-base mb-2">決済・プラン管理</h2>
                <p className="text-xs text-slate-600 leading-relaxed mb-6">
                  有料プランの登録手続き、利用履歴の確認、契約内容の管理を行います。
                </p>
              </div>
              <button
                onClick={() => alert('準備中')}
                className="w-full text-center bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium py-2 rounded border border-slate-300 transition-colors"
              >
                決済管理画面へ
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}