'use client';

import { useEffect, useState } from 'react';
import Header from '../../../components/Header';
import { ContentSkeleton } from '@/src/app/components/LoadingScreen';
import { useLocale } from '../../../../lib/i18n';
import { supabase } from '../../../../lib/supabase';

type VerifiedResident = {
  resident_name: string;
  resident_status: string;
  issued_at: string;
};

export default function VerifyResidentCard({ token }: { token: string }) {
  const { locale } = useLocale();
  const [resident, setResident] = useState<VerifiedResident | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let active = true;
    async function verify() {
      try {
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) {
          throw new Error('無効な住民証です。');
        }
        const { data, error } = await supabase.rpc('verify_resident_card', { card_token: token });
        if (error) throw error;
        const card = Array.isArray(data) ? data[0] : null;
        if (!card || card.resident_status !== 'active') throw new Error('有効な住民証を確認できませんでした。');
        if (active) setResident(card as VerifiedResident);
      } catch (error) {
        console.error('住民証を確認できませんでした:', error);
        if (active) setErrorMessage(error instanceof Error ? error.message : '住民証を確認できませんでした。');
      } finally {
        if (active) setLoading(false);
      }
    }
    const timer = window.setTimeout(() => void verify(), 0);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [token]);

  const dateLocale = locale === 'ja' ? 'ja-JP' : locale === 'zh-CN' ? 'zh-CN' : locale === 'ko' ? 'ko-KR' : 'en-US';

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800">
      <Header />
      <main className="mx-auto max-w-xl px-4 py-12">
        <section className="rounded border border-slate-200 bg-white p-6 text-center shadow-sm">
          <p className="text-xs font-bold uppercase tracking-widest text-blue-700">Resident card verification</p>
          <h1 className="mt-2 text-xl font-bold">住民証確認</h1>
          {loading ? (
            <ContentSkeleton rows={1} />
          ) : errorMessage ? (
            <p role="alert" className="mt-6 rounded border border-red-300 bg-red-50 p-4 text-sm text-red-800">{errorMessage}</p>
          ) : resident ? (
            <div className="mt-6 rounded border border-emerald-300 bg-emerald-50 p-5">
              <p className="text-xs font-semibold text-emerald-800">有効な住民証です</p>
              <p className="mt-2 text-xl font-bold text-slate-900">{resident.resident_name}</p>
              <p className="mt-2 text-xs text-slate-600">発行日: {new Intl.DateTimeFormat(dateLocale, { dateStyle: 'medium' }).format(new Date(resident.issued_at))}</p>
            </div>
          ) : null}
          <p className="mt-6 text-xs leading-relaxed text-slate-500">このページでは照会に必要な住民氏名と有効状態のみを表示しています。</p>
        </section>
      </main>
    </div>
  );
}
