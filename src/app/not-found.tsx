import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="min-h-screen bg-slate-100 flex items-center justify-center px-4">
      <section className="max-w-lg w-full bg-white border border-slate-300 rounded p-8 text-center">
        <p className="text-sm font-bold text-blue-700">404</p>
        <h1 className="text-xl font-bold text-slate-900 mt-2">ページが見つかりません</h1>
        <p className="text-sm text-slate-600 mt-3">URLをご確認いただくか、トップページからお探しください。</p>
        <Link href="/" className="inline-block mt-6 px-4 py-2 bg-slate-900 text-white rounded text-sm">
          トップページへ戻る
        </Link>
      </section>
    </main>
  );
}
