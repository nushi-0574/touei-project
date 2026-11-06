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
    { href: '/toeiken/dashboard', title: t('myPage'), description: '登録情報の確認・変更を行います。' },
    { href: '/toeiken/services?tab=community', title: '住民掲示板', description: '住民同士で投稿・コメントをやり取りします。' },
    { href: '/toeiken/messages', title: '住民チャット', description: '住民同士の個人チャットやグループチャットを利用します。' },
    { href: '/toeiken/services', title: t('serviceCenter'), description: t('serviceCenterDescription') },
    { href: '/map', title: t('map'), description: '公開中の施設・地域情報を地図上で確認します。' },
    { href: '/recruitment', title: t('recruitment'), description: '応募期間、応募条件、採用条件を確認し、募集へ応募します。' },
    { href: '/toeiken/police-result', title: t('examResults'), description: '受験番号と生年月日で試験結果を確認します。' },
    { href: '/pages', title: t('publicDocuments'), description: '公開中の行政案内を閲覧します。' },
    { href: '/', title: '新着情報・トップページ', description: '最新のお知らせとポータルのメニューを確認します。' },
  ];

  const supportCards = [
    { category: 'operations_question', title: t('operationsQuestion'), description: t('operationsQuestionDescription'), icon: '?' },
    { category: 'operations_proposal', title: t('operationsProposal'), description: t('operationsProposalDescription'), icon: '+' },
    { category: 'development_question', title: t('developmentQuestion'), description: t('developmentQuestionDescription'), icon: '?' },
    { category: 'development_proposal', title: t('developmentProposal'), description: t('developmentProposalDescription'), icon: '+' },
    { category: 'appeal', title: t('submitAppeal'), description: t('submitAppealDescription'), icon: '!' },
  ];

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 flex flex-col font-sans">
      <Header />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 flex-1 w-full">
        <Breadcrumbs items={[{ label: '東栄県住民ポータル' }]} />
        <section className="bg-white border border-slate-300 rounded shadow-sm p-6 sm:p-8">
          <div className="border-b border-slate-200 pb-4 mb-6">
            <h1 className="text-xl font-bold text-slate-900">東栄県住民ポータル</h1>
            {user && <p className="text-xs text-slate-600 mt-2">ログイン中: {displayName || '住民'}</p>}
          </div>
          {loading ? (
            <ContentSkeleton rows={3} />
          ) : errorMessage ? (
            <p role="alert" className="text-xs text-red-700 py-4">{errorMessage}</p>
          ) : (
            <>
              <Link
                href="/toeiken/services#new-application"
                className="mb-5 block rounded border border-blue-700 bg-blue-50 p-5 transition-colors hover:bg-blue-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
              >
                <h2 className="font-bold text-blue-950">{t('residentApplicationShortcut')}</h2>
                <p className="mt-2 text-sm leading-relaxed text-blue-900">{t('residentApplicationShortcutDescription')}</p>
              </Link>
              <section aria-labelledby="resident-contact-heading" className="mb-8">
                <div className="mb-4">
                  <h2 id="resident-contact-heading" className="text-lg font-bold text-slate-900">{t('residentContactTitle')}</h2>
                  <p className="mt-1 text-sm text-slate-600">{t('residentContactDescription')}</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {supportCards.map((item) => (
                    <Link
                      key={item.category}
                      href={`/toeiken/services?tab=support&category=${item.category}#contact-form`}
                      className="group flex min-h-36 items-start gap-4 rounded-lg border border-slate-300 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-600 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
                    >
                      <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xl font-bold text-blue-800 group-hover:bg-blue-100">{item.icon}</span>
                      <span>
                        <span className="block font-bold text-slate-900">{item.title}</span>
                        <span className="mt-2 block text-sm leading-relaxed text-slate-600">{item.description}</span>
                      </span>
                    </Link>
                  ))}
                </div>
              </section>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {links.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="block rounded border border-slate-200 p-5 transition-colors hover:border-emerald-600"
                  >
                    <h2 className="text-sm font-bold text-slate-900">{item.title}</h2>
                    <p className="mt-2 text-xs leading-relaxed text-slate-600">{item.description}</p>
                  </Link>
                ))}
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
