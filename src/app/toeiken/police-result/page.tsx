'use client';

import { useState } from 'react';
import Header from '../../components/Header';
import Breadcrumbs from '../../components/Breadcrumbs';
import Toast from '../../components/Toast';
import { supabase } from '../../../lib/supabase';
import { getDaysInMonth } from '../../../lib/dates';
import { getErrorMessage } from '../../../lib/errors';
import { useCurrentYear } from '../../../lib/useCurrentYear';

type ExamResult = {
  exam_number: string;
  name: string;
  result: string;
  exam_name: string;
};

function isExamResult(data: unknown): data is ExamResult {
  if (typeof data !== 'object' || data === null) return false;
  return (
    'exam_number' in data &&
    typeof data.exam_number === 'string' &&
    'name' in data &&
    typeof data.name === 'string' &&
    'result' in data &&
    typeof data.result === 'string' &&
    'exam_name' in data &&
    typeof data.exam_name === 'string'
  );
}

function normalizeExamNumber(input: string): string {
  if (!input) return '';
  // 全角数字 (０-９) を半角数字 (0-9) へ変換
  const halfWidth = input.replace(/[０-９]/g, (s) =>
    String.fromCharCode(s.charCodeAt(0) - 0xfee0)
  );
  // 数字以外の文字（ハイフン、全半角スペースなど）を除去
  return halfWidth.replace(/[^0-9]/g, '');
}

