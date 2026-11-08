'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '../components/Header';
import Breadcrumbs from '../components/Breadcrumbs';
import { ContentSkeleton } from '@/src/app/components/LoadingScreen';
import { getErrorMessage } from '../../lib/errors';
import { supabase } from '../../lib/supabase';
import {
  Monitor,
  ShieldAlert,
  Radio,
  FileCheck,
  PhoneCall,
  ChevronRight,
  Shield
} from 'lucide-react';

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
    <div className="min-h-screen bg-white text-slate-900 font-sans">
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <Breadcrumbs items={[{ label: '警察専用ポータル' }]} />

        {loading ? (
          <ContentSkeleton />
        ) : errorMessage ? (
          <p role="alert" className="text-xs text-red-800 bg-red-50 border border-red-200 p-4 rounded-sm">
            {errorMessage}
          </p>
        ) : !hasAccess ? (
          <section className="bg-slate-50 border border-slate-200 p-6 text-center rounded-sm">
            <h1 className="text-sm font-bold text-slate-900">警察職員専用ページ</h1>
            <p className="text-xs text-slate-600 mt-1">このページを利用するには管理者または警察職員ロールが必要です。</p>
            <Link href="/dashboard" className="inline-block mt-3 text-xs font-bold text-blue-700 hover:underline">
              メインメニューへ戻る
            </Link>
          </section>
        ) : (
          <div className="space-y-6">
            {/* ポータルヘッダー (東栄ブルー) */}
            <section className="bg-blue-900 text-white border border-blue-950 rounded-sm p-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <Shield className="w-4 h-4 text-blue-200" />
                    <span className="text-xs font-bold text-blue-200">
                      東栄県警察本部
                    </span>
                  </div>
                  <h1 className="text-xl font-bold">警察職員 総合ポータル</h1>
                </div>
                <div className="bg-blue-950 border border-blue-800 px-3 py-1.5 rounded-sm text-xs shrink-0">
                  <span className="text-blue-200 font-mono">役割: {policeOrgRole}</span>
                </div>
              </div>
            </section>

            {/* グリッドメニュー */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

              {/* メイン: 警察業務専用処理端末 */}
              <div className="md:col-span-2 bg-blue-950 text-white border border-blue-900 p-5 rounded-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <span className="text-[10px] font-mono tracking-widest text-blue-300 font-bold uppercase">
                    MAIN CONSOLE
                  </span>
                  <h2 className="text-base font-bold">警察業務専用処理端末 (110番指令・無線)</h2>
                </div>
                <Link
                  href="/police/operations"
                  className="px-5 py-2.5 bg-[#0046ff] hover:bg-blue-600 text-white text-xs font-bold rounded-sm transition-colors shrink-0 flex items-center justify-center gap-1.5 min-h-[40px]"
                >
                  <Monitor className="w-4 h-4" />
                  <span>業務端末を起動</span>
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>

              {/* 110番指令台 */}
              <div className="bg-white border border-slate-200 p-4 rounded-sm space-y-2 flex flex-col justify-between">
                <div className="space-y-1">
                  <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-red-700" />
                    <span>110番 緊急指令台</span>
                  </h3>
                  <p className="text-xs text-slate-600">110番緊急通報の起案・出動指示・リアルタイム管理</p>
                </div>
                <Link
                  href="/police/operations?tab=dispatch"
                  className="block text-center py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-sm"
                >
                  110番指令台を開く
                </Link>
              </div>

              {/* 警察無線 */}
              <div className="bg-white border border-slate-200 p-4 rounded-sm space-y-2 flex flex-col justify-between">
                <div className="space-y-1">
                  <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                    <Radio className="w-4 h-4 text-blue-700" />
                    <span>警察無線通信卓</span>
                  </h3>
                  <p className="text-xs text-slate-600">全5チャンネル暗号化無線通信システム</p>
                </div>
                <Link
                  href="/police/operations?tab=radio"
                  className="block text-center py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-sm"
                >
                  警察無線卓を開く
                </Link>
              </div>

              {/* 採用合否照会 */}
              <div className="bg-white border border-slate-200 p-4 rounded-sm space-y-2 flex flex-col justify-between">
                <div className="space-y-1">
                  <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                    <FileCheck className="w-4 h-4 text-slate-700" />
                    <span>採用試験 合否照会</span>
                  </h3>
                  <p className="text-xs text-slate-600">警察官採用試験合否照会および募集管理</p>
                </div>
                <div className="flex gap-2 text-xs">
                  <Link href="/toeiken/police-result" className="flex-1 text-center py-2 bg-blue-700 text-white font-bold rounded-sm">
                    合否照会
                  </Link>
                  <Link href="/recruitment" className="flex-1 text-center py-2 border border-slate-300 text-slate-800 font-bold rounded-sm">
                    採用募集一覧
                  </Link>
                </div>
              </div>

              {/* 電話窓口 */}
              <div className="bg-white border border-slate-200 p-4 rounded-sm space-y-2 flex flex-col justify-between">
                <div className="space-y-1">
                  <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                    <PhoneCall className="w-4 h-4 text-emerald-700" />
                    <span>内部電話窓口 (030番)</span>
                  </h3>
                  <p className="text-xs text-slate-600">030番号による音声通話着信応答</p>
                </div>
                <Link
                  href="/toeiken/phone"
                  className="block text-center py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-sm"
                >
                  電話窓口を開く
                </Link>
              </div>

            </div>

            <div className="pt-2 text-xs">
              <Link href="/dashboard" className="text-blue-700 hover:underline font-bold">
                ← ダッシュボードへ戻る
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
