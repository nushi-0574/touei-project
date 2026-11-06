'use client';

import { useEffect, useState } from 'react';
import Header from '../../../../components/Header';
import { ContentSkeleton } from '@/src/app/components/LoadingScreen';
import { supabase } from '../../../../../lib/supabase';

type VerifiedDocument = {
  document_number: string;
  document_type: string;
  issued_at: string;
  status: string;
};

export default function VerifyResidentDocument({ token }: { token: string }) {
  const [document, setDocument] = useState<VerifiedDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let active = true;
    async function verify() {
      try {
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) {
          throw new Error('書類を照合できませんでした。');
        }
        const { data, error } = await supabase.rpc('verify_resident_document', { token });
        if (error) throw error;
        const result = Array.isArray(data) ? data[0] : null;
        if (!result) throw new Error('有効な発行書類を確認できませんでした。');
        if (active) setDocument(result as VerifiedDocument);
      } catch (error) {
        console.error('発行書類の照合に失敗しました:', error);
        if (active) setErrorMessage(error instanceof Error ? error.message : '書類を照合できませんでした。');
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

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800">
      <Header />
      <main className="mx-auto max-w-xl px-4 py-12">
        <section className="rounded border border-slate-200 bg-white p-6 text-center shadow-sm">
          <p className="text-xs font-bold uppercase tracking-widest text-blue-700">Official document verification</p>
          <h1 className="mt-2 text-xl font-bold">公的書類照合</h1>
          {loading ? <ContentSkeleton rows={1} /> : errorMessage ? (
            <p role="alert" className="mt-6 rounded border border-red-300 bg-red-50 p-4 text-sm text-red-800">{errorMessage}</p>
          ) : document ? (
            <div className="mt-6 rounded border border-emerald-300 bg-emerald-50 p-5">
              <p className="text-sm font-bold text-emerald-800">有効な発行書類です</p>
              <p className="mt-3 text-xs text-slate-600">{document.document_type === 'residence_certificate' ? '居住証明書' : '住民登録証明書'}</p>
              <p className="mt-1 font-mono text-lg font-bold">{document.document_number}</p>
              <p className="mt-2 text-xs text-slate-600">発行日: {new Intl.DateTimeFormat('ja-JP', { dateStyle: 'long' }).format(new Date(document.issued_at))}</p>
            </div>
          ) : null}
          <p className="mt-6 text-xs leading-relaxed text-slate-500">照合では書類番号、書類の種類、発行日を表示し、住民の住所等は公開しません。</p>
        </section>
      </main>
    </div>
  );
}
