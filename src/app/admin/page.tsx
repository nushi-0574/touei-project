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

type ExamResultItem = {
  id: number;
  exam_number: string;
  name: string;
  birth_date: string; // 'YYYY-MM-DD'
  result: string;     // '合格' | '不合格'
  exam_name: string;
};

export default function AdminPage() {
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

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

  // 3. 警察官採用試験 合否データ管理ステート
  const [examResultsList, setExamResultsList] = useState<ExamResultItem[]>([]);
  const [examNumber, setExamNumber] = useState('');
  const [examName, setExamName] = useState('令和8年度 東栄県警察官採用試験');
  const [candidateName, setCandidateName] = useState('');
  const [birthYear, setBirthYear] = useState('2000');
  const [birthMonth, setBirthMonth] = useState('1');
  const [birthDay, setBirthDay] = useState('1');
  const [examResultStatus, setExamResultStatus] = useState('合格');
  const [isAddingExam, setIsAddingExam] = useState(false);

  const baseYear = 2026;
  const years = Array.from({ length: 50 }, (_, i) => baseYear - i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const days = Array.from({ length: 31 }, (_, i) => i + 1);

  // 認証チェックとデータ取得
  useEffect(() => {
    checkUserAndFetchData();
  }, []);

  const checkUserAndFetchData = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setIsAuthenticated(false);
        setToast({ message: '管理者としてログインしていません。ログインしてください。', type: 'error' });
        setLoading(false);
        return;
      }
      setIsAuthenticated(true);

      // サイト設定取得
      const { data: settingData } = await supabase
        .from('site_settings')
        .select('*')
        .eq('id', 1)
        .single();

      if (settingData) {
        setEmergencyText(settingData.emergency_text || '');
        setIsEmergencyActive(settingData.is_emergency_active || false);
      }

      // 新着情報取得
      const { data: newsData } = await supabase
        .from('news_items')
        .select('*')
        .order('id', { ascending: false });

      if (newsData) setNewsList(newsData);

      // 警察試験合否データ取得
      const { data: examData, error: examError } = await supabase
        .from('police_exam_results')
        .select('*')
        .order('id', { ascending: false });

      if (examError) {
        console.error('合否データ取得エラー:', examError);
      } else if (examData) {
        setExamResultsList(examData);
      }
    } catch (err) {
      console.error('予期せぬエラー:', err);
      setToast({ message: 'データの取得に失敗しました。', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // 緊急情報設定保存
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
    } catch (err: any) {
      setToast({ message: '設定の保存に失敗しました: ' + err.message, type: 'error' });
    } finally {
      setIsSavingSettings(false);
    }
  };

  // 新着情報追加
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
        .insert([{ date_str: newDate, title: newTitle, link_url: newLink || '/toeiken', category: newCategory }])
        .select();

      if (error) throw error;
      if (data) {
        setNewsList([data[0], ...newsList]);
        setNewDate('');
        setNewTitle('');
        setNewLink('');
        setToast({ message: '新着情報を追加しました。', type: 'success' });
      }
    } catch (err: any) {
      setToast({ message: '追加に失敗しました: ' + err.message, type: 'error' });
    } finally {
      setIsAddingNews(false);
    }
  };

  const handleDeleteNews = async (id: number) => {
    if (!confirm('本当に削除しますか？')) return;
    try {
      const { error } = await supabase.from('news_items').delete().eq('id', id);
      if (error) throw error;
      setNewsList(newsList.filter((item) => item.id !== id));
      setToast({ message: '新着情報を削除しました。', type: 'success' });
    } catch (err: any) {
      setToast({ message: '削除に失敗しました: ' + err.message, type: 'error' });
    }
  };

  // 警察合否データの追加
  const handleAddExamResult = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!examNumber.trim() || !candidateName.trim()) {
      setToast({ message: '受考番号と氏名を入力してください。', type: 'error' });
      return;
    }

    setIsAddingExam(true);
    try {
      const formattedMonth = String(birthMonth).padStart(2, '0');
      const formattedDay = String(birthDay).padStart(2, '0');
      const birthDateStr = `${birthYear}-${formattedMonth}-${formattedDay}`;

      const { data, error } = await supabase
        .from('police_exam_results')
        .insert([{
          exam_number: examNumber.trim(),
          name: candidateName.trim(),
          birth_date: birthDateStr,
          result: examResultStatus,
          exam_name: examName,
        }])
        .select();

      if (error) throw error;

      if (data) {
        setExamResultsList([data[0], ...examResultsList]);
        setExamNumber('');
        setCandidateName('');
        setToast({ message: '警察官採用試験の合否データを追加しました。', type: 'success' });
      }
    } catch (err: any) {
      setToast({ message: '合否データの追加に失敗しました: ' + err.message, type: 'error' });
    } finally {
      setIsAddingExam(false);
    }
  };

  // 警察合否データの削除
  const handleDeleteExamResult = async (id: number) => {
    if (!confirm('この合否データを削除してもよろしいですか？')) return;
    try {
      const { error } = await supabase.from('police_exam_results').delete().eq('id', id);
      if (error) throw error;
      setExamResultsList(examResultsList.filter((item) => item.id !== id));
      setToast({ message: '合否データを削除しました。', type: 'success' });
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
              ポータルサイト全体の設定、新着情報、および警察官採用試験合否データの管理を行います。
            </p>
          </div>
          <div>
            <span className={`px-3 py-1 rounded text-xs font-semibold ${isAuthenticated ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-amber-100 text-amber-800 border border-amber-300'}`}>
              {isAuthenticated ? '管理者認証済み' : '未認証'}
            </span>
          </div>
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
            {/* 1. 緊急情報設定 */}
            <section className="bg-white border border-slate-300 rounded shadow-sm p-6">
              <h2 className="text-sm font-bold text-slate-900 border-b border-slate-200 pb-2 mb-4">
                [ 1 ] 防災・緊急情報バー設定
              </h2>
              <form onSubmit={handleSaveSettings} className="space-y-4">
                <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 p-3 rounded">
                  <input
                    type="checkbox"
                    id="emergency_active"
                    checked={isEmergencyActive}
                    onChange={(e) => setIsEmergencyActive(e.target.checked)}
                    className="w-4 h-4 text-red-600 border-slate-300 rounded"
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
                    className="w-full px-3 py-2 border border-slate-300 rounded text-xs"
                  />
                </div>
                <div className="text-right">
                  <button type="submit" disabled={isSavingSettings} className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded">
                    {isSavingSettings ? '保存中...' : '緊急情報の設定を保存'}
                  </button>
                </div>
              </form>
            </section>

            {/* 2. 新着情報管理 */}
            <section className="bg-white border border-slate-300 rounded shadow-sm p-6">
              <h2 className="text-sm font-bold text-slate-900 border-b border-slate-200 pb-2 mb-4">
                [ 2 ] 新着情報・お知らせの投稿・管理
              </h2>
              <form onSubmit={handleAddNews} className="bg-slate-50 border border-slate-200 rounded p-4 mb-6 space-y-3">
                <h3 className="text-xs font-bold text-slate-800">新規お知らせの投稿</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">日付表記</label>
                    <input type="text" value={newDate} onChange={(e) => setNewDate(e.target.value)} placeholder="例: 11月5日" className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">カテゴリ</label>
                    <select value={newCategory} onChange={(e) => setNewCategory(e.target.value)} className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs bg-white">
                      <option value="お知らせ">お知らせ</option>
                      <option value="採用情報">採用情報</option>
                      <option value="住民サービス">住民サービス</option>
                      <option value="緊急通知">緊急通知</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">リンク先URL</label>
                    <input type="text" value={newLink} onChange={(e) => setNewLink(e.target.value)} placeholder="/toeiken など" className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs" />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">タイトル</label>
                  <input type="text" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="お知らせの件名" className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs" />
                </div>
                <div className="text-right">
                  <button type="submit" disabled={isAddingNews} className="px-4 py-2 bg-blue-700 hover:bg-blue-600 text-white text-xs font-bold rounded">
                    {isAddingNews ? '投稿中...' : '新着情報を追加'}
                  </button>
                </div>
              </form>

              <div className="border border-slate-200 rounded divide-y divide-slate-100 text-xs">
                {newsList.map((item) => (
                  <div key={item.id} className="p-3 flex items-center justify-between gap-4">
                    <div>
                      <span className="font-mono text-slate-500 mr-2">{item.date_str}</span>
                      <span className="font-medium text-slate-900">{item.title}</span>
                    </div>
                    <button onClick={() => handleDeleteNews(item.id)} className="px-2.5 py-1 text-red-600 border border-red-200 hover:bg-red-50 rounded text-[11px]">削除</button>
                  </div>
                ))}
              </div>
            </section>

            {/* 3. 警察官採用試験 合否データ管理 */}
            <section className="bg-white border border-slate-300 rounded shadow-sm p-6">
              <h2 className="text-sm font-bold text-slate-900 border-b border-slate-200 pb-2 mb-4">
                [ 3 ] 警察官採用試験 合否データ管理
              </h2>

              <form onSubmit={handleAddExamResult} className="bg-slate-50 border border-slate-200 rounded p-4 mb-6 space-y-3">
                <h3 className="text-xs font-bold text-slate-800">受験者・合否データの新規登録</h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">受考番号</label>
                    <input type="text" value={examNumber} onChange={(e) => setExamNumber(e.target.value)} placeholder="例: POL-8001" className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs font-mono" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">受験者氏名</label>
                    <input type="text" value={candidateName} onChange={(e) => setCandidateName(e.target.value)} placeholder="例: 東栄 太郎" className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">判定結果</label>
                    <select value={examResultStatus} onChange={(e) => setExamResultStatus(e.target.value)} className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs bg-white">
                      <option value="合格">合格</option>
                      <option value="不合格">不合格</option>
                      <option value="最終合格">最終合格</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">生年月日 (合否照会時の照合用)</label>
                  <div className="flex items-center gap-2 text-xs">
                    <select value={birthYear} onChange={(e) => setBirthYear(e.target.value)} className="px-3 py-1.5 border border-slate-300 rounded bg-white">
                      {years.map((y) => <option key={y} value={y}>{y}年</option>)}
                    </select>
                    <select value={birthMonth} onChange={(e) => setBirthMonth(e.target.value)} className="px-3 py-1.5 border border-slate-300 rounded bg-white">
                      {months.map((m) => <option key={m} value={m}>{m}月</option>)}
                    </select>
                    <select value={birthDay} onChange={(e) => setBirthDay(e.target.value)} className="px-3 py-1.5 border border-slate-300 rounded bg-white">
                      {days.map((d) => <option key={d} value={d}>{d}日</option>)}
                    </select>
                  </div>
                </div>

                <div className="text-right">
                  <button type="submit" disabled={isAddingExam} className="px-4 py-2 bg-blue-700 hover:bg-blue-600 text-white text-xs font-bold rounded">
                    {isAddingExam ? '登録中...' : '合否データを登録'}
                  </button>
                </div>
              </form>

              {/* 登録済み合否データ一覧 */}
              <div>
                <h3 className="text-xs font-bold text-slate-800 mb-3">登録済み受験データ一覧（{examResultsList.length}件）</h3>
                {examResultsList.length === 0 ? (
                  <p className="text-xs text-slate-500 py-4 text-center border border-dashed border-slate-200 rounded">
                    登録されている合否データはありません。
                  </p>
                ) : (
                  <div className="border border-slate-200 rounded divide-y divide-slate-100 text-xs">
                    {examResultsList.map((item) => (
                      <div key={item.id} className="p-3 flex items-center justify-between gap-4">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 flex-1">
                          <div>
                            <span className="text-[10px] text-slate-500 block">受考番号</span>
                            <span className="font-mono font-bold text-slate-800">{item.exam_number}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-500 block">氏名</span>
                            <span className="font-bold text-slate-800">{item.name}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-500 block">生年月日</span>
                            <span className="font-mono text-slate-600">{item.birth_date}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-500 block">結果</span>
                            <span className="inline-block px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-bold text-[11px]">
                              {item.result}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteExamResult(item.id)}
                          className="px-2.5 py-1 text-red-600 border border-red-200 hover:bg-red-50 rounded text-[11px] shrink-0"
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