export default function PoliceResultPage() {
  const [examNumber, setExamNumber] = useState('');
  
  const baseYear = useCurrentYear();
  const [birthYear, setBirthYear] = useState(String(baseYear - 20));
  const [birthMonth, setBirthMonth] = useState('3');
  const [birthDay, setBirthDay] = useState('1');

  const [resultData, setResultData] = useState<ExamResult | null>(null);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const years = Array.from({ length: 121 }, (_, i) => baseYear - i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const days = Array.from({ length: getDaysInMonth(Number(birthYear), Number(birthMonth)) }, (_, i) => i + 1);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanExamNumber = normalizeExamNumber(examNumber);
    if (!cleanExamNumber) {
      setToast({ message: '受考番号を半角数字で入力してください。', type: 'error' });
      return;
    }

    if (cleanExamNumber !== examNumber) {
      setExamNumber(cleanExamNumber);
    }

    setLoading(true);
    setSearched(false);
    setResultData(null);

    try {
      const formattedMonth = String(birthMonth).padStart(2, '0');
      const formattedDay = String(birthDay).padStart(2, '0');
      const birthDateString = `${birthYear}-${formattedMonth}-${formattedDay}`;

      const { data, error } = await supabase
        .rpc('lookup_police_exam_result', {
          p_exam_number: cleanExamNumber,
          p_birth_date: birthDateString,
        })
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (data) {
        if (!isExamResult(data)) throw new Error('合否照会の結果データ形式が正しくありません。');
        setResultData(data);
      }
      setSearched(true);
    } catch (error) {
      console.error('合否照会エラー:', error);
      setToast({ message: '照会処理中にエラーが発生しました: ' + getErrorMessage(error, '不明なエラー'), type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const formatStatus = (status: string) => {
    const lower = status?.toLowerCase();
    if (lower === 'pass') return '合格';
    if (lower === 'fail') return '不合格';
    return status;
  };
  const isPassingResult = (status: string) =>
    formatStatus(status).includes('合格') && !formatStatus(status).includes('不合格');

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col font-sans">
      <Header />

      <main className="flex-1 max-w-3xl mx-auto px-4 sm:px-6 py-8 w-full space-y-6">
        <Breadcrumbs items={[{ label: '警察官採用試験 合否照会' }]} />

        <div className="bg-white border border-slate-300 rounded-sm p-6 sm:p-8">
          <div className="border-b border-slate-200 pb-4 mb-6">
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900">
              令和8年度 東栄県警察官採用試験 合否照会システム
            </h1>
            <p className="text-[13px] text-slate-600 mt-1 leading-relaxed">
              受考番号と登録生年月日を入力または選択して、選考結果を照会できます。
            </p>
          </div>

          <form onSubmit={handleSearch} className="space-y-5">
            <div>
              <label className="block text-[13px] font-semibold text-slate-800 mb-1">
                受考番号 <span className="text-red-700">*</span>
              </label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="off"
                value={examNumber}
                onChange={(e) => setExamNumber(normalizeExamNumber(e.target.value))}
                placeholder="例: 20260103"
                className="w-full sm:w-1/2 px-3 py-2.5 min-h-[44px] border border-slate-300 rounded-sm text-base sm:text-sm focus:outline-none focus:border-slate-800 font-mono tabular-nums bg-white"
              />
              <p className="text-[13px] text-slate-500 mt-1">※全角数字で入力された場合は自動的に半角数字に変換されます。</p>
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-slate-800 mb-1">
                生年月日 <span className="text-red-700">*</span>
              </label>
              <div className="flex flex-wrap items-center gap-2 text-base sm:text-sm">
                <select
                  value={birthYear}
                  onChange={(e) => {
                    const year = e.target.value;
                    setBirthYear(year);
                    setBirthDay(String(Math.min(Number(birthDay), getDaysInMonth(Number(year), Number(birthMonth)))));
                  }}
                  className="px-3 py-2.5 min-h-[44px] border border-slate-300 rounded-sm bg-white text-base sm:text-sm focus:outline-none focus:border-slate-800 tabular-nums"
                >
                  {years.map((y) => (
                    <option key={y} value={y}>{y}年</option>
                  ))}
                </select>

                <select
                  value={birthMonth}
                  onChange={(e) => {
                    const month = e.target.value;
                    setBirthMonth(month);
                    setBirthDay(String(Math.min(Number(birthDay), getDaysInMonth(Number(birthYear), Number(month)))));
                  }}
                  className="px-3 py-2.5 min-h-[44px] border border-slate-300 rounded-sm bg-white text-base sm:text-sm focus:outline-none focus:border-slate-800 tabular-nums"
                >
                  {months.map((m) => (
                    <option key={m} value={m}>{m}月</option>
                  ))}
                </select>

                <select
                  value={birthDay}
                  onChange={(e) => setBirthDay(e.target.value)}
                  className="px-3 py-2.5 min-h-[44px] border border-slate-300 rounded-sm bg-white text-base sm:text-sm focus:outline-none focus:border-slate-800 tabular-nums"
                >
                  {days.map((d) => (
                    <option key={d} value={d}>{d}日</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full sm:w-auto px-6 py-2.5 min-h-[44px] bg-slate-900 hover:bg-slate-800 text-white text-[13px] font-semibold rounded-sm transition-colors disabled:opacity-50"
              >
                {loading ? '照会中...' : '結果を照会する'}
              </button>
            </div>
          </form>

          {searched && (
            <div className="mt-8 border-t border-slate-200 pt-6">
              <h2 className="text-[13px] font-semibold text-slate-700 uppercase tracking-wider mb-3">選考照会結果</h2>
              
              {resultData ? (
                <div className="bg-slate-50 border border-slate-300 rounded-sm p-6 space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-[13px]">
                    <div>
                      <span className="text-slate-600 block mb-0.5">受考番号</span>
                      <span className="font-mono font-bold text-slate-900 tabular-nums">{resultData.exam_number}</span>
                    </div>
                    <div>
                      <span className="text-slate-600 block mb-0.5">氏名</span>
                      <span className="font-bold text-slate-900">{resultData.name}</span>
                    </div>
                  </div>

                  <div className="border-t border-slate-200 pt-3 flex items-center justify-between">
                    <div>
                      <span className="text-slate-600 block mb-1 text-[13px]">選考結果</span>
                      <div className={`inline-block px-4 py-1.5 rounded-sm font-bold text-sm tracking-widest ${isPassingResult(resultData.result) ? 'bg-slate-900 text-white' : 'bg-red-900 text-white'}`}>
                        {formatStatus(resultData.result)}
                      </div>
                    </div>
                    <p className="text-[13px] text-slate-600">{resultData.exam_name}</p>
                  </div>
                </div>
              ) : (
                <div className="bg-amber-50 border border-amber-200 rounded-sm p-4 text-[13px] text-amber-950 space-y-1">
                  <p className="font-bold">該当する選考結果データが見つかりませんでした。</p>
                  <p className="text-[13px] text-amber-900 leading-relaxed">
                    受考番号（例: 20260103）および登録されている生年月日が正しく一致しているか再度ご確認ください。
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}