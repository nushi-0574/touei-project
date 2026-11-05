'use client';

import { useState } from 'react';
import { supabase } from '../../../lib/supabase';
import Header from '../../components/Header';
import Breadcrumbs from '../../components/Breadcrumbs';
import Toast from '../../components/Toast';

// 合否結果の型定義
type ExamResult = {
  id: string;
  examinee_number: string;
  name: string;
  status: 'passed' | 'failed'; // 'passed' = 合格, 'failed' = 不合格
};

export default function PoliceResultPage() {
  const [examineeNumber, setExamineeNumber] = useState('');
  const [birthDate, setBirthDate] = useState('');
  
  // 状態管理
  const [isLoading, setIsLoading] = useState(false); // ローディング中フラグ
  const [resultData, setResultData] = useState<ExamResult | null>(null); // 取得した合否データ
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // 照会処理
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!examineeNumber || !birthDate) {
      setToast({ message: '受考番号と生年月日を入力してください。', type: 'error' });
      return;
    }

    setIsLoading(true); // ローディング開始（画面操作不可＆ぐるぐる表示）

    try {
      // Supabaseから警察試験結果を照会
      const { data, error } = await supabase
        .from('police_exam_results')
        .select('*')
        .eq('examinee_number', examineeNumber.trim())
        .eq('birth_date', birthDate)
        .single();

      if (error || !data) {
        setToast({ message: '該当する受考データが見つかりませんでした。', type: 'error' });
        setIsLoading(false);
        return;
      }

      // 演出用のわずかなウェイト
      await new Promise((resolve) => setTimeout(resolve, 800));

      // 取得したデータをセット（これにより全画面の合否結果ビューに切り替わる）
      setResultData({
        id: data.id,
        examinee_number: data.examinee_number,
        name: data.name,
        status: data.status, // 'passed' または 'failed'
      });
    } catch (err) {
      setToast({ message: '通信エラーが発生しました。', type: 'error' });
    } finally {
      setIsLoading(false); // ローディング終了
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 flex flex-col relative">
      <Header />

      {/* ==========================================
          1. 照会中の全画面オーバーレイ（操作不可・白半透明・ぐるぐる）
          ========================================== */}
      {isLoading && (
        <div className="fixed inset-0 z-50 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center select-none">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-sm font-bold text-slate-700 tracking-wider">照会中...</p>
        </div>
      )}

      {/* ==========================================
          2. 全画面の合否結果表示エリア（結果がある場合）
          ========================================== */}
      {resultData ? (
        <main className="flex-1 w-full flex flex-col items-center justify-center p-6 animate-fadeIn">
          {resultData.status === 'passed' ? (
            /* --- 合格用 全画面ビュー --- */
            <div className="w-full max-w-xl bg-white border-2 border-emerald-500 rounded-xl shadow-xl p-8 text-center">
              <div className="inline-block px-4 py-1.5 bg-emerald-100 text-emerald-700 rounded-full mb-4 text-xs font-bold tracking-wider">
                最終合格
              </div>
              <h1 className="text-2xl font-extrabold text-slate-900 mb-2">合格おめでとうございます</h1>
              <p className="text-xs text-slate-500 mb-6">固有ID: {resultData.id}</p>
              
              <div className="bg-slate-50 border border-slate-200 rounded p-4 mb-6 text-left space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">受考番号:</span>
                  <span className="font-bold text-slate-800">{resultData.examinee_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">氏名:</span>
                  <span className="font-bold text-slate-800">{resultData.name}</span>
                </div>
              </div>

              <button
                onClick={() => setResultData(null)}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded transition-colors"
              >
                照会画面に戻る
              </button>
            </div>
          ) : (
            /* --- 不合格用 全画面ビュー --- */
            <div className="w-full max-w-xl bg-white border-2 border-slate-300 rounded-xl shadow-xl p-8 text-center">
              <div className="inline-block px-4 py-1.5 bg-slate-100 text-slate-600 rounded-full mb-4 text-xs font-bold tracking-wider">
                不合格
              </div>
              <h1 className="text-2xl font-extrabold text-slate-900 mb-2">選考結果のお知らせ</h1>
              <p className="text-xs text-slate-500 mb-6">固有ID: {resultData.id}</p>

              <div className="bg-slate-50 border border-slate-200 rounded p-4 mb-6 text-left space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">受考番号:</span>
                  <span className="font-bold text-slate-800">{resultData.examinee_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">氏名:</span>
                  <span className="font-bold text-slate-800">{resultData.name}</span>
                </div>
              </div>

              <button
                onClick={() => setResultData(null)}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded transition-colors"
              >
                照会画面に戻る
              </button>
            </div>
          )}
        </main>
      ) : (
        /* ==========================================
            通常の照会フォーム画面
            ========================================== */
        <main className="max-w-2xl mx-auto px-4 sm:px-6 py-6 flex-1 w-full">
          <Breadcrumbs items={[{ label: '警察官採用試験 合否照会' }]} />

          <div className="bg-white border border-slate-200 rounded p-8 shadow-sm">
            <div className="mb-6 pb-4 border-b border-slate-100">
              <h1 className="text-xl font-bold text-slate-900">合格発表 照会フォーム</h1>
              <p className="text-xs text-slate-500 mt-1">
                受考番号と生年月日を入力し、照会ボタンを押してください。
              </p>
            </div>

            <form onSubmit={handleSearch} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">受考番号</label>
                <input
                  type="text"
                  value={examineeNumber}
                  onChange={(e) => setExamineeNumber(e.target.value)}
                  placeholder="例: POL-2026-001"
                  className="w-full px-3 py-2 border border-slate-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">生年月日</label>
                <input
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded transition-colors mt-4 disabled:opacity-50"
              >
                結果を照会する
              </button>
            </form>
          </div>
        </main>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}