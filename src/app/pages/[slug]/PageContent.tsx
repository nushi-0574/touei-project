'use client';

import { useLocale } from '../../../lib/i18n';

type Translation = {
  title?: string;
  description?: string;
  content?: string;
};

type CustomPage = {
  title: string;
  description: string | null;
  content: string;
  translations?: Record<string, Translation> | null;
};

export default function PageContent({ page }: { page: CustomPage }) {
  const { locale } = useLocale();
  const translation = locale === 'ja' ? undefined : page.translations?.[locale];
  const title = translation?.title?.trim() || page.title;
  const description = translation?.description?.trim() || page.description;
  const content = translation?.content?.trim() || page.content;

  return (
    <article className="space-y-4 rounded border border-slate-300 bg-white p-6 shadow-sm sm:p-8">
      <h1 className="border-b border-slate-200 pb-3 text-xl font-bold text-slate-900 sm:text-2xl">
        {title}
      </h1>
      {description && <p className="text-sm text-slate-600">{description}</p>}
      <div className="whitespace-pre-wrap pt-2 text-xs leading-relaxed text-slate-700 sm:text-sm">
        {content}
      </div>
    </article>
  );
}
