import './globals.css';

export const metadata = {
  title: '東栄プロジェクト',
  description: 'チケット・デジタルコンテンツ販売',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja">
      <body className="bg-slate-50 text-slate-800 antialiased">
        {children}
      </body>
    </html>
  )
}