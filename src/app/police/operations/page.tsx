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
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-sans flex flex-col">
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 flex-1 w-full space-y-6">
        <Breadcrumbs items={[
          { label: '警察専用ポータル', href: '/police' },
          { label: '警察業務専用端末 (POLICE-OPS-01)' }
        ]} />

        {loading ? (
          <ContentSkeleton />
        ) : errorMessage ? (
          <p role="alert" className="text-xs font-bold text-red-900 bg-red-50 border border-red-300 p-4 rounded-sm">
            {errorMessage}
          </p>
        ) : !hasAccess ? (
          <section className="bg-white border border-slate-300 p-6 text-center rounded-sm space-y-3">
            <h1 className="text-base font-bold text-slate-900">警察業務専用端末</h1>
            <p className="text-xs text-slate-600">この端末を利用するには管理者または警察職員ロールが必要です。</p>
            <Link href="/police" className="inline-block text-xs font-bold text-blue-800 hover:underline">
              ← 警察総合メニューへ戻る
            </Link>
          </section>
        ) : (
          /* 7:3 非対称レイアウト */
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8 items-start">

            {/* 左側メイン業務エリア (7割) */}
            <div className="space-y-6">

              {/* 端末コンソールヘッダー (スレート/ネイビー統一定裁) */}
              <div className="bg-slate-900 text-white p-6 rounded-sm border border-slate-800 space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-3">
                    <Shield className="w-5 h-5 text-emerald-400 shrink-0" />
                    <div>
                      <span className="text-[10px] font-mono tracking-widest text-emerald-400 font-bold uppercase block">
                        EAST TOEI POLICE DEPARTMENT
                      </span>
                      <h1 className="text-lg font-bold text-white tracking-tight">
                        警察業務専用処理端末 (POLICE-OPS-01)
                      </h1>
                    </div>
                  </div>
                  <div className="text-xs font-mono text-slate-300 bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-sm">
                    指定役割: <strong className="text-emerald-400 font-bold">{policeOrgRole}</strong>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 text-xs pt-1 text-slate-300 font-mono">
                  <span>接続状態: <strong className="text-emerald-400">庁内LAN 接続完了</strong></span>
                  <span className="tabular-nums">{currentTimeStr}</span>
                </div>
              </div>

              {/* タブ切り替えバー */}
              <div className="bg-white border border-slate-300 rounded-sm p-1.5 flex flex-wrap gap-1 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setActiveTab('dispatch')}
                  className={`px-4 py-2 rounded-sm transition-colors flex items-center gap-2 ${
                    activeTab === 'dispatch'
                      ? 'bg-slate-900 text-white'
                      : 'bg-white text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <Monitor className="w-4 h-4" />
                  <span>110番緊急指令台</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('radio')}
                  className={`px-4 py-2 rounded-sm transition-colors flex items-center gap-2 ${
                    activeTab === 'radio'
                      ? 'bg-slate-900 text-white'
                      : 'bg-white text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <Radio className="w-4 h-4" />
                  <span>警察無線統括卓</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('database')}
                  className={`px-4 py-2 rounded-sm transition-colors flex items-center gap-2 ${
                    activeTab === 'database'
                      ? 'bg-slate-900 text-white'
                      : 'bg-white text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <Database className="w-4 h-4" />
                  <span>事件・台帳照会DB</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('system')}
                  className={`px-4 py-2 rounded-sm transition-colors flex items-center gap-2 ${
                    activeTab === 'system'
                      ? 'bg-slate-900 text-white'
                      : 'bg-white text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <Activity className="w-4 h-4" />
                  <span>端末ステータス</span>
                </button>
              </div>

              {/* タブコンテンツ */}
              <div className="space-y-4">

                {/* 1. 110番緊急指令台 */}
                {activeTab === 'dispatch' && (
                  <PoliceDispatchSystem />
                )}

                {/* 2. 警察無線統括卓 */}
                {activeTab === 'radio' && (
                  <PoliceRadio />
                )}

                {/* 3. 事件・台帳照会 */}
                {activeTab === 'database' && (
                  <div className="bg-white border border-slate-300 rounded-sm p-6 space-y-4 text-xs font-sans">
                    <div className="border-b border-slate-200 pb-2">
                      <h2 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
                        <Database className="w-4 h-4 text-slate-700" />
                        <span>事件簿・台帳統合照会データベース</span>
                      </h2>
                      <p className="text-xs text-slate-600 mt-0.5">
                        警察本部および各所管轄で登録された過去の110番指令データ・件名・出動履歴を検索照会できます。
                      </p>
                    </div>

                    <div className="bg-slate-50 p-4 border border-slate-200 rounded-sm space-y-2">
                      <label className="block font-semibold text-slate-800">照会検索キーワード</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={dbSearchQuery}
                          onChange={(e) => setDbSearchQuery(e.target.value)}
                          placeholder="例: 110-20261107 / 中央町 / 交通事故"
                          className="flex-1 px-3 py-2 border border-slate-300 rounded-sm text-xs bg-white focus:outline-none focus:border-slate-800"
                        />
                        <button
                          type="button"
                          className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-sm transition-colors inline-flex items-center gap-1"
                        >
                          <Search className="w-3.5 h-3.5" />
                          <span>照会検索</span>
                        </button>
                      </div>
                    </div>

                    {/* 実務的データテーブル */}
                    <div className="border border-slate-300 rounded-sm overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead className="bg-slate-900 text-white text-[11px]">
                          <tr>
                            <th className="p-2.5 border-r border-slate-800">管理番号</th>
                            <th className="p-2.5 border-r border-slate-800">事案区分</th>
                            <th className="p-2.5 border-r border-slate-800">件名・概要</th>
                            <th className="p-2.5 border-r border-slate-800">発生場所</th>
                            <th className="p-2.5 border-r border-slate-800">優先度</th>
                            <th className="p-2.5 border-r border-slate-800">状態</th>
                            <th className="p-2.5">登録日時</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          <tr className="hover:bg-slate-50">
                            <td className="p-2.5 border-r border-slate-200 font-mono font-bold tabular-nums">110-20261107-001</td>
                            <td className="p-2.5 border-r border-slate-200">交通事故</td>
                            <td className="p-2.5 border-r border-slate-200 font-semibold text-slate-900">東栄駅前における器物破損・接触事故</td>
                            <td className="p-2.5 border-r border-slate-200">東栄市中央町1-2-3</td>
                            <td className="p-2.5 border-r border-slate-200 font-bold text-red-800">第1種(緊急)</td>
                            <td className="p-2.5 border-r border-slate-200 font-bold text-blue-900">現場対応中</td>
                            <td className="p-2.5 font-mono tabular-nums text-slate-600">2026/11/07 21:30</td>
                          </tr>
                          <tr className="hover:bg-slate-50">
                            <td className="p-2.5 border-r border-slate-200 font-mono font-bold tabular-nums">110-20261107-002</td>
                            <td className="p-2.5 border-r border-slate-200">不審者</td>
                            <td className="p-2.5 border-r border-slate-200 font-semibold text-slate-900">公園付近における不審人物徘徊通報</td>
                            <td className="p-2.5 border-r border-slate-200">東栄市緑ヶ丘3-1</td>
                            <td className="p-2.5 border-r border-slate-200 font-bold text-amber-800">第2種(重要)</td>
                            <td className="p-2.5 border-r border-slate-200 font-bold text-amber-900">現場急行指示</td>
                            <td className="p-2.5 font-mono tabular-nums text-slate-600">2026/11/07 20:15</td>
                          </tr>
                          <tr className="hover:bg-slate-50">
                            <td className="p-2.5 border-r border-slate-200 font-mono font-bold tabular-nums">110-20261106-089</td>
                            <td className="p-2.5 border-r border-slate-200">落し物</td>
                            <td className="p-2.5 border-r border-slate-200 text-slate-800">商業施設における財布拾得届出</td>
                            <td className="p-2.5 border-r border-slate-200">東栄本町モール</td>
                            <td className="p-2.5 border-r border-slate-200 text-slate-700">第3種(一般)</td>
                            <td className="p-2.5 border-r border-slate-200 font-bold text-slate-700">事案完了</td>
                            <td className="p-2.5 font-mono tabular-nums text-slate-600">2026/11/06 18:40</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* 4. 端末ステータス */}
                {activeTab === 'system' && (
                  <div className="bg-white border border-slate-300 rounded-sm p-6 space-y-4 text-xs font-sans">
                    <div className="border-b border-slate-200 pb-2">
                      <h2 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
                        <Activity className="w-4 h-4 text-slate-700" />
                        <span>端末システム・ネットワーク状態診断</span>
                      </h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-slate-50 border border-slate-200 p-4 space-y-2">
                        <h3 className="font-bold text-slate-900 border-b border-slate-200 pb-1.5">端末識別情報</h3>
                        <p><span className="font-semibold text-slate-700">Terminal ID:</span> <span className="font-mono">POLICE-OPS-TERMINAL-01</span></p>
                        <p><span className="font-semibold text-slate-700">設置部署:</span> 東栄県警察本部 通信指令課 第1指令台</p>
                        <p><span className="font-semibold text-slate-700">基盤OS:</span> Toei Police Secure Operations Console V2.6</p>
                      </div>

                      <div className="bg-slate-50 border border-slate-200 p-4 space-y-2">
                        <h3 className="font-bold text-slate-900 border-b border-slate-200 pb-1.5">認証・ネットワーク</h3>
                        <p><span className="font-semibold text-slate-700">認証プロトコル:</span> Supabase Auth (TLS 1.3)</p>
                        <p><span className="font-semibold text-slate-700">指定組織ロール:</span> {policeOrgRole}</p>
                        <p><span className="font-semibold text-slate-700">リアルタイム同期:</span> 正常稼働中 (2 Subscriptions)</p>
                      </div>
                    </div>

                    <div className="bg-slate-900 text-emerald-400 p-4 font-mono text-xs rounded-sm space-y-1">
                      <p>[SYSTEM-LOG] POLICE OPERATIONS CONSOLE INITIALIZED SUCCESSFULLY</p>
                      <p>[SYSTEM-LOG] REALTIME SYNC CHANNEL 'police_dispatch_incidents' CONNECTED</p>
                      <p>[SYSTEM-LOG] REALTIME SYNC CHANNEL 'police_radio_messages' CONNECTED</p>
                      <p>[SYSTEM-LOG] STATUS: READY. HEALTH CHECK 100% OK</p>
                    </div>
                  </div>
                )}

              </div>

            </div>

            {/* 右側サイドバー (3割) */}
            <aside className="space-y-6">

              {/* 端末操作案内 */}
              <div className="bg-white border border-slate-300 p-5 rounded-sm space-y-3 text-xs">
                <h3 className="font-bold text-slate-900 border-b border-slate-200 pb-2 tracking-tight">
                  警察業務端末について
                </h3>
                <p className="text-slate-600 leading-relaxed">
                  本端末システムは東栄県警察本部内の110番緊急発令、各種無線通信、および事件簿検索を統括する専用コンソールです。
                </p>
              </div>

              <div className="bg-slate-100 border border-slate-300 p-4 rounded-sm text-xs">
                <Link href="/police" className="font-bold text-blue-800 hover:underline flex items-center gap-1">
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>警察総合メニューへ戻る</span>
                </Link>
              </div>

            </aside>

          </div>
        )}
      </main>
    </div>
  );
}
