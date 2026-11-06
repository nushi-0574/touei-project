import Link from 'next/link';

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-100 text-slate-900">
      <header className="border-b border-slate-800 bg-slate-900 text-white">
        <div className="mx-auto flex min-h-16 max-w-6xl items-center px-4 sm:px-6">
          <Link href="/" className="rounded text-base font-bold tracking-wide hover:text-slate-200">
            東栄ポータル
          </Link>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-16">
        <Link
          href="/toeiken"
          className="inline-flex min-h-14 items-center justify-center rounded bg-blue-700 px-8 py-4 text-base font-bold text-white shadow-sm transition-colors hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
        >
          東栄県住民ポータルへ
        </Link>
      </main>

      <footer className="border-t border-slate-800 bg-slate-900 py-6 text-xs text-slate-300">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>東栄ポータル</p>
          <nav aria-label="フッターナビゲーション" className="flex gap-4">
            <Link href="/terms" className="hover:text-white hover:underline">利用規約</Link>
            <Link href="/privacy" className="hover:text-white hover:underline">プライバシーポリシー</Link>
          </nav>
          <p className="text-slate-500">© 2026 東栄ポータル</p>
        </div>
      </footer>
    </div>
  );
}
