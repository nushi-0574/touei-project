import './globals.css';
import CookieBanner from './components/CookieBanner';
import { LocaleProvider } from '../lib/i18n';
import SkipLink from './components/SkipLink';
import NavigationLoading from './components/NavigationLoading';
import type { Metadata, Viewport } from 'next';
import 'leaflet/dist/leaflet.css';
import { Suspense } from 'react';

export const metadata: Metadata = {
  title: '東栄県公式ポータル',
  description: '東栄県の住民向け情報、各種案内、採用試験結果を提供する公式ポータルサイトです。',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className="antialiased bg-slate-100">
        <LocaleProvider>
          <SkipLink />
          {children}
          <CookieBanner />
        </LocaleProvider>
        <Suspense fallback={null}>
          <NavigationLoading />
        </Suspense>
      </body>
    </html>
  );
}