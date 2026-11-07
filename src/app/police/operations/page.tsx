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
    <div className="min-h-screen bg-slate-200 text-slate-900 font-mono">
      <Header />

      <main className="max-w-7xl mx-auto px-2 sm:px-4 py-4 space-y-4">
        <Breadcrumbs items={[
          { label: '警察専用ポータル', href: '/police' },
          { label: '警察業務専用端末 (POLICE-OPS-01)' }
        ]} />

        {loading ? (
          <ContentSkeleton />
        ) : errorMessage ? (
          <p role="alert" className="text-xs font-bold text-red-900 bg-red-100 border border-red-400 p-4">
            [ERROR] {errorMessage}
          </p>
        ) : !hasAccess ? (
          <section className="bg-slate-100 border-2 border-slate-600 p-6 text-center">
            <h1 className="text-base font-bold text-slate-900">[アクセス拒否] 警察業務専用端末</h1>
            <p className="text-xs text-slate-700 mt-2">SECURITY CHECK FAILED: 管理者または警察職員ロールが必要です。</p>
            <Link href="/police" className="inline-block mt-4 text-xs font-bold text-slate-800 underline">
              [ 警察総合メニューへ戻る ]
            </Link>
          </section>
        ) : (
          /* レトロ業務用端末ウインドウフレーム (モノクロ・濃淡デザイン) */
          <div className="bg-slate-300 border-2 border-slate-700 shadow-md">

            {/* ウィンドウタイトルバー */}
            <div className="bg-slate-800 text-slate-100 px-3 py-1.5 flex items-center justify-between border-b-2 border-slate-700 text-xs">
              <div className="flex items-center gap-2">
                <span className="bg-slate-600 text-white px-1.5 py-0.5 text-[10px] font-bold border border-slate-500">
                  SYS.V2.6
                </span>
                <span className="font-bold tracking-wider">
                  東栄県警察本部 統合警備・指令業務処理端末 [POLICE-TERMINAL-01]
                </span>
              </div>
              <div className="flex items-center gap-3 text-[11px] font-mono">
                <span className="hidden md:inline text-slate-300">ROLE: {policeOrgRole}</span>
                <span className="text-emerald-400">● ONLINE</span>
                <div className="flex items-center gap-1 border border-slate-600 px-1 bg-slate-900">
                  <span className="text-slate-300">[ _ ]</span>
                  <span className="text-slate-300">[ 口 ]</span>
                  <span className="text-red-400 font-bold">[ X ]</span>
                </div>
              </div>
            </div>

            {/* メニューバー (レトロスタイル) */}
            <div className="bg-slate-200 border-b border-slate-500 px-3 py-1 flex flex-wrap gap-4 text-xs font-bold text-slate-800 border-t border-t-white">
              <span className="hover:bg-slate-400 px-1.5 py-0.5 cursor-pointer">ファイル(<u>F</u>)</span>
              <span className="hover:bg-slate-400 px-1.5 py-0.5 cursor-pointer">編集(<u>E</u>)</span>
              <span className="hover:bg-slate-400 px-1.5 py-0.5 cursor-pointer">指令(<u>D</u>)</span>
              <span className="hover:bg-slate-400 px-1.5 py-0.5 cursor-pointer">無線(<u>R</u>)</span>
              <span className="hover:bg-slate-400 px-1.5 py-0.5 cursor-pointer">照会(<u>S</u>)</span>
              <span className="hover:bg-slate-400 px-1.5 py-0.5 cursor-pointer">ツール(<u>T</u>)</span>
              <span className="hover:bg-slate-400 px-1.5 py-0.5 cursor-pointer">ヘルプ(<u>H</u>)</span>
            </div>

            {/* 機能タブ切り替えバー (クラシックタブボタン) */}
            <div className="bg-slate-300 px-2 pt-2 border-b border-slate-500 flex flex-wrap gap-1 text-xs font-bold">
              <button
                type="button"
                onClick={() => setActiveTab('dispatch')}
                className={`px-4 py-2 border-t-2 border-x-2 transition-colors ${
                  activeTab === 'dispatch'
                    ? 'bg-slate-100 border-slate-700 text-slate-950 border-b-2 border-b-slate-100 -mb-px z-10'
                    : 'bg-slate-400 border-slate-600 text-slate-800 hover:bg-slate-350'
                }`}
              >
                [ F1: 110番緊急指令台 ]
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('radio')}
                className={`px-4 py-2 border-t-2 border-x-2 transition-colors ${
                  activeTab === 'radio'
                    ? 'bg-slate-100 border-slate-700 text-slate-950 border-b-2 border-b-slate-100 -mb-px z-10'
                    : 'bg-slate-400 border-slate-600 text-slate-800 hover:bg-slate-350'
                }`}
              >
                [ F2: 警察無線統括卓 ]
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('database')}
                className={`px-4 py-2 border-t-2 border-x-2 transition-colors ${
                  activeTab === 'database'
                    ? 'bg-slate-100 border-slate-700 text-slate-950 border-b-2 border-b-slate-100 -mb-px z-10'
                    : 'bg-slate-400 border-slate-600 text-slate-800 hover:bg-slate-350'
                }`}
              >
                [ F3: 事件・台帳照会 ]
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('system')}
                className={`px-4 py-2 border-t-2 border-x-2 transition-colors ${
                  activeTab === 'system'
                    ? 'bg-slate-100 border-slate-700 text-slate-950 border-b-2 border-b-slate-100 -mb-px z-10'
                    : 'bg-slate-400 border-slate-600 text-slate-800 hover:bg-slate-350'
                }`}
              >
                [ F4: 端末ステータス ]
              </button>
            </div>

            {/* タブコンテンツエリア */}
            <div className="bg-slate-100 p-4 min-h-[500px]">

              {/* F1: 110番緊急指令台 */}
              {activeTab === 'dispatch' && (
                <div className="space-y-4">
                  <div className="bg-slate-800 text-white p-3 border border-slate-700 flex justify-between items-center text-xs">
                    <span className="font-bold">▶ モード: 110番緊急指令・リアルタイム監視卓</span>
                    <span className="text-slate-300">STATUS: READY / LIVE SYNC</span>
                  </div>
                  <PoliceDispatchSystem />
                </div>
              )}

              {/* F2: 警察無線統括卓 */}
              {activeTab === 'radio' && (
                <div className="space-y-4">
                  <div className="bg-slate-800 text-white p-3 border border-slate-700 flex justify-between items-center text-xs">
                    <span className="font-bold">▶ モード: 警察無線通信統括卓 (5チャンネル暗号化回線)</span>
                    <span className="text-slate-300">ENCRYPTION: ACTIVE</span>
                  </div>
                  <PoliceRadio />
                </div>
              )}

              {/* F3: 事件・台帳照会 */}
              {activeTab === 'database' && (
                <div className="space-y-4 text-xs">
                  <div className="bg-slate-800 text-white p-3 border border-slate-700 flex justify-between items-center">
                    <span className="font-bold">▶ モード: 事件簿・台帳統合照会データベース</span>
                    <span className="text-slate-300">DB: TOEI-POLICE-MAIN</span>
                  </div>

                  <div className="bg-slate-200 p-3 border border-slate-400 space-y-2">
                    <label className="block font-bold text-slate-800">
                      検索キーワード (事件番号 / 場所 / 氏名 / 備考)
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={dbSearchQuery}
                        onChange={(e) => setDbSearchQuery(e.target.value)}
                        placeholder="例: 110-20261107 / 中央町 / 交通事故"
                        className="flex-1 px-3 py-1.5 border border-slate-600 bg-white text-xs font-mono"
                      />
                      <button
                        type="button"
                        className="px-4 py-1.5 bg-slate-800 text-white font-bold border border-slate-900 hover:bg-slate-700"
                      >
                        照会実行 [ENTER]
                      </button>
                    </div>
                  </div>

                  {/* 濃淡高密度データテーブル */}
                  <div className="border border-slate-600 bg-white overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs font-mono">
                      <thead>
                        <tr className="bg-slate-700 text-white border-b border-slate-800">
                          <th className="p-2 border-r border-slate-600">ID / 番号</th>
                          <th className="p-2 border-r border-slate-600">区分</th>
                          <th className="p-2 border-r border-slate-600">件名・概要</th>
                          <th className="p-2 border-r border-slate-600">発生場所</th>
                          <th className="p-2 border-r border-slate-600">優先度</th>
                          <th className="p-2 border-r border-slate-600">状態</th>
                          <th className="p-2">日時</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-slate-300 bg-slate-50 hover:bg-slate-200">
                          <td className="p-2 border-r border-slate-300 font-bold">110-20261107-001</td>
                          <td className="p-2 border-r border-slate-300">交通事故</td>
                          <td className="p-2 border-r border-slate-300 font-bold">東栄駅前での器物破損・接触事故</td>
                          <td className="p-2 border-r border-slate-300">東栄市中央町1-2-3</td>
                          <td className="p-2 border-r border-slate-300 font-bold text-red-700">緊急(A)</td>
                          <td className="p-2 border-r border-slate-300 font-bold">対応中</td>
                          <td className="p-2">2026/11/07 21:30</td>
                        </tr>
                        <tr className="border-b border-slate-300 bg-white hover:bg-slate-200">
                          <td className="p-2 border-r border-slate-300 font-bold">110-20261107-002</td>
                          <td className="p-2 border-r border-slate-300">不審者</td>
                          <td className="p-2 border-r border-slate-300 font-bold">公園付近での不審人物徘徊通報</td>
                          <td className="p-2 border-r border-slate-300">東栄市緑ヶ丘3-1</td>
                          <td className="p-2 border-r border-slate-300 font-bold text-amber-700">重要(B)</td>
                          <td className="p-2 border-r border-slate-300 font-bold">現場急行指示</td>
                          <td className="p-2">2026/11/07 20:15</td>
                        </tr>
                        <tr className="border-b border-slate-300 bg-slate-50 hover:bg-slate-200">
                          <td className="p-2 border-r border-slate-300 font-bold">110-20261106-089</td>
                          <td className="p-2 border-r border-slate-300">落し物</td>
                          <td className="p-2 border-r border-slate-300">商業施設での財布拾得物届出</td>
                          <td className="p-2 border-r border-slate-300">東栄本町モール</td>
                          <td className="p-2 border-r border-slate-300">一般(C)</td>
                          <td className="p-2 border-r border-slate-300 font-bold text-emerald-800">完了</td>
                          <td className="p-2">2026/11/06 18:40</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <p className="text-[11px] text-slate-500 text-right">※表示中データ: 最新3件 / 全データベース同期完了</p>
                </div>
              )}

              {/* F4: 端末ステータス */}
              {activeTab === 'system' && (
                <div className="space-y-4 text-xs">
                  <div className="bg-slate-800 text-white p-3 border border-slate-700 flex justify-between items-center">
                    <span className="font-bold">▶ モード: 警察業務端末 システム・ネットワークステータス</span>
                    <span className="text-slate-300">SYSTEM DIAGNOSTICS</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-slate-200 border border-slate-400 p-4 space-y-2">
                      <h4 className="font-bold text-slate-900 border-b border-slate-400 pb-1">[ 端末識別情報 ]</h4>
                      <p><span className="font-bold">Terminal ID:</span> POLICE-OPS-TERMINAL-01</p>
                      <p><span className="font-bold">Location:</span> 東栄県警察本部 通信指令課 第1指令台</p>
                      <p><span className="font-bold">System OS:</span> Toei Police Secure Enterprise Terminal V2.6</p>
                      <p><span className="font-bold">Client Protocol:</span> HTTPS / WebSockets (TLS 1.3)</p>
                    </div>

                    <div className="bg-slate-200 border border-slate-400 p-4 space-y-2">
                      <h4 className="font-bold text-slate-900 border-b border-slate-400 pb-1">[ セキュリティ・暗号化 ]</h4>
                      <p><span className="font-bold">Authentication:</span> Supabase Auth (Session Token OK)</p>
                      <p><span className="font-bold">Role Assignment:</span> {policeOrgRole}</p>
                      <p><span className="font-bold">Realtime Channel:</span> Active (2 Subscriptions)</p>
                      <p><span className="font-bold">System Time:</span> {currentTimeStr}</p>
                    </div>
                  </div>

                  <div className="bg-slate-900 text-emerald-400 p-3 font-mono text-[11px] border border-slate-700 leading-relaxed">
                    <p>[SYS-LOG 21:58:01] INITIALIZING POLICE OPERATIONS SYSTEM... OK</p>
                    <p>[SYS-LOG 21:58:02] CONNECTING REALTIME CHANNEL 'police_dispatch_incidents'... CONNECTED</p>
                    <p>[SYS-LOG 21:58:02] CONNECTING REALTIME CHANNEL 'police_radio_messages'... CONNECTED</p>
                    <p>[SYS-LOG 21:58:03] DISPATCH CONTROLLER READY. SYSTEM HEALTH: 100%</p>
                  </div>
                </div>
              )}

            </div>

            {/* ボトムステータスバー (レトロ端末フッター) */}
            <div className="bg-slate-800 text-slate-200 px-3 py-1.5 flex flex-wrap items-center justify-between gap-2 text-[11px] border-t border-slate-700 font-mono">
              <div className="flex items-center gap-3">
                <span className="text-emerald-400 font-bold">[ONLINE]</span>
                <span>TERM-ID: POLICE-OPS-01</span>
                <span className="hidden sm:inline">| DB: TOEI-SUPABASE</span>
              </div>
              <div className="flex items-center gap-3">
                <span>TIME: {currentTimeStr}</span>
                <Link href="/police" className="text-slate-300 hover:text-white underline">
                  [ 総合メニューへ ]
                </Link>
              </div>
            </div>

          </div>
        )}
      </main>
    </div>
  );
}
