'use client';

export default function Toast({ message, type = 'info', onClose }: { message: string; type?: 'success' | 'error' | 'info'; onClose: () => void }) {
  const bgColors = {
    success: 'bg-emerald-800 text-white',
    error: 'bg-red-800 text-white',
    info: 'bg-slate-800 text-white',
  };

  return (
    <div
      role={type === 'error' ? 'alert' : 'status'}
      aria-live={type === 'error' ? 'assertive' : 'polite'}
      className={`fixed inset-x-3 bottom-3 z-[110] mx-auto flex max-w-lg items-start justify-between gap-4 rounded px-4 py-3 text-sm shadow-lg sm:inset-x-auto sm:bottom-5 sm:right-5 ${bgColors[type]}`}
    >
      <span className="min-w-0 break-words">{message}</span>
      <button
        type="button"
        onClick={onClose}
        aria-label="通知を閉じる"
        className="min-h-7 min-w-7 shrink-0 rounded text-lg font-bold text-white/80 hover:bg-white/10 hover:text-white"
      >
        ×
      </button>
    </div>
  );
}