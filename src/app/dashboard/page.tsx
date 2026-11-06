'use client';

import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';
import { useRouter } from 'next/navigation';
import Header from '../components/Header';
import Breadcrumbs from '../components/Breadcrumbs';
import Toast from '../components/Toast';
import { getErrorMessage } from '../../lib/errors';
import BillingPanel from './BillingPanel';

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<{ is_admin?: boolean; is_police_staff?: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const router = useRouter();

  useEffect(() => {
    let active = true;

    async function getUserData() {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;

        if (!session) {
          router.replace('/login');
          return;
        }

        const { data, error } = await supabase
          .from('profiles')
          .select('is_admin, is_police_staff')
          .eq('id', session.user.id)
          .maybeSingle();

        if (error) throw error;
        if (active) {
          setUser(session.user);
          setProfile(data);
        }
      } catch (error) {
        console.error('ユーザー情報の取得に失敗しました:', error);
        if (active) {
          setProfile(null);
          setToast({ message: getErrorMessage(error, 'ユーザー情報の取得に失敗しました。'), type: 'error' });
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void getUserData();
    return () => {
      active = false;
    };
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
          <Link
            href="/toeiken"
            className="px-4 py-2 bg-white text-slate-900 hover:bg-slate-100 text-xs font-semibold rounded transition-colors whitespace-nowrap"
          >
            専用ページへ移動
          </Link>
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
                {profile?.is_admin ? '管理者' : '一般ユーザー'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* システム管理パネル */}
            {profile?.is_admin ? (
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
                <Link
                  href="/admin"
                  className="block w-full text-center bg-[#0046ff] hover:bg-blue-700 text-white text-xs font-medium py-2 rounded transition-colors"
                >
                  管理画面を開く
                </Link>
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

            {profile?.is_police_staff && (
              <div className="border border-emerald-200 rounded p-5 bg-white hover:border-emerald-500 transition-colors flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="font-bold text-slate-900 text-base">警察職員メニュー</h2>
                    <span className="text-xs bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded font-medium">
                      警察職員専用
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed mb-6">
                    警察専用ページとCommand systemの110番通報機能を利用できます。
                  </p>
                </div>
                <Link
                  href="/police"
                  className="block w-full text-center bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-medium py-2 rounded transition-colors"
                >
                  警察職員ページを開く
                </Link>
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
              <Link
                href="/pages"
                className="block w-full text-center bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium py-2 rounded border border-slate-300 transition-colors"
              >
                資料を閲覧する
              </Link>
            </div>

            <div className="border border-slate-200 rounded p-5 bg-white hover:border-[#0046ff] transition-colors flex flex-col justify-between">
              <div>
                <h2 className="font-bold text-slate-900 text-base mb-2">住民サービスセンター</h2>
                <p className="text-xs text-slate-600 leading-relaxed mb-6">
                  行政申請、イベント、通知、住民証、コミュニティ、問い合わせをまとめて利用できます。
                </p>
              </div>
              <Link href="/toeiken/services" className="block w-full text-center bg-[#0046ff] hover:bg-blue-700 text-white text-xs font-medium py-2 rounded transition-colors">
                住民サービスを開く
              </Link>
            </div>

            <div className="border border-slate-200 rounded p-5 bg-white hover:border-[#0046ff] transition-colors flex flex-col justify-between">
              <div>
                <h2 className="font-bold text-slate-900 text-base mb-2">施設・採用情報</h2>
                <p className="text-xs text-slate-600 leading-relaxed mb-6">
                  地図で施設情報を確認し、公開中の採用情報を閲覧・応募できます。
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Link href="/map" className="block w-full text-center bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium py-2 rounded border border-slate-300 transition-colors">
                  地図を見る
                </Link>
                <Link href="/recruitment" className="block w-full text-center bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium py-2 rounded border border-slate-300 transition-colors">
                  採用情報
                </Link>
              </div>
            </div>

            {/* 決済・契約管理 */}
            <div className="border border-slate-200 rounded p-5 bg-white hover:border-[#0046ff] transition-colors">
              <div className="mb-4">
                <h2 className="font-bold text-slate-900 text-base mb-2">決済・プラン管理</h2>
                <p className="text-xs text-slate-600 leading-relaxed">
                  契約状況の確認、定期プランのお申し込み、支払い方法や解約の管理ができます。
                </p>
              </div>
              {user && <BillingPanel userId={user.id} />}
            </div>
          </div>
        </div>
      </main>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}