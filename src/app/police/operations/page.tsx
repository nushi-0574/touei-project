'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import Header from '../../components/Header';
import Breadcrumbs from '../../components/Breadcrumbs';
import { ContentSkeleton } from '@/src/app/components/LoadingScreen';
import { getErrorMessage } from '../../../lib/errors';
import { supabase } from '../../../lib/supabase';
import PoliceRadio from '../PoliceRadio';
import PoliceDispatchSystem from '../PoliceDispatchSystem';
import { Shield, Monitor, Radio, Database, Activity, ArrowLeft, Search } from 'lucide-react';

type TabKey = 'dispatch' | 'radio' | 'database' | 'system';

export default function PoliceOperationsPage() {
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [policeOrgRole, setPoliceOrgRole] = useState('一般');
  const [errorMessage, setErrorMessage] = useState('');
  const [activeTab, setActiveTab] = useState<TabKey>('dispatch');
  const [currentTimeStr, setCurrentTimeStr] = useState('');
  const [dbSearchQuery, setDbSearchQuery] = useState('');

  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'radio' || tabParam === 'database' || tabParam === 'system' || tabParam === 'dispatch') {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTimeStr(now.toLocaleString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let active = true;

    async function checkAccess() {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (!session) {
          router.replace('/login');
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('is_admin, is_police_staff, police_org_role')
          .eq('id', session.user.id)
          .maybeSingle();
        if (profileError) throw profileError;
        if (!active) return;

        const authorized = profile?.is_admin === true || profile?.is_police_staff === true;
        setHasAccess(authorized);
        if (
          profile?.police_org_role === '教官'
          || profile?.police_org_role === '学生'
          || profile?.police_org_role === '一般'
          || profile?.police_org_role === '指令'
        ) {
          setPoliceOrgRole(profile.police_org_role);
        }
      } catch (error) {
        console.error('警察業務端末の読み込みに失敗しました:', error);
        if (active) setErrorMessage(getErrorMessage(error, '警察業務端末を読み込めませんでした。'));
      } finally {
        if (active) setLoading(false);
      }
    }

    void checkAccess();
    return () => {
      active = false;
    };
  }, [router]);

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans flex flex-col">
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex-1 w-full space-y-4">
        <Breadcrumbs items={[
          { label: '警察専用ポータル', href: '/police' },
          { label: '警察業務専用端末 (POLICE-OPS-01)' }
        ]} />

        {loading ? (
          <ContentSkeleton />
        ) : errorMessage ? (
          <p role="alert" className="text-xs font-bold text-red-900 bg-red-50 border border-red-200 p-3 rounded-sm">
            {errorMessage}
          </p>
        ) : !hasAccess ? (
          <section className="bg-slate-50 border border-slate-200 p-6 text-center rounded-sm space-y-2">
            <h1 className="text-sm font-bold text-slate-900">警察業務専用端末</h1>
            <p className="text-xs text-slate-600">管理者または警察職員ロールが必要です。</p>
            <Link href="/police" className="inline-block text-xs font-bold text-blue-700 hover:underline">
              ← 警察総合メニューへ戻る
            </Link>
          </section>
        ) : (
          /* 白ベース＋東栄ブルーヘッダーの統一致裁 */
          <div className="bg-white border border-slate-300 rounded-sm">

            {/* システムヘッダーバー (ブランドブルー) */}
            <div className="bg-blue-900 text-white px-4 py-3 flex flex-wrap items-center justify-between border-b border-blue-950 text-xs">
              <div className="flex items-center gap-2.5">
                <Shield className="w-5 h-5 text-blue-200 shrink-0" />
                <span className="font-bold tracking-tight text-white text-sm">
                  東栄県警察本部 統合業務端末 [POLICE-OPS-01]
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs font-mono">
                <span>役割: <strong>{policeOrgRole}</strong></span>
                <span className="tabular-nums">{currentTimeStr}</span>
              </div>
            </div>

            {/* タブ切り替えバー */}
            <div className="bg-slate-100 p-2 border-b border-slate-200 flex flex-wrap gap-1 text-xs font-bold">
              <button
                type="button"
                onClick={() => setActiveTab('dispatch')}
                className={`px-4 py-2 rounded-sm transition-colors flex items-center gap-1.5 ${
                  activeTab === 'dispatch'
                    ? 'bg-[#0046ff] text-white'
                    : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-300'
                }`}
              >
                <Monitor className="w-3.5 h-3.5" />
                <span>110番緊急指令台</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('radio')}
                className={`px-4 py-2 rounded-sm transition-colors flex items-center gap-1.5 ${
                  activeTab === 'radio'
                    ? 'bg-[#0046ff] text-white'
                    : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-300'
                }`}
              >
                <Radio className="w-3.5 h-3.5" />
                <span>警察無線統括卓</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('database')}
                className={`px-4 py-2 rounded-sm transition-colors flex items-center gap-1.5 ${
                  activeTab === 'database'
                    ? 'bg-[#0046ff] text-white'
                    : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-300'
                }`}
              >
                <Database className="w-3.5 h-3.5" />
                <span>事件・台帳照会DB</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('system')}
                className={`px-4 py-2 rounded-sm transition-colors flex items-center gap-1.5 ${
                  activeTab === 'system'
                    ? 'bg-[#0046ff] text-white'
                    : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-300'
                }`}
              >
                <Activity className="w-3.5 h-3.5" />
                <span>端末ステータス</span>
              </button>
            </div>

            {/* タブコンテンツ */}
            <div className="p-4 space-y-4">

              {activeTab === 'dispatch' && (
                <PoliceDispatchSystem />
              )}

              {activeTab === 'radio' && (
                <PoliceRadio />
              )}

              {activeTab === 'database' && (
                <div className="bg-white border border-slate-200 rounded-sm p-5 space-y-4 text-xs font-sans">
                  <h2 className="text-sm font-bold text-slate-900 tracking-tight border-b border-slate-200 pb-2 flex items-center gap-1.5">
                    <Database className="w-4 h-4 text-[#0046ff]" />
                    <span>事件簿・台帳統合照会データベース</span>
                  </h2>

                  <div className="bg-slate-50 p-3.5 border border-slate-200 rounded-sm space-y-2">
                    <label className="block font-bold text-slate-800">照会検索キーワード</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={dbSearchQuery}
                        onChange={(e) => setDbSearchQuery(e.target.value)}
                        placeholder="例: 110-20261107 / 中央町 / 交通事故"
                        className="flex-1 px-3 py-1.5 border border-slate-300 rounded-sm text-xs bg-white focus:outline-none focus:border-[#0046ff]"
                      />
                      <button
                        type="button"
                        className="px-4 py-1.5 bg-[#0046ff] hover:bg-blue-700 text-white font-bold rounded-sm transition-colors inline-flex items-center gap-1"
                      >
                        <Search className="w-3.5 h-3.5" />
                        <span>照会検索</span>
                      </button>
                    </div>
                  </div>

                  <div className="border border-slate-200 rounded-sm overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="bg-slate-100 text-slate-800 text-[11px] font-bold border-b border-slate-200">
                        <tr>
                          <th className="p-2.5 border-r border-slate-200">管理番号</th>
                          <th className="p-2.5 border-r border-slate-200">事案区分</th>
                          <th className="p-2.5 border-r border-slate-200">件名・概要</th>
                          <th className="p-2.5 border-r border-slate-200">発生場所</th>
                          <th className="p-2.5 border-r border-slate-200">優先度</th>
                          <th className="p-2.5 border-r border-slate-200">状態</th>
                          <th className="p-2.5">登録日時</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        <tr className="hover:bg-slate-50">
                          <td className="p-2.5 border-r border-slate-200 font-mono font-bold tabular-nums">110-20261107-001</td>
                          <td className="p-2.5 border-r border-slate-200">交通事故</td>
                          <td className="p-2.5 border-r border-slate-200 font-bold text-slate-900">東栄駅前における器物破損・接触事故</td>
                          <td className="p-2.5 border-r border-slate-200">東栄市中央町1-2-3</td>
                          <td className="p-2.5 border-r border-slate-200 font-bold text-red-800">第1種(緊急)</td>
                          <td className="p-2.5 border-r border-slate-200 font-bold text-blue-800">現場対応中</td>
                          <td className="p-2.5 font-mono tabular-nums text-slate-600">2026/11/07 21:30</td>
                        </tr>
                        <tr className="hover:bg-slate-50">
                          <td className="p-2.5 border-r border-slate-200 font-mono font-bold tabular-nums">110-20261107-002</td>
                          <td className="p-2.5 border-r border-slate-200">不審者</td>
                          <td className="p-2.5 border-r border-slate-200 font-bold text-slate-900">公園付近における不審人物徘徊通報</td>
                          <td className="p-2.5 border-r border-slate-200">東栄市緑ヶ丘3-1</td>
                          <td className="p-2.5 border-r border-slate-200 font-bold text-amber-800">第2種(重要)</td>
                          <td className="p-2.5 border-r border-slate-200 font-bold text-amber-900">現場急行指示</td>
                          <td className="p-2.5 font-mono tabular-nums text-slate-600">2026/11/07 20:15</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {activeTab === 'system' && (
                <div className="bg-white border border-slate-200 rounded-sm p-5 space-y-4 text-xs font-sans">
                  <h2 className="text-sm font-bold text-slate-900 tracking-tight border-b border-slate-200 pb-2 flex items-center gap-1.5">
                    <Activity className="w-4 h-4 text-[#0046ff]" />
                    <span>端末診断・ネットワーク接続情報</span>
                  </h2>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-slate-50 border border-slate-200 p-4 space-y-2">
                      <h3 className="font-bold text-slate-900 border-b border-slate-200 pb-1">端末情報</h3>
                      <p><span className="font-semibold text-slate-700">Terminal ID:</span> <span className="font-mono">POLICE-OPS-01</span></p>
                      <p><span className="font-semibold text-slate-700">設置部署:</span> 東栄県警察本部 通信指令課</p>
                    </div>

                    <div className="bg-slate-50 border border-slate-200 p-4 space-y-2">
                      <h3 className="font-bold text-slate-900 border-b border-slate-200 pb-1">接続状態</h3>
                      <p><span className="font-semibold text-slate-700">認証プロトコル:</span> Supabase Auth (TLS 1.3)</p>
                      <p><span className="font-semibold text-slate-700">組織役割:</span> {policeOrgRole}</p>
                    </div>
                  </div>
                </div>
              )}

            </div>

            <div className="bg-slate-50 px-4 py-2 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
              <Link href="/police" className="text-[#0046ff] hover:underline font-bold flex items-center gap-1">
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>警察総合メニューへ戻る</span>
              </Link>
              <span className="font-mono text-[11px] tabular-nums">{currentTimeStr}</span>
            </div>

          </div>
        )}
      </main>
    </div>
  );
}
