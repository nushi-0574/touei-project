import { supabase } from '../../../lib/supabase';
import Header from '../../components/Header';
import Breadcrumbs from '../../components/Breadcrumbs';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import PageContent from './PageContent';

interface PageProps {
  params: Promise<{
    slug: string;
  }>;
}

async function getPage(slug: string) {
  const { data: pageData, error } = await supabase
    .from('custom_pages')
    .select('*')
    .eq('slug', slug)
    .eq('is_published', true)
    .maybeSingle();

  if (error) throw error;

  return pageData;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const pageData = await getPage(slug);
  if (!pageData) notFound();

  return {
    title: pageData.title,
    description: pageData.description || undefined,
    keywords: pageData.keywords || undefined,
  };
}

export default async function DynamicCustomPage({ params }: PageProps) {
  const { slug } = await params;
  const pageData = await getPage(slug);
  if (!pageData) notFound();

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 flex flex-col font-sans">
      <Header />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 flex-1 w-full space-y-6">
        <Breadcrumbs items={[{ label: 'ページ詳細' }]} />
        <PageContent page={pageData} />
      </main>
    </div>
  );
}