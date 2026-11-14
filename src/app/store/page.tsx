'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Header from '../components/Header';
import Breadcrumbs from '../components/Breadcrumbs';
import { ContentSkeleton } from '@/src/app/components/LoadingScreen';
import { supabase } from '../../lib/supabase';
import { ShoppingBag, Music, ChevronRight, ShieldCheck } from 'lucide-react';

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

export default function DigitalStorePage() {
  const [products, setProducts] = useState<DigitalProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    let active = true;

    async function loadProducts() {
      try {
        const { data, error } = await supabase
          .from('digital_products')
          .select('*')
          .eq('is_published', true)
          .order('created_at', { ascending: false });

        if (error) throw error;
        if (!active) return;
        const list = (data ?? []) as DigitalProduct[];
        setProducts(list);

        // 音声プレビュー用の署名付きURLを取得
        for (const p of list) {
          if (p.preview_audio_path) {
            const { data: signed } = await supabase.storage
              .from('digital-product-previews')
              .createSignedUrl(p.preview_audio_path, 3600);
            if (signed?.signedUrl && active) {
              setPreviewUrls((current) => ({ ...current, [p.id]: signed.signedUrl }));
            }
          }
        }
      } catch (err) {
        console.error('デジタル商品カタログの取得に失敗しました:', err);
        if (active) setErrorMessage('デジタル商品を読み込めませんでした。');
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadProducts();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="min-h-screen bg-white text-slate-950 flex flex-col font-sans">
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 flex-1 w-full space-y-6">
        <Breadcrumbs items={[{ label: 'デジタル商品ストア' }]} />

        {/* 7:3 非対称レイアウト */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8 items-start mt-4">

          {/* メインカタログエリア (7割) */}
          <div className="space-y-6">

            <section className="bg-slate-50 border border-slate-200 p-6 rounded-sm space-y-2">
              <span className="text-xs font-bold text-[#0046ff] bg-blue-50 border border-blue-200 px-2.5 py-0.5 inline-block">
                DIGITAL COMMERCE
              </span>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                デジタル商品・コンテンツストア
              </h1>
              <p className="text-[13px] text-slate-600 leading-relaxed">
                東栄県ポータルで提供する公式デジタル素材、ソフトウェアライセンス、音声データ等を直接ご購入いただけます。音声商品は試聴プレビューに対応しています。
              </p>
            </section>

            {errorMessage && (
              <p role="alert" className="border border-red-300 bg-red-50 p-3 text-xs font-bold text-red-900 rounded-sm">
                {errorMessage}
              </p>
            )}

            {loading ? (
              <ContentSkeleton rows={3} />
            ) : products.length === 0 ? (
              <div className="bg-slate-50 border border-slate-200 p-12 text-center rounded-sm text-xs text-slate-500 font-mono">
                現在、公開中のデジタル商品はございません。
              </div>
            ) : (
              <div className="space-y-4">
                {products.map((product) => (
                  <article
                    key={product.id}
                    className="bg-white border border-slate-200 p-6 rounded-sm space-y-4 hover:border-slate-400 transition-colors"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-slate-100 pb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="bg-slate-100 text-slate-800 border border-slate-200 px-2 py-0.5 text-[11px] font-mono font-bold">
                            {product.billing_type === 'subscription' ? '月額サブスクリプション' : '単品買い切り'}
                          </span>
                        </div>
                        <h2 className="text-base font-bold text-slate-900 tracking-tight">
                          <Link href={`/store/${product.slug}`} className="hover:text-[#0046ff] transition-colors">
                            {product.title}
                          </Link>
                        </h2>
                      </div>
                      <div className="text-right">
                        <span className="text-lg font-bold font-mono tabular-nums text-slate-900">
                          ¥{product.price_amount.toLocaleString()}
                        </span>
                        <span className="text-xs text-slate-500 block font-normal">
                          ({product.currency.toUpperCase()})
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-slate-600 leading-relaxed">
                      {product.description}
                    </p>

                    {/* 音声ファイルの商品プレビュー（ダウンロード不可） */}
                    {product.preview_audio_path && previewUrls[product.id] && (
                      <div className="bg-slate-50 border border-slate-200 p-3 rounded-sm space-y-1.5">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                          <Music className="w-4 h-4 text-[#0046ff]" />
                          <span>音声サンプル試聴（ダウンロード不可プレビュー）</span>
                        </div>
                        <audio
                          controls
                          controlsList="nodownload"
                          onContextMenu={(e) => e.preventDefault()}
                          src={previewUrls[product.id]}
                          className="w-full h-9"
                          preload="none"
                        />
                      </div>
                    )}

                    <div className="pt-2 flex justify-end">
                      <Link
                        href={`/store/${product.slug}`}
                        className="px-5 py-2.5 bg-[#0046ff] hover:bg-blue-700 text-white font-bold text-xs rounded-sm transition-colors inline-flex items-center gap-1.5 min-h-[40px]"
                      >
                        <ShoppingBag className="w-4 h-4" />
                        <span>商品詳細・購入手続きへ</span>
                        <ChevronRight className="w-4 h-4" />
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            )}

          </div>

          {/* 右側サイドバー (3割) */}
          <aside className="space-y-6">

            <div className="bg-white border border-slate-200 p-5 rounded-sm space-y-3 text-xs">
              <h3 className="font-bold text-slate-900 border-b border-slate-200 pb-2 tracking-tight flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-slate-700" />
                <span>安心のデジタル納品</span>
              </h3>
              <p className="text-slate-600 leading-relaxed">
                決済完了後、購入済み商品は「デジタルライブラリ」からいつでも安全にダウンロードいただけます。
              </p>
              <div className="pt-1">
                <Link href="/dashboard/library" className="text-[#0046ff] hover:underline font-bold block">
                  購入済みデジタルライブラリへ →
                </Link>
              </div>
            </div>

          </aside>

        </div>
      </main>
    </div>
  );
}
