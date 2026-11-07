'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '../components/Header';
import Breadcrumbs from '../components/Breadcrumbs';
import { ContentSkeleton } from '@/src/app/components/LoadingScreen';
import { getErrorMessage } from '../../lib/errors';
import { supabase } from '../../lib/supabase';

export default function FirePage() {
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const router = useRouter();

  useEffect(() => {
    let active = true;

    async function loadFirePage() {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (!session) {
          router.replace('/login');
          return;
        }

        const [{ data: profile, error: profileError }, { data: roles, error: rolesError }] = await Promise.all([
          supabase
            .from('profiles')
            .select('is_admin')
            .eq('id', session.user.id)
            .maybeSingle(),
          supabase
            .from('staff_roles')
            .select('role')
            .eq('user_id', session.user.id)
            .eq('role', 'fire')
            .maybeSingle(),
        ]);
        if (profileError) throw profileError;
        if (rolesError) throw rolesError;
        if (!active) return;

        const authorized = profile?.is_admin === true || roles !== null;
        setHasAccess(authorized);
      } catch (error) {
        console.error('消防専用ページの読み込みに失敗しました:', error);
        if (active) setErrorMessage(getErrorMessage(error, '消防専用ページを読み込めませんでした。'));
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadFirePage();
    return () => {
      active = false;
    };
  }, [router]);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800">
      <Header />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <Breadcrumbs items={[{ label: '消防専用ページ' }]} />

        {loading ? (
          <ContentSkeleton />
        ) : errorMessage ? (
          <p role="alert" className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {errorMessage}
          </p>
        ) : !hasAccess ? (
          <section className="rounded border border-slate-200 bg-white p-6 text-center">
            <h1 className="text-lg font-bold text-slate-900">消防職員専用ページ</h1>
            <p className="mt-2 text-sm text-slate-600">このページを利用するには管理者または消防ロールが必要です。</p>
            <Link href="/dashboard" className="mt-4 inline-block text-sm text-blue-700 hover:underline">
              メインメニューへ戻る
            </Link>
          </section>
        ) : (
          <div className="space-y-6">
            <section className="rounded border border-slate-200 bg-white p-6">
              <h1 className="text-xl font-bold text-slate-900">東栄県消防局 災害指令ポータル</h1>
              <p className="mt-2 text-sm text-slate-600">
                消防・救急業務ポータルです。管理者および消防ロール保有職員が利用可能です。
              </p>
            </section>

            <section className="rounded border border-red-300 bg-white p-6 shadow-sm">
              <div className="space-y-3">
                <span className="text-xs font-bold text-red-700 bg-red-50 px-2 py-1 rounded">119番 消防通信指令</span>
                <h2 className="text-lg font-bold text-slate-900">火災・救急通報管理</h2>
                <p className="text-sm text-slate-600">
                  消防通信指令は警察指令卓および住民サポートデスク・電話窓口機能と連携し運用されています。
                </p>
                <div className="pt-2 flex flex-wrap gap-3">
                  <Link
                    href="/toeiken/phone"
                    className="inline-flex items-center justify-center rounded bg-red-700 px-5 py-2.5 text-xs font-bold text-white hover:bg-red-800"
                  >
                    📞 内部電話窓口へアクセス
                  </Link>
                  <Link
                    href="/admin/services"
                    className="inline-flex items-center justify-center rounded border border-slate-300 bg-white px-5 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
                  >
                    業務管理画面へ
                  </Link>
                </div>
              </div>
            </section>

            <Link href="/dashboard" className="inline-block text-sm text-blue-700 hover:underline">
              メインメニューへ戻る
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
