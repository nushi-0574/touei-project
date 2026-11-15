import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  if (pathname.startsWith('/api/') || pathname.startsWith('/_next/') || pathname.includes('.')) {
    return NextResponse.next();
  }

  return new NextResponse(
    `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>503 Service Unavailable - 東栄ポータル メンテナンス中</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f8fafc; color: #0f172a; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
    .box { max-width: 520px; padding: 40px; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 4px; text-align: left; }
    h1 { font-size: 20px; font-weight: bold; margin-bottom: 12px; color: #0f172a; letter-spacing: -0.02em; }
    p { font-size: 14px; line-height: 1.75; color: #334155; margin-bottom: 20px; }
    .code { font-family: monospace; font-size: 12px; background: #f1f5f9; padding: 6px 10px; border: 1px solid #e2e8f0; color: #475569; display: inline-block; margin-bottom: 20px; }
    .footer { font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 16px; }
  </style>
</head>
<body>
  <div class="box">
    <div class="code">503 SERVICE UNAVAILABLE</div>
    <h1>システムメンテナンス中のお知らせ</h1>
    <p>ただいま、東栄ポータル（Toei Portal）はシステムメンテナンスおよび機能アップデート作業を実施しております。</p>
    <p>ご不便をおかけし大変恐縮ですが、サービス再開まで今しばらくお待ちください。</p>
    <div class="footer">
      東栄ポータル運営事務局
    </div>
  </div>
</body>
</html>`,
    {
      status: 503,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Retry-After': '3600',
      },
    }
  );
}

export const config = {
  matcher: '/((?!_next/static|_next/image|favicon.ico).*)',
};
