'use client';

import { useState, useEffect } from 'react';
import Header from '../components/Header';
import Toast from '../components/Toast';
import { supabase } from '../../lib/supabase';

type NewsItem = { id: number; date_str: string; title: string; link_url: string; category: string; };
type ExamResultItem = { id: number; exam_number: string; name: string; birth_date: string; result: string; exam_name: string; };
type CustomPageItem = { id: string; slug: string; title: string; content: string; is_published: boolean; };
type MenuCardItem = { id: string; title: string; description: string; link_url: string; display_order: number; is_visible: boolean; };

export default function AdminPage() {
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // 1. サイト緊急情報
  const [emergencyText, setEmergencyText] = useState('');
  const [isEmergencyActive, setIsEmergencyActive] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // 2. 新着情報一覧
  const [newsList, setNewsList] = useState<NewsItem[]>([]);
  const [newDate, setNewDate] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newLink, setNewLink] = useState('');
  const [newCategory, setNewCategory] = useState('お知らせ');

  // 3. 警察官採用試験
  const [examResultsList, setExamResultsList] = useState<ExamResultItem[]>([]);

  // 4. カスタムページ管理ステート
  const [customPages, setCustomPages] = useState<CustomPageItem[]>([]);
  const [pageSlug, setPageSlug] = useState('');
  const [pageTitle, setPageTitle] = useState('');
  const [pageContent, setPageContent] = useState('');
  const [editingPageId, setEditingPageId] = useState<string | null>(null);

  // 5. メインメニューカード管理ステート
  const [menuCards, setMenuCards] = useState<MenuCardItem[]>([]);
  const [cardTitle, setCardTitle] = useState('');
  const [cardDesc, setCardDesc] = useState('');
  const [cardLink, setCardLink] = useState('');
  const [cardOrder, setCardOrder] = useState('0');
  const [editingCardId, setEditingCardId] = useState<string | null>(null);

  useEffect(() => {
    checkUserAndFetchData();
  }, []);

  const checkUserAndFetchData = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setIsAuthenticated(false);
        setLoading(false);
        return;
      }
      setIsAuthenticated(true);

      // 全設定・データの並行取得
      const [settingRes, newsRes, examRes, pagesRes, cardsRes] = await Promise.all([
        supabase.from('site_settings').select('*').eq('id', 1).maybeSingle(),
        supabase.from('news_items').select('*').order('id', { ascending: false }),
        supabase.from('police_exam_results').select('*').order('id', { ascending: false }),
        supabase.from('custom_pages').select('*').order('created_at', { ascending: false }),
        supabase.from('main_menu_cards').select('*').order('display_order', { ascending: true }),
      ]);

      if (settingRes.data) {
        setEmergencyText(settingRes.data.emergency_text || '');
        setIsEmergencyActive(settingRes.data.is_emergency_active || false);
      }
      if (newsRes.data) setNewsList(newsRes.data);
      if (examRes.data) setExamResultsList(examRes.data);
      if (pagesRes.data) setCustomPages(pagesRes.data);
      if (cardsRes.data) setMenuCards(cardsRes.data);

    } catch (err) {
      console.error('データ取得エラー:', err);
    } finally {
      setLoading(false);
    }
  };

  // --- カスタムページの保存 / 更新 ---
  const handleSaveCustomPage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pageSlug.trim() || !pageTitle.trim()) {
      setToast({ message: 'URLスラッグとタイトルを入力してください。', type: 'error' });
      return;
    }

    try {
      if (editingPageId) {
        const { error } = await supabase
          .from('custom_pages')
          .update({ slug: pageSlug.trim(), title: pageTitle.trim(), content: pageContent, updated_at: new Date().toISOString() })
          .eq('id', editingPageId);
        if (error) throw error;
        setToast({ message: 'ページを更新しました。', type: 'success' });
      } else {
        const { error } = await supabase
          .from('custom_pages')
          .insert([{ slug: pageSlug.trim(), title: pageTitle.trim(), content: pageContent }]);
        if (error) throw error;
        setToast({ message: '新しいページを作成しました。', type: 'success' });
      }

      setPageSlug('');
      setPageTitle('');
      setPageContent('');
      setEditingPageId(null);
      checkUserAndFetchData();
    } catch (err: any) {
      setToast({ message: 'ページの保存に失敗しました: ' + err.message, type: 'error' });
    }
  };

  const handleDeletePage = async (id: string) => {
    if (!confirm('このページを削除しますか？')) return;
    try {
      const { error } = await supabase.from('custom_pages').delete().eq('id', id);
      if (error) throw error;
      setCustomPages(customPages.filter((p) => p.id !== id));
      setToast({ message: 'ページを削除しました。', type: 'success' });
    } catch (err: any) {
      setToast({ message: '削除に失敗しました: ' + err.message, type: 'error' });
    }
  };

  const handleEditPageClick = (page: CustomPageItem) => {
    setEditingPageId(page.id);
    setPageSlug(page.slug);
    setPageTitle(page.title);
    setPageContent(page.content || '');
  };

  // --- メインメニューカードの保存 / 更新 ---
  const handleSaveMenuCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cardTitle.trim() || !cardLink.trim()) {
      setToast({ message: 'カードタイトルと遷移先URLを入力してください。', type: 'error' });
      return;
    }

    try {
      const orderVal = parseInt(cardOrder, 10) || 0;
      if (editingCardId) {
        const { error } = await supabase
          .from('main_menu_cards')
          .update({ title: cardTitle.trim(), description: cardDesc.trim(), link_url: cardLink.trim(), display_order: orderVal })
          .eq('id', editingCardId);
        if (error) throw error;
        setToast({ message: 'メニューカードを更新しました。', type: 'success' });
      } else {
        const { error } = await supabase
          .from('main_menu_cards')
          .insert([{ title: cardTitle.trim(), description: cardDesc.trim(), link_url: cardLink.trim(), display_order: orderVal }]);
        if (error) throw error;
        setToast({ message: 'メニューカードを追加しました。', type: 'success' });
      }

      setCardTitle('');
      setCardDesc('');
      setCardLink('');
      setCardOrder('0');
      setEditingCardId(null);
      checkUserAndFetchData();
    } catch (err: any) {
      setToast({ message: 'カードの保存に失敗しました: ' + err.message, type: 'error' });
    }
  };

  const handleDeleteCard = async (id: string) => {
    if (!confirm('このメニューカードを削除しますか？')) return;
    try {
      const { error } = await supabase.from('main_menu_cards').delete().eq('id', id);
      if (error) throw error;
      setMenuCards(menuCards.filter((c) => c.id !== id));
      setToast({ message: 'メニューカードを削除しました。', type: 'success' });
    } catch (err: any) {
      setToast({ message: '削除に失敗しました: ' + err.message, type: 'error' });
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col font-sans">
      <Header />

      <main className="flex-1 max-w-5xl mx-auto px-4 sm:px-6 py-8 w-full space-y-8">
        <div className="border-b border-slate-300 pb-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900 border-l-4 border-slate-800 pl-3">
              東栄ポータル 統合管理パネル
            </h1>
            <p className="text-xs text-slate-600 mt-1">
              緊急通知、新着情報、ページ追加・更新、メニューカードの並び替え・編集を行います。
            </p>
          </div>
          <span className={`px-3 py-1 rounded text-xs font-semibold ${isAuthenticated ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-amber-100 text-amber-800 border border-amber-300'}`}>
            {isAuthenticated ? '管理者認証済み' : '未認証'}
          </span>
        </div>

        {loading ? (
          <div className="bg-white border border-slate-300 rounded p-8 text-center text-xs text-slate-500">
            データを読み込み中...
          </div>
        ) : !isAuthenticated ? (
          <div className="bg-white border border-slate-300 rounded p-8 text-center space-y-4">
            <p className="text-xs text-red-600 font-bold">管理者権限が必要です。ログインを行ってください。</p>
            <a href="/toeiken" className="inline-block px-4 py-2 bg-[#5865F2] text-white text-xs font-semibold rounded shadow">
              認証ページへ移動
            </a>
          </div>
        ) : (
          <div className="space-y-8">
            {/* メインメニュー（カード・ページ遷移・表示順）管理 */}
            <section className="bg-white border border-slate-300 rounded shadow-sm p-6">
              <h2 className="text-sm font-bold text-slate-900 border-b border-slate-200 pb-2 mb-4">
                [ メインメニューカード・並び替え管理 ]
              </h2>

              <form onSubmit={handleSaveMenuCard} className="bg-slate-50 border border-slate-200 rounded p-4 mb-6 space-y-3 text-xs">
                <h3 className="font-bold text-slate-800">
                  {editingCardId ? 'メニューカードの編集' : '新規メニューカードの追加'}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-semibold mb-1">カードタイトル</label>
                    <input type="text" value={cardTitle} onChange={(e) => setCardTitle(e.target.value)} placeholder="例: 住民ポータル" className="w-full px-3 py-1.5 border border-slate-300 rounded" />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">遷移先URL</label>
                    <input type="text" value={cardLink} onChange={(e) => setCardLink(e.target.value)} placeholder="例: /toeiken または /pages/about" className="w-full px-3 py-1.5 border border-slate-300 rounded" />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">表示順（数字が小さいほど先頭）</label>
                    <input type="number" value={cardOrder} onChange={(e) => setCardOrder(e.target.value)} className="w-full px-3 py-1.5 border border-slate-300 rounded" />
                  </div>
                </div>
                <div>
                  <label className="block font-semibold mb-1">カードの説明文</label>
                  <input type="text" value={cardDesc} onChange={(e) => setCardDesc(e.target.value)} placeholder="簡単な概要説明" className="w-full px-3 py-1.5 border border-slate-300 rounded" />
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  {editingCardId && (
                    <button type="button" onClick={() => { setEditingCardId(null); setCardTitle(''); setCardDesc(''); setCardLink(''); }} className="px-3 py-1.5 border border-slate-300 bg-white rounded">
                      キャンセル
                    </button>
                  )}
                  <button type="submit" className="px-4 py-1.5 bg-blue-700 hover:bg-blue-600 text-white font-bold rounded">
                    {editingCardId ? '変更を保存' : 'カードを追加'}
                  </button>
                </div>
              </form>

              {/* カード一覧 */}
              <div className="border border-slate-200 rounded divide-y divide-slate-100 text-xs">
                {menuCards.map((card) => (
                  <div key={card.id} className="p-3 flex items-center justify-between gap-4">
                    <div>
                      <span className="font-mono bg-slate-200 px-2 py-0.5 rounded text-[10px] mr-2">順序: {card.display_order}</span>
                      <span className="font-bold text-slate-800 mr-2">{card.title}</span>
                      <span className="text-slate-500 font-mono text-[11px]">({card.link_url})</span>
                      <p className="text-slate-600 text-[11px] mt-0.5">{card.description}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => { setEditingCardId(card.id); setCardTitle(card.title); setCardDesc(card.description || ''); setCardLink(card.link_url); setCardOrder(String(card.display_order)); }} className="px-2.5 py-1 text-slate-700 border border-slate-300 bg-white rounded text-[11px]">編集</button>
                      <button onClick={() => handleDeleteCard(card.id)} className="px-2.5 py-1 text-red-600 border border-red-200 hover:bg-red-50 rounded text-[11px]">削除</button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* カスタムページ作成・編集機能 */}
            <section className="bg-white border border-slate-300 rounded shadow-sm p-6">
              <h2 className="text-sm font-bold text-slate-900 border-b border-slate-200 pb-2 mb-4">
                [ 新規ページの作成・編集・削除 ]
              </h2>

              <form onSubmit={handleSaveCustomPage} className="bg-slate-50 border border-slate-200 rounded p-4 mb-6 space-y-3 text-xs">
                <h3 className="font-bold text-slate-800">
                  {editingPageId ? 'ページの編集' : '新しいWebページの新規作成'}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold mb-1">URLスラッグ (英数字)</label>
                    <div className="flex items-center gap-1">
                      <span className="text-slate-500 font-mono text-[11px]">/pages/</span>
                      <input type="text" value={pageSlug} onChange={(e) => setPageSlug(e.target.value)} placeholder="about や guide など" className="w-full px-3 py-1.5 border border-slate-300 rounded font-mono" />
                    </div>
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">ページタイトル</label>
                    <input type="text" value={pageTitle} onChange={(e) => setPageTitle(e.target.value)} placeholder="例: 東栄県について" className="w-full px-3 py-1.5 border border-slate-300 rounded" />
                  </div>
                </div>
                <div>
                  <label className="block font-semibold mb-1">ページ本文（文章・説明）</label>
                  <textarea rows={6} value={pageContent} onChange={(e) => setPageContent(e.target.value)} placeholder="ページのコンテンツ本文を入力してください" className="w-full px-3 py-2 border border-slate-300 rounded font-sans" />
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  {editingPageId && (
                    <button type="button" onClick={() => { setEditingPageId(null); setPageSlug(''); setPageTitle(''); setPageContent(''); }} className="px-3 py-1.5 border border-slate-300 bg-white rounded">
                      キャンセル
                    </button>
                  )}
                  <button type="submit" className="px-4 py-1.5 bg-blue-700 hover:bg-blue-600 text-white font-bold rounded">
                    {editingPageId ? '変更を更新' : '新しいページを公開作成'}
                  </button>
                </div>
              </form>

              {/* 作成済みページ一覧 */}
              <div className="border border-slate-200 rounded divide-y divide-slate-100 text-xs">
                {customPages.map((page) => (
                  <div key={page.id} className="p-3 flex items-center justify-between gap-4">
                    <div>
                      <span className="font-mono bg-blue-50 text-blue-800 border border-blue-200 px-2 py-0.5 rounded text-[10px] mr-2">/pages/{page.slug}</span>
                      <span className="font-bold text-slate-800">{page.title}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <a href={`/pages/${page.slug}`} target="_blank" className="px-2.5 py-1 text-blue-600 border border-blue-200 hover:bg-blue-50 rounded text-[11px]">表示確認</a>
                      <button onClick={() => handleEditPageClick(page)} className="px-2.5 py-1 text-slate-700 border border-slate-300 bg-white rounded text-[11px]">編集</button>
                      <button onClick={() => handleDeletePage(page.id)} className="px-2.5 py-1 text-red-600 border border-red-200 hover:bg-red-50 rounded text-[11px]">削除</button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </main>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}