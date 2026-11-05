'use client';

import { useState, useEffect } from 'react';
import Header from '../components/Header';
import Toast from '../components/Toast';
import { supabase } from '../../lib/supabase';

type NewsItem = {
  id: number;
  date_str: string;
  title: string;
  link_url: string;
  category: string;
};

export default function AdminPage() {
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [loading, setLoading] = useState(true);

  // 1. サイト緊急情報の設定ステート
  const [emergencyText, setEmergencyText] = useState('');
  const [isEmergencyActive, setIsEmergencyActive] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // 2. 新着情報一覧 & 新規入力フォームのステート
  const [newsList, setNewsList] = useState<NewsItem[]>([]);
  const [newDate, setNewDate] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newLink, setNewLink] = useState('');
  const [newCategory, setNewCategory] = useState('お知らせ');
  const [isAddingNews, setIsAddingNews] = useState(false);

  // 初期データ取得
  useEffect(() => {
    fetchAdminData();
  }, []);

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      // サイト設定の取得
      const { data: settingData } = await supabase
        .from('site_settings')
        .select('*')
        .eq('id', 1)
        .single();

      if (settingData) {
        setEmergencyText(settingData.emergency_text || '');
        setIsEmergencyActive(settingData.is_emergency_active || false);
      }

      // 新着情報の取得
      const { data: newsData } = await supabase
        .from('news_items')
        .select('*')
        .order('id', { ascending: false });

      if (newsData) {
        setNewsList(newsData);
      }
    } catch (err) {
      setToast({ message: 'データの取得に失敗しました。', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // 緊急情報設定の保存
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);

    try {
      const { error } = await supabase
        .from('site_settings')
        .upsert({
          id: 1,
          emergency_text: emergencyText,
          is_emergency_active: isEmergencyActive,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;
      setToast({ message: '緊急情報設定を更新しました。', type: 'success' });
    } catch (err) {
      setToast({ message: '設定の保存に失敗しました。', type: 'error' });
    } finally {
      setIsSavingSettings(false);
    }
  };

  // 新着情報の追加
  const handleAddNews = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDate || !newTitle) {
      setToast({ message: '日付とタイトルを入力してください。', type: 'error' });
      return;
    }

    setIsAddingNews(true);

    try {
      const { data, error } = await supabase
        .from('news_items')
        .insert([
          {
            date_str: newDate,
            title: newTitle,
            link_url: newLink || '/toeiken',
            category: newCategory,
          },
        ])
        .select();

      if (error) throw error;

      if (data) {
        setNewsList([data[0], ...newsList]);
        setNewDate('');
        setNewTitle('');
        setNewLink('');
        setToast({ message: '新着情報を追加しました。', type: 'success' });
      }
    } catch (err) {
      setToast({ message: '新着情報の追加に失敗しました。', type: 'error' });
    } finally {
      setIsAddingNews(false);
    }
  };

  // 新着情報の削除
  const handleDeleteNews = async (id: number) => {
    if (!confirm('この新着情報を削除してもよろしいですか？')) return;

    try {
      const { error } = await supabase.from('news_items').delete().eq('id', id);
      if (error) throw error;

      setNewsList(newsList.filter((item) => item.id !== id));
      setToast({ message: '新着情報を削除しました。', type: 'success' });
    } catch (err) {
      setToast({ message: '削除に失敗しました。', type: 'error' });
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col font-sans">
      <Header />

      <main className="flex-1 max-w-5xl mx-auto px-4 sm:px-6 py-8 w-full space-y-8">
        <div className="border-b border-slate-300 pb-4">
          <h1 className="text-xl font-bold text-slate-900 border-l-4 border-slate-800 pl-3">
            東栄ポータル 統合管理パネル
          </h1>
          <p className="text-xs text-slate-600 mt-1">
            トップページに表示される各種情報およびコンテンツのリアルタイム編集を行います。
          </p>
        </div>

        {loading ? (
          <div className="bg-white border border-slate-300 rounded p-8 text-center text-xs text-slate-500">
            データを読み込み中...
          </div>
        ) : (
          <div className="space-y-8">
            {/* 1. 防災・緊急情報 設定セクション */}
            <section className="bg-white border border-slate-300 rounded shadow-sm p-6">
              <h2 className="text-sm font-bold text-slate-900 border-b border-slate-200 pb-2 mb-4 flex items-center justify-between">
                <span>[ 1 ] 防災・緊急情報バー設定</span>
                <span className="text-xs font-normal text-slate-500">トップページ最上部</span>
              </h2>

              <form onSubmit={handleSaveSettings} className="space-y-4">
                <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 p-3 rounded">
                  <input
                    type="checkbox"
                    id="emergency_active"
                    checked={isEmergencyActive}
                    onChange={(e) => setIsEmergencyActive(e.target.checked)}
                    className="w-4 h-4 text-red-600 border-slate-300 rounded focus:ring-red-500"
                  />
                  <label htmlFor="emergency_active" className="text-xs font-bold text-slate-800 cursor-pointer">
                    緊急情報バーを有効化してトップページに表示する
                  </label>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">表示メッセージ</label>
                  <input
                    type="text"
                    value={emergencyText}
                    onChange={(e) => setEmergencyText(e.target.value)}
                    placeholder="例: 現在、東栄県内における重大な警報・緊急情報はありません。"
                    className="w-full px-3 py-2 border border-slate-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-slate-500"
                  />
                </div>

                <div className="text-right">
                  <button
                    type="submit"
                    disabled={isSavingSettings}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded transition-colors disabled:opacity-50"
                  >
                    {isSavingSettings ? '保存中...' : '緊急情報の設定を保存'}
                  </button>
                </div>
              </form>
            </section>

            {/* 2. 新着情報 管理セクション */}
            <section className="bg-white border border-slate-300 rounded shadow-sm p-6">
              <h2 className="text-sm font-bold text-slate-900 border-b border-slate-200 pb-2 mb-4">
                [ 2 ] 新着情報・更新情報の投稿・管理
              </h2>

              {/* 追加フォーム */}
              <form onSubmit={handleAddNews} className="bg-slate-50 border border-slate-200 rounded p-4 mb-6 space-y-3">
                <h3 className="text-xs font-bold text-slate-800">新規お知らせの投稿</h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">日付表記</label>
                    <input
                      type="text"
                      value={newDate}
                      onChange={(e) => setNewDate(e.target.value)}
                      placeholder="例: 11月5日"
                      className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-slate-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">カテゴリ</label>
                    <select
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-slate-500"
                    >
                      <option value="お知らせ">お知らせ</option>
                      <option value="採用情報">採用情報</option>
                      <option value="住民サービス">住民サービス</option>
                      <option value="行政運営">行政運営</option>
                      <option value="緊急通知">緊急通知</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">リンク先URL (任意)</label>
                    <input
                      type="text"
                      value={newLink}
                      onChange={(e) => setNewLink(e.target.value)}
                      placeholder="/toeiken/police-result など"
                      className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-slate-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">タイトル</label>
                  <input
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="お知らせの件名を入力してください"
                    className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-slate-500"
                  />
                </div>

                <div className="text-right pt-1">
                  <button
                    type="submit"
                    disabled={isAddingNews}
                    className="px-4 py-2 bg-blue-700 hover:bg-blue-600 text-white text-xs font-bold rounded transition-colors disabled:opacity-50"
                  >
                    {isAddingNews ? '投稿中...' : '新着情報を追加'}
                  </button>
                </div>
              </form>

              {/* 登録済み一覧 */}
              <div>
                <h3 className="text-xs font-bold text-slate-800 mb-3">投稿済み一覧（{newsList.length}件）</h3>
                
                {newsList.length === 0 ? (
                  <p className="text-xs text-slate-500 py-4 text-center border border-dashed border-slate-200 rounded">
                    投稿された新着情報はありません。
                  </p>
                ) : (
                  <div className="border border-slate-200 rounded divide-y divide-slate-100 text-xs">
                    {newsList.map((item) => (
                      <div key={item.id} className="p-3 flex items-center justify-between gap-4 hover:bg-slate-50">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-mono text-slate-500">{item.date_str}</span>
                            <span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded text-[10px]">
                              {item.category}
                            </span>
                          </div>
                          <p className="font-medium text-slate-900 truncate">{item.title}</p>
                        </div>
                        <button
                          onClick={() => handleDeleteNews(item.id)}
                          className="px-2.5 py-1 text-red-600 border border-red-200 hover:bg-red-50 rounded text-[11px] font-semibold shrink-0"
                        >
                          削除
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </div>
        )}
      </main>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}