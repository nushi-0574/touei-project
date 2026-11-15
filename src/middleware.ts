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
  <title>503 Service Unavailable - 読み込み中</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f8fafc; color: #0f172a; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
    .box { max-width: 520px; padding: 40px; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 4px; text-align: left; }
    h1 { font-size: 20px; font-weight: bold; margin-bottom: 12px; color: #0f172a; letter-spacing: -0.02em; }
    p { font-size: 14px; line-height: 1.75; color: #334155; margin-bottom: 20px; }
    .code { font-family: monospace; font-size: 12px; background: #f1f5f9; padding: 6px 10px; border: 1px solid #e2e8f0; color: #475569; display: inline-block; margin-bottom: 20px; }
    .footer { font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 16px; line-height: 1.6; }
    .loading-text { font-family: monospace; font-size: 14px; font-weight: bold; color: #2563eb; margin-bottom: 16px; min-height: 24px; }
  </style>
</head>
<body>
  <div class="box" id="content-box">
    <div class="code">503 SERVICE UNAVAILABLE</div>
    <div id="loading-container">
      <div class="loading-text" id="status-text">接続を試みています.</div>
      <p style="color: #64748b; font-size: 13px;">サーバーへの接続を確認しています。しばらくお待ちください...</p>
    </div>
  </div>

  <script>
    (function() {
      const statusText = document.getElementById('status-text');
      const contentBox = document.getElementById('content-box');

      // 段階1: 接続を試みています... (3回のリトライをシミュレート)
      let step = 1;
      let dotCount = 1;
      let qCount = 1;

      const interval = setInterval(() => {
        if (step === 1) {
          dotCount = (dotCount % 3) + 1;
          statusText.textContent = '接続を試みています' + '.'.repeat(dotCount);
          // 約2.4秒後に第2段階へ
        } else if (step === 2) {
          qCount = (qCount % 3) + 1;
          statusText.textContent = 'なにかがおかしいようです' + '?'.repeat(qCount);
          // 約2秒後に第3段階へ
        } else if (step === 3) {
          statusText.textContent = '申し訳ございません';
          // 約1.5秒後に最終503画面へ
        } else if (step === 4) {
          clearInterval(interval);
          contentBox.innerHTML = \`
            <div class="code">503 SERVICE UNAVAILABLE</div>
            <h1>サーバーが存在しません</h1>
            <p>The <b>Osaka (Asia 2)</b> server is not a valid server for your region.</p>
            <div class="footer">
              東栄ポータル運営事務局<br />
              このメッセージはバックアップシステムからの自動送信です
            </div>
          \`;
        }
      }, 700);

      // ステップの進行タイマー
      setTimeout(() => { step = 2; }, 2100);
      setTimeout(() => { step = 3; }, 4200);
      setTimeout(() => { step = 4; }, 5800);
    })();
  </script>
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
