'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { getErrorMessage } from '../../lib/errors';
import {
  ShieldAlert,
  Radio,
  PlusCircle,
  CheckCircle2,
  AlertCircle,
  MapPin,
  User,
  Phone,
  Clock,
  Car,
  FileText,
  Send,
  X
} from 'lucide-react';

export type DispatchIncident = {
  id: string;
  incident_number: string;
  title: string;
  category: string;
  location: string;
  reporter_name: string;
  reporter_phone: string;
  details: string;
  priority: '第1種 (緊急指令)' | '第2種 (重要指令)' | '第3種 (一般指令)' | '緊急(A)' | '重要(B)' | '一般(C)';
  status: '通報受付' | '現場急行指示' | '対応中' | '現場対応中' | '完了' | '事案完了' | '保留';
  assigned_unit: string;
  created_at: string;
  updated_at: string;
};

const CATEGORIES = ['交通事故', '事件・犯罪', '不審者・暴漢', '急病・救護要請', '火災・災害', 'その他特記事項'] as const;
const PRIORITIES = ['第1種 (緊急指令)', '第2種 (重要指令)', '第3種 (一般指令)'] as const;
const STATUSES = ['通報受付', '現場急行指示', '現場対応中', '事案完了', '保留'] as const;

export default function PoliceDispatchSystem() {
  const [incidents, setIncidents] = useState<DispatchIncident[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [broadcastingId, setBroadcastingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [toastMessage, setToastMessage] = useState('');

  // 入力フォーム状態
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<typeof CATEGORIES[number]>('交通事故');
  const [location, setLocation] = useState('');
  const [reporterName, setReporterName] = useState('');
  const [reporterPhone, setReporterPhone] = useState('');
  const [details, setDetails] = useState('');
  const [priority, setPriority] = useState<typeof PRIORITIES[number]>('第1種 (緊急指令)');
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

  // 新規通報の起案
  const handleCreateIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !location.trim()) {
      setErrorMessage('件名および発生場所の入力は必須です。');
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
      setToastMessage(`110番指令を登録・発令しました（管理番号: ${incidentNumber}）`);
      setTimeout(() => setToastMessage(''), 4000);
    } catch (err) {
      console.error('指令の起案に失敗しました:', err);
      setErrorMessage(getErrorMessage(err, '110番指令の登録に失敗しました。'));
    } finally {
      setSubmitting(false);
    }
  };

  // ステータスの更新
  const handleUpdateStatus = async (id: string, newStatus: DispatchIncident['status']) => {
    try {
      const updates = {
        status: newStatus,
        updated_at: new Date().toISOString(),
      };

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

  // 警察無線（県内Ch）への指令送出
  const handleBroadcastToRadio = async (incident: DispatchIncident) => {
    setBroadcastingId(incident.id);
    try {
      const radioText = `【110番緊急指令】 [区分: ${incident.priority}]
管理番号: ${incident.incident_number} / 種別: ${incident.category}
発生場所: ${incident.location}
事案概要: ${incident.title}
担当部隊: ${incident.assigned_unit || '未指定'} / 指令状態: ${incident.status}
詳細事項: ${incident.details || 'なし'}`;

      const { error } = await supabase
        .from('police_radio_messages')
        .insert({
          channel: '県内',
          body: radioText,
        });

      if (error) throw error;

      setToastMessage(`指令情報を警察無線（県内チャンネル）へ一斉送信しました。`);
      setTimeout(() => setToastMessage(''), 4000);
    } catch (err) {
      console.error('無線送出失敗:', err);
      setErrorMessage(getErrorMessage(err, '警察無線への送出に失敗しました。'));
    } finally {
      setBroadcastingId(null);
    }
  };

  const normalizePriority = (p: string) => {
    if (p.includes('1') || p.includes('緊急')) return '第1種 (緊急指令)';
    if (p.includes('2') || p.includes('重要')) return '第2種 (重要指令)';
    return '第3種 (一般指令)';
  };

  const getPriorityClass = (priorityStr: string) => {
    const p = normalizePriority(priorityStr);
    if (p === '第1種 (緊急指令)') return 'bg-red-950 text-red-200 border-red-800 font-bold';
    if (p === '第2種 (重要指令)') return 'bg-amber-950 text-amber-200 border-amber-800 font-bold';
    return 'bg-slate-800 text-slate-200 border-slate-700';
  };

  const getStatusClass = (statusStr: string) => {
    if (statusStr === '通報受付') return 'bg-red-900 text-white font-bold border-red-700';
    if (statusStr === '現場急行指示') return 'bg-amber-800 text-white font-bold border-amber-600';
    if (statusStr === '対応中' || statusStr === '現場対応中') return 'bg-blue-900 text-blue-100 font-bold border-blue-700';
    if (statusStr === '完了' || statusStr === '事案完了') return 'bg-slate-800 text-slate-300 border-slate-700';
    return 'bg-slate-700 text-slate-200 border-slate-600';
  };

  return (
    <section className="bg-slate-900 border-2 border-slate-700 text-slate-100 rounded-none shadow-lg overflow-hidden font-sans">
      {/* 官公庁・警察指令台 ヘッダー */}
      <div className="bg-slate-950 border-b border-slate-800 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-slate-800 border border-slate-700 rounded-none text-red-400">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono tracking-widest text-red-400 uppercase font-bold">
                EMERGENCY DISPATCH SYSTEM
              </span>
              <span className="text-[10px] bg-slate-800 text-slate-300 border border-slate-700 px-1.5 py-0.2">
                機密性2 (庁内限定)
              </span>
            </div>
            <h2 className="text-base font-bold text-slate-100 tracking-wide">
              110番 警察緊急指令卓（統合発令・進捗管理）
            </h2>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-red-800 hover:bg-red-700 text-white text-xs font-bold rounded-none border border-red-600 transition-colors flex items-center justify-center gap-1.5 min-h-[38px]"
        >
          {showForm ? <X className="w-4 h-4" /> : <PlusCircle className="w-4 h-4" />}
          <span>{showForm ? '入力フォーム閉じる' : '新規110番起案発令'}</span>
        </button>
      </div>

      {toastMessage && (
        <div className="bg-emerald-950 border-b border-emerald-800 px-4 py-2.5 text-xs font-bold text-emerald-200 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="bg-red-950 border-b border-red-800 px-4 py-2.5 text-xs font-bold text-red-200 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* 起案入力フォーム (実務的デザイン) */}
      {showForm && (
        <form onSubmit={handleCreateIncident} className="bg-slate-950 border-b border-slate-800 p-4 sm:p-5 space-y-4 text-xs">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <h3 className="font-bold text-slate-200 text-xs tracking-wider uppercase flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-red-400" />
              新規110番通報 指令起案票
            </h3>
            <span className="text-[11px] text-slate-500 font-mono">FORM-REF: 110-NEW</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="lg:col-span-2">
              <label className="block text-[11px] font-bold text-slate-400 mb-1">
                事案名称・通報概要 <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="例: 東栄駅北口付近における交差点交通事故"
                className="w-full px-3 py-2 border border-slate-700 bg-slate-900 text-slate-100 text-xs rounded-none focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-1">
                発生場所・現場位置 <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="例: 東栄市中央町2-4 交差点"
                className="w-full px-3 py-2 border border-slate-700 bg-slate-900 text-slate-100 text-xs rounded-none focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-1">事案種別</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as typeof CATEGORIES[number])}
                className="w-full px-3 py-2 border border-slate-700 bg-slate-900 text-slate-100 text-xs rounded-none focus:outline-none focus:border-blue-500 min-h-[36px]"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-1">指令優先度区分</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as typeof PRIORITIES[number])}
                className="w-full px-3 py-2 border border-slate-700 bg-slate-900 text-slate-100 text-xs rounded-none focus:outline-none focus:border-blue-500 min-h-[36px]"
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-1">出動指定部隊・車両</label>
              <input
                type="text"
                value={assignedUnit}
                onChange={(e) => setAssignedUnit(e.target.value)}
                placeholder="例: 東栄101号、自ら隊2号"
                className="w-full px-3 py-2 border border-slate-700 bg-slate-900 text-slate-100 text-xs rounded-none focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-1">通報者氏名</label>
              <input
                type="text"
                value={reporterName}
                onChange={(e) => setReporterName(e.target.value)}
                placeholder="例: 通報者（一般住民）"
                className="w-full px-3 py-2 border border-slate-700 bg-slate-900 text-slate-100 text-xs rounded-none focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-1">通報者連絡先電話番号</label>
              <input
                type="text"
                value={reporterPhone}
                onChange={(e) => setReporterPhone(e.target.value)}
                placeholder="例: 090-XXXX-XXXX"
                className="w-full px-3 py-2 border border-slate-700 bg-slate-900 text-slate-100 text-xs rounded-none focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-400 mb-1">指令補足情報・現場状況詳細</label>
            <textarea
              rows={2}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="現場の傷病者有無、車両特徴、進行方向等の詳細を入力"
              className="w-full px-3 py-2 border border-slate-700 bg-slate-900 text-slate-100 text-xs rounded-none focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold border border-slate-700"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-1.5 bg-red-800 hover:bg-red-700 text-white text-xs font-bold border border-red-600 disabled:opacity-50"
            >
              {submitting ? '発令中...' : '110番指令を本発令'}
            </button>
          </div>
        </form>
      )}

      {/* 指令一覧・高密度テーブル表示 */}
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between text-xs border-b border-slate-800 pb-2">
          <span className="font-bold text-slate-300 tracking-wider">
            現行発令中・過去指令案件一覧 ({incidents.length}件)
          </span>
          <span className="text-[11px] font-mono text-slate-400">
            DATABASE: REALTIME SYNC ACTIVE
          </span>
        </div>

        {loading ? (
          <p className="text-center py-8 text-xs text-slate-400 font-mono">指令データを取得中...</p>
        ) : incidents.length === 0 ? (
          <div className="text-center py-10 bg-slate-950 border border-slate-800 text-xs text-slate-400 font-mono">
            現在、発令中の110番緊急指令データはありません。
          </div>
        ) : (
          <div className="space-y-3">
            {incidents.map((item) => (
              <article
                key={item.id}
                className="bg-slate-950 border border-slate-800 p-3.5 space-y-2.5 text-xs hover:border-slate-700 transition-colors"
              >
                {/* 管理ヘッダー行 */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-slate-300 bg-slate-900 border border-slate-700 px-2 py-0.5 text-[11px]">
                      {item.incident_number}
                    </span>
                    <span className={`px-2 py-0.5 border text-[11px] ${getPriorityClass(item.priority)}`}>
                      {normalizePriority(item.priority)}
                    </span>
                    <span className="font-bold text-slate-200 text-xs">
                      {item.category}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className={`px-2.5 py-0.5 border text-[11px] ${getStatusClass(item.status)}`}>
                      {item.status}
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-500" />
                      {new Date(item.created_at).toLocaleString('ja-JP')}
                    </span>
                  </div>
                </div>

                {/* 件名 & 現場 */}
                <div className="space-y-1">
                  <h4 className="font-bold text-slate-100 text-sm">{item.title}</h4>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-slate-300 text-xs">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="font-bold text-slate-400">発生場所:</span> {item.location}
                    </span>
                    {item.assigned_unit && (
                      <span className="flex items-center gap-1 text-emerald-300 font-semibold bg-emerald-950/60 border border-emerald-800 px-2 py-0.5 text-[11px]">
                        <Car className="w-3.5 h-3.5 shrink-0" />
                        出動指定: {item.assigned_unit}
                      </span>
                    )}
                  </div>
                </div>

                {/* 詳細記述 */}
                {item.details && (
                  <p className="bg-slate-900 border border-slate-800 p-2.5 text-slate-300 text-xs leading-relaxed whitespace-pre-wrap font-sans">
                    {item.details}
                  </p>
                )}

                {/* 通報者・操作バー */}
                <div className="border-t border-slate-800 pt-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="text-[11px] text-slate-400 flex flex-wrap items-center gap-3">
                    {item.reporter_name && (
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3 text-slate-500" />
                        通報者: {item.reporter_name}
                      </span>
                    )}
                    {item.reporter_phone && (
                      <span className="flex items-center gap-1 font-mono">
                        <Phone className="w-3 h-3 text-slate-500" />
                        TEL: {item.reporter_phone}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 text-[11px] font-bold">状態変更:</span>
                    <select
                      value={item.status}
                      onChange={(e) => handleUpdateStatus(item.id, e.target.value as DispatchIncident['status'])}
                      className="bg-slate-900 border border-slate-700 text-slate-200 px-2 py-1 text-xs font-bold rounded-none focus:outline-none"
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>

                    <button
                      type="button"
                      disabled={broadcastingId === item.id}
                      onClick={() => handleBroadcastToRadio(item)}
                      className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-600 font-bold text-xs transition-colors flex items-center gap-1.5"
                    >
                      <Radio className="w-3.5 h-3.5 text-blue-400" />
                      <span>{broadcastingId === item.id ? '送信中...' : '無線Chへ送信'}</span>
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
