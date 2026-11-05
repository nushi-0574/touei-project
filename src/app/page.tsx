import Link from 'next/link';
import Header from './components/Header';

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans">
      <Header />

      {/* 緊急・重要お知らせティッカー（官公庁風） */}
      <div className="bg-amber-500/10 border-y border-amber-500/30 text-amber-300 text-xs py-2 px-4 text-center tracking-wider">
        <span className="font-bold mr-2">[重要通知]</span>
        東栄県ポータルおよび警察官採用試験の合否照会システムが稼働中です。
      </div>

      <main className="flex-1 max-w-5xl mx-auto px-4 sm:px-6 py-10 w-full flex flex-col justify-center">
        {/* メインビジュアルセクション（重厚な行政風） */}
        <div className="bg-slate-800 border border-slate-700 rounded-lg shadow-xl p-8 sm:p-12 mb-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/10 rounded-bl-full pointer-events-none"></div>
          
          <div className="max-w-2xl">
            <div className="inline-block px-3 py-1 bg-slate-700 text-blue-400 border border-blue-500/30 rounded text-xs font-semibold tracking-wider mb-4">
              東栄プロジェクト 公式総合ポータル
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-wide mb-4">
              東栄県 総合行政ポータル
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed mb-8">
              本ポータルは、東栄プロジェクト（東栄県）における住民認証、採用試験の合否照会、および各種行政手続きを統合管理する公式窓口です。
            </p>
            
            <div className="flex flex-wrap gap-3">
              <Link
                href="/toeiken"
                className="px-5 py-2.5 bg-[#5865F2] hover:bg-[#4752C4] text-white text-xs font-semibold rounded shadow transition-colors flex items-center gap-2"
              >
                <span>住民アカウント認証 (Discord)</span>
              </Link>
              <Link
                href="/toeiken/police-result"
                className="px-5 py-2.5 bg-blue-700 hover:bg-blue-600 text-white text-xs font-semibold rounded shadow transition-colors border border-blue-500/40"
              >
                警察官採用試験 合否照会
              </Link>
            </div>
          </div>
        </div>

        {/* サービス一覧（公的機関の窓口風レイアウト） */}
        <div className="mb-4 pb-2 border-b border-slate-700 flex items-center justify-between">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
            行政サービス・各種窓口
          </h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* カード1 */}
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 flex flex-col justify-between hover:border-slate-500 transition-colors">
            <div>
              <div className="text-xs font-bold text-emerald-400 mb-2 tracking-wider">
                [ 住民サービス ]
              </div>
              <h3 className="text-sm font-bold text-white mb-2">東栄県専用ポータル</h3>
              <p className="text-xs text-slate-400 leading-relaxed mb-6">
                東栄県の住民および関係者向けの専用ダッシュボード。各種申請や県内情報へのアクセスを行います。
              </p>
            </div>
            <Link
              href="/toeiken"
              className="text-xs font-medium text-blue-400 hover:text-blue-300 flex items-center gap-1"
            >
              窓口へ進む &rarr;
            </Link>
          </div>

          {/* カード2 */}
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 flex flex-col justify-between hover:border-slate-500 transition-colors">
            <div>
              <div className="text-xs font-bold text-blue-400 mb-2 tracking-wider">
                [ 採用・試験 ]
              </div>
              <h3 className="text-sm font-bold text-white mb-2">警察官採用試験 合否照会</h3>
              <p className="text-xs text-slate-400 leading-relaxed mb-6">
                警察官採用試験の受考者を対象とした結果照会システムです。受考番号と生年月日が必要です。
              </p>
            </div>
            <Link
              href="/toeiken/police-result"
              className="text-xs font-medium text-blue-400 hover:text-blue-300 flex items-center gap-1"
            >
              照会ページを開く &rarr;
            </Link>
          </div>

          {/* カード3 */}
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 flex flex-col justify-between hover:border-slate-500 transition-colors">
            <div>
              <div className="text-xs font-bold text-amber-400 mb-2 tracking-wider">
                [ 管理・システム ]
              </div>
              <h3 className="text-sm font-bold text-white mb-2">管理者専用パネル</h3>
              <p className="text-xs text-slate-400 leading-relaxed mb-6">
                合否データの登録やシステムの設定を行うための管理者向け機能です（要権限）。
              </p>
            </div>
            <Link
              href="/admin"
              className="text-xs font-medium text-blue-400 hover:text-blue-300 flex items-center gap-1"
            >
              管理画面へ &rarr;
            </Link>
          </div>
        </div>
      </main>

      <footer className="border-t border-slate-800 bg-slate-950 py-6 text-center text-[11px] text-slate-500">
        &copy; 2026 葵プロジェクト / 東栄プロジェクト 運営局. All Rights Reserved.
      </footer>
    </div>
  );
}