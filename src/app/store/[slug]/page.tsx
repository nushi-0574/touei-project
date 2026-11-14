'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Header from '../../components/Header';
import Breadcrumbs from '../../components/Breadcrumbs';
import { ContentSkeleton } from '@/src/app/components/LoadingScreen';
import { supabase } from '../../../lib/supabase';
import { getErrorMessage } from '../../../lib/errors';
import { ShoppingBag, Music, ShieldCheck, ArrowLeft } from 'lucide-react';

type DigitalProduct = {
  id: string;
  title: string;
  slug: string;
  description: string;
  price_amount: number;
  currency: string;
  billing_type: 'one_time' | 'subscription';
  preview_audio_path: string | null;
  created_at: string;
};

export default function ProductDetailPage() {
  const params = useParams();
  const slug = params.slug as string;
  const router = useRouter();

  const [product, setProduct] = useState<DigitalProduct | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let active = true;

    async function loadProduct() {
      try {
        const { data, error } = await supabase
          .from('digital_products')
          .select('*')
          .eq('slug', slug)
          .eq('is_published', true)
          .maybeSingle();

        if (error) throw error;
        if (!active) return;
        if (!data) {
          setErrorMessage('指定された商品は存在しないか公開されていません。');
          return;
        }

        const item = data as DigitalProduct;
        setProduct(item);

        if (item.preview_audio_path) {
          const { data: signed } = await supabase.storage
            .from('digital-product-previews')
            .createSignedUrl(item.preview_audio_path, 3600);
          if (signed?.signedUrl && active) {
            setPreviewUrl(signed.signedUrl);
          }
        }
      } catch (err) {
        console.error('商品詳細の取得に失敗しました:', err);
        if (active) setErrorMessage('商品情報を読み込めませんでした。');
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadProduct();
    return () => {
      active = false;
    };
  }, [slug]);

  const handleCheckout = async () => {
    if (!product) return;
    setPurchasing(true);
    setErrorMessage('');
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!session) {
        router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`);
        return;
      }

      const response = await fetch('/api/store/checkout', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ productId: product.id }),
      });

      const payload = await response.json() as { url?: string; error?: string };
      if (!response.ok || !payload.url) {
        throw new Error(payload.error || '決済セッションを作成できませんでした。');
      }

      window.location.assign(payload.url);
    } catch (err) {
      console.error('Checkout error:', err);
      setErrorMessage(getErrorMessage(err, '決済画面を開けませんでした。'));
      setPurchasing(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-950 flex flex-col font-sans">
      <Header />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 flex-1 w-full space-y-6">
        <Breadcrumbs items={[
          { label: 'デジタル商品ストア', href: '/store' },
          { label: product?.title || '商品詳細' }
        ]} />

        {loading ? (
          <ContentSkeleton rows={3} />
        ) : errorMessage ? (
          <div className="bg-red-50 border border-red-200 p-6 rounded-sm text-xs font-bold text-red-900 space-y-3">
            <p>{errorMessage}</p>
            <Link href="/store" className="inline-block text-blue-700 underline">
              ← ストア一覧へ戻る
            </Link>
          </div>
        ) : product ? (
          <div className="bg-white border border-slate-300 rounded-sm p-8 space-y-6">
            <div className="border-b border-slate-200 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="bg-slate-100 text-slate-800 border border-slate-200 px-2.5 py-0.5 text-xs font-mono font-bold mb-2 inline-block">
                  {product.billing_type === 'subscription' ? '月額サブスクリプション' : '単品買い切り商品'}
                </span>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                  {product.title}
                </h1>
              </div>
              <div className="text-right">
                <span className="text-2xl font-bold font-mono tabular-nums text-slate-900">
                  ¥{product.price_amount.toLocaleString()}
                </span>
                <span className="text-xs text-slate-500 block font-normal">
                  ({product.currency.toUpperCase()})
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">商品詳細説明</h2>
              <p className="text-xs sm:text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                {product.description}
              </p>
            </div>

            {/* 音声プレビュープレイヤー（ダウンロード不可） */}
            {previewUrl && (
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-sm space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                  <Music className="w-4 h-4 text-[#0046ff]" />
                  <span>音声サンプル試聴（ダウンロード不可プレビュー）</span>
                </div>
                <audio
                  controls
                  controlsList="nodownload"
                  onContextMenu={(e) => e.preventDefault()}
                  src={previewUrl}
                  className="w-full h-10"
                  preload="metadata"
                />
              </div>
            )}

            <div className="border-t border-slate-200 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-xs text-slate-600 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-700" />
                <span>決済完了後、即座にデジタルライブラリへ追加・ダウンロード可能になります。</span>
              </div>

              <button
                type="button"
                disabled={purchasing}
                onClick={handleCheckout}
                className="w-full sm:w-auto px-8 py-3 bg-[#0046ff] hover:bg-blue-700 text-white font-bold text-xs rounded-sm transition-colors shadow-none disabled:opacity-50 min-h-[44px] flex items-center justify-center gap-2"
              >
                <ShoppingBag className="w-4 h-4" />
                <span>{purchasing ? 'Stripe決済準備中...' : 'Stripeで今すぐ購入'}</span>
              </button>
            </div>

            <div className="pt-4 border-t border-slate-200">
              <Link href="/store" className="text-xs font-bold text-[#0046ff] hover:underline inline-flex items-center gap-1">
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>デジタル商品ストアへ戻る</span>
              </Link>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}
