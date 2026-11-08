'use client';

import { useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';
import Header from '../components/Header';
import Breadcrumbs from '../components/Breadcrumbs';
import Toast from '../components/Toast';
import { getErrorMessage } from '../../lib/errors';
import LegalConsentField from '../components/LegalConsentField';
import { getLegalConsentUrl } from '../../lib/legalConsent';

export default function ToeikenAuthPage() {
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [loadingProvider, setLoadingProvider] = useState(false);
  const [acceptedPolicies, setAcceptedPolicies] = useState(false);
  const [consentError, setConsentError] = useState('');

  const handleGoogleAuth = async () => {
    if (!acceptedPolicies) {
      setConsentError('Googleで続行する前に、利用規約とプライバシーポリシーへの同意が必要です。');
      return;
    }
    setLoadingProvider(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: getLegalConsentUrl(window.location.origin, '/toeiken/dashboard'),
        },
      });
      if (error) throw error;
    } catch (error) {
      setToast({ message: `Google認証エラー: ${getErrorMessage(error, '不明なエラー')}`, type: 'error' });
      setLoadingProvider(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col font-sans">
      <Header />
      <main className="max-w-xl mx-auto px-4 sm:px-6 py-12 flex-1 w-full">
        <Breadcrumbs items={[{ label: '東栄アカウント認証' }]} />

        <div className="bg-white border border-slate-300 rounded-sm p-6 space-y-6">
          <div className="border-b border-slate-200 pb-3">
            <span className="text-xs font-bold text-[#0046ff] bg-blue-50 border border-blue-200 px-2 py-0.5 inline-block mb-1">
              統合認証
            </span>
            <h1 className="text-lg font-bold text-slate-900 tracking-tight">東栄アカウント 認証窓口</h1>
          </div>

          <div className="space-y-4 text-[13px]">
            <LegalConsentField
              checked={acceptedPolicies}
              onChange={(checked) => {
                setAcceptedPolicies(checked);
                setConsentError('');
              }}
              disabled={loadingProvider}
              error={consentError}
            />

            <div className="border border-slate-200 rounded-sm p-4 bg-slate-50 space-y-3">
              <div>
                <span className="font-bold text-slate-900 text-xs block mb-1">Google アカウント認証</span>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Googleアカウントで認証し、サインインを行います。
                </p>
              </div>
              <button
                onClick={() => void handleGoogleAuth()}
                disabled={loadingProvider}
                className="w-full py-2.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 text-xs font-bold rounded-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50 min-h-[44px]"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span>{loadingProvider ? '処理中...' : 'Googleでログイン'}</span>
              </button>
            </div>

            <div className="rounded-sm border border-slate-200 bg-white p-4 space-y-3">
              <p className="text-xs font-bold text-slate-900">メールアドレス認証</p>
              <div className="flex flex-col sm:flex-row gap-2 text-xs">
                <Link
                  href="/signup?next=%2Ftoeiken%2Fdashboard"
                  className="flex-1 rounded-sm bg-[#0046ff] hover:bg-blue-700 px-4 py-2.5 text-center font-bold text-white min-h-[44px] flex items-center justify-center"
                >
                  新規アカウント作成
                </Link>
                <Link
                  href="/login?next=%2Ftoeiken%2Fdashboard"
                  className="flex-1 rounded-sm border border-slate-300 bg-white hover:bg-slate-50 px-4 py-2.5 text-center font-bold text-slate-800 min-h-[44px] flex items-center justify-center"
                >
                  ログイン
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}