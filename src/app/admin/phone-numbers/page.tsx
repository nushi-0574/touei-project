'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Header from '../../components/Header';
import Breadcrumbs from '../../components/Breadcrumbs';
import { ContentSkeleton } from '@/src/app/components/LoadingScreen';
import { supabase } from '../../../lib/supabase';
import { PhoneCall, ShieldCheck, ChevronRight } from 'lucide-react';

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
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col font-sans">
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 flex-1 w-full">
        <Breadcrumbs items={[{ label: '管理者パネル', href: '/admin' }, { label: '電話番号管理' }]} />

        {/* 7:3 非対称レイアウト */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8 items-start mt-4">

          {/* 左側メインエリア (7割) */}
          <div className="space-y-6">

            <div className="bg-slate-900 text-white p-6 rounded-sm border border-slate-800 space-y-2">
              <span className="text-[11px] font-mono tracking-widest text-emerald-400 font-bold uppercase">
                TELEPHONE ADMINISTRATION / 030-NUMBER MANAGEMENT
              </span>
              <h1 className="text-xl font-bold tracking-tight text-white">030番 内部電話番号 発行審査管理</h1>
              <p className="text-xs text-slate-300">
                住民から申請された030形式内部電話番号の発行承認・番号割り当ておよび審査管理を行います。
              </p>
            </div>

            {errorMessage && <p role="alert" className="border border-red-300 bg-red-50 p-3 text-xs font-bold text-red-900 rounded-sm">{errorMessage}</p>}
            {notice && <p role="status" className="border border-emerald-300 bg-emerald-50 p-3 text-xs font-bold text-emerald-900 rounded-sm">{notice}</p>}

            {loading ? (
              <ContentSkeleton rows={5} />
            ) : (
              <section className="bg-white border border-slate-300 rounded-sm overflow-hidden text-xs">
                <div className="bg-slate-800 text-white px-4 py-3 font-bold border-b border-slate-700 flex justify-between items-center">
                  <span>電話番号申請一覧 ({requests.length}件)</span>
                  <span className="font-mono text-[11px] text-slate-400">MANAGEMENT CONSOLE</span>
                </div>

                <div className="divide-y divide-slate-200">
                  {requests.map((request) => (
                    <article key={request.id} className="p-4 hover:bg-slate-50 transition-colors space-y-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1">
                          <h2 className="font-bold text-slate-900 text-sm">{request.resident?.full_name || request.resident?.email || request.user_id}</h2>
                          <p className="text-[11px] text-slate-500 font-mono tabular-nums">
                            {request.resident?.email ?? ''} | 状態: {request.resident?.resident_status ?? '不明'} | 申請日時: {new Date(request.created_at).toLocaleString('ja-JP')}
                          </p>
                          {request.preferred_number && (
                            <p className="text-xs text-slate-700 font-mono font-semibold pt-1">
                              希望番号: <span className="text-blue-900">{request.preferred_number}</span>
                            </p>
                          )}
                          {request.phone && (
                            <p className="font-mono text-sm font-bold text-emerald-800 pt-1 tabular-nums">
                              発行番号: {request.phone.phone_number} (状態: {request.phone.status})
                            </p>
                          )}
                          {request.staff_response && (
                            <p className="text-xs text-slate-600 bg-slate-100 p-2 rounded-sm border border-slate-200 mt-1">
                              回答事項: {request.staff_response}
                            </p>
                          )}
                        </div>

                        <span className={`px-2.5 py-1 text-xs font-bold border ${request.status === 'approved' ? 'bg-emerald-100 text-emerald-900 border-emerald-300' : request.status === 'rejected' ? 'bg-red-100 text-red-900 border-red-300' : 'bg-amber-100 text-amber-900 border-amber-300'}`}>
                          {request.status === 'approved' ? '承認済み' : request.status === 'rejected' ? '却下' : '審査待ち'}
                        </span>
                      </div>

                      {request.status === 'submitted' && (
                        <div className="bg-slate-50 border border-slate-300 p-3 rounded-sm space-y-3 pt-2">
                          <div className="space-y-1">
                            <label className="block text-[11px] font-bold text-slate-700">住民への連絡事項・連絡メモ</label>
                            <textarea
                              maxLength={2000}
                              rows={2}
                              value={responses[request.id] ?? ''}
                              onChange={(event) => setResponses((current) => ({ ...current, [request.id]: event.target.value }))}
                              className="w-full border border-slate-300 px-3 py-1.5 text-xs bg-white rounded-sm focus:outline-none focus:border-slate-800"
                            />
                          </div>

                          <div className="flex flex-wrap gap-2">
                            {request.preferred_number && (
                              <button
                                type="button"
                                disabled={Boolean(busyId)}
                                onClick={() => void reviewRequest(request.id, 'approved', true)}
                                className="px-3 py-1.5 border border-emerald-700 bg-white hover:bg-emerald-50 text-emerald-900 text-xs font-bold rounded-sm disabled:opacity-50"
                              >
                                希望番号で承認発行
                              </button>
                            )}
                            <button
                              type="button"
                              disabled={Boolean(busyId)}
                              onClick={() => void reviewRequest(request.id, 'approved')}
                              className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-sm disabled:opacity-50"
                            >
                              {busyId === request.id ? '処理中...' : '自動連番で承認発行'}
                            </button>
                            <button
                              type="button"
                              disabled={Boolean(busyId)}
                              onClick={() => void reviewRequest(request.id, 'rejected')}
                              className="px-3 py-1.5 border border-red-300 bg-white hover:bg-red-50 text-red-900 text-xs font-bold rounded-sm disabled:opacity-50"
                            >
                              申請を却下
                            </button>
                          </div>
                        </div>
                      )}
                    </article>
                  ))}

                  {!requests.length && (
                    <p className="py-8 text-center text-xs text-slate-500 font-mono">現在、電話番号の申請データはありません。</p>
                  )}
                </div>
              </section>
            )}

          </div>

          {/* 右側サイドバー (3割) */}
          <aside className="space-y-6">

            <div className="bg-white border border-slate-300 p-5 rounded-sm space-y-3 text-xs">
              <h3 className="font-bold text-slate-900 border-b border-slate-200 pb-2 tracking-tight flex items-center gap-1.5">
                <PhoneCall className="w-4 h-4 text-slate-700" />
                <span>電話窓口システム案内</span>
              </h3>
              <p className="text-slate-600 leading-relaxed">
                承認された住民には 030-XXX-XXX 形式の内部番号が発行され、各局窓口へのWebRTC通話が可能になります。
              </p>
              <div className="pt-2">
                <Link href="/toeiken/phone" className="text-blue-800 hover:underline font-bold block">
                  電話窓口画面を開く →
                </Link>
              </div>
            </div>

            <div className="bg-slate-100 border border-slate-300 p-4 rounded-sm text-xs">
              <Link href="/admin" className="font-bold text-blue-800 hover:underline block">
                ← 管理者パネルへ戻る
              </Link>
            </div>

          </aside>

        </div>
      </main>
    </div>
  );
}
