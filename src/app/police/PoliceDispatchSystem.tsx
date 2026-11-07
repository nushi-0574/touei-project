'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { getErrorMessage } from '../../lib/errors';

export type DispatchIncident = {
  id: string;
  incident_number: string;
  title: string;
  category: string;
  location: string;
  reporter_name: string;
  reporter_phone: string;
  details: string;
  priority: '緊急(A)' | '重要(B)' | '一般(C)';
  status: '通報受付' | '現場急行指示' | '対応中' | '完了' | '保留';
  assigned_unit: string;
  created_at: string;
  updated_at: string;
};

const CATEGORIES = ['交通事故', '事件・犯罪', '不審者・暴漢', '急病・救護', '火災・災害', 'その他'] as const;
const PRIORITIES = ['緊急(A)', '重要(B)', '一般(C)'] as const;
const STATUSES = ['通報受付', '現場急行指示', '対応中', '完了', '保留'] as const;

export default function PoliceDispatchSystem() {
  const [incidents, setIncidents] = useState<DispatchIncident[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [broadcastingId, setBroadcastingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [toastMessage, setToastMessage] = useState('');

  // フォームステート
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<typeof CATEGORIES[number]>('交通事故');
  const [location, setLocation] = useState('');
  const [reporterName, setReporterName] = useState('');
  const [reporterPhone, setReporterPhone] = useState('');
  const [details, setDetails] = useState('');
  const [priority, setPriority] = useState<typeof PRIORITIES[number]>('緊急(A)');
  const [assignedUnit, setAssignedUnit] = useState('');

  useEffect(() => {
    let active = true;

    async function loadIncidents() {
      try {
        const { data, error } = await supabase
          .from('police_dispatch_incidents')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50);

        if (error) throw error;
        if (active) {
          setIncidents(data as DispatchIncident[]);
        }
      } catch (err) {
        console.error('警察指令データの取得に失敗しました:', err);
        if (active) setErrorMessage('指令データの読み込みに失敗しました。');
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadIncidents();

    const subscription = supabase
      .channel('police-dispatch-channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'police_dispatch_incidents' },
        (payload) => {
          if (!active) return;
          if (payload.eventType === 'INSERT') {
            const newRow = payload.new as DispatchIncident;
            setIncidents((current) => [newRow, ...current.filter((i) => i.id !== newRow.id)]);
          } else if (payload.eventType === 'UPDATE') {
            const updatedRow = payload.new as DispatchIncident;
            setIncidents((current) => current.map((i) => (i.id === updatedRow.id ? updatedRow : i)));
          } else if (payload.eventType === 'DELETE') {
            const deletedId = (payload.old as { id: string }).id;
            setIncidents((current) => current.filter((i) => i.id !== deletedId));
          }
        }
      )
      .subscribe();

    return () => {
      active = false;
      void supabase.removeChannel(subscription);
    };
  }, []);

  // 新規通報・起案の送信
  const handleCreateIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !location.trim()) {
      setErrorMessage('件名と発生場所を入力してください。');
      return;
    }

    setSubmitting(true);
    setErrorMessage('');
    try {
      const now = new Date();
      const dateStr = now.getFullYear().toString() +
        (now.getMonth() + 1).toString().padStart(2, '0') +
        now.getDate().toString().padStart(2, '0');
      const seqStr = Math.floor(100 + Math.random() * 900).toString();
      const incidentNumber = `110-${dateStr}-${seqStr}`;

      const { data, error } = await supabase
        .from('police_dispatch_incidents')
        .insert({
          incident_number: incidentNumber,
          title: title.trim(),
          category,
          location: location.trim(),
          reporter_name: reporterName.trim(),
          reporter_phone: reporterPhone.trim(),
          details: details.trim(),
          priority,
          status: '通報受付',
          assigned_unit: assignedUnit.trim(),
        })
        .select('*')
        .single();

      if (error) throw error;

      setIncidents((current) => [data as DispatchIncident, ...current]);
      setShowForm(false);
      setTitle('');
      setLocation('');
      setReporterName('');
      setReporterPhone('');
      setDetails('');
      setAssignedUnit('');
      setToastMessage(`指令起案完了: ${incidentNumber}`);
      setTimeout(() => setToastMessage(''), 4000);
    } catch (err) {
      console.error('指令の起案に失敗しました:', err);
      setErrorMessage(getErrorMessage(err, '110番指令の起案に失敗しました。'));
    } finally {
      setSubmitting(false);
    }
  };

  // ステータス・対応部隊の更新
  const handleUpdateStatus = async (id: string, newStatus: DispatchIncident['status'], newUnit?: string) => {
    try {
      const updates: Partial<DispatchIncident> = {
        status: newStatus,
        updated_at: new Date().toISOString(),
      };
      if (newUnit !== undefined) {
        updates.assigned_unit = newUnit;
      }

      const { data, error } = await supabase
        .from('police_dispatch_incidents')
        .update(updates)
        .eq('id', id)
        .select('*')
        .single();

      if (error) throw error;
      setIncidents((current) => current.map((i) => (i.id === id ? (data as DispatchIncident) : i)));
    } catch (err) {
      console.error('ステータス更新失敗:', err);
      setErrorMessage(getErrorMessage(err, 'ステータスの更新に失敗しました。'));
    }
  };

  // 警察無線への指令送出
  const handleBroadcastToRadio = async (incident: DispatchIncident) => {
    setBroadcastingId(incident.id);
    try {
      const radioText = `【110番緊急指令】 [${incident.priority}] ${incident.category}
発生場所: ${incident.location}
件名: ${incident.title}
対応部隊: ${incident.assigned_unit || '未割り当て'} / ステータス: ${incident.status}
詳細: ${incident.details || 'なし'}`;

      const { error } = await supabase
        .from('police_radio_messages')
        .insert({
          channel: '県内',
          body: radioText,
        });

      if (error) throw error;

      setToastMessage(`110番指令情報を警察無線（県内Ch）へ送信しました。`);
      setTimeout(() => setToastMessage(''), 4000);
    } catch (err) {
      console.error('無線送出失敗:', err);
      setErrorMessage(getErrorMessage(err, '警察無線への送出に失敗しました。'));
    } finally {
      setBroadcastingId(null);
    }
  };

  const getPriorityBadgeClass = (p: DispatchIncident['priority']) => {
    if (p === '緊急(A)') return 'bg-red-700 text-white';
    if (p === '重要(B)') return 'bg-amber-600 text-white';
    return 'bg-blue-700 text-white';
  };

  const getStatusBadgeClass = (s: DispatchIncident['status']) => {
    if (s === '通報受付') return 'bg-red-100 text-red-900 border-red-300';
    if (s === '現場急行指示') return 'bg-amber-100 text-amber-900 border-amber-300';
    if (s === '対応中') return 'bg-blue-100 text-blue-900 border-blue-300';
    if (s === '完了') return 'bg-emerald-100 text-emerald-900 border-emerald-300';
    return 'bg-slate-100 text-slate-800 border-slate-300';
  };

  return (
    <section className="rounded border border-red-300 bg-white shadow-sm overflow-hidden">
      {/* ヘッダー */}
      <div className="bg-red-900 text-white p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-block w-3 h-3 rounded-full bg-red-400 animate-pulse" />
            <h2 className="text-lg font-bold">110番 警察緊急指令システム</h2>
          </div>
          <p className="text-xs text-red-100 mt-1">
            東栄県警察本部 交通・地域・刑事総括 リアルタイム指令台
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
          className="px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded shadow transition-colors min-h-[44px] flex items-center justify-center"
        >
          {showForm ? '新規指令フォームを閉じる' : '＋ 110番緊急発令・起案'}
        </button>
      </div>

      {toastMessage && (
        <div className="bg-emerald-50 border-b border-emerald-200 px-4 py-3 text-xs font-bold text-emerald-900 flex items-center gap-2">
          <span>✓</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-3 text-xs font-bold text-red-900">
          {errorMessage}
        </div>
      )}

      {/* 起案フォーム */}
      {showForm && (
        <form onSubmit={handleCreateIncident} className="bg-slate-50 border-b border-slate-300 p-5 space-y-4 text-xs">
          <h3 className="font-bold text-slate-900 text-sm border-b border-slate-200 pb-2">
            新規110番緊急指令の入力
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                件名・概要 <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="例: 東栄駅北口付近でのひき逃げ事故"
                className="w-full px-3 py-2 border border-slate-300 rounded text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                発生場所・現場 <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                required
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="例: 東栄市中央町2-4 交差点"
                className="w-full px-3 py-2 border border-slate-300 rounded text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">種別</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as typeof CATEGORIES[number])}
                className="w-full px-3 py-2 border border-slate-300 rounded text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[38px]"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">優先度</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as typeof PRIORITIES[number])}
                className="w-full px-3 py-2 border border-slate-300 rounded text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[38px]"
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">通報者氏名</label>
              <input
                type="text"
                value={reporterName}
                onChange={(e) => setReporterName(e.target.value)}
                placeholder="例: 東栄 太郎（目撃者）"
                className="w-full px-3 py-2 border border-slate-300 rounded text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">通報者連絡先</label>
              <input
                type="text"
                value={reporterPhone}
                onChange={(e) => setReporterPhone(e.target.value)}
                placeholder="例: 090-XXXX-XXXX"
                className="w-full px-3 py-2 border border-slate-300 rounded text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">現場担当・出動予定部隊</label>
            <input
              type="text"
              value={assignedUnit}
              onChange={(e) => setAssignedUnit(e.target.value)}
              placeholder="例: 東栄101号車、交通機動隊1号"
              className="w-full px-3 py-2 border border-slate-300 rounded text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">指令詳細・傷病者状況など</label>
            <textarea
              rows={3}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="状況詳細、逃走経路、特徴、傷病者の有無等を入力"
              className="w-full px-3 py-2 border border-slate-300 rounded text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2 bg-red-700 hover:bg-red-600 text-white text-xs font-bold rounded shadow disabled:opacity-50"
            >
              {submitting ? '起案発令中...' : '110番指令を発令・登録'}
            </button>
          </div>
        </form>
      )}

      {/* 指令モニター・アクティブ一覧 */}
      <div className="p-5 space-y-4">
        <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center justify-between">
          <span>発令中・過去の指令案件一覧 ({incidents.length}件)</span>
          <span className="text-[11px] text-slate-400 font-normal">※リアルタイム同期中</span>
        </h3>

        {loading ? (
          <p className="text-center py-8 text-xs text-slate-500">指令データを読み込んでいます...</p>
        ) : incidents.length === 0 ? (
          <div className="text-center py-12 bg-slate-50 border border-slate-200 rounded text-xs text-slate-500">
            現在、登録されている110番指令案件はありません。
          </div>
        ) : (
          <div className="space-y-3">
            {incidents.map((item) => (
              <article
                key={item.id}
                className="border border-slate-200 rounded bg-white p-4 space-y-3 hover:border-slate-300 transition-colors shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-xs text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                      {item.incident_number}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${getPriorityBadgeClass(item.priority)}`}>
                      {item.priority}
                    </span>
                    <span className="text-xs font-bold text-slate-800">{item.category}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-0.5 rounded border text-xs font-bold ${getStatusBadgeClass(item.status)}`}>
                      {item.status}
                    </span>
                    <time className="text-[11px] text-slate-500" dateTime={item.created_at}>
                      {new Date(item.created_at).toLocaleString('ja-JP')}
                    </time>
                  </div>
                </div>

                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-slate-900">{item.title}</h4>
                  <p className="text-xs text-slate-600 flex items-center gap-1">
                    <span className="font-bold text-slate-700">📍 発生場所:</span> {item.location}
                  </p>
                  {item.assigned_unit && (
                    <p className="text-xs text-blue-900 font-semibold bg-blue-50 px-2 py-1 rounded inline-block">
                      🚔 担当出動部隊: {item.assigned_unit}
                    </p>
                  )}
                </div>

                {item.details && (
                  <p className="text-xs text-slate-700 bg-slate-50 p-2.5 rounded border border-slate-100 whitespace-pre-wrap">
                    {item.details}
                  </p>
                )}

                {(item.reporter_name || item.reporter_phone) && (
                  <div className="text-[11px] text-slate-500 flex flex-wrap gap-3 pt-1">
                    {item.reporter_name && <span>通報者: {item.reporter_name}</span>}
                    {item.reporter_phone && <span className="font-mono">電話: {item.reporter_phone}</span>}
                  </div>
                )}

                {/* 指令操作パネル */}
                <div className="border-t border-slate-100 pt-3 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500 font-bold text-[11px]">ステータス変更:</span>
                    <select
                      value={item.status}
                      onChange={(e) => handleUpdateStatus(item.id, e.target.value as DispatchIncident['status'])}
                      className="px-2 py-1 border border-slate-300 rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="button"
                    disabled={broadcastingId === item.id}
                    onClick={() => handleBroadcastToRadio(item)}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded text-xs font-bold transition-colors flex items-center gap-1.5"
                  >
                    <span>📻</span>
                    <span>{broadcastingId === item.id ? '送信中...' : '警察無線（県内Ch）へ送信'}</span>
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
