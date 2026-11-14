'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Header from '../../components/Header';
import Breadcrumbs from '../../components/Breadcrumbs';
import { ContentSkeleton } from '@/src/app/components/LoadingScreen';
import { supabase } from '../../../lib/supabase';
import { getErrorMessage } from '../../../lib/errors';
import { Package, Plus, ShieldCheck, CheckCircle2, AlertCircle, Settings } from 'lucide-react';

type Product = {
  id: string;
  title: string;
  slug: string;
  description: string;
  price_amount: number;
  billing_type: string;
  is_published: boolean;
  created_at: string;
};

type Order = {
  id: string;
  order_number: string;
  amount_paid: number;
  status: string;
  created_at: string;
  user_id: string;
  product: { title: string } | null;
};

export default function AdminStorePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [notice, setNotice] = useState('');

  // サイト情報編集フォーム
  const [siteTitle, setSiteTitle] = useState('東栄ポータル');
  const [announcementText, setAnnouncementText] = useState('');
  const [supportEmail, setSupportEmail] = useState('');
  const [footerText, setFooterText] = useState('© 2026 Toei Portal All rights reserved.');

  // 商品登録フォーム
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [priceAmount, setPriceAmount] = useState('1000');
  const [billingType, setBillingType] = useState<'one_time' | 'subscription'>('one_time');
  const [isPublished, setIsPublished] = useState(true);
  const [contentFile, setContentFile] = useState<File | null>(null);
  const [previewAudioFile, setPreviewAudioFile] = useState<File | null>(null);

  useEffect(() => {
    let active = true;

    async function loadAdminStore() {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (!session) {
          window.location.href = '/login?next=/admin/store';
          return;
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('is_admin')
          .eq('id', session.user.id)
          .maybeSingle();

        if (!profile?.is_admin) {
          throw new Error('管理者権限が必要です。');
        }

        const [prodRes, ordRes, setRes] = await Promise.all([
          supabase.from('digital_products').select('*').order('created_at', { ascending: false }),
          supabase.from('digital_orders').select('id, order_number, amount_paid, status, created_at, user_id, product:product_id(title)').order('created_at', { ascending: false }).limit(50),
          supabase.from('site_settings').select('*').eq('id', 1).maybeSingle(),
        ]);

        if (prodRes.error) throw prodRes.error;
        if (ordRes.error) throw ordRes.error;

        if (active) {
          setProducts((prodRes.data ?? []) as Product[]);
          setOrders(((ordRes.data ?? []) as unknown as Array<{ id: string; order_number: string; amount_paid: number; status: string; created_at: string; user_id: string; product: { title: string } | { title: string }[] | null }>).map((o) => ({
            ...o,
            product: Array.isArray(o.product) ? o.product[0] ?? null : o.product,
          })));

          if (setRes.data) {
            setSiteTitle(setRes.data.site_title || '東栄ポータル');
            setAnnouncementText(setRes.data.announcement_text || '');
            setSupportEmail(setRes.data.support_email || '');
            setFooterText(setRes.data.footer_text || '© 2026 Toei Portal All rights reserved.');
          }
        }
      } catch (err) {
        console.error('管理者ストア情報の読み込みに失敗しました:', err);
        if (active) setErrorMessage(getErrorMessage(err, '管理データを読み込めませんでした。'));
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadAdminStore();
    return () => {
      active = false;
    };
  }, []);

  const handleSaveSiteSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    setErrorMessage('');
    setNotice('');
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!session) throw new Error('ログインしてください。');

      const response = await fetch('/api/admin/site-settings', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          site_title: siteTitle,
          announcement_text: announcementText,
          support_email: supportEmail,
          footer_text: footerText,
        }),
      });

      const payload = await response.json() as { success?: boolean; error?: string };
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || 'サイト情報の更新に失敗しました。');
      }

      setNotice('サイト基本情報を更新しました。');
      setTimeout(() => setNotice(''), 4000);
    } catch (err) {
      console.error('Site settings save error:', err);
      setErrorMessage(getErrorMessage(err, 'サイト情報の保存に失敗しました。'));
    } finally {
      setSavingSettings(false);
    }
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !slug.trim()) {
      setErrorMessage('商品名とURLスラッグは必須です。');
      return;
    }

    setSubmitting(true);
    setErrorMessage('');
    setNotice('');
    try {
      let filePath: string | null = null;
      let previewAudioPath: string | null = null;

      if (contentFile) {
        const ext = contentFile.name.split('.').pop() || 'zip';
        filePath = `products/${crypto.randomUUID()}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from('digital-product-contents')
          .upload(filePath, contentFile, { upsert: true });
        if (uploadErr) throw uploadErr;
      }

      if (previewAudioFile) {
        const ext = previewAudioFile.name.split('.').pop() || 'mp3';
        previewAudioPath = `previews/${crypto.randomUUID()}.${ext}`;
        const { error: audioErr } = await supabase.storage
          .from('digital-product-previews')
          .upload(previewAudioPath, previewAudioFile, { upsert: true });
        if (audioErr) throw audioErr;
      }

      const { data, error } = await supabase
        .from('digital_products')
        .insert({
          title: title.trim(),
          slug: slug.trim(),
          description: description.trim(),
          price_amount: Number(priceAmount) || 0,
          billing_type: billingType,
          is_published: isPublished,
          file_path: filePath,
          preview_audio_path: previewAudioPath,
        })
        .select('*')
        .single();

      if (error) throw error;

      setProducts((current) => [data as Product, ...current]);
      setTitle('');
      setSlug('');
      setDescription('');
      setContentFile(null);
      setPreviewAudioFile(null);
      setNotice('新しいデジタル商品を登録しました。');
      setTimeout(() => setNotice(''), 4000);
    } catch (err) {
      console.error('商品登録エラー:', err);
      setErrorMessage(getErrorMessage(err, '商品の登録に失敗しました。'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-950 flex flex-col font-sans">
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 flex-1 w-full space-y-6">
        <Breadcrumbs items={[
          { label: '管理者パネル', href: '/admin' },
          { label: 'デジタル商品・サイト管理' }
        ]} />

        {/* 7:3 非対称レイアウト */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-8 items-start mt-4">

          {/* メインエリア (7割): 商品一覧・取引履歴 */}
          <div className="space-y-6">

            <section className="bg-slate-50 border border-slate-200 p-6 rounded-sm space-y-2">
              <span className="text-xs font-bold text-[#0046ff] bg-blue-50 border border-blue-200 px-2.5 py-0.5 inline-block">
                MERCHANT ADMIN PANEL
              </span>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                デジタル商品・取引管理パネル
              </h1>
              <p className="text-[13px] text-slate-600 leading-relaxed">
                デジタル商品の追加・編集、試聴音声の設定、および顧客注文履歴の確認を行います。
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
            ) : (
              <div className="space-y-6">

                {/* 登録済み商品一覧 */}
                <section className="bg-white border border-slate-200 rounded-sm overflow-hidden text-xs">
                  <div className="bg-slate-900 text-white px-4 py-3 font-bold border-b border-slate-800 flex justify-between items-center">
                    <span>登録デジタル商品一覧 ({products.length}件)</span>
                    <span className="font-mono text-[11px] text-slate-300">CATALOG MASTER</span>
                  </div>

                  <div className="divide-y divide-slate-200">
                    {products.map((p) => (
                      <article key={p.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 text-[10px] font-bold ${p.is_published ? 'bg-emerald-100 text-emerald-900' : 'bg-slate-100 text-slate-700'}`}>
                              {p.is_published ? '公開中' : '非公開'}
                            </span>
                            <span className="font-mono text-slate-500 text-[11px]">slug: {p.slug}</span>
                          </div>
                          <h3 className="font-bold text-slate-900 text-sm">{p.title}</h3>
                          <p className="text-xs text-slate-600">{p.description}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-base font-bold font-mono tabular-nums text-slate-900 block">
                            ¥{p.price_amount.toLocaleString()}
                          </span>
                          <span className="text-[11px] text-slate-500">
                            {p.billing_type === 'subscription' ? '月額サブスク' : '単品買い切り'}
                          </span>
                        </div>
                      </article>
                    ))}
                    {!products.length && (
                      <p className="py-8 text-center text-xs text-slate-500 font-mono">登録されているデジタル商品はございません。</p>
                    )}
                  </div>
                </section>

                {/* 最近の取引注文履歴 */}
                <section className="bg-white border border-slate-200 rounded-sm overflow-hidden text-xs">
                  <div className="bg-slate-900 text-white px-4 py-3 font-bold border-b border-slate-800 flex justify-between items-center">
                    <span>最近のデジタル商品注文・取引履歴 ({orders.length}件)</span>
                    <span className="font-mono text-[11px] text-slate-300">STRIPE ORDERS</span>
                  </div>

                  <div className="divide-y divide-slate-200">
                    {orders.map((o) => (
                      <article key={o.id} className="p-3.5 flex flex-wrap items-center justify-between gap-3">
                        <div className="space-y-0.5">
                          <span className="font-mono text-[11px] text-slate-500 tabular-nums">注文番号: {o.order_number}</span>
                          <p className="font-bold text-slate-900">{o.product?.title || '削除された商品'}</p>
                          <p className="text-[11px] text-slate-500 font-mono">購入日時: {new Date(o.created_at).toLocaleString('ja-JP')}</p>
                        </div>
                        <div className="text-right">
                          <span className="font-mono font-bold text-slate-900 text-sm tabular-nums block">
                            ¥{o.amount_paid.toLocaleString()}
                          </span>
                          <span className="bg-emerald-100 text-emerald-900 px-2 py-0.5 text-[10px] font-bold">
                            {o.status}
                          </span>
                        </div>
                      </article>
                    ))}
                    {!orders.length && (
                      <p className="py-8 text-center text-xs text-slate-500 font-mono">取引履歴はまだありません。</p>
                    )}
                  </div>
                </section>

              </div>
            )}

          </div>

          {/* 右側サイドバー (3割): 新規商品登録 ＆ サイト情報編集 */}
          <aside className="space-y-6">

            {/* サイト情報編集フォーム */}
            <div className="bg-white border border-slate-200 p-5 rounded-sm space-y-4 text-xs">
              <div className="border-b border-slate-200 pb-2">
                <h2 className="font-bold text-slate-900 text-sm tracking-tight flex items-center gap-1.5">
                  <Settings className="w-4 h-4 text-slate-700" />
                  <span>サイト情報・基本設定編集</span>
                </h2>
              </div>

              <form onSubmit={handleSaveSiteSettings} className="space-y-3">
                <div>
                  <label className="block font-semibold text-slate-800 mb-1">サイトタイトル</label>
                  <input
                    type="text"
                    value={siteTitle}
                    onChange={(e) => setSiteTitle(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-sm bg-white text-xs"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-800 mb-1">トップお知らせ文言</label>
                  <textarea
                    rows={2}
                    value={announcementText}
                    onChange={(e) => setAnnouncementText(e.target.value)}
                    placeholder="お知らせ情報"
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-sm bg-white text-xs"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-800 mb-1">サポート連絡先メール</label>
                  <input
                    type="email"
                    value={supportEmail}
                    onChange={(e) => setSupportEmail(e.target.value)}
                    placeholder="support@example.com"
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-sm bg-white text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-800 mb-1">フッターコピーライト</label>
                  <input
                    type="text"
                    value={footerText}
                    onChange={(e) => setFooterText(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-sm bg-white text-xs"
                  />
                </div>

                <button
                  type="submit"
                  disabled={savingSettings}
                  className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-sm transition-colors disabled:opacity-50 min-h-[38px]"
                >
                  {savingSettings ? '保存中...' : 'サイト情報を保存'}
                </button>
              </form>
            </div>

            {/* 新規商品登録フォーム */}
            <div className="bg-white border border-slate-200 p-5 rounded-sm space-y-4 text-xs">
              <div className="border-b border-slate-200 pb-2">
                <h2 className="font-bold text-slate-900 text-sm tracking-tight flex items-center gap-1.5">
                  <Plus className="w-4 h-4 text-[#0046ff]" />
                  <span>新規デジタル商品追加</span>
                </h2>
              </div>

              <form onSubmit={handleCreateProduct} className="space-y-3">
                <div>
                  <label className="block font-semibold text-slate-800 mb-1">商品タイトル <span className="text-red-700">*</span></label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="例: 東栄県警 警察無線音源アーカイブ ZIP"
                    className="w-full px-3 py-2 border border-slate-300 rounded-sm bg-white text-xs"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-800 mb-1">URLスラッグ <span className="text-red-700">*</span></label>
                  <input
                    type="text"
                    required
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    placeholder="例: police-radio-archive"
                    className="w-full px-3 py-2 border border-slate-300 rounded-sm bg-white text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-800 mb-1">商品説明文</label>
                  <textarea
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="商品の仕様や内容量を記載"
                    className="w-full px-3 py-2 border border-slate-300 rounded-sm bg-white text-xs"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-semibold text-slate-800 mb-1">価格 (円) <span className="text-red-700">*</span></label>
                    <input
                      type="number"
                      required
                      min="0"
                      value={priceAmount}
                      onChange={(e) => setPriceAmount(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-sm bg-white text-xs font-mono tabular-nums"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-800 mb-1">販売形態</label>
                    <select
                      value={billingType}
                      onChange={(e) => setBillingType(e.target.value as 'one_time' | 'subscription')}
                      className="w-full px-3 py-2 border border-slate-300 rounded-sm bg-white text-xs"
                    >
                      <option value="one_time">単品買い切り</option>
                      <option value="subscription">月額サブスク</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-800 mb-1">本コンテンツ納品ファイル (ZIP等)</label>
                  <input
                    type="file"
                    onChange={(e) => setContentFile(e.target.files?.[0] ?? null)}
                    className="block w-full text-xs text-slate-600 file:mr-2 file:py-1 file:px-2 file:rounded-sm file:border-0 file:bg-slate-100 file:font-semibold"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-800 mb-1">試聴用音声ファイル (MP3等 / プレビュー用)</label>
                  <input
                    type="file"
                    accept="audio/*"
                    onChange={(e) => setPreviewAudioFile(e.target.files?.[0] ?? null)}
                    className="block w-full text-xs text-slate-600 file:mr-2 file:py-1 file:px-2 file:rounded-sm file:border-0 file:bg-slate-100 file:font-semibold"
                  />
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="is-published"
                    checked={isPublished}
                    onChange={(e) => setIsPublished(e.target.checked)}
                  />
                  <label htmlFor="is-published" className="font-semibold text-slate-800 text-xs">今すぐストアに公開する</label>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-2.5 bg-[#0046ff] hover:bg-blue-700 text-white font-bold text-xs rounded-sm transition-colors disabled:opacity-50 min-h-[40px]"
                >
                  {submitting ? '登録中...' : 'デジタル商品を追加'}
                </button>
              </form>
            </div>

            <div className="bg-slate-50 border border-slate-200 p-4 rounded-sm text-xs">
              <Link href="/admin" className="font-bold text-[#0046ff] hover:underline block">
                ← 管理者パネルへ戻る
              </Link>
            </div>

          </aside>

        </div>
      </main>
    </div>
  );
}
