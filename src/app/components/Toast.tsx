'export client';

export default function Toast({ message, type = 'info', onClose }: { message: string; type?: 'success' | 'error' | 'info'; onClose: () => void }) {
  const bgColors = {
    success: 'bg-emerald-800 text-white',
    error: 'bg-red-800 text-white',
    info: 'bg-slate-800 text-white',
  };

  return (
    <div className={`fixed bottom-5 right-5 z-50 px-4 py-3 rounded shadow-lg text-xs flex items-center space-x-3 transition-all ${bgColors[type]}`}>
      <span>{message}</span>
      <button onClick={onClose} className="text-white/80 hover:text-white font-bold ml-2">×</button>
    </div>
  );
}