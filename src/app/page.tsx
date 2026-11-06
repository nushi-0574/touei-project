'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Header from './components/Header';
import { ContentSkeleton } from '@/src/app/components/LoadingScreen';
import { supabase } from '../lib/supabase';
import { getErrorMessage } from '../lib/errors';

type NewsItem = {
  id: number;
  date_str: string;
  title: string;
  link_url: string;
  category: string;
};

type MenuCard = {
  id: string;
  title: string;
  description: string;
  link_url: string;
  display_order: number;
};

function isSafeLink(href: string): boolean {
  if (href.startsWith('/') && !href.startsWith('//')) return true;

  try {
    const url = new URL(href);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export default function Home() {
  const [emergencyText, setEmergencyText] = useState('');
  const [isEmergencyActive, setIsEmergencyActive] = useState(false);
  const [newsList, setNewsList] = useState<NewsItem[]>([]);
  const [menuCards, setMenuCards] = useState<MenuCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let active = true;

    async function fetchData() {
      try {
        const [settingResult, newsResult, cardsResult] = await Promise.all([
          supabase.from('site_settings').select('emergency_text, is_emergency_active').eq('id', 1).maybeSingle(),
          supabase.from('news_items').select('id, date_str, title, link_url, category').order('id', { ascending: false }),
          supabase.from('main_menu_cards').select('id, title, description, link_url, display_order').eq('is_visible', true).order('display_order', { ascending: true }),
        ]);
        const queryError = [settingResult, newsResult, cardsResult].find((result) => result.error)?.error;
        if (queryError) throw queryError;

        if (!active) return;
        setEmergencyText(settingResult.data?.emergency_text || '');
        setIsEmergencyActive(settingResult.data?.is_emergency_active === true);
        setNewsList(newsResult.data || []);
        setMenuCards(cardsResult.data || []);
      } catch (error) {
        console.error('データ取得エラー:', error);
        if (active) setLoadError(getErrorMessage(error, 'データの読み込みに失敗しました。'));
      } finally {
        if (active) setLoading(false);
      }
    }

    void fetchData();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col font-sans">
      <Header />

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

      <nav className="bg-slate-900 text-white border-b border-slate-800 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 flex flex-wrap items-center justify-between py-3">
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold tracking-wider text-slate-100 border-l-4 border-blue-500 pl-2">
              東栄県公式ポータル
            </span>
          </div>
          <div className="flex flex-wrap gap-1 sm:gap-2 text-xs">
            <Link href="/toeiken" className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded transition-colors text-slate-200">
              住民ポータル・マイページ
            </Link>
            <Link href="/toeiken/police-result" className="px-3 py-1.5 bg-blue-700 hover:bg-blue-600 rounded transition-colors text-white font-semibold">
              合否照会
            </Link>
          </div>
        </div>
      </nav>

      <main className="flex-1 max-w-6xl mx-auto px-4 sm:px-6 py-8 w-full space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          <section className="lg:col-span-2 bg-white border border-slate-300 rounded shadow-sm p-6">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
              <h2 className="text-base font-bold text-slate-900 border-l-4 border-blue-600 pl-2">
                新着情報・お知らせ
              </h2>
            </div>
            
            {loading ? (
              <ContentSkeleton rows={2} />
            ) : loadError ? (
              <p role="alert" className="text-xs text-red-700 py-4 text-center">情報を読み込めませんでした。時間をおいて再度お試しください。</p>
            ) : newsList.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">現在、新着情報はありません。</p>
            ) : (
              <ul className="divide-y divide-slate-100 text-xs">
                {newsList.map((item) => (
                  <li key={item.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <div className="flex items-center gap-3">
                      <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[11px] font-mono shrink-0">
                        {item.date_str}
                      </span>
                      {item.link_url && isSafeLink(item.link_url) ? (
                        item.link_url.startsWith('/') ? (
                          <Link href={item.link_url} className="text-blue-700 hover:underline font-medium">{item.title}</Link>
                        ) : (
                          <a href={item.link_url} target="_blank" rel="noopener noreferrer" className="text-blue-700 hover:underline font-medium">{item.title}</a>
                        )
                      ) : (
                        <span className="font-medium">{item.title}</span>
                      )}
                    </div>
                    <span className="text-[10px] bg-blue-50 text-blue-800 px-2 py-0.5 rounded w-fit">
                      {item.category}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <aside className="space-y-4">
            <div className="bg-white border border-slate-300 rounded p-5 shadow-sm">
              <h3 className="text-sm font-bold text-slate-900 mb-3 border-b border-slate-200 pb-2">
                [ 住民ポータル窓口 ]
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed mb-4">
                ログイン後、マイページにて住民情報の確認や各種連携手続きを行っていただけます。
              </p>
              <Link
                href="/toeiken"
                className="block w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded text-center transition-colors shadow"
              >
                ポータルログイン / 登録
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

        {menuCards.length > 0 && (
          <section aria-labelledby="menu-cards-heading">
            <h2 id="menu-cards-heading" className="text-base font-bold text-slate-900 border-l-4 border-blue-600 pl-2 mb-4">
              ポータルメニュー
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {menuCards.map((card) => {
                const href = card.link_url?.trim() || '';
                const content = (
                  <>
                    <h3 className="font-bold text-slate-900">{card.title}</h3>
                    <p className="text-xs text-slate-600 mt-2">{card.description}</p>
                  </>
                );
                const className = 'block h-full bg-white border border-slate-300 rounded p-5 hover:border-blue-500 transition-colors';

                if (!isSafeLink(href)) {
                  return <div key={card.id} className={className}>{content}</div>;
                }
                return href.startsWith('/') ? (
                  <Link key={card.id} href={href} className={className}>{content}</Link>
                ) : (
                  <a key={card.id} href={href} target="_blank" rel="noopener noreferrer" className={className}>{content}</a>
                );
              })}
            </div>
          </section>
        )}
      </main>

      <footer className="border-t border-slate-300 bg-slate-900 text-slate-300 mt-12 py-8 text-xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <p className="font-bold text-white text-sm mb-2">東栄県庁（東栄プロジェクト運営局）</p>
            <p className="text-slate-400 leading-relaxed">
              〒540-8570 東栄県本庁舎 総合行政窓口
            </p>
          </div>
          <div className="flex flex-col md:items-end justify-center gap-2">
            <div className="flex flex-wrap gap-4 text-slate-300">
              <Link href="/terms" className="hover:underline">利用規約</Link>
              <Link href="/privacy" className="hover:underline">プライバシーポリシー</Link>
            </div>
          </div>
        </div>
        <div className="border-t border-slate-800 pt-6 text-center text-slate-500 text-[11px]">
          &copy; 2026 葵プロジェクト / 東栄プロジェクト (Toei Prefectural Government). All Rights Reserved.
        </div>
      </footer>
    </div>
  );
}