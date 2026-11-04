'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useRouter } from 'next/navigation';
import Header from '../components/Header';
import Breadcrumbs from '../components/Breadcrumbs';
import Toast from '../components/Toast';

export default function AdminPage() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [profilesList, setProfilesList] = useState<any[]>([]);
  const [examResults, setExamResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // 合否登録・編集フォームの状態
  const [editingId, setEditingId] = useState<string | null>(null);
  const [examNumber, setExamNumber] = useState('');
  const [fullName, setFullName] = useState('');
  const [birthDate, setBirthDate] = useState('2006-01-01');
  const [status, setStatus] = useState<'pass' | 'fail'>('pass');
  const [department, setDepartment] = useState('警務部 採用普及課（第一期条件付き採用）');

  const router = useRouter();

  useEffect(() => {
    async function checkAdmin() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }
      setUser(session.user);

      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (!profileData || profileData.role !== 'admin') {
        router.push('/dashboard');
        return;
      }

      setProfile(profileData);
      await fetchData();
      setLoading(false);
    }

    checkAdmin();
  }, [router]);

  async function fetchData() {
    const { data: profs } = await supabase.from('profiles').select('*');
    if (profs) setProfilesList(profs);

    const { data: results } = await supabase.from('police_exam_results').select('*').order('created_at', { ascending: false });
    if (results) setExamResults(results);
  }

  const handleUpdateRole = async (id: string, newRole: string) => {
    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', id);

    if (error) {
      setToast({ message: 'ロール更新失敗: ' + error.message, type: 'error' });
    } else {
      setToast({ message: 'ロールを更新しました。', type: 'success' });
      fetchData();
    }
  };

  // 登録または更新の保存処理
  const handleSaveExamResult = async (e: React.FormEvent) => {
    e.preventDefault();

    if (editingId) {
      // 編集モード
      const { error } = await supabase
        .from('police_exam_results')
        .update({
          exam_number: examNumber.trim().toUpperCase(),
          full_name: fullName,
          birth_date: birthDate,
          status: status,
          department: department,
        })
        .eq('id', editingId);

      if (error) {
        setToast({ message: '更新エラー: ' + error.message, type: 'error' });
      } else {
        setToast({ message: '合否データを更新しました。', type: 'success' });
        resetExamForm();
        fetchData();
      }
    } else {
      // 新規登録モード
      const { error } = await supabase.from('police_exam_results').insert([
        {
          exam_number: examNumber.trim().toUpperCase(),
          full_name: fullName,
          birth_date: birthDate,
          status: status,
          department: department,
        },
      ]);

      if (error) {
        setToast({ message: '登録エラー: ' + error.message, type: 'error' });
      } else {
        setToast({ message: '合否データを登録しました。', type: 'success' });
        resetExamForm();
        fetchData();
      }
    }
  };

  // 編集開始：選択したデータの値をフォームにセット
  const handleEditClick = (item: any) => {
    setEditingId(item.id);
    setExamNumber(item.exam_number);
    setFullName(item.full_name);
    setBirthDate(item.birth_date);
    setStatus(item.status);
    setDepartment(item.department || '警務部 採用普及課（第一期条件付き採用）');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // フォームリセット
  const resetExamForm = () => {
    setEditingId(null);
    setExamNumber('');
    setFullName('');
    setBirthDate('2006-01-01');
    setStatus('pass');
    setDepartment('警務部 採用普及課（第一期条件付き採用）');
  };

  const handleDeleteExamResult = async (id: string) => {
    if (!confirm('本当にこの合否データを削除しますか？')) return;
    const { error } = await supabase.from('police_exam_results').delete().eq('id', id);
    if (error) {
      setToast({ message: '削除失敗: ' + error.message, type: 'error' });
    } else {
      setToast({ message: 'データを削除しました。', type: 'success' });
      fetchData();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center">
        <div className="w-6 h-6 border-2 border-slate-300 border-t-[#0046ff] rounded-full animate-spin mb-3"></div>
        <p className="text-slate-500 text-xs">読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800">
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <Breadcrumbs items={[{ label: 'メインメニュー', href: '/dashboard' }, { label: 'システム管理パネル' }]} />

        <div className="bg-white border border-slate-200 rounded p-6 mb-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
            <div>
              <h1 className="text-xl font-bold text-slate-900">システム管理パネル</h1>
              <p className="text-xs text-slate-500 mt-1">登録ユーザーおよび東栄県警察採用試験データの管理</p>
            </div>
            <span className="text-xs bg-blue-50 text-[#0046ff] border border-blue-200 px-3 py-1 rounded font-medium">
              管理者: {user?.email}
            </span>
          </div>

          {/* セクション 1: 東栄県警察 採用合否データ管理 */}
          <div className="mb-10">
            <h2 className="text-base font-bold text-slate-900 mb-3 pb-2 border-b border-slate-100">
              東栄県警察 第一期採用試験 合否データ管理
            </h2>

            {/* 登録・編集フォーム */}
            <form onSubmit={handleSaveExamResult} className={`border rounded p-4 mb-6 transition-colors ${editingId ? 'bg-amber-50/50 border-amber-300' : 'bg-slate-50 border-slate-200'}`}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold text-slate-800">
                  {editingId ? '合否データの編集中（ID: ' + editingId.slice(0, 8) + '...）' : '新規合否データ追加'}
                </h3>
                {editingId && (
                  <button
                    type="button"
                    onClick={resetExamForm}
                    className="text-[11px] text-slate-500 hover:text-slate-800 underline"
                  >
                    編集をキャンセル
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 mb-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">受考番号</label>
                  <input
                    type="text"
                    value={examNumber}
                    onChange={(e) => setExamNumber(e.target.value)}
                    required
                    placeholder="TP-2026-001"
                    className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">氏名</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    placeholder="東栄 太郎"
                    className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">生年月日</label>
                  <input
                    type="date"
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                    required
                    className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">合否判定</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as 'pass' | 'fail')}
                    className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded text-xs"
                  >
                    <option value="pass">合格 (Pass)</option>
                    <option value="fail">不合格 (Fail)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">配属部署</label>
                  <input
                    type="text"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    required
                    className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded text-xs"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="submit"
                  className={`px-4 py-1.5 text-white text-xs font-medium rounded transition-colors ${editingId ? 'bg-amber-600 hover:bg-amber-700' : 'bg-emerald-700 hover:bg-emerald-800'}`}
                >
                  {editingId ? '変更を保存する' : '登録する'}
                </button>
                {editingId && (
                  <button
                    type="button"
                    onClick={resetExamForm}
                    className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-medium rounded transition-colors"
                  >
                    キャンセル
                  </button>
                )}
              </div>
            </form>

            {/* 登録済み一覧テーブル */}
            <div className="overflow-x-auto border border-slate-200 rounded">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-slate-700">
                    <th className="p-3">受考番号</th>
                    <th className="p-3">氏名</th>
                    <th className="p-3">生年月日</th>
                    <th className="p-3">合否</th>
                    <th className="p-3">配属予定</th>
                    <th className="p-3 text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {examResults.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-4 text-center text-slate-400">データが登録されていません。</td>
                    </tr>
                  ) : (
                    examResults.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50">
                        <td className="p-3 font-semibold">{item.exam_number}</td>
                        <td className="p-3">{item.full_name}</td>
                        <td className="p-3">{item.birth_date}</td>
                        <td className="p-3">
                          {item.status === 'pass' ? (
                            <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold">合格</span>
                          ) : (
                            <span className="bg-slate-200 text-slate-700 px-2 py-0.5 rounded font-bold">不合格</span>
                          )}
                        </td>
                        <td className="p-3 text-slate-600">{item.department}</td>
                        <td className="p-3 text-right space-x-1">
                          <button
                            onClick={() => handleEditClick(item)}
                            className="bg-blue-50 hover:bg-blue-100 text-[#0046ff] px-2 py-1 rounded text-[11px] border border-blue-200 transition-colors"
                          >
                            編集
                          </button>
                          <button
                            onClick={() => handleDeleteExamResult(item.id)}
                            className="bg-red-50 hover:bg-red-100 text-red-600 px-2 py-1 rounded text-[11px] border border-red-200 transition-colors"
                          >
                            削除
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* セクション 2: 登録ユーザー一覧と権限管理 */}
          <div>
            <h2 className="text-base font-bold text-slate-900 mb-3 pb-2 border-b border-slate-100">
              登録ユーザー一覧と権限管理
            </h2>
            <div className="overflow-x-auto border border-slate-200 rounded">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-slate-700">
                    <th className="p-3">メールアドレス</th>
                    <th className="p-3">氏名</th>
                    <th className="p-3">生年月日</th>
                    <th className="p-3">性別</th>
                    <th className="p-3">権限 (Role)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {profilesList.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="p-3 font-medium text-slate-900">{p.email}</td>
                      <td className="p-3">{p.full_name || '-'}</td>
                      <td className="p-3">{p.birth_date || '-'}</td>
                      <td className="p-3">{p.gender || '-'}</td>
                      <td className="p-3">
                        <select
                          value={p.role || 'customer'}
                          onChange={(e) => handleUpdateRole(p.id, e.target.value)}
                          className="bg-white border border-slate-300 rounded px-2 py-1 text-xs focus:outline-none focus:border-[#0046ff]"
                        >
                          <option value="customer">一般ユーザー</option>
                          <option value="admin">管理者</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </main>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}