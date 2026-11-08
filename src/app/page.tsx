import Link from 'next/link';
import Header from './components/Header';
import { Shield, FileText, Map, ChevronRight } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col font-sans">
      <Header />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-8">
        {/* 7:3 非対称レイアウト */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8 items-start">

          {/* 左側メインエリア (7割) */}
          <div className="space-y-6">

            {/* 白ベース＋東栄ブルーブランド見出し */}
            <section className="bg-slate-50 border border-slate-200 p-6 rounded-sm space-y-3">
              <span className="text-xs font-bold text-[#0046ff] bg-blue-50 border border-blue-200 px-2.5 py-0.5 inline-block">
                東栄県公式ポータル
              </span>
              <h1 className="text-xl font-bold tracking-tight text-slate-900">
                東栄県 公式ポータルサイト
              </h1>
              <p className="text-[13px] text-slate-700 leading-relaxed">
                行政手続き、施設案内マップ、および警察・防災関連ポータルを提供しています。
              </p>
              <div className="pt-1 flex flex-wrap gap-2 text-xs">
                <Link
                  href="/toeiken"
                  className="px-4 py-2 bg-[#0046ff] hover:bg-blue-700 text-white font-bold rounded-sm transition-colors inline-flex items-center gap-1 min-h-[40px]"
                >
                  <span>東栄アカウントログイン</span>
                  <ChevronRight className="w-4 h-4" />
                </Link>
                <Link
                  href="/toeiken/portal"
                  className="px-4 py-2 bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 font-bold rounded-sm transition-colors min-h-[40px] flex items-center"
                >
                  住民ポータル機能一覧
                </Link>
              </div>
            </section>

            {/* 主要機能案内 (テキスト最小限・白カード) */}
            <section className="space-y-3">
              <h2 className="text-sm font-bold text-slate-900 tracking-tight border-b border-slate-200 pb-2">
                主要窓口・ポータル
              </h2>

              <div className="space-y-3">
                <Link
                  href="/toeiken/services"
                  className="block bg-white border border-slate-200 p-4 rounded-sm hover:border-[#0046ff] transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <FileText className="w-5 h-5 text-[#0046ff] shrink-0 mt-0.5" />
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 tracking-tight">住民サービスセンター</h3>
                      <p className="text-xs text-slate-600 mt-0.5">申請手続き・イベント予約・コミュニティ掲示板</p>
                    </div>
                  </div>
                </Link>

                <Link
                  href="/police"
                  className="block bg-white border border-slate-200 p-4 rounded-sm hover:border-[#0046ff] transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <Shield className="w-5 h-5 text-[#0046ff] shrink-0 mt-0.5" />
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 tracking-tight">警察職員ポータル (警備・指令卓)</h3>
                      <p className="text-xs text-slate-600 mt-0.5">110番緊急指令台・警察無線通信卓・合否照会</p>
                    </div>
                  </div>
                </Link>

                <Link
                  href="/map"
                  className="block bg-white border border-slate-200 p-4 rounded-sm hover:border-[#0046ff] transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <Map className="w-5 h-5 text-[#0046ff] shrink-0 mt-0.5" />
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 tracking-tight">施設情報・防災マップ</h3>
                      <p className="text-xs text-slate-600 mt-0.5">県内公共施設および避難場所マップデータ</p>
                    </div>
                  </div>
                </Link>
              </div>
            </section>

          </div>

          {/* 右側サイドバー (3割) */}
          <aside className="space-y-4">

            <div className="bg-slate-50 border border-slate-200 p-4 rounded-sm space-y-3">
              <h3 className="text-xs font-bold text-slate-900 border-b border-slate-200 pb-1.5">
                クイックアクセス
              </h3>
              <ul className="space-y-1.5 text-xs">
                <li>
                  <Link href="/toeiken/police-result" className="text-[#0046ff] hover:underline font-bold block py-0.5">
                    警察官採用試験 合否照会
                  </Link>
                </li>
                <li>
                  <Link href="/recruitment" className="text-[#0046ff] hover:underline font-bold block py-0.5">
                    採用募集一覧
                  </Link>
                </li>
                <li>
                  <Link href="/toeiken/phone" className="text-[#0046ff] hover:underline font-bold block py-0.5">
                    内部電話窓口 (030番)
                  </Link>
                </li>
              </ul>
            </div>

            <div className="bg-white border border-slate-200 p-4 rounded-sm text-xs space-y-1">
              <p className="font-bold text-slate-900">東栄県庁 総合案内</p>
              <p className="text-slate-600 text-[11px]">開庁時間: 平日 8:30〜17:15</p>
            </div>

          </aside>

        </div>
      </main>

      {/* 平たいフッター */}
      <footer className="border-t border-slate-200 bg-white py-4 text-xs text-slate-600">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="font-bold text-[#0046ff]">東栄県公式ポータル</p>
          <nav aria-label="フッターナビゲーション" className="flex gap-4">
            <Link href="/terms" className="hover:underline">利用規約</Link>
            <Link href="/privacy" className="hover:underline">プライバシーポリシー</Link>
          </nav>
          <p className="text-slate-500 font-mono text-[11px]">© 2026 東栄県 All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
