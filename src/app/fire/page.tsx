'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '../components/Header';
import Breadcrumbs from '../components/Breadcrumbs';
import { ContentSkeleton } from '@/src/app/components/LoadingScreen';
import { normalizeCommandSystemUrl } from '../../lib/commandSystem';
import { getErrorMessage } from '../../lib/errors';
import { supabase } from '../../lib/supabase';

export default function FirePage() {
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [commandSystemUrl, setCommandSystemUrl] = useState('');
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
        if (!authorized) return;

        const { data: settings, error: settingsError } = await supabase
          .from('site_settings')
          .select('command_system_url')
          .eq('id', 1)
          .maybeSingle();
        if (settingsError) throw settingsError;
        if (active) setCommandSystemUrl(settings?.command_system_url || '');
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

  const baseUrl = normalizeCommandSystemUrl(commandSystemUrl);
  const emergencyCallUrl = baseUrl ? `${baseUrl}/confirm?type=119` : null;

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
              <h1 className="text-xl font-bold text-slate-900">消防向けメインメニュー</h1>
              <p className="mt-2 text-sm text-slate-600">
                消防向け機能を利用できます。管理者にはこの画面の閲覧権限があります。
              </p>
            </section>

            <section className="rounded border border-red-200 bg-white p-6">
              <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
                <div>
                  <span className="text-xs font-bold text-red-700">Command system</span>
                  <h2 className="mt-1 text-lg font-bold text-slate-900">119番通報</h2>
                  <p className="mt-2 text-sm text-slate-600">
                    通報開始後、Command systemの確認画面で送信を確定してください。
                  </p>
                </div>
                {emergencyCallUrl ? (
                  <a
                    href={emergencyCallUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center rounded bg-red-700 px-6 py-3 text-sm font-bold text-white hover:bg-red-800"
                  >
                    119番通報を開始
                  </a>
                ) : (
                  <p className="rounded border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    Command systemの接続先が未設定です。管理者に設定を依頼してください。
                  </p>
                )}
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
