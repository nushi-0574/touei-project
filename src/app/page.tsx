'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Header from './components/Header';
import { supabase } from '../lib/supabase';

type NewsItem = {
  id: number;
  date_str: string;
  title: string;
  link_url: string;
  category: string;
};

export default function Home() {
  const [emergencyText, setEmergencyText] = useState('現在、東栄県内における重大な警報・緊急情報はありません。');
  const [isEmergencyActive, setIsEmergencyActive] = useState(false);
  const [newsList, setNewsList] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  // ページ読み込み時にSupabaseからデータを取得
  useEffect(() => {
    async function fetchData() {
      try {
        // 1. サイト設定（緊急情報など）の取得
        const { data: settingData } = await supabase
          .from('site_settings')
          .select('*')
          .eq('id', 1)
          .single();

        if (settingData) {
          setEmergencyText(settingData.emergency_text);
          setIsEmergencyActive(settingData.is_emergency_active);
        }

        // 2. 新着情報の取得
        const { data: newsData } = await supabase
          .from('news_items')
          .select('*')
          .order('id', { ascending: false });

        if (newsData) {
          setNewsList(newsData);
        }
      } catch (err) {
        console.error('データ取得エラー:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col font-sans">
      <Header />

      {/* ==========================================
          防災・緊急情報ティッカー（管理画面からON/OFF・文字変更可能）
          ========================================== */}
      {isEmergencyActive && (
        <div className="bg-red-900 text-white text-xs py-2 px-4 border-b border-red-950">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="bg-red-700 text-white px-2 py-0.5 rounded text-[10px] font-bold tracking-wider">防災・緊急</span>
              <span>{emergencyText}</span>
            </div>
            <Link href="/toeiken" className="underline hover:text-red-200 text-[11px]">
              詳細・過去の情報 &rarr;
            </Link>
          </div>
        </div>
      )}

      {/* グローバルナビゲーション */}
      <nav className="bg-slate-900 text-white border-b border-slate-800 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 flex flex-wrap items-center justify-between py-3">
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold tracking-wider text-slate-100 border-l-4 border-blue-500 pl-2">
              東栄県公式ポータル
            </span>
          </div>
          <div className="flex flex-wrap gap-1 sm:gap-2 text-xs">
            <Link href="/toeiken" className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded transition-colors text-slate-200">
              住民ポータル
            </Link>
            <Link href="/toeiken/police-result" className="px-3 py-1.5 bg-blue-700 hover:bg-blue-600 rounded transition-colors text-white font-semibold">
              合否照会
            </Link>
          </div>
        </div>
      </nav>

      <main className="flex-1 max-w-6xl mx-auto px-4 sm:px-6 py-8 w-full space-y-8">
        {/* メインセクション */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* 左側：新着情報（データベースから動的表示） */}
          <section className="lg:col-span-2 bg-white border border-slate-300 rounded shadow-sm p-6">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
              <h2 className="text-base font-bold text-slate-900 border-l-4 border-blue-600 pl-2">
                新着情報・更新情報
              </h2>
              <span className="text-xs text-slate-500">管理画面から追加可能</span>
            </div>
            
            {loading ? (
              <p className="text-xs text-slate-500 py-4 text-center">読み込み中...</p>
            ) : newsList.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">新着情報はありません。</p>
            ) : (
              <ul className="divide-y divide-slate-100 text-xs">
                {newsList.map((item) => (
                  <li key={item.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <div className="flex items-center gap-3">
                      <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[11px] font-mono shrink-0">
                        {item.date_str}
                      </span>
                      <Link href={item.link_url} className="text-blue-700 hover:underline font-medium">
                        {item.title}
                      </Link>
                    </div>
                    <span className="text-[10px] bg-blue-50 text-blue-800 px-2 py-0.5 rounded w-fit">
                      {item.category}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* 右側：クイックアクセス */}
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
      </main>

      <footer className="border-t border-slate-300 bg-slate-900 text-slate-300 mt-12 py-8 text-xs">
        <div className="max-w-6xl mx-auto px-4 text-center text-slate-500 text-[11px]">
          &copy; 2026 葵プロジェクト / 東栄プロジェクト (Touei Prefectural Government). All Rights Reserved.
        </div>
      </footer>
    </div>
  );
}