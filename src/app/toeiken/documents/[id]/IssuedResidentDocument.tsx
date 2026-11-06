'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';
import Header from '../../../components/Header';
import Breadcrumbs from '../../../components/Breadcrumbs';
import { ContentSkeleton } from '@/src/app/components/LoadingScreen';
import { supabase } from '../../../../lib/supabase';

type IssuedDocument = {
  id: string;
  document_type: 'residence_certificate' | 'resident_status_certificate';
  document_number: string;
  verification_token: string;
  issued_at: string;
};
type Resident = { full_name: string | null; address: string | null; birth_date: string | null };

export default function IssuedResidentDocument({ requestId }: { requestId: string }) {
  const [document, setDocument] = useState<IssuedDocument | null>(null);
  const [resident, setResident] = useState<Resident | null>(null);
  const [origin, setOrigin] = useState('');
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (!session) throw new Error('ログインしてください。');
        const [{ data: request, error: requestError }, { data: profile, error: profileError }] = await Promise.all([
          supabase.from('resident_document_requests')
            .select('id, document_type, status, document_number, verification_token, issued_at')
            .eq('id', requestId)
            .eq('user_id', session.user.id)
            .maybeSingle(),
          supabase.from('profiles')
            .select('full_name, address, birth_date')
            .eq('id', session.user.id)
            .maybeSingle(),
        ]);
        if (requestError) throw requestError;
        if (profileError) throw profileError;
        if (!request || request.status !== 'approved' || !request.document_number || !request.issued_at) {
          throw new Error('発行済みの書類を確認できませんでした。');
        }
        if (active) {
          setDocument(request as IssuedDocument);
          setResident(profile);
          setOrigin(window.location.origin);
        }
      } catch (error) {
        console.error('発行書類の取得に失敗しました:', error);
        if (active) setErrorMessage(error instanceof Error ? error.message : '書類を取得できませんでした。');
      } finally {
        if (active) setLoading(false);
      }
    }
    const timer = window.setTimeout(() => void load(), 0);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [requestId]);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800">
      <div className="print-hidden"><Header /></div>
      <main className="print-document-root mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <div className="print-hidden"><Breadcrumbs items={[{ label: '住民サービス', href: '/toeiken/services' }, { label: '発行書類' }]} /></div>
        {loading ? <ContentSkeleton /> : errorMessage ? (
          <p role="alert" className="mt-5 rounded border border-red-300 bg-red-50 p-4 text-sm text-red-800">{errorMessage}</p>
        ) : document && resident ? (
          <>
            <article className="mt-5 border-2 border-slate-800 bg-white p-8 shadow-sm sm:p-12">
              <p className="text-center text-xs font-bold tracking-[0.3em]">TOEI PREFECTURE</p>
              <h1 className="mt-8 border-b-2 border-slate-800 pb-5 text-center text-2xl font-bold">
                {document.document_type === 'residence_certificate' ? '居住証明書' : '住民登録証明書'}
              </h1>
              <p className="mt-8 text-center text-sm">次のとおり登録されていることを証明します。</p>
              <dl className="mx-auto mt-8 max-w-xl divide-y divide-slate-300 border-y border-slate-300">
                <div className="grid grid-cols-[8rem_1fr] gap-3 py-4"><dt className="font-semibold">氏名</dt><dd>{resident.full_name || '未登録'}</dd></div>
                <div className="grid grid-cols-[8rem_1fr] gap-3 py-4"><dt className="font-semibold">住所</dt><dd>{resident.address || '登録なし'}</dd></div>
                <div className="grid grid-cols-[8rem_1fr] gap-3 py-4"><dt className="font-semibold">生年月日</dt><dd>{resident.birth_date || '登録なし'}</dd></div>
                <div className="grid grid-cols-[8rem_1fr] gap-3 py-4"><dt className="font-semibold">書類番号</dt><dd className="font-mono">{document.document_number}</dd></div>
                <div className="grid grid-cols-[8rem_1fr] gap-3 py-4"><dt className="font-semibold">発行日</dt><dd>{new Intl.DateTimeFormat('ja-JP', { dateStyle: 'long' }).format(new Date(document.issued_at))}</dd></div>
              </dl>
              <div className="mt-10 flex flex-col items-center gap-3 text-center">
                {origin && <QRCodeSVG value={`${origin}/id/documents/verify/${document.verification_token}`} size={112} level="M" title="書類照合用QRコード" />}
                <p className="text-xs text-slate-600">照合用QRコードまたは書類番号で発行状態を確認できます。</p>
              </div>
            </article>
            <div className="print-hidden mt-4 flex flex-wrap gap-3">
              <button type="button" onClick={() => window.print()} className="rounded bg-blue-700 px-4 py-2 text-sm font-semibold text-white">印刷・PDF保存</button>
              <Link href="/toeiken/services?tab=documents" className="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-semibold">住民サービスへ戻る</Link>
            </div>
          </>
        ) : null}
      </main>
    </div>
  );
}
