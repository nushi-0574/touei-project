'use client';

import { useSyncExternalStore } from 'react';

const CONSENT_EVENT = 'cookie-consent-change';

function subscribe(callback: () => void) {
  window.addEventListener(CONSENT_EVENT, callback);
  window.addEventListener('storage', callback);
  return () => {
    window.removeEventListener(CONSENT_EVENT, callback);
    window.removeEventListener('storage', callback);
  };
}

function getSnapshot() {
  return localStorage.getItem('cookie_consent') !== 'accepted';
}

function getServerSnapshot() {
  return false;
}

export default function CookieBanner() {
  const showBanner = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const handleAccept = () => {
    localStorage.setItem('cookie_consent', 'accepted');
    window.dispatchEvent(new Event(CONSENT_EVENT));
  };

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-slate-900/95 text-white border-t border-slate-700 p-4 z-50 shadow-lg text-xs">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
        <p className="text-slate-300 leading-relaxed">
          当ポータルサイトでは、ログイン状態の維持、表示言語、プライバシー案内の確認状態をブラウザー内に保存します。
          詳細については「プライバシーポリシー」をご確認ください。
        </p>
        <button
          onClick={handleAccept}
          className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded shrink-0 transition-colors"
        >
          同意して利用する
        </button>
      </div>
    </div>
  );
}