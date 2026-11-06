'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Header from '../components/Header';
import Breadcrumbs from '../components/Breadcrumbs';
import { supabase } from '../../lib/supabase';
import { getErrorMessage } from '../../lib/errors';

type CustomPage = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  category: string | null;
};

export default function PagesIndex() {
  const [pages, setPages] = useState<CustomPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let active = true;

    async function loadPages() {
      try {
        const { data, error } = await supabase
          .from('custom_pages')
          .select('id, slug, title, description, category')
          .eq('is_published', true)
          .order('display_order', { ascending: true });

        if (error) throw error;
        if (active) setPages(data || []);
      } catch (error) {
        console.error('公開ページの取得に失敗しました:', error);
        if (active) setErrorMessage(getErrorMessage(error, '公開ページを取得できませんでした。'));
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadPages();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 flex flex-col font-sans">
      <Header />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 flex-1 w-full">
        <Breadcrumbs items={[{ label: '資料・案内一覧' }]} />
        <section className="bg-white border border-slate-300 rounded shadow-sm p-6 sm:p-8">
          <h1 className="text-xl font-bold text-slate-900 border-b border-slate-200 pb-3 mb-4">
            資料・案内一覧
          </h1>
          {loading ? (
            <p className="text-xs text-slate-500 text-center py-6">読み込み中...</p>
          ) : errorMessage ? (
            <p role="alert" className="text-xs text-red-700 py-4">{errorMessage}</p>
          ) : pages.length === 0 ? (
            <p className="text-xs text-slate-500 py-4">現在、公開されている資料・案内はありません。</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {pages.map((page) => (
                <li key={page.id} className="py-4">
                  <Link href={`/pages/${encodeURIComponent(page.slug)}`} className="font-semibold text-blue-700 hover:underline">
                    {page.title}
                  </Link>
                  {page.category && (
                    <span className="ml-2 text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                      {page.category}
                    </span>
                  )}
                  {page.description && <p className="text-xs text-slate-600 mt-1">{page.description}</p>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
