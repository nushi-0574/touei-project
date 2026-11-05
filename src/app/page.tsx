import Link from 'next/link';
import Header from './components/Header';

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col font-sans">
      <Header />

      {/* ==========================================
          防災・緊急情報ティッカー（官公庁風）
          ========================================== */}
      <div className="bg-red-900 text-white text-xs py-2 px-4 border-b border-red-950">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="bg-red-700 text-white px-2 py-0.5 rounded text-[10px] font-bold tracking-wider">防災・緊急</span>
            <span>現在、東栄県内における重大な警報・緊急情報はありません。</span>
          </div>
          <Link href="/toeiken" className="underline hover:text-red-200 text-[11px]">
            詳細・過去の情報 &rarr;
          </Link>
        </div>
      </div>

      {/* ==========================================
          グローバルナビゲーション（行政ポータル風）
          ========================================== */}
      <nav className="bg-slate-900 text-white border-b border-slate-800 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 flex flex-wrap items-center justify-between py-3">
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold tracking-wider text-slate-100 border-l-4 border-blue-500 pl-2">
              東栄県公式ポータル
            </span>
          </div>
          <div className="flex flex-wrap gap-1 sm:gap-2 text-xs">
            <Link href="/toeiken" className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded transition-colors text-slate-200">
              分類から探す
            </Link>
            <Link href="/toeiken" className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded transition-colors text-slate-200">
              目的から探す
            </Link>
            <Link href="/toeiken" className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded transition-colors text-slate-200">
              組織から探す
            </Link>
            <Link href="/toeiken/police-result" className="px-3 py-1.5 bg-blue-700 hover:bg-blue-600 rounded transition-colors text-white font-semibold">
              採用・試験情報
            </Link>
          </div>
        </div>
      </nav>

      {/* ==========================================
          メインビジュアル & 注目情報エリア
          ========================================== */}
      <main className="flex-1 max-w-6xl mx-auto px-4 sm:px-6 py-8 w-full space-y-8">
        
        {/* 注意喚起 (Attention) セクション */}
        <section className="bg-amber-50 border border-amber-200 rounded p-4 text-xs">
          <h2 className="font-bold text-amber-900 mb-2 flex items-center gap-1.5 text-sm">
            <span className="w-2 h-2 rounded-full bg-amber-600 inline-block"></span>
            重要なお知らせ・注意喚起
          </h2>
          <ul className="space-y-1.5 text-amber-900 list-disc list-inside">
            <li>
              <Link href="/toeiken" className="hover:underline text-blue-800 font-medium">
                東栄県住民ポータル（Discord連携）のシステムメンテナンスおよび認証手順について
              </Link>
            </li>
            <li>
              <Link href="/toeiken/police-result" className="hover:underline text-blue-800 font-medium">
                令和8年度 東栄県警察官採用試験の最終合否照会システムが公開されました。
              </Link>
            </li>
            <li>東栄県職員や関係者を名乗る不審な連絡や詐欺行為にご注意ください。</li>
          </ul>
        </section>

        {/* 2カラムレイアウト（新着情報 ＆ 注目コンテンツ） */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* 左側：新着情報（2カラム分） */}
          <section className="lg:col-span-2 bg-white border border-slate-300 rounded shadow-sm p-6">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
              <h2 className="text-base font-bold text-slate-900 border-l-4 border-blue-600 pl-2">
                新着情報・更新情報
              </h2>
              <span className="text-xs text-slate-500">最新情報一覧</span>
            </div>
            
            <ul className="divide-y divide-slate-100 text-xs">
              <li className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <div className="flex items-center gap-3">
                  <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[11px] font-mono shrink-0">11月5日</span>
                  <Link href="/toeiken/police-result" className="text-blue-700 hover:underline font-medium">
                    警察官採用試験 受考者向けの合否照会システムをアップデートしました。
                  </Link>
                </div>
                <span className="text-[10px] bg-blue-50 text-blue-800 px-2 py-0.5 rounded w-fit">採用情報</span>
              </li>
              <li className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <div className="flex items-center gap-3">
                  <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[11px] font-mono shrink-0">11月4日</span>
                  <Link href="/toeiken" className="text-blue-700 hover:underline font-medium">
                    東栄プロジェクト公式Discordサーバー連携による住民認証の受付を開始。
                  </Link>
                </div>
                <span className="text-[10px] bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded w-fit">住民サービス</span>
              </li>
              <li className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <div className="flex items-center gap-3">
                  <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[11px] font-mono shrink-0">11月1日</span>
                  <Link href="/" className="text-blue-700 hover:underline font-medium">
                    東栄ポータルサイト（v1.0）の商用運用およびVercel自動デプロイ環境を構築。
                  </Link>
                </div>
                <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded w-fit">行政運営</span>
              </li>
            </ul>

            <div className="mt-6 pt-3 border-t border-slate-100 text-right">
              <Link href="/toeiken" className="text-xs font-semibold text-blue-700 hover:underline">
                すべての新着情報をみる &rarr;
              </Link>
            </div>
          </section>

          {/* 右側：主要バナー・クイックアクセス */}
          <aside className="space-y-4">
            <div className="bg-slate-900 text-white border border-slate-800 rounded p-5 shadow-sm">
              <h3 className="text-sm font-bold mb-3 border-b border-slate-700 pb-2 text-blue-400">
                [ 住民・関係者向け窓口 ]
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed mb-4">
                東栄県民としての各種申請や専用のダッシュボードへアクセスします。
              </p>
              <Link
                href="/toeiken"
                className="block w-full py-2.5 bg-[#5865F2] hover:bg-[#4752C4] text-white text-xs font-bold rounded text-center transition-colors shadow"
              >
                Discordで住民認証・ログイン
              </Link>
            </div>

            <div className="bg-white border border-slate-300 rounded p-5 shadow-sm">
              <h3 className="text-sm font-bold text-slate-900 mb-3 border-b border-slate-200 pb-2">
                [ 採用・試験案内 ]
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed mb-4">
                警察官採用試験の受験票受付、および結果の照会を行います。
              </p>
              <Link
                href="/toeiken/police-result"
                className="block w-full py-2.5 bg-blue-700 hover:bg-blue-600 text-white text-xs font-bold rounded text-center transition-colors shadow"
              >
                合否照会システムへ
              </Link>
            </div>
          </aside>
        </div>

        {/* ==========================================
            東栄の基本情報（組織・各部門）
            ========================================== */}
        <section className="bg-white border border-slate-300 rounded shadow-sm p-6">
          <h2 className="text-base font-bold text-slate-900 border-l-4 border-slate-700 pl-2 mb-6">
            東栄県の組織・基本情報
          </h2>
          
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
            <div className="border border-slate-200 rounded p-4 text-center hover:bg-slate-50 transition-colors">
              <p className="font-bold text-slate-800 mb-1">知事室・行政運営</p>
              <p className="text-[11px] text-slate-500">総合企画・条例管理</p>
            </div>
            <div className="border border-slate-200 rounded p-4 text-center hover:bg-slate-50 transition-colors">
              <p className="font-bold text-slate-800 mb-1">東栄県警察本部</p>
              <p className="text-[11px] text-slate-500">治安維持・採用試験</p>
            </div>
            <div className="border border-slate-200 rounded p-4 text-center hover:bg-slate-50 transition-colors">
              <p className="font-bold text-slate-800 mb-1">住民文化部</p>
              <p className="text-[11px] text-slate-500">コミュニティ・広報</p>
            </div>
            <div className="border border-slate-200 rounded p-4 text-center hover:bg-slate-50 transition-colors">
              <p className="font-bold text-slate-800 mb-1">都市整備・インフラ</p>
              <p className="text-[11px] text-slate-500">仮想空間構築・管理</p>
            </div>
          </div>
        </section>

      </main>

      {/* ==========================================
          フッター（官公庁フォーマット）
          ========================================== */}
      <footer className="border-t border-slate-300 bg-slate-900 text-slate-300 mt-12 py-8 text-xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <p className="font-bold text-white text-sm mb-2">東栄県庁（東栄プロジェクト運営局）</p>
            <p className="text-slate-400 leading-relaxed">
              〒540-8570 東栄県本庁舎 総合行政窓口<br />
              代表連絡先：公式Discordコミュニティにお問い合わせください。
            </p>
          </div>
          <div className="flex flex-col md:items-end justify-center gap-2">
            <div className="flex flex-wrap gap-4 text-slate-300">
              <Link href="/toeiken" className="hover:underline">利用規約</Link>
              <Link href="/toeiken" className="hover:underline">プライバシーポリシー</Link>
              <Link href="/toeiken" className="hover:underline">サイトマップ</Link>
            </div>
          </div>
        </div>
        <div className="border-t border-slate-800 pt-6 text-center text-slate-500 text-[11px]">
          &copy; 2026 葵プロジェクト / 東栄プロジェクト (Touei Prefectural Government). All Rights Reserved.
        </div>
      </footer>
    </div>
  );
}