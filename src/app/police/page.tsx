'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '../components/Header';
import Breadcrumbs from '../components/Breadcrumbs';
import { ContentSkeleton } from '@/src/app/components/LoadingScreen';
import { getErrorMessage } from '../../lib/errors';
import { supabase } from '../../lib/supabase';

export default function PolicePage() {
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [policeOrgRole, setPoliceOrgRole] = useState('一般');
  const [errorMessage, setErrorMessage] = useState('');
  const router = useRouter();

  useEffect(() => {
    let active = true;

    async function loadPolicePage() {
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
        console.error('警察専用ページの読み込みに失敗しました:', error);
        if (active) setErrorMessage(getErrorMessage(error, '警察専用ページを読み込めませんでした。'));
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadPolicePage();
    return () => {
      active = false;
    };
  }, [router]);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800">
      <Header />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <Breadcrumbs items={[{ label: '警察専用ポータル' }]} />

        {loading ? (
          <ContentSkeleton />
        ) : errorMessage ? (
          <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-4">
            {errorMessage}
          </p>
        ) : !hasAccess ? (
          <section className="bg-white border border-slate-200 rounded p-6 text-center">
            <h1 className="text-lg font-bold text-slate-900">警察職員専用ページ</h1>
            <p className="text-sm text-slate-600 mt-2">このページを利用するには管理者または警察職員ロールが必要です。</p>
            <Link href="/dashboard" className="inline-block mt-4 text-sm text-blue-700 hover:underline">
              メインメニューへ戻る
            </Link>
          </section>
        ) : (
          <div className="space-y-6">
            {/* ポータルヘッダー */}
            <section className="bg-slate-900 text-white border border-slate-800 rounded p-6 shadow">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <span className="text-xs font-bold text-emerald-400 bg-emerald-950 px-2.5 py-1 rounded border border-emerald-800">
                    東栄県警察本部 警備・情報統括ポータル
                  </span>
                  <h1 className="text-xl font-bold mt-2">警察職員 総合メニュー</h1>
                  <p className="text-xs text-slate-300 mt-1">
                    警察業務処理端末、110番緊急指令卓、警察無線、採用・組織管理ポータルへアクセスできます。
                  </p>
                </div>
                <div className="bg-slate-800 border border-slate-700 p-3 rounded text-xs shrink-0">
                  <span className="text-slate-400 block mb-0.5">現在の組織役割</span>
                  <span className="font-bold text-emerald-300 text-sm">{policeOrgRole}</span>
                </div>
              </div>
            </section>

            {/* 総合メニューカードグリッド */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

              {/* メイン: 警察業務専用端末（レトロ業務用UI） */}
              <div className="md:col-span-2 bg-gradient-to-r from-slate-800 to-slate-900 text-white rounded border border-slate-700 p-6 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-5">
                <div className="space-y-2 max-w-2xl">
                  <div className="flex items-center gap-2">
                    <span className="bg-emerald-500 text-slate-950 text-[11px] font-bold px-2 py-0.5 rounded">
                      メイン業務システム
                    </span>
                    <span className="text-slate-400 text-xs font-mono">Terminal POLICE-OPS-01</span>
                  </div>
                  <h2 className="text-lg font-bold">警察業務専用処理端末システム</h2>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    110番緊急指令卓・警察無線・事件情報照会・システムステータスを統括処理するクラシック業務用端末画面を開きます。
                  </p>
                </div>
                <Link
                  href="/police/operations"
                  className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-slate-950 text-xs font-bold rounded shadow transition-colors shrink-0 flex items-center justify-center gap-2 min-h-[44px]"
                >
                  <span>🖥️</span>
                  <span>業務専用処理端末を開く（濃淡UI）</span>
                </Link>
              </div>

              {/* カード1: 110番緊急指令台 */}
              <div className="bg-white border border-slate-200 rounded p-5 space-y-3 shadow-sm hover:border-slate-300 transition-colors flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                      <span>🚨</span>
                      <span>110番 緊急指令台</span>
                    </h3>
                    <span className="text-[11px] font-bold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded">
                      リアルタイム
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    110番緊急通報の受付、優先度・種別指定、現場急行部隊の配備指示および進捗管理を行います。
                  </p>
                </div>
                <Link
                  href="/police/operations?tab=dispatch"
                  className="block text-center py-2.5 px-4 bg-red-700 hover:bg-red-800 text-white text-xs font-bold rounded transition-colors"
                >
                  110番指令台へ直行
                </Link>
              </div>

              {/* カード2: 警察無線通信 */}
              <div className="bg-white border border-slate-200 rounded p-5 space-y-3 shadow-sm hover:border-slate-300 transition-colors flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                      <span>📻</span>
                      <span>警察無線通信卓</span>
                    </h3>
                    <span className="text-[11px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
                      全5チャンネル
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    「県内」「Ch1」「Ch2」「非常用」「教育」各チャンネルでの暗号化テキスト・音声相互連絡システムです。
                  </p>
                </div>
                <Link
                  href="/police/operations?tab=radio"
                  className="block text-center py-2.5 px-4 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded transition-colors"
                >
                  警察無線卓へ直行
                </Link>
              </div>

              {/* カード3: 採用試験合否照会 */}
              <div className="bg-white border border-slate-200 rounded p-5 space-y-3 shadow-sm hover:border-slate-300 transition-colors flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                      <span>📄</span>
                      <span>警察官採用試験 合否照会</span>
                    </h3>
                    <span className="text-[11px] font-bold text-slate-700 bg-slate-100 border border-slate-300 px-2 py-0.5 rounded">
                      公開システム
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    受験者向けの令和8年度 東栄県警察官採用試験 合否照会および採用募集管理ポータルです。
                  </p>
                </div>
                <div className="flex gap-2">
                  <Link
                    href="/toeiken/police-result"
                    className="flex-1 text-center py-2 px-3 bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold rounded transition-colors"
                  >
                    合否照会画面
                  </Link>
                  <Link
                    href="/recruitment"
                    className="flex-1 text-center py-2 px-3 border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold rounded transition-colors"
                  >
                    採用募集一覧
                  </Link>
                </div>
              </div>

              {/* カード4: 内部電話窓口 & 住民サポート */}
              <div className="bg-white border border-slate-200 rounded p-5 space-y-3 shadow-sm hover:border-slate-300 transition-colors flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                      <span>📞</span>
                      <span>内部電話窓口 (030番)</span>
                    </h3>
                    <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                      ブラウザ通話
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    住民・他部局からの030形式番号による通話着信の応答、相談対応および通話接続を処理します。
                  </p>
                </div>
                <Link
                  href="/toeiken/phone"
                  className="block text-center py-2.5 px-4 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded transition-colors"
                >
                  電話窓口を開く
                </Link>
              </div>

            </div>

            <div className="pt-4 border-t border-slate-200 flex justify-between items-center text-xs text-slate-500">
              <Link href="/dashboard" className="text-blue-700 hover:underline font-bold">
                ← ポータルメインメニューへ戻る
              </Link>
              <span>東栄県警察本部 警備部情報通信課</span>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
