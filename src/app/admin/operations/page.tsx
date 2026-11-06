'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Header from '../../components/Header';
import Breadcrumbs from '../../components/Breadcrumbs';
import { ContentSkeleton } from '@/src/app/components/LoadingScreen';
import WorkItemNotes from '../WorkItemNotes';
import { supabase } from '../../../lib/supabase';

type RequestStatus = 'submitted' | 'reviewing' | 'needs_information' | 'approved' | 'rejected' | 'withdrawn';
type ResidentSummary = { id: string; full_name: string | null; email: string | null };
type Assignee = ResidentSummary;
type ProfileChangeRequest = {
  id: string;
  user_id: string;
  requested_changes: Record<string, string>;
  reason: string;
  status: RequestStatus;
  staff_response: string | null;
  assigned_to: string | null;
  due_at: string | null;
  created_at: string;
  resident: ResidentSummary | null;
};
type DocumentRequest = {
  id: string;
  user_id: string;
  document_type: 'residence_certificate' | 'resident_status_certificate';
  purpose: string;
  status: RequestStatus;
  staff_response: string | null;
  assigned_to: string | null;
  due_at: string | null;
  document_number: string | null;
  verification_token: string;
  issued_at: string | null;
  created_at: string;
  resident: (ResidentSummary & { address: string | null; birth_date: string | null }) | null;
};
type EmergencyAlert = {
  id: string;
  title: string;
  message: string;
  severity: 'information' | 'warning' | 'critical';
  area: string;
  status: 'draft' | 'published' | 'resolved';
  starts_at: string;
  ends_at: string;
  created_at: string;
};
type AuditEntry = {
  id: number;
  actor_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  target_user_id: string | null;
  changed_fields: string[];
  created_at: string;
};
type WorkspaceTab = 'overview' | 'documents' | 'profile' | 'emergency' | 'audit';
type Metrics = { applications: number; applicationsPending: number; documents: number; documentsPending: number; profileChanges: number; profileChangesPending: number; tickets: number; ticketsPending: number };

const emptyMetrics: Metrics = {
  applications: 0,
  applicationsPending: 0,
  documents: 0,
  documentsPending: 0,
  profileChanges: 0,
  profileChangesPending: 0,
  tickets: 0,
  ticketsPending: 0,
};
const requestStatusOptions: { value: RequestStatus; label: string }[] = [
  { value: 'reviewing', label: '審査中' },
  { value: 'needs_information', label: '追加情報待ち' },
  { value: 'approved', label: '承認' },
  { value: 'rejected', label: '却下' },
];
const profileFieldLabels: Record<string, string> = {
  full_name: '氏名',
  address: '住所',
  birth_date: '生年月日',
  preferred_locale: '表示言語',
};

