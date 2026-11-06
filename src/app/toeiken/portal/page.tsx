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
        if (active) setUser(session.user);
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
    { href: '/toeiken/services', title: t('serviceCenter'), description: t('serviceCenterDescription') },
    { href: '/map', title: t('map'), description: '公開中の施設・地域情報を地図上で確認します。' },
    { href: '/recruitment', title: t('recruitment'), description: '応募期間、応募条件、採用条件を確認し、募集へ応募します。' },
    { href: '/toeiken/police-result', title: t('examResults'), description: '受験番号と生年月日で試験結果を確認します。' },
    { href: '/pages', title: t('publicDocuments'), description: '公開中の行政案内を閲覧します。' },
    { href: '/', title: '新着情報・トップページ', description: '最新のお知らせとポータルのメニューを確認します。' },
  ];

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 flex flex-col font-sans">
      <Header />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 flex-1 w-full">
        <Breadcrumbs items={[{ label: '東栄県住民ポータル' }]} />
        <section className="bg-white border border-slate-300 rounded shadow-sm p-6 sm:p-8">
          <div className="border-b border-slate-200 pb-4 mb-6">
            <h1 className="text-xl font-bold text-slate-900">東栄県住民ポータル</h1>
            {user && <p className="text-xs text-slate-600 mt-2">ログイン中: {user.email || '認証済みユーザー'}</p>}
          </div>
          {loading ? (
            <ContentSkeleton rows={3} />
          ) : errorMessage ? (
            <p role="alert" className="text-xs text-red-700 py-4">{errorMessage}</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {links.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="block border border-slate-200 rounded p-5 hover:border-emerald-600 transition-colors"
                >
                  <h2 className="font-bold text-slate-900 text-sm">{item.title}</h2>
                  <p className="text-xs text-slate-600 leading-relaxed mt-2">{item.description}</p>
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
