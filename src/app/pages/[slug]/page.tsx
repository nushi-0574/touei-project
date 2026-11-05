import { supabase } from '../../../lib/supabase';
import Header from '../../components/Header';
import Breadcrumbs from '../../components/Breadcrumbs';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { connection } from 'next/server';

interface PageProps {
  params: Promise<{ slug: string }>;
}

async function PageContent({ slug }: { slug: string }) {
  await connection();

  // Supabaseから該当スラッグのページを取得
  const { data: pageData } = await supabase
    .from('custom_pages')
    .select('*')
    .eq('slug', slug)
    .eq('is_published', true)
    .single();

  if (!pageData) {
    notFound();
  }

  return (
    <article className="bg-white border border-slate-300 rounded shadow-sm p-6 sm:p-8 space-y-4">
      <h1 className="text-xl sm:text-2xl font-bold text-slate-900 border-b border-slate-200 pb-3">
        {pageData.title}
      </h1>

      <div className="text-xs sm:text-sm text-slate-700 leading-relaxed whitespace-pre-wrap pt-2">
        {pageData.content}
      </div>
    </article>
  );
}

export default async function DynamicCustomPage({ params }: PageProps) {
  const resolvedParams = await params;
  const { slug } = resolvedParams;

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 flex flex-col font-sans">
      <Header />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 flex-1 w-full space-y-6">
        <Breadcrumbs items={[{ label: 'ページ詳細' }]} />

        <Suspense fallback={<div className="text-xs text-slate-500 text-center py-8">読み込み中...</div>}>
          <PageContent slug={slug} />
        </Suspense>
      </main>
    </div>
  );
}