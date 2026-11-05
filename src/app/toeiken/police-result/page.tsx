'use client';

import { useState } from 'react';
import Header from '../../components/Header';
import Breadcrumbs from '../../components/Breadcrumbs';
import Toast from '../../components/Toast';
import { supabase } from '../../../lib/supabase';

type ExamResult = {
  id: number;
  exam_number: string;
  name: string;
  result: string;
  exam_name: string;
};

export default function PoliceResultPage() {
  const [examNumber, setExamNumber] = useState('');
  
  // プルダウン用の生年月日ステート（年・月・日）
  const [birthYear, setBirthYear] = useState('2000');
  const [birthMonth, setBirthMonth] = useState('1');
  const [birthDay, setBirthDay] = useState('1');

  const [resultData, setResultData] = useState<ExamResult | null>(null);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 50 }, (_, i) => currentYear - i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const days = Array.from({ length: 31 }, (_, i) => i + 1);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!examNumber.trim()) {
      setToast({ message: '受考番号を入力してください。', type: 'error' });
      return;
    }

    setLoading(true);
    setSearched(false);
    setResultData(null);

    try {
      const formattedMonth = String(birthMonth).padStart(2, '0');
      const formattedDay = String(birthDay).padStart(2, '0');
      const birthDateString = `${birthYear}-${formattedMonth}-${formattedDay}`;

      const { data, error } = await supabase
        .from('police_exam_results')
        .select('*')
        .eq('exam_number', examNumber.trim())
        .eq('birth_date', birthDateString)
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (data) {
        setResultData(data);
      }
      setSearched(true);
    } catch (err: any) {
      console.error('合否照会エラー:', err);
      setToast({ message: '照会処理中にエラーが発生しました: ' + (err.message || ''), type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col font-sans">
      <Header />

      <main className="flex-1 max-w-3xl mx-auto px-4 sm:px-6 py-8 w-full space-y-6">
        <Breadcrumbs items={[{ label: '警察官採用試験 合否照会' }]} />

        <div className="bg-white border border-slate-300 rounded shadow-sm p-6 sm:p-8">
          <div className="border-b border-slate-200 pb-4 mb-6">
            <h1 className="text-lg sm:text-xl font-bold text-slate-900">
              令和8年度 東栄県警察官採用試験 合否照会システム
            </h1>
            <p className="text-xs text-slate-600 mt-1">
              受考番号と生年月日を選択し、結果を確認してください。
            </p>
          </div>

          <form onSubmit={handleSearch} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                受考番号 <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                value={examNumber}
                onChange={(e) => setExamNumber(e.target.value)}
                placeholder="例: POL-8001"
                className="w-full sm:w-1/2 px-3 py-2 border border-slate-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                生年月日 <span className="text-red-600">*</span>
              </label>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <select
                  value={birthYear}
                  onChange={(e) => setBirthYear(e.target.value)}
                  className="px-3 py-2 border border-slate-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {years.map((y) => (
                    <option key={y} value={y}>{y}年</option>
                  ))}
                </select>

                <select
                  value={birthMonth}
                  onChange={(e) => setBirthMonth(e.target.value)}
                  className="px-3 py-2 border border-slate-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {months.map((m) => (
                    <option key={m} value={m}>{m}月</option>
                  ))}
                </select>

                <select
                  value={birthDay}
                  onChange={(e) => setBirthDay(e.target.value)}
                  className="px-3 py-2 border border-slate-300 rounded bg-white focus:outline-none focus:ring