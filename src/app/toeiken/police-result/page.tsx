'use client';

import { useState } from 'react';
import { supabase } from '../../../lib/supabase';
import Header from '../../components/Header';
import Breadcrumbs from '../../components/Breadcrumbs';

export default function PoliceResultPage() {
  const [examNumber, setExamNumber] = useState('');
  const [birthYear, setBirthYear] = useState('2006');
  const [birthMonth, setBirthMonth] = useState('1');
  const [birthDay, setBirthDay] = useState('1');

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    status: 'pass' | 'fail' | 'not_found';
    name?: string;
    number?: string;
    department?: string;
  } | null>(null);

  const currentYear = 2026;
  const years = Array.from({ length: 101 }, (_, i) => currentYear - i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const days = Array.from({ length: 31 }, (_, i) => i + 1);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    const formattedMonth = String(birthMonth).padStart(2, '0');
    const formattedDay = String(birthDay).padStart(2, '0');
    const birthDateStr = `${birthYear}-${formattedMonth}-${formattedDay}`;
    const cleanNumber = examNumber.trim().toUpperCase();

    // Supabaseから一致する受考番号と生年月日を検索
    const { data, error } = await supabase
      .from('police_exam_results')
      .select('*')
      .eq('exam_number', cleanNumber)
      .eq('birth_date', birthDateStr)
      .single();

    if (error || !data) {
      setResult({ status: 'not_found' });
    } else {
      setResult({
        status: data.status,
        name: data.full_name,
        number: data.exam_number,
        department: data.department || '警務部 採用普及課（第一期条件付き採用）',
      });
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 flex flex-col">
      <Header />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 flex-1 w-full">
        <Breadcrumbs
          items={[
            { label: '東栄県ポータル', href: '/toeiken/dashboard' },
            { label: '東栄県警察 合否照会' },
          ]}
        />

        <div className="bg-white border border-slate-200 rounded p-6 sm:p-8">
          <div className="border-b border-slate-200 pb-4 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-[10px] bg-slate-800 text-slate-100 px-2 py-0.5 rounded font-medium">
                東栄県警察本部 警務部 採用係
              </span>
              <h1 className="text-xl font-bold text-slate-900 mt-2">
                第一期条件付き採用職員選考試験 合否照会
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                受考番号および生年月日を入力のうえ、「照会する」ボタンを押してください。
              </p>
            </div>
          </div>

          <form onSubmit={handleSearch} className="bg-slate-50 border border-slate-200 rounded p-6 mb-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  受考番号 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={examNumber}
                  onChange={(e) => setExamNumber(e.target.value)}
                  required
                  placeholder="例: TP-2026-001"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-sm text-slate-800 focus:outline-none focus:border-emerald-700"
                />
                <p className="text-[11px] text-slate-400 mt-1">※受考票に記載された番号を入力してください。</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  生年月日 <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <select
                    value={birthYear}
                    onChange={(e) => setBirthYear(e.target.value)}
                    className="px-2 py-2 bg-white border border-slate-300 rounded text-xs text-slate-800 focus:outline-none focus:border-emerald-700"
                  >
                    {years.map((y) => (
                      <option key={y} value={y}>{y}年</option>
                    ))}
                  </select>

                  <select
                    value={birthMonth}
                    onChange={(e) => setBirthMonth(e.target.value)}
                    className="px-2 py-2 bg-white border border-slate-300 rounded text-xs text-slate-800 focus:outline-none focus:border-emerald-700"
                  >
                    {months.map((m) => (
                      <option key={m} value={m}>{m}月</option>
                    ))}
                  </select>

                  <select
                    value={birthDay}
                    onChange={(e) => setBirthDay(e.target.value)}
                    className="px-2 py-2 bg-white border border-slate-300 rounded text-xs text-slate-800 focus:outline-none focus:border-emerald-700"
                  >
                    {days.map((d) => (
                      <option key={d} value={d}>{d}日</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="mt-6 text-right">
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 bg-emerald-800 hover:bg-emerald-900 text-white font-medium text-xs rounded transition-colors disabled:opacity-50"
              >
                {loading ? '照会中...' : '照会する'}
              </button>
            </div>
          </form>

          {result && (
            <div className="border border-slate-300 rounded overflow-hidden transition-all">
              {result.status === 'pass' && (
                <div className="bg-emerald-50 border-l-4 border-emerald-700 p-6">
                  <div className="flex items-center space-x-2 mb-2">
                    <span className="bg-emerald-700 text-white text-[10px] font-bold px-2 py-0.5 rounded">
                      結果：合格
                    </span>
                    <span className="text-xs text-emerald-900 font-bold">【条件付き採用決定】</span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900 mb-2">
                    合格おめでとうございます
                  </h3>
                  <p className="text-xs text-slate-700 leading-relaxed mb-4">
                    東栄県警察 第一期条件付き採用職員選考試験の結果、貴殿は合格と判定されました。指定の着任手続き手引きおよび教本資料をご確認のうえ、指定日に教養課程へ着任してください。
                  </p>

                  <div className="bg-white border border-emerald-200 rounded p-4 text-xs space-y-2 mb-4">
                    <p><span className="font-semibold text-slate-600">氏名:</span> {result.name}</p>
                    <p><span className="font-semibold text-slate-600">受考番号:</span> {result.number}</p>
                    <p><span className="font-semibold text-slate-600">配属予定:</span> {result.department}</p>
                  </div>

                  <a
                    href="/dashboard"
                    className="inline-block bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-medium px-4 py-2 rounded transition-colors"
                  >
                    教本・手続きドキュメントを確認する
                  </a>
                </div>
              )}

              {result.status === 'fail' && (
                <div className="bg-slate-50 border-l-4 border-slate-500 p-6">
                  <div className="flex items-center space-x-2 mb-2">
                    <span className="bg-slate-600 text-white text-[10px] font-bold px-2 py-0.5 rounded">
                      結果：不合格
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900 mb-2">
                    選考結果のご案内
                  </h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    慎重なる選考を行いました結果、誠に残念ながら今回は採用を見送らせていただくこととなりました。多数のご応募をいただき感謝申し上げます。
                  </p>
                </div>
              )}

              {result.status === 'not_found' && (
                <div className="bg-amber-50 border-l-4 border-amber-600 p-6">
                  <h3 className="text-sm font-bold text-amber-900 mb-1">
                    該当するデータが見つかりません
                  </h3>
                  <p className="text-xs text-amber-800 leading-relaxed">
                    入力された「受考番号」または「生年月日」に誤りがある可能性があります。再度お確かめのうえ入力してください。
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}