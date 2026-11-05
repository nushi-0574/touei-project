import Link from 'next/link';
import Header from './components/Header';

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 flex flex-col">
      <Header />

      <main className="flex-1 max-w-5xl mx-auto px-4 sm:px-6 py-10 w-full flex flex-col justify-center">
        {/* ヒーローセクション */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-8 sm:p-12 mb-8 text-center sm:text-left flex flex-col sm:flex-row items-center justify-between gap-6">
          <div>
            <div className="inline-block px-3 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-full text-xs font-semibold mb-4">
              東栄プロジェクト 公式総合ポータル
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mb-3">
              東栄ポータルへようこそ
            </h1>
            <p className="text-sm text-slate-600 max-w-xl leading-relaxed">
              東栄プロジェクトおよび東栄県における各種行政サービス、採用試験、コミュニティ参加への総合玄関口です。
            </p>
          </div>
          <div className="flex flex-col gap-3 w-full sm:w-auto shrink-0">
            <Link
              href="/toeiken"
              className="px-6 py-3 bg-[#5865F2] hover:bg-[#4752C4] text-white text-xs font-semibold rounded-lg shadow transition-colors text-center"
            >
              東栄県 住民ログイン (Discord)
            </Link>
            <Link
              href="/toeiken/police-result"
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow transition-colors text-center"
            >
              警察官採用試験 合否照会
            </Link>
          </div>
        </div>

        {/* 機能・サービス一覧グリッド */}
        <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4 px-1">
          主要サービス・コンテンツ
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* カード1: 東栄県ポータル */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center font-bold mb-4 text-base">
                県
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-2">東栄県専用ポータル</h3>
              <p className="text-xs text-slate-600 leading-relaxed mb-6">
                東栄プロジェクト（東栄県）の住民および関係者向けの専用ダッシュボードと各種手続きを行います。
              </p>
            </div>
            <Link
              href="/toeiken"
              className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
            >
              アクセスする &rarr;
            </Link>
          </div>

          {/* カード2: 警察採用試験 合否照会 */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center font-bold mb-4 text-base">
                試
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-2">警察官採用試験 合否照会</h3>
              <p className="text-xs text-slate-600 leading-relaxed mb-6">
                警察官採用試験を受考された方の専用照会ページです。受考番号と生年月日を入力して結果を確認できます。
              </p>
            </div>
            <Link
              href="/toeiken/police-result"
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              照会ページへ &rarr;
            </Link>
          </div>

          {/* カード3: 管理画面・その他 */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-lg flex items-center justify-center font-bold mb-4 text-base">
                管
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-2">管理者・システム設定</h3>
              <p className="text-xs text-slate-600 leading-relaxed mb-6">
                合否データの登録・管理やユーザーのロール制御を行うための管理者用パネルです（権限が必要となります）。
              </p>
            </div>
            <Link
              href="/admin"
              className="text-xs font-semibold text-amber-600 hover:text-amber-700 flex items-center gap-1"
            >
              管理画面へ &rarr;
            </Link>
          </div>
        </div>
      </main>

      <footer className="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-500">
        &copy; 2026 葵プロジェクト / 東栄プロジェクト All Rights Reserved.
      </footer>
    </div>
  );
}