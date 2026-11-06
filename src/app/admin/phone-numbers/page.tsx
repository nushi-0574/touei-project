'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Header from '../../components/Header';
import Breadcrumbs from '../../components/Breadcrumbs';
import { ContentSkeleton } from '@/src/app/components/LoadingScreen';
import { supabase } from '../../../lib/supabase';

type RequestRecord = {
  id: string;
  user_id: string;
  preferred_number: string | null;
  status: 'submitted' | 'approved' | 'rejected' | 'cancelled';
  staff_response: string | null;
  created_at: string;
  resident: { id: string; full_name: string | null; email: string | null; resident_status: string } | null;
  phone: { phone_number: string; status: string } | null;
};

const errorText = (error: unknown) => error instanceof Error ? error.message : '処理を完了できませんでした。';

export default function PhoneNumberRequestsPage() {
  const [requests, setRequests] = useState<RequestRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [notice, setNotice] = useState('');
  const [busyId, setBusyId] = useState('');
  const [responses, setResponses] = useState<Record<string, string>>({});

  const loadRequests = useCallback(async () => {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    if (!session) throw new Error('ログインしてください。');
    const response = await fetch('/api/admin/phone-numbers', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    const result: unknown = await response.json();
    if (!response.ok) {
      throw new Error(typeof result === 'object' && result && 'error' in result && typeof result.error === 'string'
        ? result.error : '電話番号申請を取得できませんでした。');
    }
    if (typeof result !== 'object' || !result || !('requests' in result) || !Array.isArray(result.requests)) {
      throw new Error('電話番号申請の応答形式が不正です。');
    }
    setRequests(result.requests as RequestRecord[]);
  }, []);

  useEffect(() => {
    let active = true;
    async function initialize() {
      try {
        await loadRequests();
      } catch (error) {
        console.error('電話番号申請を読み込めませんでした:', error);
        if (active) setErrorMessage(errorText(error));
      } finally {
        if (active) setLoading(false);
      }
    }
    const timer = window.setTimeout(() => void initialize(), 0);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [loadRequests]);

  async function reviewRequest(requestId: string, status: 'approved' | 'rejected', usePreferredNumber = false) {
    setBusyId(requestId);
    setErrorMessage('');
    setNotice('');
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!session) throw new Error('ログインしてください。');
      const response = await fetch('/api/admin/phone-numbers', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ requestId, status, response: responses[requestId] ?? '', usePreferredNumber }),
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        throw new Error(typeof result === 'object' && result && 'error' in result && typeof result.error === 'string'
          ? result.error : '電話番号申請を審査できませんでした。');
      }
      await loadRequests();
      setNotice(status === 'approved' ? '電話番号を発行しました。' : '申請を却下しました。');
    } catch (error) {
      console.error('電話番号申請を審査できませんでした:', error);
      setErrorMessage(errorText(error));
    } finally {
      setBusyId('');
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800">
      <Header />
      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <Breadcrumbs items={[{ label: '管理者パネル', href: '/admin' }, { label: '電話番号管理' }]} />
        <div className="mt-4 flex flex-wrap items-end justify-between gap-3 border-b border-slate-300 pb-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-blue-700">Telephone administration</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-950">電話番号申請</h1>
            <p className="mt-2 text-sm text-slate-600">承認すると住民向けの内部電話番号が自動発行されます。</p>
          </div>
          <Link href="/toeiken/phone" className="text-sm font-semibold text-blue-700 underline">電話窓口を開く</Link>
        </div>
        {errorMessage && <p role="alert" className="mt-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">{errorMessage}</p>}
        {notice && <p role="status" className="mt-4 rounded border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
        {loading ? <div className="mt-5"><ContentSkeleton rows={5} /></div> : (
          <section className="mt-5 rounded border border-slate-200 bg-white p-5">
            <div className="divide-y divide-slate-100">
              {requests.map((request) => (
                <article key={request.id} className="py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="font-semibold">{request.resident?.full_name || request.resident?.email || request.user_id}</h2>
                      <p className="mt-1 text-xs text-slate-500">{request.resident?.resident_status ?? '状態不明'} · {new Date(request.created_at).toLocaleString()} · {request.status}</p>
                      {request.preferred_number && <p className="mt-2 text-sm">希望番号: <span className="font-mono font-semibold">{request.preferred_number}</span></p>}
                      {request.phone && <p className="mt-2 font-mono text-lg font-bold text-blue-800">{request.phone.phone_number} · {request.phone.status}</p>}
                      {request.staff_response && <p className="mt-2 text-sm text-slate-600">{request.staff_response}</p>}
                    </div>
                    {request.status === 'submitted' && (
                      <div className="grid w-full gap-2 sm:max-w-md">
                        <label className="grid gap-1 text-xs font-semibold">住民への連絡事項
                          <textarea maxLength={2000} rows={2} value={responses[request.id] ?? ''} onChange={(event) => setResponses((current) => ({ ...current, [request.id]: event.target.value }))} className="w-full rounded border border-slate-300 px-3 py-2 text-sm" />
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {request.preferred_number && <button type="button" disabled={Boolean(busyId)} onClick={() => void reviewRequest(request.id, 'approved', true)} className="rounded border border-emerald-700 px-3 py-2 text-xs font-semibold text-emerald-800 disabled:opacity-50">希望番号で発行</button>}
                          <button type="button" disabled={Boolean(busyId)} onClick={() => void reviewRequest(request.id, 'approved')} className="rounded bg-emerald-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{busyId === request.id ? '処理中...' : '自動番号で発行'}</button>
                          <button type="button" disabled={Boolean(busyId)} onClick={() => void reviewRequest(request.id, 'rejected')} className="rounded border border-red-300 px-3 py-2 text-xs font-semibold text-red-700 disabled:opacity-50">却下</button>
                        </div>
                      </div>
                    )}
                  </div>
                </article>
              ))}
              {!requests.length && <p className="py-4 text-sm text-slate-500">電話番号申請はありません。</p>}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
