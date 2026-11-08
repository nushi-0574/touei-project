'use client';

import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '../../components/Header';
import Breadcrumbs from '../../components/Breadcrumbs';
import { ContentSkeleton } from '@/src/app/components/LoadingScreen';
import { supabase } from '../../../lib/supabase';
import { getErrorMessage } from '../../../lib/errors';
import { useLocale } from '../../../lib/i18n';
import { FileText, ChevronRight, HelpCircle, MessageSquarePlus, UserCheck } from 'lucide-react';

export default function ToeiPortalPage() {
  const [user, setUser] = useState<User | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const router = useRouter();
  const { t } = useLocale();

  useEffect(() => {
    let active = true;

    async function loadSession() {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (!session) {
          router.replace('/toeiken');
          return;
        }
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('display_name, full_name')
          .eq('id', session.user.id)
          .maybeSingle();
        if (profileError) throw profileError;
        if (active) {
          setUser(session.user);
          setDisplayName(profile?.display_name || profile?.full_name || '住民');
        }
      } catch (error) {
        console.error('ログイン状態の取得に失敗しました:', error);
        if (active) setErrorMessage(getErrorMessage(error, 'ログイン状態を確認できませんでした。'));
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadSession();
    return () => {
      active = false;
    };
  }, [router]);

  const links = [
    { href: '/toeiken/dashboard', title: t('myPage'), description: '登録情報の確認および住民プロフィールの変更を行います。' },
    { href: '/toeiken/services?tab=community', title: '住民コミュニティ掲示板', description: '住民同士の地域情報共有・投稿および返信コメント機能です。' },
    { href: '/toeiken/messages', title: '住民メッセージ・チャット', description: '個人チャットおよびグループ会話機能を利用できます。' },
    { href: '/toeiken/phone', title: '内部電話窓口 (030番)', description: '030番号を申請し、行政各局窓口へブラウザ音声通話で問い合わせます。' },
    { href: '/toeiken/services', title: t('serviceCenter'), description: t('serviceCenterDescription') },
    { href: '/map', title: t('map'), description: '公開中の施設情報・地域マップ情報を閲覧します。' },
    { href: '/recruitment', title: t('recruitment'), description: '採用応募条件および募集要項を確認し、オンライン応募手続きを行います。' },
    { href: '/toeiken/police-result', title: t('examResults'), description: '受考番号と生年月日で警察官採用試験結果を照会します。' },
    { href: '/pages', title: t('publicDocuments'), description: '公開されている行政手続き案内および関連資料を閲覧します。' },
    { href: '/', title: '東栄ポータル トップページ', description: '新着情報と公式ポータル総合メニューを確認します。' },
  ];

  const supportCategories = [
    { category: 'operations_question', title: t('operationsQuestion'), description: t('operationsQuestionDescription') },
    { category: 'operations_proposal', title: t('operationsProposal'), description: t('operationsProposalDescription') },
    { category: 'development_question', title: t('developmentQuestion'), description: t('developmentQuestionDescription') },
    { category: 'development_proposal', title: t('developmentProposal'), description: t('developmentProposalDescription') },
    { category: 'appeal', title: t('submitAppeal'), description: t('submitAppealDescription') },
  ];

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col font-sans">
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 flex-1 w-full">
        <Breadcrumbs items={[{ label: '東栄県住民ポータル' }]} />

        {loading ? (
          <ContentSkeleton rows={3} />
        ) : errorMessage ? (
          <p role="alert" className="text-xs font-bold text-red-800 bg-red-50 border border-red-200 p-4 rounded-sm">{errorMessage}</p>
        ) : (
          /* 7:3 非対称レイアウト */
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8 items-start mt-4">

            {/* メインカラム (7割) */}
            <div className="space-y-6">

              {/* ポータルヘッダー */}
              <section className="bg-slate-900 text-white p-6 rounded-sm border border-slate-800 space-y-2">
                <span className="text-xs font-semibold text-emerald-400 bg-slate-800 border border-slate-700 px-2.5 py-0.5 inline-block">
                  東栄県公式 住民総合ポータル
                </span>
                <h1 className="text-xl font-bold tracking-tight text-white">東栄県住民ポータル</h1>
                {user && <p className="text-xs text-slate-300">ログイン中: <strong className="text-white">{displayName || '住民'}</strong> ({user.email})</p>}
              </section>

              {/* ショートカット案内 */}
              <Link
                href="/toeiken/services#new-application"
                className="block rounded-sm border border-slate-300 bg-white p-5 hover:border-slate-500 transition-colors"
              >
                <div className="flex items-start gap-4">
                  <div className="p-2.5 bg-blue-50 border border-blue-200 text-blue-800 shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="font-bold text-slate-900 text-sm tracking-tight">{t('residentApplicationShortcut')}</h2>
                    <p className="mt-1 text-xs leading-relaxed text-slate-600">{t('residentApplicationShortcutDescription')}</p>
                  </div>
                </div>
              </Link>

              {/* ポータル機能メニュー一覧 (縦並び構造・3カラム全廃) */}
              <section className="space-y-3">
                <h2 className="text-base font-bold text-slate-900 tracking-tight border-b border-slate-200 pb-2">
                  住民ポータル利用可能サービス
                </h2>

                <div className="space-y-3">
                  {links.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="block rounded-sm border border-slate-200 bg-white p-4 hover:border-slate-400 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-slate-900 tracking-tight">{item.title}</h3>
                        <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-slate-600">{item.description}</p>
                    </Link>
                  ))}
                </div>
              </section>

            </div>

            {/* サイドバー (3割) - サポート窓口カテゴリ */}
            <aside className="space-y-6">

              {/* ユーザー案内 */}
              <div className="bg-white border border-slate-300 p-5 rounded-sm space-y-2 text-xs">
                <h3 className="font-bold text-slate-900 border-b border-slate-200 pb-2 flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4 text-slate-600" />
                  <span>アカウント状態</span>
                </h3>
                <p className="text-slate-700">登録表示名: <strong className="text-slate-900">{displayName}</strong></p>
                <Link href="/toeiken/dashboard" className="text-blue-800 hover:underline font-bold block pt-1">
                  マイページでプロフィール設定 →
                </Link>
              </div>

              {/* 問い合わせ・サポートカテゴリ一覧 (定型3カラム廃止 -> サイドバー縦リスト) */}
              <div className="bg-white border border-slate-300 p-5 rounded-sm space-y-4">
                <div className="border-b border-slate-200 pb-2">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    {t('residentContactTitle')}
                  </h3>
                  <p className="mt-1 text-[11px] text-slate-500 leading-relaxed">
                    {t('residentContactDescription')}
                  </p>
                </div>

                <div className="space-y-2 text-xs">
                  {supportCategories.map((item) => (
                    <Link
                      key={item.category}
                      href={`/toeiken/services?tab=support&category=${item.category}#contact-form`}
                      className="block p-3 rounded-sm border border-slate-200 bg-slate-50 hover:border-slate-400 hover:bg-white transition-colors"
                    >
                      <span className="block font-bold text-slate-900 text-xs">{item.title}</span>
                      <span className="mt-1 block text-[11px] leading-relaxed text-slate-600">{item.description}</span>
                    </Link>
                  ))}
                </div>
              </div>

            </aside>

          </div>
        )}
      </main>
    </div>
  );
}