function localDateTime(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function displayDate(value: string): string {
  return new Intl.DateTimeFormat('ja-JP', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

async function responseJson<T>(response: Response): Promise<T> {
  const value: unknown = await response.json();
  if (!response.ok) {
    const message = typeof value === 'object' && value !== null && 'error' in value && typeof value.error === 'string'
      ? value.error
      : '処理を完了できませんでした。';
    throw new Error(message);
  }
  return value as T;
}

export default function OperationsPage() {
  const [tab, setTab] = useState<WorkspaceTab>('overview');
  const [availableTabs, setAvailableTabs] = useState<WorkspaceTab[]>([]);
  const [profileRequests, setProfileRequests] = useState<ProfileChangeRequest[]>([]);
  const [profileAssignees, setProfileAssignees] = useState<Assignee[]>([]);
  const [documents, setDocuments] = useState<DocumentRequest[]>([]);
  const [documentAssignees, setDocumentAssignees] = useState<Assignee[]>([]);
  const [alerts, setAlerts] = useState<EmergencyAlert[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);
  const [metrics, setMetrics] = useState(emptyMetrics);
  const [userId, setUserId] = useState('');
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [notice, setNotice] = useState('');
  const [alertForm, setAlertForm] = useState({ title: '', message: '', severity: 'warning' as EmergencyAlert['severity'], area: '全域', starts_at: '', ends_at: '' });

  const loadData = useCallback(async () => {
    setErrorMessage('');
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    if (!session) throw new Error('ログインしてください。');
    const [{ data: profile, error: profileError }, { data: permissions, error: permissionsError }, { data: roles, error: rolesError }] = await Promise.all([
      supabase.from('profiles').select('is_admin, is_super_admin').eq('id', session.user.id).maybeSingle(),
      supabase.from('staff_permissions').select('permission').eq('user_id', session.user.id),
      supabase.from('staff_roles').select('role').eq('user_id', session.user.id),
    ]);
    if (profileError) throw profileError;
    if (permissionsError) throw permissionsError;
    if (rolesError) throw rolesError;

    const isAdmin = profile?.is_admin === true;
    const nextIsSuperAdmin = profile?.is_super_admin === true;
    const permissionSet = new Set((permissions ?? []).map((item) => item.permission as string));
    const roleSet = new Set((roles ?? []).map((item) => item.role as string));
    const canManageApplications = isAdmin || permissionSet.has('manage_applications') || roleSet.has('administration_bureau');
    const canManageProfile = isAdmin || permissionSet.has('manage_residents') || roleSet.has('administration_bureau');
    const canManageDocuments = canManageApplications || permissionSet.has('manage_residents');
    const canManageEmergency = isAdmin || permissionSet.has('manage_map') || roleSet.has('operations_bureau');
    const canManageSupport = isAdmin
      || permissionSet.has('manage_support')
      || roleSet.has('operations_bureau')
      || roleSet.has('development_bureau')
      || roleSet.has('administration_bureau');
    const nextTabs: WorkspaceTab[] = ['overview'];
    if (canManageDocuments) nextTabs.push('documents');
    if (canManageProfile) nextTabs.push('profile');
    if (canManageEmergency) nextTabs.push('emergency');
    if (nextIsSuperAdmin) nextTabs.push('audit');
    if (!canManageApplications && !canManageDocuments && !canManageProfile && !canManageEmergency && !canManageSupport) {
      throw new Error('この画面を利用する権限がありません。');
    }

    setUserId(session.user.id);
    setIsSuperAdmin(nextIsSuperAdmin);
    setAvailableTabs(nextTabs);
    if (!nextTabs.includes(tab)) setTab(nextTabs[0]);

    const token = session.access_token;
    const requests: PromiseLike<unknown>[] = [
      canManageProfile
        ? fetch('/api/admin/profile-changes', { headers: { Authorization: `Bearer ${token}` } })
            .then((response) => responseJson<{ requests: ProfileChangeRequest[]; assignees: Assignee[] }>(response))
        : Promise.resolve({ requests: [], assignees: [] }),
      canManageDocuments
        ? fetch('/api/admin/documents', { headers: { Authorization: `Bearer ${token}` } })
            .then((response) => responseJson<{ requests: DocumentRequest[]; assignees: Assignee[] }>(response))
        : Promise.resolve({ requests: [], assignees: [] }),
      canManageEmergency
        ? supabase.from('emergency_alerts').select('*').order('created_at', { ascending: false }).limit(100)
        : Promise.resolve({ data: [], error: null }),
      nextIsSuperAdmin
        ? supabase.from('staff_audit_logs').select('*').order('created_at', { ascending: false }).limit(100)
        : Promise.resolve({ data: [], error: null }),
      canManageApplications
        ? supabase.from('service_applications').select('id', { count: 'exact', head: true })
        : Promise.resolve({ count: null, error: null }),
      canManageApplications
        ? supabase.from('service_applications').select('id', { count: 'exact', head: true }).in('status', ['submitted', 'reviewing', 'needs_information'])
        : Promise.resolve({ count: null, error: null }),
      canManageDocuments
        ? supabase.from('resident_document_requests').select('id', { count: 'exact', head: true })
        : Promise.resolve({ count: null, error: null }),
      canManageDocuments
        ? supabase.from('resident_document_requests').select('id', { count: 'exact', head: true }).in('status', ['submitted', 'reviewing', 'needs_information'])
        : Promise.resolve({ count: null, error: null }),
      canManageProfile
        ? supabase.from('profile_change_requests').select('id', { count: 'exact', head: true })
        : Promise.resolve({ count: null, error: null }),
      canManageProfile
        ? supabase.from('profile_change_requests').select('id', { count: 'exact', head: true }).in('status', ['submitted', 'reviewing', 'needs_information'])
        : Promise.resolve({ count: null, error: null }),
      (isAdmin || permissionSet.has('manage_support') || roleSet.has('operations_bureau') || roleSet.has('development_bureau') || roleSet.has('administration_bureau'))
        ? supabase.from('support_tickets').select('id', { count: 'exact', head: true })
        : Promise.resolve({ count: null, error: null }),
      (isAdmin || permissionSet.has('manage_support') || roleSet.has('operations_bureau') || roleSet.has('development_bureau') || roleSet.has('administration_bureau'))
        ? supabase.from('support_tickets').select('id', { count: 'exact', head: true }).in('status', ['open', 'in_progress'])
        : Promise.resolve({ count: null, error: null }),
    ];
    const results = await Promise.all(requests);
    const profileResult = results[0] as { requests: ProfileChangeRequest[]; assignees: Assignee[] };
    const documentResult = results[1] as { requests: DocumentRequest[]; assignees: Assignee[] };
    const alertsResult = results[2] as { data: EmergencyAlert[] | null; error: { message: string } | null };
    const auditResult = results[3] as { data: AuditEntry[] | null; error: { message: string } | null };
    const countResults = results.slice(4) as { count: number | null; error: { message: string } | null }[];
    const failure = [...countResults.map((item) => item.error), alertsResult.error, auditResult.error].find(Boolean);
    if (failure) throw new Error(failure.message);

    setProfileRequests(profileResult.requests);
    setProfileAssignees(profileResult.assignees);
    setDocuments(documentResult.requests);
    setDocumentAssignees(documentResult.assignees);
    setAlerts(alertsResult.data ?? []);
    setAuditLogs(auditResult.data ?? []);
    setMetrics({
      applications: countResults[0].count ?? 0,
      applicationsPending: countResults[1].count ?? 0,
      documents: countResults[2].count ?? 0,
      documentsPending: countResults[3].count ?? 0,
      profileChanges: countResults[4].count ?? 0,
      profileChangesPending: countResults[5].count ?? 0,
      tickets: countResults[6].count ?? 0,
      ticketsPending: countResults[7].count ?? 0,
    });
  }, [tab]);

  useEffect(() => {
    let active = true;
    async function initialize() {
      try {
        await loadData();
      } catch (error) {
        console.error('業務ダッシュボードの読み込みに失敗しました:', error);
        if (active) setErrorMessage(error instanceof Error ? error.message : '業務情報を取得できませんでした。');
      } finally {
        if (active) setLoading(false);
      }
    }
    const timer = window.setTimeout(() => void initialize(), 0);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [loadData]);

  async function getAccessToken(): Promise<string> {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) throw error;
    if (!session) throw new Error('ログインしてください。');
    return session.access_token;
  }

  async function reviewRequest(kind: 'profile' | 'document', request: ProfileChangeRequest | DocumentRequest, status: RequestStatus, responseText: string, assignedTo: string, dueAt: string) {
    setBusy(true);
    setErrorMessage('');
    setNotice('');
    try {
      const token = await getAccessToken();
      const endpoint = kind === 'profile' ? '/api/admin/profile-changes' : '/api/admin/documents';
      await responseJson(await fetch(endpoint, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: request.id,
          status,
          response: responseText,
          assignedTo: assignedTo || null,
          dueAt: dueAt ? new Date(dueAt).toISOString() : null,
        }),
      }));
      setNotice(kind === 'profile' ? '住民情報変更申請を更新しました。' : '書類申請を更新しました。');
      await loadData();
    } catch (error) {
      console.error('業務申請の更新に失敗しました:', error);
      setErrorMessage(error instanceof Error ? error.message : '申請を更新できませんでした。');
    } finally {
      setBusy(false);
    }
  }

  async function saveEmergency(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setErrorMessage('');
    setNotice('');
    try {
      const startsAt = new Date(alertForm.starts_at);
      const endsAt = new Date(alertForm.ends_at);
      if (!Number.isFinite(startsAt.getTime()) || !Number.isFinite(endsAt.getTime()) || endsAt <= startsAt) {
        throw new Error('公開開始・終了日時を正しく入力してください。');
      }
      const { error } = await supabase.from('emergency_alerts').insert({
        title: alertForm.title.trim(),
        message: alertForm.message.trim(),
        severity: alertForm.severity,
        area: alertForm.area.trim() || '全域',
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        status: 'published',
        created_by: userId,
      });
      if (error) throw error;
      setAlertForm({ title: '', message: '', severity: 'warning', area: '全域', starts_at: '', ends_at: '' });
      setNotice('緊急情報を公開しました。');
      await loadData();
    } catch (error) {
      console.error('緊急情報を公開できませんでした:', error);
      setErrorMessage(error instanceof Error ? error.message : '緊急情報を保存できませんでした。');
    } finally {
      setBusy(false);
    }
  }

  async function updateEmergency(alert: EmergencyAlert, status: EmergencyAlert['status']) {
    const { error } = await supabase.from('emergency_alerts')
      .update({ status, resolved_at: status === 'resolved' ? new Date().toISOString() : null, updated_at: new Date().toISOString() })
      .eq('id', alert.id);
    if (error) {
      console.error('緊急情報を更新できませんでした:', error);
      setErrorMessage(error.message);
      return;
    }
    setNotice(status === 'resolved' ? '緊急情報を終了しました。' : '緊急情報を更新しました。');
    await loadData();
  }

  const tabs = useMemo(() => [
    { id: 'overview' as const, label: '業務状況' },
    { id: 'documents' as const, label: '証明書発行' },
    { id: 'profile' as const, label: '住民情報変更' },
    { id: 'emergency' as const, label: '緊急情報' },
    { id: 'audit' as const, label: '操作監査' },
  ].filter((item) => availableTabs.includes(item.id)), [availableTabs]);
  const inputClass = 'w-full rounded border border-slate-300 px-3 py-2 text-sm';

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800">
      <Header />
      <main id="main-content" className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <Breadcrumbs items={[{ label: '業務管理', href: '/admin/services' }, { label: '業務ダッシュボード' }]} />
        <div className="mt-4 flex flex-wrap items-end justify-between gap-3 border-b border-slate-300 pb-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-blue-700">Civic operations</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-950">業務ダッシュボード</h1>
            <p className="mt-2 text-sm text-slate-600">担当局の業務量、審査待ち、緊急情報、操作履歴を確認できます。</p>
          </div>
          <a href="/admin/services" className="text-sm font-semibold text-blue-700 underline">従来の業務管理へ</a>
        </div>
        {errorMessage && <p role="alert" className="mt-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">{errorMessage}</p>}
        {notice && <p role="status" className="mt-4 rounded border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
        {loading ? <ContentSkeleton /> : (
          <div className="mt-5 grid items-start gap-5 lg:grid-cols-[230px_minmax(0,1fr)]">
            <nav aria-label="業務ダッシュボード" className="rounded border border-slate-200 bg-white p-2">
              {tabs.map((item) => (
                <button key={item.id} type="button" aria-pressed={tab === item.id} onClick={() => setTab(item.id)} className={`mb-1 min-h-11 w-full rounded px-3 py-3 text-left text-sm font-semibold ${tab === item.id ? 'bg-slate-900 text-white' : 'hover:bg-slate-100'}`}>
                  {item.label}
                </button>
              ))}
            </nav>
            <section aria-live="polite" className="min-w-0 space-y-4">
              {tab === 'overview' && (
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    ['行政申請', metrics.applications, metrics.applicationsPending],
                    ['公的書類', metrics.documents, metrics.documentsPending],
                    ['住民情報変更', metrics.profileChanges, metrics.profileChangesPending],
                    ['問い合わせ', metrics.tickets, metrics.ticketsPending],
                  ].map(([label, total, pending]) => (
                    <article key={label} className="rounded border border-slate-200 bg-white p-5">
                      <h2 className="text-sm font-semibold text-slate-600">{label}</h2>
                      <p className="mt-2 text-3xl font-bold text-slate-950">{total}<span className="ml-2 text-sm font-normal text-slate-500">件</span></p>
                      <p className="mt-2 text-xs text-amber-800">対応中・未対応 {pending} 件</p>
                    </article>
                  ))}
                  <article className="rounded border border-slate-200 bg-white p-5 sm:col-span-2">
                    <h2 className="font-bold">業務の進め方</h2>
                    <p className="mt-2 text-sm leading-6 text-slate-600">申請を審査し、担当者と期限を設定して処理状況を更新します。住民情報の変更は管理局が確認してから登録情報へ反映されます。発行された書類には照合用の番号が付与されます。</p>
                  </article>
                </div>
              )}
              {tab === 'documents' && (
                <section className="rounded border border-slate-200 bg-white p-5">
                  <h2 className="text-lg font-bold">公的書類の審査・発行</h2>
                  <div className="mt-4 space-y-4">
                    {documents.map((request) => (
                      <DocumentReviewCard key={request.id} request={request} assignees={documentAssignees} inputClass={inputClass} busy={busy} authorId={userId} onSave={(status, response, assignedTo, dueAt) => reviewRequest('document', request, status, response, assignedTo, dueAt)} />
                    ))}
                    {!documents.length && <p className="text-sm text-slate-500">書類申請はありません。</p>}
                  </div>
                </section>
              )}
              {tab === 'profile' && (
                <section className="rounded border border-slate-200 bg-white p-5">
                  <h2 className="text-lg font-bold">住民情報の変更審査</h2>
                  <p className="mt-1 text-sm text-slate-600">承認すると申請された項目だけを住民登録情報へ反映します。</p>
                  <div className="mt-4 space-y-4">
                    {profileRequests.map((request) => (
                      <ProfileReviewCard key={request.id} request={request} assignees={profileAssignees} inputClass={inputClass} busy={busy} authorId={userId} onSave={(status, response, assignedTo, dueAt) => reviewRequest('profile', request, status, response, assignedTo, dueAt)} />
                    ))}
                    {!profileRequests.length && <p className="text-sm text-slate-500">住民情報変更の申請はありません。</p>}
                  </div>
                </section>
              )}
              {tab === 'emergency' && (
                <div className="space-y-4">
                  <section className="rounded border border-slate-200 bg-white p-5">
                    <h2 className="text-lg font-bold">緊急情報を配信</h2>
                    <form onSubmit={saveEmergency} className="mt-4 grid gap-3">
                      <label className="grid gap-1 text-sm font-semibold">見出し
                        <input required maxLength={200} value={alertForm.title} onChange={(event) => setAlertForm({ ...alertForm, title: event.target.value })} className={inputClass} />
                      </label>
                      <label className="grid gap-1 text-sm font-semibold">内容・住民への案内
                        <textarea required maxLength={5000} rows={4} value={alertForm.message} onChange={(event) => setAlertForm({ ...alertForm, message: event.target.value })} className={inputClass} />
                      </label>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="grid gap-1 text-sm font-semibold">重要度
                          <select value={alertForm.severity} onChange={(event) => setAlertForm({ ...alertForm, severity: event.target.value as EmergencyAlert['severity'] })} className={inputClass}>
                            <option value="information">情報</option><option value="warning">警戒</option><option value="critical">緊急</option>
                          </select>
                        </label>
                        <label className="grid gap-1 text-sm font-semibold">対象地域
                          <input required maxLength={200} value={alertForm.area} onChange={(event) => setAlertForm({ ...alertForm, area: event.target.value })} className={inputClass} />
                        </label>
                        <label className="grid gap-1 text-sm font-semibold">公開開始
                          <input required type="datetime-local" value={alertForm.starts_at} onChange={(event) => setAlertForm({ ...alertForm, starts_at: event.target.value })} className={inputClass} />
                        </label>
                        <label className="grid gap-1 text-sm font-semibold">公開終了
                          <input required type="datetime-local" value={alertForm.ends_at} onChange={(event) => setAlertForm({ ...alertForm, ends_at: event.target.value })} className={inputClass} />
                        </label>
                      </div>
                      <button disabled={busy} className="justify-self-start rounded bg-red-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">緊急情報を公開</button>
                    </form>
                  </section>
                  <section className="rounded border border-slate-200 bg-white p-5">
                    <h2 className="text-lg font-bold">配信履歴</h2>
                    <div className="mt-3 divide-y divide-slate-100">
                      {alerts.map((alert) => (
                        <article key={alert.id} className="py-3">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <h3 className="font-semibold">{alert.title}</h3>
                              <p className="mt-1 text-xs text-slate-500">{alert.area} · {alert.severity} · {alert.status} · {displayDate(alert.created_at)}</p>
                              <p className="mt-2 whitespace-pre-wrap text-sm">{alert.message}</p>
                            </div>
                            {alert.status !== 'resolved' && <button type="button" onClick={() => void updateEmergency(alert, 'resolved')} className="rounded border border-slate-300 px-3 py-2 text-xs font-semibold">終了</button>}
                          </div>
                        </article>
                      ))}
                      {!alerts.length && <p className="py-3 text-sm text-slate-500">緊急情報はありません。</p>}
                    </div>
                  </section>
                </div>
              )}
              {tab === 'audit' && isSuperAdmin && (
                <section className="rounded border border-slate-200 bg-white p-5">
                  <h2 className="text-lg font-bold">操作監査ログ</h2>
                  <p className="mt-1 text-sm text-slate-600">記録には操作対象と変更項目名のみを保存し、個人情報の変更前後の値は含めません。</p>
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full min-w-[700px] text-left text-sm">
                      <thead className="bg-slate-50 text-xs text-slate-600"><tr><th className="px-3 py-2">日時</th><th className="px-3 py-2">実行者</th><th className="px-3 py-2">操作</th><th className="px-3 py-2">対象</th><th className="px-3 py-2">変更項目</th></tr></thead>
                      <tbody className="divide-y divide-slate-100">
                        {auditLogs.map((entry) => (
                          <tr key={entry.id}>
                            <td className="whitespace-nowrap px-3 py-3">{displayDate(entry.created_at)}</td>
                            <td className="break-all px-3 py-3">{entry.actor_id ?? 'システム'}</td>
                            <td className="px-3 py-3">{entry.action}</td>
                            <td className="px-3 py-3">{entry.resource_type}</td>
                            <td className="px-3 py-3">{entry.changed_fields.join(', ')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {!auditLogs.length && <p className="py-4 text-sm text-slate-500">監査ログはありません。</p>}
                  </div>
                </section>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}

function AssignmentControls({ assignees, assignedTo, dueAt, onAssigneeChange, onDueAtChange, inputClass }: {
  assignees: Assignee[];
  assignedTo: string;
  dueAt: string;
  onAssigneeChange: (value: string) => void;
  onDueAtChange: (value: string) => void;
  inputClass: string;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <label className="grid gap-1 text-xs font-semibold">担当者
        <select value={assignedTo} onChange={(event) => onAssigneeChange(event.target.value)} className={inputClass}>
          <option value="">未割り当て</option>
          {assignees.map((person) => <option key={person.id} value={person.id}>{person.full_name || person.email || person.id}</option>)}
        </select>
      </label>
      <label className="grid gap-1 text-xs font-semibold">対応期限
        <input type="datetime-local" value={dueAt} onChange={(event) => onDueAtChange(event.target.value)} className={inputClass} />
      </label>
    </div>
  );
}

function ProfileReviewCard({ request, assignees, inputClass, busy, authorId, onSave }: {
  request: ProfileChangeRequest;
  assignees: Assignee[];
  inputClass: string;
  busy: boolean;
  authorId: string;
  onSave: (status: RequestStatus, response: string, assignedTo: string, dueAt: string) => Promise<void>;
}) {
  const [status, setStatus] = useState<RequestStatus>(request.status === 'submitted' ? 'reviewing' : request.status);
  const [response, setResponse] = useState(request.staff_response ?? '');
  const [assignedTo, setAssignedTo] = useState(request.assigned_to ?? '');
  const [dueAt, setDueAt] = useState(localDateTime(request.due_at));
  return (
    <article className="rounded border border-slate-200 p-4">
      <div className="flex flex-wrap justify-between gap-2">
        <div><h3 className="font-semibold">{request.resident?.full_name || request.resident?.email || request.user_id}</h3><p className="text-xs text-slate-500">{displayDate(request.created_at)} · {request.status}</p></div>
        <span className="text-xs text-slate-500">申請者ID: {request.user_id}</span>
      </div>
      <dl className="mt-3 grid gap-2 sm:grid-cols-2">
        {Object.entries(request.requested_changes).map(([field, value]) => (
          <div key={field} className="rounded bg-slate-50 p-3 text-sm"><dt className="font-semibold">{profileFieldLabels[field] ?? field}</dt><dd className="mt-1 break-words">{value || '未入力'}</dd></div>
        ))}
      </dl>
      <p className="mt-3 whitespace-pre-wrap text-sm"><span className="font-semibold">申請理由：</span>{request.reason}</p>
      <div className="mt-4 grid gap-3">
        <AssignmentControls assignees={assignees} assignedTo={assignedTo} dueAt={dueAt} onAssigneeChange={setAssignedTo} onDueAtChange={setDueAt} inputClass={inputClass} />
        <label className="grid gap-1 text-xs font-semibold">住民への連絡事項
          <textarea maxLength={2000} rows={2} value={response} onChange={(event) => setResponse(event.target.value)} className={inputClass} />
        </label>
        <div className="flex flex-wrap gap-2">
          <select value={status} onChange={(event) => setStatus(event.target.value as RequestStatus)} className={`${inputClass} max-w-56`}>
            {requestStatusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <button type="button" disabled={busy} onClick={() => void onSave(status, response, assignedTo, dueAt)} className="rounded bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">更新</button>
        </div>
      </div>
      <WorkItemNotes workItemType="profile_change" workItemId={request.id} authorId={authorId} />
    </article>
  );
}

function DocumentReviewCard({ request, assignees, inputClass, busy, authorId, onSave }: {
  request: DocumentRequest;
  assignees: Assignee[];
  inputClass: string;
  busy: boolean;
  authorId: string;
  onSave: (status: RequestStatus, response: string, assignedTo: string, dueAt: string) => Promise<void>;
}) {
  const [status, setStatus] = useState<RequestStatus>(request.status === 'submitted' ? 'reviewing' : request.status);
  const [response, setResponse] = useState(request.staff_response ?? '');
  const [assignedTo, setAssignedTo] = useState(request.assigned_to ?? '');
  const [dueAt, setDueAt] = useState(localDateTime(request.due_at));
  const label = request.document_type === 'residence_certificate' ? '居住証明書' : '住民登録証明書';
  return (
    <article className="rounded border border-slate-200 p-4">
      <div className="flex flex-wrap justify-between gap-2">
        <div><h3 className="font-semibold">{label} — {request.resident?.full_name || request.resident?.email || request.user_id}</h3><p className="text-xs text-slate-500">{displayDate(request.created_at)} · {request.status}</p></div>
        <span className="text-xs text-slate-500">申請者ID: {request.user_id}</span>
      </div>
      <p className="mt-2 text-sm">使用目的：{request.purpose}</p>
      <div className="mt-4 grid gap-3">
        <AssignmentControls assignees={assignees} assignedTo={assignedTo} dueAt={dueAt} onAssigneeChange={setAssignedTo} onDueAtChange={setDueAt} inputClass={inputClass} />
        <label className="grid gap-1 text-xs font-semibold">住民への連絡事項
          <textarea maxLength={2000} rows={2} value={response} onChange={(event) => setResponse(event.target.value)} className={inputClass} />
        </label>
        <div className="flex flex-wrap gap-2">
          <select value={status} onChange={(event) => setStatus(event.target.value as RequestStatus)} className={`${inputClass} max-w-56`}>
            {requestStatusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <button type="button" disabled={busy} onClick={() => void onSave(status, response, assignedTo, dueAt)} className="rounded bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">更新</button>
        </div>
      </div>
      <WorkItemNotes workItemType="document_request" workItemId={request.id} authorId={authorId} />
    </article>
  );
}
