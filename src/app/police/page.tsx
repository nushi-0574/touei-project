'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '../components/Header';
import Breadcrumbs from '../components/Breadcrumbs';
import { normalizeCommandSystemUrl } from '../../lib/commandSystem';
import { getErrorMessage } from '../../lib/errors';
import { supabase } from '../../lib/supabase';

export default function PolicePage() {
  const [loading, setLoading] = useState(true);
  const [isPoliceStaff, setIsPoliceStaff] = useState(false);
  const [commandSystemUrl, setCommandSystemUrl] = useState('');
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
          .select('is_police_staff')
          .eq('id', session.user.id)
          .maybeSingle();
        if (profileError) throw profileError;
        if (!active) return;

        const authorized = profile?.is_police_staff === true;
        setIsPoliceStaff(authorized);
        if (!authorized) return;

        const { data: settings, error: settingsError } = await supabase
          .from('site_settings')
          .select('command_system_url')
          .eq('id', 1)
          .maybeSingle();
        if (settingsError) throw settingsError;
        if (active) setCommandSystemUrl(settings?.command_system_url || '');
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

  const baseUrl = normalizeCommandSystemUrl(commandSystemUrl);
  const emergencyCallUrl = baseUrl ? `${baseUrl}/confirm?type=110` : null;

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800">
      <Header />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <Breadcrumbs items={[{ label: '警察専用ページ' }]} />

        {loading ? (
          <p className="text-center text-sm text-slate-500 py-12">読み込み中...</p>
        ) : errorMessage ? (
          <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-4">
            {errorMessage}
          </p>
        ) : !isPoliceStaff ? (
          <section className="bg-white border border-slate-200 rounded p-6 text-center">
            <h1 className="text-lg font-bold text-slate-900">警察職員専用ページ</h1>
            <p className="text-sm text-slate-600 mt-2">このページを利用するには警察職員ロールが必要です。</p>
            <Link href="/dashboard" className="inline-block mt-4 text-sm text-blue-700 hover:underline">
              メインメニューへ戻る
            </Link>
          </section>
        ) : (
          <div className="space-y-6">
            <section className="bg-white border border-slate-200 rounded p-6">
              <h1 className="text-xl font-bold text-slate-900">警察職員メインメニュー</h1>
              <p className="text-sm text-slate-600 mt-2">
                Command systemの通報受付機能を利用できます。通報確認後、通報は起動中の指令システムへ送信されます。
              </p>
            </section>

            <section className="bg-white border border-red-200 rounded p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
                <div>
                  <span className="text-xs font-bold text-red-700">Command system</span>
                  <h2 className="text-lg font-bold text-slate-900 mt-1">110番通報</h2>
                  <p className="text-sm text-slate-600 mt-2">
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
                    110番通報を開始
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
