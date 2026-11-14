'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Header from '../../components/Header';
import Breadcrumbs from '../../components/Breadcrumbs';
import { ContentSkeleton } from '@/src/app/components/LoadingScreen';
import { supabase } from '../../../lib/supabase';
import { getErrorMessage } from '../../../lib/errors';
import { Download, ShoppingBag, ShieldCheck, ArrowLeft, Package } from 'lucide-react';

type PurchasedOrder = {
  id: string;
  order_number: string;
  amount_paid: number;
  created_at: string;
  product: {
    id: string;
    title: string;
    slug: string;
    description: string;
  } | {
    id: string;
    title: string;
    slug: string;
    description: string;
  }[] | null;
};

export default function CustomerLibraryPage() {
  const [orders, setOrders] = useState<PurchasedOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let active = true;

    async function loadLibrary() {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (!session) {
          window.location.href = '/login?next=/dashboard/library';
          return;
        }

        const { data, error } = await supabase
          .from('digital_orders')
          .select(`
            id,
            order_number,
            amount_paid,
            created_at,
            product:product_id (
              id,
              title,
              slug,
              description
            )
          `)
          .eq('user_id', session.user.id)
          .eq('status', 'completed')
          .order('created_at', { ascending: false });

        if (error) throw error;
        if (active) {
          setOrders((data ?? []) as PurchasedOrder[]);
        }
      } catch (err) {
        console.error('購入ライブラリの取得に失敗しました:', err);
        if (active) setErrorMessage('購入済みデジタル商品の取得に失敗しました。');
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadLibrary();
    return () => {
      active = false;
    };
  }, []);

  const handleDownload = async (productId: string, title: string) => {
    setDownloadingId(productId);
    setErrorMessage('');
    setNotice('');
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!session) throw new Error('ログインしてください。');

      const response = await fetch('/api/store/download', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ productId }),
      });

      const payload = await response.json() as { downloadUrl?: string; error?: string };
      if (!response.ok || !payload.downloadUrl) {
        throw new Error(payload.error || 'ダウンロードリンクを取得できませんでした。');
      }

      const anchor = document.createElement('a');
      anchor.href = payload.downloadUrl;
      anchor.download = `${title}.zip`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);

      setNotice(`「${title}」の安全なダウンロードを開始しました。`);
      setTimeout(() => setNotice(''), 4000);
    } catch (err) {
      console.error('Download error:', err);
      setErrorMessage(getErrorMessage(err, 'ファイルをダウンロードできませんでした。'));
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-950 flex flex-col font-sans">
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 flex-1 w-full space-y-6">
        <Breadcrumbs items={[
          { label: 'メインメニュー', href: '/dashboard' },
          { label: 'デジタルライブラリ' }
        ]} />

        {/* 7:3 非対称レイアウト */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8 items-start mt-4">

          {/* メインエリア (7割) */}
          <div className="space-y-6">

            <section className="bg-slate-50 border border-slate-200 p-6 rounded-sm space-y-2">
              <span className="text-xs font-bold text-[#0046ff] bg-blue-50 border border-blue-200 px-2.5 py-0.5 inline-block">
                CUSTOMER DIGITAL LIBRARY
              </span>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                購入済みデジタルライブラリ
              </h1>
              <p className="text-[13px] text-slate-600 leading-relaxed">
                これまでに決済・購入されたすべてのデジタル商品およびダウンロードファイルを安全に管理・取得できます。
              </p>
            </section>

            {errorMessage && (
              <p role="alert" className="border border-red-300 bg-red-50 p-3 text-xs font-bold text-red-900 rounded-sm">
                {errorMessage}
              </p>
            )}

            {notice && (
              <p role="status" className="border border-emerald-300 bg-emerald-50 p-3 text-xs font-bold text-emerald-900 rounded-sm">
                {notice}
              </p>
            )}

            {loading ? (
              <ContentSkeleton rows={3} />
            ) : orders.length === 0 ? (
              <div className="bg-slate-50 border border-slate-200 p-12 text-center rounded-sm text-xs text-slate-500 font-mono space-y-3">
                <p>現在、購入済みのデジタル商品はございません。</p>
                <Link href="/store" className="inline-block px-4 py-2 bg-[#0046ff] text-white font-bold rounded-sm">
                  デジタルストアを見る
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {orders.map((order) => {
                  const product = Array.isArray(order.product) ? order.product[0] : order.product;
                  if (!product) return null;
                  return (
                    <article
                      key={order.id}
                      className="bg-white border border-slate-200 p-6 rounded-sm space-y-3"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                        <div className="space-y-1">
                          <span className="font-mono text-[11px] text-slate-500 tabular-nums">
                            注文番号: {order.order_number} (購入日: {new Date(order.created_at).toLocaleString('ja-JP')})
                          </span>
                          <h2 className="text-base font-bold text-slate-900 tracking-tight">
                            {product.title}
                          </h2>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-bold font-mono tabular-nums text-slate-900">
                            ¥{order.amount_paid.toLocaleString()} 決済済
                          </span>
                        </div>
                      </div>

                      <p className="text-xs text-slate-600 leading-relaxed">
                        {product.description}
                      </p>

                      <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
                        <Link
                          href={`/store/${product.slug}`}
                          className="text-xs font-bold text-[#0046ff] hover:underline"
                        >
                          商品ページを表示 →
                        </Link>

                        <button
                          type="button"
                          disabled={downloadingId === product.id}
                          onClick={() => handleDownload(product.id, product.title)}
                          className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-sm transition-colors inline-flex items-center gap-1.5 disabled:opacity-50 min-h-[40px]"
                        >
                          <Download className="w-4 h-4 text-emerald-400" />
                          <span>{downloadingId === product.id ? '署名付きURL発行中...' : '安全にファイルをダウンロード'}</span>
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}

          </div>

          {/* 右側サイドバー (3割) */}
          <aside className="space-y-6">

            <div className="bg-white border border-slate-200 p-5 rounded-sm space-y-3 text-xs">
              <h3 className="font-bold text-slate-900 border-b border-slate-200 pb-2 tracking-tight flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-700" />
                <span>セキュリティ保護</span>
              </h3>
              <p className="text-slate-600 leading-relaxed">
                ダウンロードリンクはご購入者様本人専用の一時的な署名付きURLとして発行されます。
              </p>
              <div className="pt-1">
                <Link href="/store" className="text-[#0046ff] hover:underline font-bold block">
                  ← デジタルストアに戻る
                </Link>
              </div>
            </div>

          </aside>

        </div>
      </main>
    </div>
  );
}
