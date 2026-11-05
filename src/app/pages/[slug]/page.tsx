import { supabase } from '../../../lib/supabase';
import Header from '../../components/Header';
import Breadcrumbs from '../../components/Breadcrumbs';
import { notFound } from 'next/navigation';

interface PageProps {
  params: {
    slug: string;
  };
}

// Cache Componentsの要件（最低1つのパラメータを返す）を満たすようダミーをフォールバックに含める
export async function generateStaticParams() {
  const { data } = await supabase.from('custom_pages').select('slug');
  if (!data || data.length === 0) {
    return [{ slug: 'dummy' }];
  }
  return data.map((item) => ({
    slug: item.slug,
  }));
}

export default async function DynamicCustomPage({ params }: PageProps) {
  const { slug } = params;

  if (slug === 'dummy') {
    notFound();
  }

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
    <div className="min-h-screen bg-slate-100 text-slate-800 flex flex-col font-sans">
      <Header />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 flex-1 w-full space-y-6">
        <Breadcrumbs items={[{ label: pageData.title }]} />

        <article className="bg-white border border-slate-300 rounded shadow-sm p-6 sm:p-8 space-y-4">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 border-b border-slate-200 pb-3">
            {pageData.title}
          </h1>

          <div className="text-xs sm:text-sm text-slate-700 leading-relaxed whitespace-pre-wrap pt-2">
            {pageData.content}
          </div>
        </article>
      </main>
    </div>
  );
}