export default function LoadingScreen({ ariaHidden = false }: { ariaHidden?: boolean }) {
  return (
    <main
      role={ariaHidden ? undefined : 'status'}
      aria-live={ariaHidden ? undefined : 'polite'}
      aria-busy={ariaHidden ? undefined : true}
      aria-hidden={ariaHidden}
      className="fixed inset-0 z-[100] flex min-h-screen items-center justify-center bg-slate-100 px-4 text-slate-800"
    >
      <div className="flex w-full max-w-sm flex-col items-center rounded-lg border border-slate-200 bg-white px-8 py-10 shadow-sm">
        <div
          aria-hidden="true"
          className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-blue-700"
        />
        <p className="mt-5 text-sm font-bold">ページを読み込んでいます</p>
        <p className="mt-2 text-xs text-slate-500">しばらくお待ちください。</p>
      </div>
    </main>
  );
}
