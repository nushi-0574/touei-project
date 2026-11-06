'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('画面の表示中にエラーが発生しました:', error);
  }, [error]);

  return (
    <main className="min-h-screen bg-slate-100 flex items-center justify-center px-4">
      <section className="max-w-lg w-full bg-white border border-slate-300 rounded p-8 text-center">
        <h1 className="text-xl font-bold text-slate-900">ページを表示できませんでした</h1>
        <p className="text-sm text-slate-600 mt-3">通信状態を確認して、もう一度お試しください。</p>
        {error.digest && <p className="text-xs text-slate-400 mt-2">エラーID: {error.digest}</p>}
        <div className="flex justify-center gap-3 mt-6">
          <button onClick={reset} className="px-4 py-2 bg-blue-700 text-white rounded text-sm">
            再試行
          </button>
          <Link href="/" className="px-4 py-2 border border-slate-300 rounded text-sm">
            トップページへ
          </Link>
        </div>
      </section>
    </main>
  );
}
