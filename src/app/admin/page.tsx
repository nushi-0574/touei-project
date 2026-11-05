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

  // 2. 新着情報一覧
  const [newsList, setNewsList] = useState<NewsItem[]>([]);

  // 3. 警察官採用試験 合否データ管理ステート
  const [examResultsList, setExamResultsList] = useState<ExamResultItem[]>([]);
  const [examNumber, setExamNumber] = useState('');
  const [examName, setExamName] = useState('令和8年度 東栄県警察官採用試験');
  const [examFullName, setExamFullName] = useState('');
  const [examBirthDate, setExamBirthDate] = useState('2000-04-01');
  const [examResult, setExamResult] = useState('合格');
  const [editingExamId, setEditingExamId] = useState<number | null>(null);

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
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        setIsAuthenticated(false);
        setLoading(false);
        return;
      }
      setIsAuthenticated(true);

      // 各テーブルから安全にデータを取得（エラーが発生しても全体がクラッシュしないように個別catch）
      const [newsRes, examRes, pagesRes, cardsRes] = await Promise.all([
        supabase.from('news_items').select('*').order('id', { ascending: false }),
        supabase.from('police_exam_results').select('*').order('id', { ascending: false }),
        supabase.from('custom_pages').select('*').order('created_at', { ascending: false }),
        supabase.from('main_menu_cards').select('*').order('display_order', { ascending: true }),
      ]);

      if (newsRes.data) setNewsList(newsRes.data);
      if (examRes.data) setExamResultsList(examRes.data);
      if (pagesRes.data) setCustomPages(pagesRes.data);
      if (cardsRes.data) setMenuCards(cardsRes.data);

    } catch (err) {
      console.error('データ取得エラー:', err);
      setToast({ message: 'データの取得中にエラーが発生しました。', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // --- 警察官採用試験 合否データの保存 / 更新 ---
  const handleSaveExamResult = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!examNumber.trim() || !examFullName.trim()) {
      setToast({ message: '受験番号と氏名を入力してください。', type: 'error' });
      return;
    }

    try {
      if (editingExamId !== null) {
        const { error } = await supabase
          .from('police_exam_results')
          .update({
            exam_number: examNumber.trim(),
            exam_name: examName.trim(),
            name: examFullName.trim(),
            birth_date: examBirthDate,
            result: examResult.trim(),
          })
          .eq('id', editingExamId);

        if (error) throw error;
        setToast({ message: '合否データを更新しました。', type: 'success' });
      } else {
        const { error } = await supabase
          .from('police_exam_results')
          .insert([{
            exam_number: examNumber.trim(),
            exam_name: examName.trim(),
            name: examFullName.trim(),
            birth_date: examBirthDate,
            result: examResult.trim(),
          }]);

        if (error) throw error;
        setToast({ message: '合否データを新しく登録しました。', type: 'success' });
      }

      setExamNumber('');
      setExamFullName('');
      setEditingExamId(null);
      checkUserAndFetchData();
    } catch (err: any) {
      setToast({ message: '合否データの保存に失敗しました: ' + err.message, type: 'error' });
    }
  };

  const handleEditExamClick = (item: ExamResultItem) => {
    setEditingExamId(item.id);
    setExamNumber(item.exam_number);
    setExamName(item.exam_name || '令和8年度 東栄県警察官採用試験');
    setExamFullName(item.name);
    setExamBirthDate(item.birth_date || '2000-04-01');
    setExamResult(item.result || '合格');
  };

  const handleDeleteExam = async (id: number) => {
    if (!confirm('この合否データを削除しますか？')) return;
    try {
      const { error } = await supabase.from('police_exam_results').delete().eq('id', id);
      if (error) throw error;
      setExamResultsList(examResultsList.filter((item) => item.id !== id));
      setToast({ message: '合否データを削除しました。', type: 'success' });
    } catch (err: any) {
      setToast({ message: '削除に失敗しました: ' + err.message, type: 'error' });
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
              警察官採用試験合否、ページ作成、メニューカードの並び替え・編集を行います。
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
            {/* 1. 警察官採用試験 合否データ管理セクション */}
            <section className="bg-white border border-slate-300 rounded shadow-sm p-6">
              <h2 className="text-sm font-bold text-slate-900 border-b border-slate-200 pb-2 mb-4">
                [ 警察官採用試験 合否データの登録・変更 ]
              </h2>

              <form onSubmit={handleSaveExamResult} className="bg-slate-50 border border-slate-200 rounded p-4 mb-6 space-y-3 text-xs">
                <h3 className="font-bold text-slate-800">
                  {editingExamId !== null ? '合否データの編集' : '新規受験者の合否登録'}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold mb-1">試験名</label>
                    <input type="text" value={examName} onChange={(e) => setExamName(e.target.value)} placeholder="例: 令和8年度 東栄県警察官採用試験" className="w-full px-3 py-1.5 border border-slate-300 rounded" />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">受験番号</label>
                    <input type="text" value={examNumber} onChange={(e) => setExamNumber(e.target.value)} placeholder="例: P-2026-001" className="w-full px-3 py-1.5 border border-slate-300 rounded font-mono" />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">氏名</label>
                    <input type="text" value={examFullName} onChange={(e) => setExamFullName(e.target.value)} placeholder="例: 東栄 太郎" className="w-full px-3 py-1.5 border border-slate-300 rounded" />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">生年月日</label>
                    <input type="date" value={examBirthDate} onChange={(e) => setExamBirthDate(e.target.value)} className="w-full px-3 py-1.5 border border-slate-300 rounded" />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">合否結果</label>
                    <select value={examResult} onChange={(e) => setExamResult(e.target.value)} className="w-full px-3 py-1.5 border border-slate-300 rounded bg-white">
                      <option value="合格">合格</option>
                      <option value="不合格">不合格</option>
                      <option value="第一次合格">第一次合格</option>
                      <option value="最終合格">最終合格</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  {editingExamId !== null && (
                    <button type="button" onClick={() => { setEditingExamId(null); setExamNumber(''); setExamFullName(''); }} className="px-3 py-1.5 border border-slate-300 bg-white rounded">
                      キャンセル
                    </button>
                  )}
                  <button type="submit" className="px-4 py-1.5 bg-blue-700 hover:bg-blue-600 text-white font-bold rounded">
                    {editingExamId !== null ? '変更を保存' : '合否データを登録'}
                  </button>
                </div>
              </form>

              <div className="border border-slate-200 rounded divide-y divide-slate-100 text-xs overflow-x-auto">
                {examResultsList.length === 0 ? (
                  <p className="p-4 text-center text-slate-500">登録されている合否データはありません。</p>
                ) : (
                  examResultsList.map((item) => (
                    <div key={item.id} className="p-3 flex items-center justify-between gap-4 min-w-[500px]">
                      <div>
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-mono bg-slate-200 px-2 py-0.5 rounded text-[10px]">{item.exam_number}</span>
                          <span className="font-bold text-slate-800">{item.name}</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${item.result?.includes('合格') ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-red-100 text-red-800 border border-red-300'}`}>
                            {item.result}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500">生年月日: {item.birth_date} / 試験名: {item.exam_name}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => handleEditExamClick(item)} className="px-2.5 py-1 text-slate-700 border border-slate-300 bg-white rounded text-[11px]">編集</button>
                        <button onClick={() => handleDeleteExam(item.id)} className="px-2.5 py-1 text-red-600 border border-red-200 hover:bg-red-50 rounded text-[11px]">削除</button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            {/* 2. メインメニューカード管理 */}
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

            {/* 3. カスタムページ管理 */}
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