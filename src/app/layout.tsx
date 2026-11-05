import './globals.css';
import CookieBanner from './components/CookieBanner';

export const metadata = {
  title: '東栄県公式ポータル',
  description: '東栄県ポータルサイト',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className="antialiased bg-slate-100">
        {children}
        <CookieBanner />
      </body>
    </html>
  );
}