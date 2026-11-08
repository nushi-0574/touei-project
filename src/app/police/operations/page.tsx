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
import { Shield, Monitor, Radio, Database, Activity, ArrowLeft } from 'lucide-react';

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
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans">
      <Header />

      <main className="max-w-7xl mx-auto px-2 sm:px-4 py-4 space-y-4">
        <Breadcrumbs items={[
          { label: '警察専用ポータル', href: '/police' },
          { label: '警察業務専用端末 (POLICE-OPS-01)' }
        ]} />

        {loading ? (
          <ContentSkeleton />
        ) : errorMessage ? (
          <p role="alert" className="text-xs font-bold text-red-200 bg-red-950 border border-red-800 p-4">
            [エラー] {errorMessage}
          </p>
        ) : !hasAccess ? (
          <section className="bg-slate-950 border border-slate-800 p-6 text-center">
            <h1 className="text-base font-bold text-slate-100">警察業務専用端末</h1>
            <p className="text-xs text-slate-400 mt-2">SECURITY CHECK FAILED: 管理者または警察職員ロールが必要です。</p>
            <Link href="/police" className="inline-block mt-4 text-xs font-bold text-blue-400 hover:underline">
              ← 警察総合メニューへ戻る
            </Link>
          </section>
        ) : (
          /* 重厚・高信頼 警察業務端末コンソール (ダークスレート・モノクロ高視認性UI) */
          <div className="bg-slate-950 border-2 border-slate-700 shadow-2xl">

            {/* システムヘッダーバー */}
            <div className="bg-slate-900 text-slate-100 px-4 py-2.5 flex flex-wrap items-center justify-between border-b border-slate-800 text-xs">
              <div className="flex items-center gap-3">
                <Shield className="w-5 h-5 text-emerald-400" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold tracking-wider text-slate-100">
                      東栄県警察本部 警備・指令業務統合端末
                    </span>
                    <span className="bg-slate-800 text-slate-300 px-2 py-0.5 text-[10px] font-mono border border-slate-700">
                      TERMINAL-01
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4 text-[11px] font-mono">
                <span className="text-slate-300">役職区分: <strong className="text-emerald-400">{policeOrgRole}</strong></span>
                <span className="text-emerald-400 font-bold">● 庁内LAN接続中</span>
                <span className="text-slate-400">{currentTimeStr}</span>
              </div>
            </div>

            {/* タブ切り替えバー */}
            <div className="bg-slate-900 px-2 pt-2 border-b border-slate-800 flex flex-wrap gap-1 text-xs font-bold">
              <button
                type="button"
                onClick={() => setActiveTab('dispatch')}
                className={`px-4 py-2 border-t border-x transition-colors flex items-center gap-2 ${
                  activeTab === 'dispatch'
                    ? 'bg-slate-950 border-slate-700 text-emerald-400 border-b-2 border-b-emerald-500 -mb-px z-10'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-850 hover:text-slate-200'
                }`}
              >
                <Monitor className="w-3.5 h-3.5" />
                <span>110番緊急指令台</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('radio')}
                className={`px-4 py-2 border-t border-x transition-colors flex items-center gap-2 ${
                  activeTab === 'radio'
                    ? 'bg-slate-950 border-slate-700 text-emerald-400 border-b-2 border-b-emerald-500 -mb-px z-10'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-850 hover:text-slate-200'
                }`}
              >
                <Radio className="w-3.5 h-3.5" />
                <span>警察無線統括卓</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('database')}
                className={`px-4 py-2 border-t border-x transition-colors flex items-center gap-2 ${
                  activeTab === 'database'
                    ? 'bg-slate-950 border-slate-700 text-emerald-400 border-b-2 border-b-emerald-500 -mb-px z-10'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-850 hover:text-slate-200'
                }`}
              >
                <Database className="w-3.5 h-3.5" />
                <span>事件・台帳照会DB</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('system')}
                className={`px-4 py-2 border-t border-x transition-colors flex items-center gap-2 ${
                  activeTab === 'system'
                    ? 'bg-slate-950 border-slate-700 text-emerald-400 border-b-2 border-b-emerald-500 -mb-px z-10'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-850 hover:text-slate-200'
                }`}
              >
                <Activity className="w-3.5 h-3.5" />
                <span>端末ステータス</span>
              </button>
            </div>

            {/* タブコンテンツエリア */}
            <div className="bg-slate-950 p-4 min-h-[520px]">

              {/* 110番緊急指令台 */}
              {activeTab === 'dispatch' && (
                <div className="space-y-4">
                  <div className="bg-slate-900 text-slate-200 px-3 py-2 border border-slate-800 flex justify-between items-center text-xs font-mono">
                    <span className="font-bold text-emerald-400">STATUS: 110番緊急指令・リアルタイム監視卓 動作中</span>
                    <span className="text-slate-400">REALTIME DISPATCH ENGINE</span>
                  </div>
                  <PoliceDispatchSystem />
                </div>
              )}

              {/* 警察無線統括卓 */}
              {activeTab === 'radio' && (
                <div className="space-y-4">
                  <div className="bg-slate-900 text-slate-200 px-3 py-2 border border-slate-800 flex justify-between items-center text-xs font-mono">
                    <span className="font-bold text-blue-400">STATUS: 警察無線暗号化回線 (全5回線) 正常接続中</span>
                    <span className="text-slate-400">RADIO FREQUENCY ENCRYPTED</span>
                  </div>
                  <PoliceRadio />
                </div>
              )}

              {/* 事件・台帳照会 */}
              {activeTab === 'database' && (
                <div className="space-y-4 text-xs font-mono">
                  <div className="bg-slate-900 text-slate-200 px-3 py-2 border border-slate-800 flex justify-between items-center">
                    <span className="font-bold text-slate-100">事件簿・台帳統合照会データベース</span>
                    <span className="text-slate-400">DB: TOEI-POLICE-MAIN-STORE</span>
                  </div>

                  <div className="bg-slate-900 p-3.5 border border-slate-800 space-y-2">
                    <label className="block font-bold text-slate-300">
                      照会キーワード検索 (管理番号 / 発生場所 / 氏名 / 概要)
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={dbSearchQuery}
                        onChange={(e) => setDbSearchQuery(e.target.value)}
                        placeholder="例: 110-20261107 / 中央町 / 交通事故"
                        className="flex-1 px-3 py-2 border border-slate-700 bg-slate-950 text-slate-100 text-xs focus:outline-none focus:border-blue-500"
                      />
                      <button
                        type="button"
                        className="px-5 py-2 bg-slate-800 text-slate-100 font-bold border border-slate-700 hover:bg-slate-700 transition-colors"
                      >
                        照会検索
                      </button>
                    </div>
                  </div>

                  {/* 濃淡高密度データテーブル */}
                  <div className="border border-slate-800 bg-slate-950 overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs font-mono">
                      <thead>
                        <tr className="bg-slate-900 text-slate-200 border-b border-slate-800">
                          <th className="p-2.5 border-r border-slate-800">管理番号</th>
                          <th className="p-2.5 border-r border-slate-800">事案区分</th>
                          <th className="p-2.5 border-r border-slate-800">件名・概要</th>
                          <th className="p-2.5 border-r border-slate-800">発生場所</th>
                          <th className="p-2.5 border-r border-slate-800">指令区分</th>
                          <th className="p-2.5 border-r border-slate-800">状態</th>
                          <th className="p-2.5">登録日時</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-slate-800/80 bg-slate-900/50 hover:bg-slate-900">
                          <td className="p-2.5 border-r border-slate-800 font-bold text-slate-200">110-20261107-001</td>
                          <td className="p-2.5 border-r border-slate-800">交通事故</td>
                          <td className="p-2.5 border-r border-slate-800 font-bold text-slate-100">東栄駅前における器物破損・接触事故</td>
                          <td className="p-2.5 border-r border-slate-800">東栄市中央町1-2-3</td>
                          <td className="p-2.5 border-r border-slate-800 font-bold text-red-400">第1種(緊急)</td>
                          <td className="p-2.5 border-r border-slate-800 font-bold text-blue-300">現場対応中</td>
                          <td className="p-2.5 text-slate-400">2026/11/07 21:30</td>
                        </tr>
                        <tr className="border-b border-slate-800/80 bg-slate-950 hover:bg-slate-900">
                          <td className="p-2.5 border-r border-slate-800 font-bold text-slate-200">110-20261107-002</td>
                          <td className="p-2.5 border-r border-slate-800">不審者</td>
                          <td className="p-2.5 border-r border-slate-800 font-bold text-slate-100">公園付近における不審人物徘徊通報</td>
                          <td className="p-2.5 border-r border-slate-800">東栄市緑ヶ丘3-1</td>
                          <td className="p-2.5 border-r border-slate-800 font-bold text-amber-400">第2種(重要)</td>
                          <td className="p-2.5 border-r border-slate-800 font-bold text-amber-300">現場急行指示</td>
                          <td className="p-2.5 text-slate-400">2026/11/07 20:15</td>
                        </tr>
                        <tr className="border-b border-slate-800/80 bg-slate-900/50 hover:bg-slate-900">
                          <td className="p-2.5 border-r border-slate-800 font-bold text-slate-200">110-20261106-089</td>
                          <td className="p-2.5 border-r border-slate-800">落し物</td>
                          <td className="p-2.5 border-r border-slate-800 text-slate-300">商業施設における財布拾得届出</td>
                          <td className="p-2.5 border-r border-slate-800">東栄本町モール</td>
                          <td className="p-2.5 border-r border-slate-800 text-slate-300">第3種(一般)</td>
                          <td className="p-2.5 border-r border-slate-800 font-bold text-emerald-400">事案完了</td>
                          <td className="p-2.5 text-slate-400">2026/11/06 18:40</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <p className="text-[11px] text-slate-500 text-right">※表示中データ: 直近3件 / データ同期完了</p>
                </div>
              )}

              {/* 端末ステータス */}
              {activeTab === 'system' && (
                <div className="space-y-4 text-xs font-mono">
                  <div className="bg-slate-900 text-slate-200 px-3 py-2 border border-slate-800 flex justify-between items-center">
                    <span className="font-bold">端末診断・通信ネットワーク情報</span>
                    <span className="text-slate-400">SYSTEM DIAGNOSTICS</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-slate-900 border border-slate-800 p-4 space-y-2">
                      <h4 className="font-bold text-slate-200 border-b border-slate-800 pb-1.5">端末識別情報</h4>
                      <p><span className="text-slate-400 font-bold">Terminal ID:</span> POLICE-OPS-TERMINAL-01</p>
                      <p><span className="text-slate-400 font-bold">Location:</span> 東栄県警察本部 通信指令課 第1指令台</p>
                      <p><span className="text-slate-400 font-bold">System OS:</span> Toei Police Secure Enterprise Terminal V2.6</p>
                      <p><span className="text-slate-400 font-bold">Network:</span> 警察庁内LAN 閉域接続 (TLS 1.3)</p>
                    </div>

                    <div className="bg-slate-900 border border-slate-800 p-4 space-y-2">
                      <h4 className="font-bold text-slate-200 border-b border-slate-800 pb-1.5">セキュリティ・認証状態</h4>
                      <p><span className="text-slate-400 font-bold">Authentication:</span> Supabase Auth (Session OK)</p>
                      <p><span className="text-slate-400 font-bold">Role Assignment:</span> {policeOrgRole}</p>
                      <p><span className="text-slate-400 font-bold">Realtime Engine:</span> Active (2 Subscriptions)</p>
                      <p><span className="text-slate-400 font-bold">System Time:</span> {currentTimeStr}</p>
                    </div>
                  </div>

                  <div className="bg-slate-900 text-emerald-400 p-3.5 font-mono text-[11px] border border-slate-800 leading-relaxed">
                    <p>[SYS-LOG] INITIALIZING POLICE OPERATIONS SYSTEM... OK</p>
                    <p>[SYS-LOG] CONNECTING REALTIME CHANNEL 'police_dispatch_incidents'... CONNECTED</p>
                    <p>[SYS-LOG] CONNECTING REALTIME CHANNEL 'police_radio_messages'... CONNECTED</p>
                    <p>[SYS-LOG] DISPATCH CONTROLLER READY. SYSTEM HEALTH: 100%</p>
                  </div>
                </div>
              )}

            </div>

            {/* ボトムステータスバー */}
            <div className="bg-slate-900 text-slate-300 px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-[11px] border-t border-slate-800 font-mono">
              <div className="flex items-center gap-3">
                <span className="text-emerald-400 font-bold">● ONLINE</span>
                <span>TERM-ID: POLICE-OPS-01</span>
                <span className="hidden sm:inline">| DB: TOEI-POLICE-DB</span>
              </div>
              <div className="flex items-center gap-4">
                <span>TIME: {currentTimeStr}</span>
                <Link href="/police" className="text-blue-400 hover:underline font-bold flex items-center gap-1">
                  <ArrowLeft className="w-3 h-3" />
                  <span>総合メニューへ</span>
                </Link>
              </div>
            </div>

          </div>
        )}
      </main>
    </div>
  );
}
