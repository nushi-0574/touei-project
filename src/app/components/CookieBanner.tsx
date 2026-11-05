'use client';

import { useState, useEffect } from 'react';

export default function CookieBanner() {
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem('cookie_consent');
    if (!consent) {
      setShowBanner(true);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem('cookie_consent', 'accepted');
    setShowBanner(false);
  };

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-slate-900/95 text-white border-t border-slate-700 p-4 z-50 shadow-lg text-xs">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
        <p className="text-slate-300 leading-relaxed">
          当ポータルサイトでは、住民ログイン状態の維持（セッション管理）および利便性向上のためにCookieを使用しています。
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