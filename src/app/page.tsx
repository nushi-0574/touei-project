import Link from 'next/link';
import Header from './components/Header';
import { ShoppingBag, Shield, FileText, ChevronRight, ExternalLink } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col font-sans">
      <Header />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-8">
        {/* 7:3 非対称レイアウト */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8 items-start">

          {/* 左側メインエリア (7割) */}
          <div className="space-y-6">

            {/* 東栄ポータル初期画面メインヒーロー (白ベース＋東栄ブルー) */}
            <section className="bg-slate-50 border border-slate-200 p-6 sm:p-8 rounded-sm space-y-4">
              <div className="space-y-2">
                <span className="text-xs font-bold text-[#0046ff] bg-blue-50 border border-blue-200 px-2.5 py-0.5 inline-block">
                  商用・デジタルコマース プラットフォーム
                </span>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
                  東栄ポータル (Toei Portal)
                </h1>
                <p className="text-sm text-slate-700 leading-relaxed max-w-2xl">
                  デジタル商品のオンライン取引、ソフトウェアライセンス販売、電子コンテンツ購入および事業者向けコマース管理を提供する総合プラットフォームです。
                </p>
              </div>

              {/* 主要アクションボタン群 */}
              <div className="pt-2 flex flex-wrap gap-3 text-xs">
                <Link
                  href="/store"
                  className="px-5 py-3 bg-[#0046ff] hover:bg-blue-700 text-white font-bold rounded-sm transition-colors inline-flex items-center gap-1.5 min-h-[44px]"
                >
                  <ShoppingBag className="w-4 h-4" />
                  <span>デジタル商品ストアを見る</span>
                  <ChevronRight className="w-4 h-4" />
                </Link>

                <Link
                  href="/dashboard/library"
                  className="px-5 py-3 bg-white hover:bg-slate-100 border border-slate-300 text-slate-900 font-bold rounded-sm transition-colors min-h-[44px] flex items-center"
                >
                  購入済みデジタルライブラリ
                </Link>
              </div>
            </section>

            {/* 東栄県ポータルへの移行案内バナー (非常に目立つ専用移行ボタン) */}
            <section className="bg-blue-900 text-white border border-blue-950 p-6 rounded-sm space-y-3">
              <div className="space-y-1">
                <span className="text-[11px] font-mono tracking-widest text-blue-200 uppercase font-bold">
                  LOCAL GOVERNMENT & RESIDENT PORTAL
                </span>
                <h2 className="text-lg font-bold tracking-tight">
                  東栄県ポータル（住民・行政サービス）をご利用の方へ
                </h2>
                <p className="text-xs text-blue-100 leading-relaxed">
                  住民票の申請、警察官採用試験の合否照会、地域防災マップ、行政手続き等はこちらの東栄県ポータルへお進みください。
                </p>
              </div>

              <div className="pt-1">
                <Link
                  href="/toeiken/portal"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-white text-blue-950 hover:bg-blue-50 font-bold text-xs rounded-sm transition-colors shadow-sm min-h-[44px]"
                >
                  <ExternalLink className="w-4 h-4 text-[#0046ff]" />
                  <span>東栄県ポータル（住民・行政サービス）へ移行する</span>
                  <ChevronRight className="w-4 h-4 text-[#0046ff]" />
                </Link>
              </div>
            </section>

            {/* プラットフォーム機能案内 */}
            <section className="space-y-3">
              <h2 className="text-sm font-bold text-slate-900 tracking-tight border-b border-slate-200 pb-2">
                プラットフォーム機能一覧
              </h2>

              <div className="space-y-3 text-xs">
                <Link
                  href="/admin/store"
                  className="block bg-white border border-slate-200 p-4 rounded-sm hover:border-[#0046ff] transition-colors"
                >
                  <h3 className="text-sm font-bold text-slate-900 tracking-tight">デジタル商品・取引管理パネル</h3>
                  <p className="text-xs text-slate-600 mt-0.5">事業者のためのデジタル商品登録、納品ファイル管理、売上注文履歴</p>
                </Link>

                <Link
                  href="/dashboard"
                  className="block bg-white border border-slate-200 p-4 rounded-sm hover:border-[#0046ff] transition-colors"
                >
                  <h3 className="text-sm font-bold text-slate-900 tracking-tight">メインダッシュボード・決済プラン管理</h3>
                  <p className="text-xs text-slate-600 mt-0.5">Stripe定期サブスクリプションおよびアカウント設定</p>
                </Link>
              </div>
            </section>

          </div>

          {/* 右側サイドバー (3割) */}
          <aside className="space-y-4">

            <div className="bg-slate-50 border border-slate-200 p-4 rounded-sm space-y-3 text-xs">
              <h3 className="font-bold text-slate-900 border-b border-slate-200 pb-1.5">
                クイックナビゲーション
              </h3>
              <ul className="space-y-2">
                <li>
                  <Link href="/store" className="text-[#0046ff] hover:underline font-bold block">
                    デジタル商品ストア →
                  </Link>
                </li>
                <li>
                  <Link href="/toeiken/portal" className="text-[#0046ff] hover:underline font-bold block">
                    東栄県ポータル (住民) →
                  </Link>
                </li>
                <li>
                  <Link href="/police" className="text-[#0046ff] hover:underline font-bold block">
                    警察職員ポータル →
                  </Link>
                </li>
                <li>
                  <Link href="/admin" className="text-[#0046ff] hover:underline font-bold block">
                    管理者パネル →
                  </Link>
                </li>
              </ul>
            </div>

            <div className="bg-white border border-slate-200 p-4 rounded-sm text-xs space-y-1">
              <p className="font-bold text-slate-900">東栄ポータル運営事務局</p>
              <p className="text-slate-600 text-[11px]">デジタル商品取引・商用プラットフォーム</p>
            </div>

          </aside>

        </div>
      </main>

      {/* 平たいフッター */}
      <footer className="border-t border-slate-200 bg-white py-4 text-xs text-slate-600">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="font-bold text-[#0046ff]">東栄ポータル (Toei Portal)</p>
          <nav aria-label="フッターナビゲーション" className="flex gap-4">
            <Link href="/terms" className="hover:underline">利用規約</Link>
            <Link href="/privacy" className="hover:underline">プライバシーポリシー</Link>
            <Link href="/toeiken/portal" className="hover:underline text-blue-700 font-bold">東栄県ポータルへ</Link>
          </nav>
          <p className="text-slate-500 font-mono text-[11px]">© 2026 Toei Portal All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
