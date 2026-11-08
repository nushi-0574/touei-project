import Link from 'next/link';
import Header from './components/Header';
import { Shield, FileText, Map, Phone, Users, ChevronRight } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col font-sans">
      <Header />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-12">
        {/* 非対称 (7:3) メイングリッド構成 */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8 items-start">

          {/* 左側メインエリア (7割) */}
          <div className="space-y-8">

            {/* 左揃えヘッダーセクション（中央揃えヒーローの全面禁止対応） */}
            <section className="bg-slate-900 text-slate-100 p-8 border border-slate-800 rounded-sm">
              <div className="space-y-4 max-w-2xl">
                <span className="inline-block text-xs font-semibold text-emerald-400 bg-slate-800 border border-slate-700 px-3 py-1">
                  東栄県電子行政ポータル
                </span>
                <h1 className="text-2xl font-bold tracking-tight text-white leading-tight">
                  東栄県 公式ポータルサイト
                </h1>
                <p className="text-sm text-slate-300 leading-relaxed">
                  東栄県の住民向け行政サービス手続き、施設情報マップ、広報・お知らせ、および各種行政機関専門ポータルを提供します。
                </p>
                <div className="pt-2 flex flex-wrap gap-3 text-xs">
                  <Link
                    href="/toeiken"
                    className="px-5 py-2.5 bg-blue-700 hover:bg-blue-600 text-white font-medium rounded-sm transition-colors inline-flex items-center gap-1.5"
                  >
                    <span>東栄アカウントログイン・新規作成</span>
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                  <Link
                    href="/toeiken/portal"
                    className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-medium rounded-sm transition-colors"
                  >
                    住民ポータル機能一覧
                  </Link>
                </div>
              </div>
            </section>

            {/* 主要行政サービス案内 (縦並び構造・定型3カラムカード廃止) */}
            <section className="space-y-4">
              <div className="border-b border-slate-200 pb-2">
                <h2 className="text-base font-bold text-slate-900 tracking-tight">
                  主要手続き・ポータル案内
                </h2>
                <p className="text-xs text-slate-600 mt-0.5">
                  各窓口・ポータルへ直接アクセスできます。
                </p>
              </div>

              <div className="space-y-3">
                {/* 住民手続き・申請窓口 */}
                <Link
                  href="/toeiken/services"
                  className="block bg-white border border-slate-200 p-5 rounded-sm hover:border-slate-400 transition-colors"
                >
                  <div className="flex items-start gap-4">
                    <div className="p-2.5 bg-slate-100 border border-slate-200 text-slate-700 shrink-0">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                        住民サービス・申請窓口 (サービスセンター)
                      </h3>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        各種申請手続き、住民証発行、地域イベント予約、住民掲示板コミュニティおよびお問い合わせ窓口をご利用いただけます。
                      </p>
                    </div>
                  </div>
                </Link>

                {/* 警察職員・指令・無線ポータル */}
                <Link
                  href="/police"
                  className="block bg-white border border-slate-200 p-5 rounded-sm hover:border-slate-400 transition-colors"
                >
                  <div className="flex items-start gap-4">
                    <div className="p-2.5 bg-slate-100 border border-slate-200 text-slate-700 shrink-0">
                      <Shield className="w-5 h-5" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                        東栄県警察本部 警備・指令ポータル
                      </h3>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        110番緊急指令卓、警察無線通信システム、採用試験合否照会および警察職員ポータルへのアクセスが可能です。
                      </p>
                    </div>
                  </div>
                </Link>

                {/* 地域施設情報マップ */}
                <Link
                  href="/map"
                  className="block bg-white border border-slate-200 p-5 rounded-sm hover:border-slate-400 transition-colors"
                >
                  <div className="flex items-start gap-4">
                    <div className="p-2.5 bg-slate-100 border border-slate-200 text-slate-700 shrink-0">
                      <Map className="w-5 h-5" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                        地域施設・防災地図情報
                      </h3>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        東栄県内の公共施設、避難所、地域情報をオープンストリートマップ上で確認できます。
                      </p>
                    </div>
                  </div>
                </Link>
              </div>
            </section>

          </div>

          {/* 右側サイドバー (3割) - 腰の据わった固定案内エリア */}
          <aside className="space-y-6">

            {/* ショートカットパネル */}
            <div className="bg-white border border-slate-200 p-5 rounded-sm space-y-4">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider border-b border-slate-200 pb-2">
                クイックアクセス
              </h3>
              <ul className="space-y-2 text-xs">
                <li>
                  <Link href="/toeiken/police-result" className="text-blue-800 hover:underline font-medium block py-1 border-b border-slate-100">
                    警察官採用試験 合否照会
                  </Link>
                </li>
                <li>
                  <Link href="/recruitment" className="text-blue-800 hover:underline font-medium block py-1 border-b border-slate-100">
                    県職員・警察官 採用募集一覧
                  </Link>
                </li>
                <li>
                  <Link href="/toeiken/phone" className="text-blue-800 hover:underline font-medium block py-1 border-b border-slate-100">
                    内部電話窓口 (030番)
                  </Link>
                </li>
                <li>
                  <Link href="/pages" className="text-blue-800 hover:underline font-medium block py-1 border-b border-slate-100">
                    公開資料・行政案内一覧
                  </Link>
                </li>
              </ul>
            </div>

            {/* 庁内連絡先・問い合わせ */}
            <div className="bg-slate-100 border border-slate-300 p-5 rounded-sm space-y-2 text-xs">
              <h3 className="font-bold text-slate-900 flex items-center gap-1.5">
                <Phone className="w-4 h-4 text-slate-600" />
                <span>東栄県庁 総合案内</span>
              </h3>
              <p className="text-slate-600 leading-relaxed">
                開庁時間: 平日 8:30〜17:15<br />
                土日・祝日・年末年始を除く
              </p>
            </div>

            {/* 利用規約・同意記録 */}
            <div className="bg-white border border-slate-200 p-5 rounded-sm space-y-2 text-xs">
              <h3 className="font-bold text-slate-900">利用規定・同意記録</h3>
              <p className="text-slate-600 leading-relaxed">
                アカウント利用時には規約およびプライバシーポリシーへの同意が求められます。
              </p>
              <div className="pt-1 flex gap-3 text-blue-800 font-medium">
                <Link href="/terms" className="hover:underline">利用規約</Link>
                <Link href="/privacy" className="hover:underline">プライバシーポリシー</Link>
              </div>
            </div>

          </aside>

        </div>
      </main>

      {/* 簡素化フッター (平たくクリーン) */}
      <footer className="border-t border-slate-800 bg-slate-900 py-6 text-xs text-slate-300">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="font-semibold text-slate-200">東栄県公式ポータルサイト</p>
          <nav aria-label="フッターナビゲーション" className="flex gap-6">
            <Link href="/terms" className="hover:text-white hover:underline">利用規約</Link>
            <Link href="/privacy" className="hover:text-white hover:underline">プライバシーポリシー</Link>
            <Link href="/pages" className="hover:text-white hover:underline">公開資料</Link>
          </nav>
          <p className="text-slate-500 font-mono">© 2026 東栄県 All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
