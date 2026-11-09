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
import LoadingScreen from '../components/LoadingScreen';
import { Shield, FileText, Map, PhoneCall, UserCheck, ChevronRight } from 'lucide-react';

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<{ is_admin?: boolean; is_super_admin?: boolean; is_police_staff?: boolean } | null>(null);
  const [isFireStaff, setIsFireStaff] = useState(false);
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

        const [{ data, error }, { data: fireRole, error: fireRoleError }] = await Promise.all([
          supabase
            .from('profiles')
            .select('is_admin, is_super_admin, is_police_staff')
            .eq('id', session.user.id)
            .maybeSingle(),
          supabase
            .from('staff_roles')
            .select('role')
            .eq('user_id', session.user.id)
            .eq('role', 'fire')
            .maybeSingle(),
        ]);

        if (error) throw error;
        if (fireRoleError) throw fireRoleError;
        if (active) {
          setUser(session.user);
          setProfile(data);
          setIsFireStaff(fireRole !== null);
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
    return <LoadingScreen />;
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col font-sans">
      <Header />
      
      <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-8 flex-1">
        <Breadcrumbs items={[{ label: 'メインメニュー' }]} />

        {/* 非対称 7:3 レイアウト */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8 items-start mt-4">

          {/* メインエリア (7割) */}
          <div className="space-y-6">

            {/* 東栄県ユーザー誘導ヘッダー (左揃え) */}
            <section className="bg-slate-900 text-white p-6 rounded-sm border border-slate-800">
              <div className="space-y-3 max-w-2xl">
                <span className="inline-block text-xs font-semibold text-emerald-400 bg-slate-800 border border-slate-700 px-2.5 py-0.5">
                  東栄県専用ポータル案内
                </span>
                <h1 className="text-xl font-bold tracking-tight text-white">
                  東栄ポータル 機能統合ダッシュボード
                </h1>
                <p className="text-xs text-slate-300 leading-relaxed">
                  東栄アカウントでの各種行政手続き、住民サービス、施設マップ、および各種専門職用管理機能を開設しています。
                </p>
                <div className="pt-2">
                  <Link
                    href="/toeiken"
                    className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-blue-700 hover:bg-blue-600 text-white text-xs font-semibold rounded-sm transition-colors"
                  >
                    <span>東栄アカウント専用画面へ移動</span>
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            </section>

            {/* 各種ポータル機能一覧（縦並び・影なし・13px+） */}
            <section className="space-y-4">
              <h2 className="text-base font-bold text-slate-900 tracking-tight border-b border-slate-200 pb-2">
                機能・ポータル一覧
              </h2>

              <div className="space-y-3">

                {/* システム管理パネル (管理者専用) */}
                {profile?.is_admin ? (
                  <div className="border border-slate-300 rounded-sm p-5 bg-white space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-slate-900 text-sm">システム管理パネル</h3>
                      <span className="text-xs bg-blue-50 text-blue-900 border border-blue-200 px-2 py-0.5 font-semibold">
                        管理者専用
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      登録ユーザーの一覧参照、住民データ照会、職員の組織権限（ロール）割り当て手続きを行います。
                    </p>
                    <div className="pt-2">
                      <Link
                        href="/admin"
                        className="inline-block px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-sm transition-colors"
                      >
                        管理画面を開く
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-sm p-5 bg-slate-100 opacity-60">
                    <h3 className="font-bold text-slate-700 text-sm">システム管理パネル</h3>
                    <p className="text-xs text-slate-500 leading-relaxed mt-1">
                      管理者権限を持つアカウントのみアクセス可能です。
                    </p>
                  </div>
                )}

                {/* 警察職員メニュー */}
                {(profile?.is_police_staff || profile?.is_admin) && (
                  <div className="border border-slate-300 rounded-sm p-5 bg-white space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                        <Shield className="w-4 h-4 text-emerald-700" />
                        <span>警察職員ポータル</span>
                      </h3>
                      <span className="text-xs bg-emerald-50 text-emerald-900 border border-emerald-200 px-2 py-0.5 font-semibold">
                        警察職員専用
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      110番緊急指令卓、警察無線統括卓、採用合否照会システムを利用できます。
                    </p>
                    <div className="pt-2">
                      <Link
                        href="/police"
                        className="inline-block px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-semibold rounded-sm transition-colors"
                      >
                        警察職員専用ポータルを開く
                      </Link>
                    </div>
                  </div>
                )}

                {/* 消防職員メニュー */}
                {(isFireStaff || profile?.is_admin) && (
                  <div className="border border-slate-300 rounded-sm p-5 bg-white space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-slate-900 text-sm">消防職員ポータル</h3>
                      <span className="text-xs bg-red-50 text-red-900 border border-red-200 px-2 py-0.5 font-semibold">
                        消防職員専用
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      消防通信指令ポータルおよび災害連絡窓口を利用できます。
                    </p>
                    <div className="pt-2">
                      <Link
                        href="/fire"
                        className="inline-block px-4 py-2 bg-red-800 hover:bg-red-900 text-white text-xs font-semibold rounded-sm transition-colors"
                      >
                        消防職員専用ポータルを開く
                      </Link>
                    </div>
                  </div>
                )}

                {/* 住民サービスセンター */}
                <div className="border border-slate-300 rounded-sm p-5 bg-white space-y-2">
                  <h3 className="font-bold text-slate-900 text-sm">住民サービスセンター</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    行政申請手続き、イベント予約、通知確認、住民証発行、コミュニティ掲示板、電話窓口をまとめて利用できます。
                  </p>
                  <div className="pt-2">
                    <Link
                      href="/toeiken/services"
                      className="inline-block px-4 py-2 bg-blue-700 hover:bg-blue-600 text-white text-xs font-semibold rounded-sm transition-colors"
                    >
                      住民サービスセンターを開く
                    </Link>
                  </div>
                </div>

                {/* ドキュメント & 地図・採用 */}
                <div className="border border-slate-300 rounded-sm p-5 bg-white space-y-3">
                  <h3 className="font-bold text-slate-900 text-sm">情報閲覧・公開資料</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    行政案内資料、地域地図、採用募集情報を確認できます。
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1 text-xs">
                    <Link href="/pages" className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 font-medium rounded-sm">
                      公開資料一覧
                    </Link>
                    <Link href="/map" className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 font-medium rounded-sm">
                      地域地図情報
                    </Link>
                    <Link href="/recruitment" className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 font-medium rounded-sm">
                      採用情報
                    </Link>
                  </div>
                </div>

              </div>
            </section>

          </div>

          {/* 右側サイドバー (3割) - ユーザーアカウント・契約情報 */}
          <aside className="space-y-6">

            {/* アカウントステータス */}
            <div className="bg-white border border-slate-300 p-5 rounded-sm space-y-3 text-xs">
              <h3 className="font-bold text-slate-900 border-b border-slate-200 pb-2 flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-slate-600" />
                <span>ログインアカウント情報</span>
              </h3>
              <div className="space-y-1.5 text-slate-700">
                <p className="break-all font-mono font-semibold">{user?.email}</p>
                <p className="text-slate-500">
                  アカウント権限: <strong className="text-slate-900">{profile?.is_super_admin ? '主任管理者' : profile?.is_admin ? '一般管理者' : profile?.is_police_staff ? '警察職員' : isFireStaff ? '消防職員' : '一般ユーザー'}</strong>
                </p>
              </div>
              <div className="pt-2">
                <Link href="/toeiken/dashboard" className="text-blue-800 hover:underline font-bold text-xs block">
                  マイページでプロフィールを確認 →
                </Link>
              </div>
            </div>

            {/* 決済・契約管理 */}
            <div className="bg-white border border-slate-300 p-5 rounded-sm space-y-3 text-xs">
              <h3 className="font-bold text-slate-900 border-b border-slate-200 pb-2">
                決済・プラン管理
              </h3>
              <p className="text-slate-600 leading-relaxed">
                定額プラン契約状況、Stripeカスタマーポータルでのカード変更や請求履歴の管理を行えます。
              </p>
              {user && <BillingPanel userId={user.id} />}
            </div>

          </aside>

        </div>
      </main>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}