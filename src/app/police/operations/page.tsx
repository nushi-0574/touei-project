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
import { Shield, Monitor, Radio, Database, Activity, ArrowLeft, Search, Terminal, Server } from 'lucide-react';

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

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex-1 w-full space-y-4">
        <Breadcrumbs items={[
          { label: '警察専用ポータル', href: '/police' },
          { label: '警察業務専用処理端末 (POLICE-OPS-01)' }
        ]} />

        {/* 外枠: 最新ポータル内の端末エミュレータ案内バー */}
        <section className="bg-slate-50 border border-slate-300 p-4 rounded-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 border border-blue-200 text-[#0046ff] rounded-sm shrink-0">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-bold text-[#0046ff] uppercase tracking-wider block">
                POLICE ENTERPRISE C/S TERMINAL EMULATOR
              </span>
              <h1 className="text-sm font-bold text-slate-900">
                東栄県Webポータル 庁内レトロ業務端末 Webエミュレート実行環境
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono shrink-0">
            <span className="bg-white border border-slate-300 px-2.5 py-1 text-slate-700">
              HOST: 192.168.1.100:23
            </span>
            <span className="bg-blue-50 border border-blue-200 text-[#0046ff] px-2.5 py-1 font-bold">
              VT100 / ACTIVE
            </span>
          </div>
        </section>

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
          /* 内枠: 埋め込まれたレトロ業務システムウインドウ (C/S Mainframe Terminal Style) */
          <div className="bg-slate-300 border-2 border-slate-700 font-mono text-slate-900 shadow-sm">

            {/* レトロ端末 ウィンドウタイトルバー */}
            <div className="bg-slate-800 text-white px-3 py-1.5 flex items-center justify-between border-b-2 border-slate-700 text-xs">
              <div className="flex items-center gap-2">
                <span className="bg-slate-700 text-emerald-400 px-1.5 py-0.5 text-[10px] font-bold border border-slate-600 font-mono">
                  [SYS-EMULATOR]
                </span>
                <span className="font-bold tracking-wider text-slate-100 text-[13px]">
                  東栄県警察庁 警務統合情報処理システム V1.08 (BUILD-1998)
                </span>
              </div>
              <div className="flex items-center gap-3 text-[11px] font-mono">
                <span className="hidden md:inline text-slate-300">OP: {policeOrgRole}</span>
                <span className="text-emerald-400">● ONLINE</span>
                {/* レトロ操作ボタン */}
                <div className="flex items-center gap-1 border border-slate-600 px-1 bg-slate-900 text-[10px]">
                  <span className="text-slate-300 cursor-pointer">[_]</span>
                  <span className="text-slate-300 cursor-pointer">[口]</span>
                  <span className="text-red-400 font-bold cursor-pointer">[X]</span>
                </div>
              </div>
            </div>

            {/* クラシック メニューバー */}
            <div className="bg-slate-200 border-b border-slate-500 px-3 py-1 flex flex-wrap gap-4 text-xs font-bold text-slate-800 border-t border-t-white">
              <span className="hover:bg-slate-400 px-1.5 py-0.5 cursor-pointer">ファイル(<u>F</u>)</span>
              <span className="hover:bg-slate-400 px-1.5 py-0.5 cursor-pointer">編集(<u>E</u>)</span>
              <span className="hover:bg-slate-400 px-1.5 py-0.5 cursor-pointer">指令(<u>D</u>)</span>
              <span className="hover:bg-slate-400 px-1.5 py-0.5 cursor-pointer">無線(<u>R</u>)</span>
              <span className="hover:bg-slate-400 px-1.5 py-0.5 cursor-pointer">台帳(<u>S</u>)</span>
              <span className="hover:bg-slate-400 px-1.5 py-0.5 cursor-pointer">通信(<u>C</u>)</span>
              <span className="hover:bg-slate-400 px-1.5 py-0.5 cursor-pointer">ヘルプ(<u>H</u>)</span>
            </div>

            {/* ファンクションキー切り替えタブ */}
            <div className="bg-slate-300 px-2 pt-2 border-b border-slate-500 flex flex-wrap gap-1 text-xs font-bold">
              <button
                type="button"
                onClick={() => setActiveTab('dispatch')}
                className={`px-3.5 py-1.5 border-t-2 border-x-2 transition-colors flex items-center gap-1.5 ${
                  activeTab === 'dispatch'
                    ? 'bg-white border-slate-700 text-slate-950 border-b-2 border-b-white -mb-px z-10'
                    : 'bg-slate-400 border-slate-600 text-slate-800 hover:bg-slate-350'
                }`}
              >
                <Monitor className="w-3.5 h-3.5" />
                <span>[ F1: 110番緊急指令台 ]</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('radio')}
                className={`px-3.5 py-1.5 border-t-2 border-x-2 transition-colors flex items-center gap-1.5 ${
                  activeTab === 'radio'
                    ? 'bg-white border-slate-700 text-slate-950 border-b-2 border-b-white -mb-px z-10'
                    : 'bg-slate-400 border-slate-600 text-slate-800 hover:bg-slate-350'
                }`}
              >
                <Radio className="w-3.5 h-3.5" />
                <span>[ F2: 警察無線統括卓 ]</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('database')}
                className={`px-3.5 py-1.5 border-t-2 border-x-2 transition-colors flex items-center gap-1.5 ${
                  activeTab === 'database'
                    ? 'bg-white border-slate-700 text-slate-950 border-b-2 border-b-white -mb-px z-10'
                    : 'bg-slate-400 border-slate-600 text-slate-800 hover:bg-slate-350'
                }`}
              >
                <Database className="w-3.5 h-3.5" />
                <span>[ F3: 事件・台帳照会 ]</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('system')}
                className={`px-3.5 py-1.5 border-t-2 border-x-2 transition-colors flex items-center gap-1.5 ${
                  activeTab === 'system'
                    ? 'bg-white border-slate-700 text-slate-950 border-b-2 border-b-white -mb-px z-10'
                    : 'bg-slate-400 border-slate-600 text-slate-800 hover:bg-slate-350'
                }`}
              >
                <Activity className="w-3.5 h-3.5" />
                <span>[ F4: 端末ステータス ]</span>
              </button>
            </div>

            {/* 端末画面ディスプレイエリア */}
            <div className="bg-white p-4 min-h-[520px] font-sans">

              {/* F1: 110番緊急指令台 */}
              {activeTab === 'dispatch' && (
                <div className="space-y-3">
                  <div className="bg-slate-800 text-slate-100 px-3 py-2 border border-slate-700 flex justify-between items-center text-xs font-mono">
                    <span className="font-bold text-emerald-400">▶ TERMINAL MODE: 110番緊急指令・リアルタイム監視卓</span>
                    <span className="text-slate-300">REALTIME DISPATCH ENGINE</span>
                  </div>
                  <PoliceDispatchSystem />
                </div>
              )}

              {/* F2: 警察無線統括卓 */}
              {activeTab === 'radio' && (
                <div className="space-y-3">
                  <div className="bg-slate-800 text-slate-100 px-3 py-2 border border-slate-700 flex justify-between items-center text-xs font-mono">
                    <span className="font-bold text-blue-400">▶ TERMINAL MODE: 警察無線統括通信卓 (全5回線)</span>
                    <span className="text-slate-300">ENCRYPTED RADIO CHANNEL</span>
                  </div>
                  <PoliceRadio />
                </div>
              )}

              {/* F3: 事件・台帳照会 */}
              {activeTab === 'database' && (
                <div className="space-y-4 text-xs font-mono">
                  <div className="bg-slate-800 text-slate-100 px-3 py-2 border border-slate-700 flex justify-between items-center">
                    <span className="font-bold text-slate-100">▶ TERMINAL MODE: 事件簿・台帳統合照会データベース</span>
                    <span className="text-slate-400">DB: TOEI-POLICE-STORE</span>
                  </div>

                  <div className="bg-slate-100 p-3.5 border border-slate-400 space-y-2">
                    <label className="block font-bold text-slate-800">照会検索キーワード (管理番号 / 発生場所 / 概要)</label>
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
                        className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white font-bold border border-slate-900 transition-colors inline-flex items-center gap-1"
                      >
                        <Search className="w-3.5 h-3.5" />
                        <span>照会実行 [ENTER]</span>
                      </button>
                    </div>
                  </div>

                  {/* 濃淡レトロデータテーブル */}
                  <div className="border border-slate-600 bg-white overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs font-mono">
                      <thead>
                        <tr className="bg-slate-700 text-white border-b border-slate-800">
                          <th className="p-2 border-r border-slate-600">管理番号</th>
                          <th className="p-2 border-r border-slate-600">事案区分</th>
                          <th className="p-2 border-r border-slate-600">件名・概要</th>
                          <th className="p-2 border-r border-slate-600">発生場所</th>
                          <th className="p-2 border-r border-slate-600">優先度</th>
                          <th className="p-2 border-r border-slate-600">状態</th>
                          <th className="p-2">登録日時</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-slate-300 bg-slate-50 hover:bg-slate-200">
                          <td className="p-2 border-r border-slate-300 font-bold tabular-nums">110-20261107-001</td>
                          <td className="p-2 border-r border-slate-300">交通事故</td>
                          <td className="p-2 border-r border-slate-300 font-bold text-slate-900">東栄駅前における器物破損・接触事故</td>
                          <td className="p-2 border-r border-slate-300">東栄市中央町1-2-3</td>
                          <td className="p-2 border-r border-slate-300 font-bold text-red-700">第1種(緊急)</td>
                          <td className="p-2 border-r border-slate-300 font-bold text-blue-900">現場対応中</td>
                          <td className="p-2 tabular-nums text-slate-700">2026/11/07 21:30</td>
                        </tr>
                        <tr className="border-b border-slate-300 bg-white hover:bg-slate-200">
                          <td className="p-2 border-r border-slate-300 font-bold tabular-nums">110-20261107-002</td>
                          <td className="p-2 border-r border-slate-300">不審者</td>
                          <td className="p-2 border-r border-slate-300 font-bold text-slate-900">公園付近における不審人物徘徊通報</td>
                          <td className="p-2 border-r border-slate-300">東栄市緑ヶ丘3-1</td>
                          <td className="p-2 border-r border-slate-300 font-bold text-amber-700">第2種(重要)</td>
                          <td className="p-2 border-r border-slate-300 font-bold text-amber-900">現場急行指示</td>
                          <td className="p-2 tabular-nums text-slate-700">2026/11/07 20:15</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* F4: 端末ステータス */}
              {activeTab === 'system' && (
                <div className="space-y-4 text-xs font-mono">
                  <div className="bg-slate-800 text-slate-100 px-3 py-2 border border-slate-700 flex justify-between items-center">
                    <span className="font-bold">▶ TERMINAL DIAGNOSTICS & HARDWARE STATUS</span>
                    <span className="text-slate-400">EMULATOR OK</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-slate-100 border border-slate-400 p-4 space-y-2">
                      <h3 className="font-bold text-slate-900 border-b border-slate-400 pb-1.5">[ 端末識別情報 ]</h3>
                      <p><span className="font-bold">Terminal ID:</span> POLICE-OPS-TERMINAL-01</p>
                      <p><span className="font-bold">Location:</span> 東栄県警察本部 通信指令課 第1指令台</p>
                      <p><span className="font-bold">System OS:</span> Toei Police Secure Enterprise Terminal V2.6</p>
                    </div>

                    <div className="bg-slate-100 border border-slate-400 p-4 space-y-2">
                      <h3 className="font-bold text-slate-900 border-b border-slate-400 pb-1.5">[ 接続状態 ]</h3>
                      <p><span className="font-bold">Authentication:</span> Supabase Auth (Session OK)</p>
                      <p><span className="font-bold">Role Assignment:</span> {policeOrgRole}</p>
                      <p><span className="font-bold">Realtime Channel:</span> Active (2 Subscriptions)</p>
                    </div>
                  </div>

                  <div className="bg-slate-900 text-emerald-400 p-3.5 font-mono text-[11px] border border-slate-700 leading-relaxed">
                    <p>[SYS-LOG] INITIALIZING POLICE OPERATIONS TERMINAL EMULATOR...</p>
                    <p>[SYS-LOG] CONNECTING HOST 192.168.1.100:23 VIA WEBSOCKET BRIDGE... CONNECTED</p>
                    <p>[SYS-LOG] REALTIME SYNC CHANNEL 'police_dispatch_incidents' CONNECTED</p>
                    <p>[SYS-LOG] REALTIME SYNC CHANNEL 'police_radio_messages' CONNECTED</p>
                    <p>[SYS-LOG] TERMINAL STATUS: READY. 100% OPERATIONAL</p>
                  </div>
                </div>
              )}

            </div>

            {/* ボトムステータスバー (レトロ端末フッター) */}
            <div className="bg-slate-800 text-slate-200 px-3 py-1.5 flex flex-wrap items-center justify-between gap-2 text-[11px] border-t border-slate-700 font-mono">
              <div className="flex items-center gap-3">
                <span className="text-emerald-400 font-bold">[ONLINE]</span>
                <span>TERM-ID: POLICE-OPS-01</span>
                <span className="hidden sm:inline">| BAUD: 9600 | TERM: VT100</span>
              </div>
              <div className="flex items-center gap-4">
                <span>TIME: {currentTimeStr}</span>
                <Link href="/police" className="text-slate-300 hover:text-white underline">
                  [ 警察総合メニューへ戻る ]
                </Link>
              </div>
            </div>

          </div>
        )}
      </main>
    </div>
  );
}
