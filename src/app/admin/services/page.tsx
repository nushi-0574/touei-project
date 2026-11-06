'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Header from '../../components/Header';
import Breadcrumbs from '../../components/Breadcrumbs';
import { ContentSkeleton } from '@/src/app/components/LoadingScreen';
import { useLocale } from '../../../lib/i18n';
import { supabase } from '../../../lib/supabase';

type Application = { id: string; user_id: string; subject: string; application_type: string; details: Record<string, unknown>; status: string; staff_note: string | null; created_at: string };
type EventRecord = { id: string; title: string; description: string; location: string; starts_at: string; ends_at: string; capacity: number | null; status: string };
type PostRecord = { id: string; user_id: string; title: string; body: string; status: string; created_at: string };
type CommunityReport = { id: string; post_id: string; reporter_id: string; reason: string; status: string; created_at: string };
type TicketRecord = { id: string; user_id: string; subject: string; status: string; priority: string; created_at: string };
type TicketMessage = { id: string; user_id: string; body: string; is_staff_reply: boolean; created_at: string };
type Recipient = { id: string; full_name: string | null; resident_status: string };
type WorkspaceTab = 'applications' | 'events' | 'notifications' | 'community' | 'support';

const permissionTabs: { id: WorkspaceTab; permission: string; label: string }[] = [
  { id: 'applications', permission: 'manage_applications', label: '申請審査' },
  { id: 'events', permission: 'manage_events', label: 'イベント管理' },
  { id: 'notifications', permission: 'send_notifications', label: '通知配信' },
  { id: 'community', permission: 'moderate_community', label: 'コミュニティ審査' },
  { id: 'support', permission: 'manage_support', label: '問い合わせ対応' },
];

const emptyEvent = { title: '', description: '', location: '', starts_at: '', ends_at: '', capacity: '', status: 'draft' };
const errorText = (error: unknown) => error instanceof Error ? error.message : '処理を完了できませんでした。';

export default function AdminServicesPage() {
  const { t } = useLocale();
  const [userId, setUserId] = useState('');
  const [availableTabs, setAvailableTabs] = useState<WorkspaceTab[]>([]);
  const [tab, setTab] = useState<WorkspaceTab>('applications');
  const [listSearch, setListSearch] = useState('');
  const [listStatus, setListStatus] = useState('all');
  const [listPage, setListPage] = useState(0);
  const [applications, setApplications] = useState<Application[]>([]);
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [eventRegistrationCounts, setEventRegistrationCounts] = useState<Record<string, number>>({});
  const [posts, setPosts] = useState<PostRecord[]>([]);
  const [reports, setReports] = useState<CommunityReport[]>([]);
  const [tickets, setTickets] = useState<TicketRecord[]>([]);
  const [ticketId, setTicketId] = useState('');
  const [ticketMessages, setTicketMessages] = useState<TicketMessage[]>([]);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [notice, setNotice] = useState('');
  const [eventForm, setEventForm] = useState(emptyEvent);
  const [editingEventId, setEditingEventId] = useState('');
  const [notificationForm, setNotificationForm] = useState({ userId: '', category: 'service', title: '', body: '', href: '' });
  const [reply, setReply] = useState('');

  const loadData = useCallback(async () => {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    if (!session) throw new Error('ログインしてください。');
    const [{ data: profile, error: profileError }, { data: assigned, error: permissionError }] = await Promise.all([
      supabase.from('profiles').select('is_admin').eq('id', session.user.id).maybeSingle(),
      supabase.from('staff_permissions').select('permission').eq('user_id', session.user.id),
    ]);
    if (profileError) throw profileError;
    if (permissionError) throw permissionError;
    const admin = profile?.is_admin === true;
    const permissions = (assigned ?? []).map((item) => item.permission as string);
    const tabs = permissionTabs.filter((item) => admin || permissions.includes(item.permission)).map((item) => item.id);
    setUserId(session.user.id);
    setAvailableTabs(tabs);
    if (!tabs.includes(tab) && tabs.length) setTab(tabs[0]);
    if (!tabs.length) throw new Error('業務管理権限がありません。');

    const [applicationsResult, eventsResult, registrationsResult, postsResult, reportsResult, ticketsResult] = await Promise.all([
      (admin || permissions.includes('manage_applications'))
        ? supabase.from('service_applications').select('*').order('created_at', { ascending: false }).limit(200)
        : Promise.resolve({ data: [], error: null }),
      (admin || permissions.includes('manage_events'))
        ? supabase.from('events').select('*').order('starts_at')
        : Promise.resolve({ data: [], error: null }),
      (admin || permissions.includes('manage_events'))
        ? supabase.from('event_registrations').select('event_id').eq('status', 'registered')
        : Promise.resolve({ data: [], error: null }),
      (admin || permissions.includes('moderate_community'))
        ? supabase.from('community_posts').select('*').order('created_at', { ascending: false }).limit(200)
        : Promise.resolve({ data: [], error: null }),
      (admin || permissions.includes('moderate_community'))
        ? supabase.from('community_reports').select('*').order('created_at', { ascending: false }).limit(200)
        : Promise.resolve({ data: [], error: null }),
      (admin || permissions.includes('manage_support'))
        ? supabase.from('support_tickets').select('*').order('created_at', { ascending: false }).limit(200)
        : Promise.resolve({ data: [], error: null }),
    ]);
    const failure = [applicationsResult, eventsResult, registrationsResult, postsResult, reportsResult, ticketsResult].find((result) => result.error);
    if (failure?.error) throw failure.error;
    setApplications(applicationsResult.data ?? []);
    setEvents(eventsResult.data ?? []);
    setEventRegistrationCounts((registrationsResult.data ?? []).reduce((counts, registration) => {
      counts[registration.event_id] = (counts[registration.event_id] ?? 0) + 1;
      return counts;
    }, {} as Record<string, number>));
    setPosts(postsResult.data ?? []);
    setReports(reportsResult.data ?? []);
    setTickets(ticketsResult.data ?? []);

    if (admin || permissions.includes('send_notifications')) {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (!currentSession) throw new Error('ログイン状態を確認できませんでした。');
      const response = await fetch('/api/admin/notifications', { headers: { Authorization: `Bearer ${currentSession.access_token}` } });
      const result: unknown = await response.json();
      if (!response.ok) throw new Error(typeof result === 'object' && result && 'error' in result && typeof result.error === 'string' ? result.error : t('error'));
      if (typeof result === 'object' && result && 'recipients' in result && Array.isArray(result.recipients)) {
        setRecipients(result.recipients as Recipient[]);
      }
    }
  }, [tab, t]);

  useEffect(() => {
    let active = true;
    async function initialize() {
      try {
        await loadData();
      } catch (error) {
        console.error('業務管理情報の読み込みに失敗しました:', error);
        if (active) setErrorMessage(errorText(error));
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

  async function getAccessToken() {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) throw error;
    if (!session) throw new Error('ログインしてください。');
    return session.access_token;
  }

  async function updateApplication(applicationId: string, status: string, staffNote: string) {
    setErrorMessage('');
    try {
      const { error } = await supabase.from('service_applications').update({ status, staff_note: staffNote.trim() || null, updated_at: new Date().toISOString() }).eq('id', applicationId);
      if (error) throw error;
      setNotice('申請の審査状況を更新しました。');
      await loadData();
    } catch (error) {
      console.error('申請を更新できませんでした:', error);
      setErrorMessage(errorText(error));
    }
  }

  async function saveEvent(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setErrorMessage('');
    try {
      const startsAt = new Date(eventForm.starts_at);
      const endsAt = new Date(eventForm.ends_at);
      if (!Number.isFinite(startsAt.getTime()) || !Number.isFinite(endsAt.getTime()) || endsAt <= startsAt) {
        throw new Error('イベントの開始・終了日時を正しく入力してください。');
      }
      const capacity = eventForm.capacity.trim() ? Number(eventForm.capacity) : null;
      if (capacity !== null && (!Number.isInteger(capacity) || capacity < 1)) throw new Error('定員は1以上の整数を入力してください。');
      const payload = {
        title: eventForm.title.trim(),
        description: eventForm.description.trim(),
        location: eventForm.location.trim(),
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        capacity,
        status: eventForm.status,
        updated_at: new Date().toISOString(),
      };
      const result = editingEventId
        ? await supabase.from('events').update(payload).eq('id', editingEventId)
        : await supabase.from('events').insert({ ...payload, created_by: userId });
      if (result.error) throw result.error;
      setEventForm(emptyEvent);
      setEditingEventId('');
      setNotice('イベントを保存しました。');
      await loadData();
    } catch (error) {
      console.error('イベントを保存できませんでした:', error);
      setErrorMessage(errorText(error));
    } finally {
      setBusy(false);
    }
  }

  async function removeEvent(id: string) {
    if (!window.confirm('このイベントを削除しますか。申込済みの参加登録も削除されます。')) return;
    try {
      const { error } = await supabase.from('events').delete().eq('id', id);
      if (error) throw error;
      await loadData();
    } catch (error) {
      console.error('イベントを削除できませんでした:', error);
      setErrorMessage(errorText(error));
    }
  }

  async function sendNotification(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setErrorMessage('');
    try {
      const token = await getAccessToken();
      const response = await fetch('/api/admin/notifications', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(notificationForm),
      });
      const result: unknown = await response.json();
      if (!response.ok) throw new Error(typeof result === 'object' && result && 'error' in result && typeof result.error === 'string' ? result.error : t('error'));
      setNotificationForm({ userId: '', category: 'service', title: '', body: '', href: '' });
      setNotice('住民へ通知を配信しました。');
    } catch (error) {
      console.error('住民通知を配信できませんでした:', error);
      setErrorMessage(errorText(error));
    } finally {
      setBusy(false);
    }
  }

  async function moderatePost(post: PostRecord, status: string) {
    try {
      const { error } = await supabase.from('community_posts').update({ status, updated_at: new Date().toISOString() }).eq('id', post.id);
      if (error) throw error;
      setNotice('投稿状態を更新しました。');
      await loadData();
    } catch (error) {
      console.error('投稿を審査できませんでした:', error);
      setErrorMessage(errorText(error));
    }
  }

  async function updateReport(report: CommunityReport, status: string) {
    try {
      const { error } = await supabase.from('community_reports').update({ status }).eq('id', report.id);
      if (error) throw error;
      setNotice('報告状況を更新しました。');
      await loadData();
    } catch (error) {
      console.error('コミュニティ報告を更新できませんでした:', error);
      setErrorMessage(errorText(error));
    }
  }

  async function openTicket(id: string) {
    setTicketId(id);
    try {
      const { data, error } = await supabase.from('support_messages').select('*').eq('ticket_id', id).order('created_at');
      if (error) throw error;
      setTicketMessages(data ?? []);
    } catch (error) {
      console.error('問い合わせを取得できませんでした:', error);
      setErrorMessage(errorText(error));
    }
  }

  async function sendSupportReply(event: React.FormEvent) {
    event.preventDefault();
    if (!ticketId || !userId) return;
    setBusy(true);
    try {
      const { error } = await supabase.from('support_messages').insert({ ticket_id: ticketId, user_id: userId, body: reply.trim(), is_staff_reply: true });
      if (error) throw error;
      const { error: ticketError } = await supabase.from('support_tickets').update({ status: 'waiting_for_resident', updated_at: new Date().toISOString() }).eq('id', ticketId);
      if (ticketError) throw ticketError;
      setReply('');
      await openTicket(ticketId);
      setNotice('返信を送信しました。');
    } catch (error) {
      console.error('問い合わせに返信できませんでした:', error);
      setErrorMessage(errorText(error));
    } finally {
      setBusy(false);
    }
  }

  const inputClass = 'w-full rounded border border-slate-300 px-3 py-2 text-sm';
  const normalizedSearch = listSearch.trim().toLocaleLowerCase();
  const includesSearch = (...values: (string | null | undefined)[]) =>
    !normalizedSearch || values.some((value) => value?.toLocaleLowerCase().includes(normalizedSearch));
  const filteredApplications = applications.filter((item) =>
    (listStatus === 'all' || item.status === listStatus)
    && includesSearch(item.subject, item.application_type, item.user_id),
  );
  const filteredEvents = events.filter((item) =>
    (listStatus === 'all' || item.status === listStatus)
    && includesSearch(item.title, item.location),
  );
  const filteredPosts = posts.filter((item) =>
    (listStatus === 'all' || item.status === listStatus)
    && includesSearch(item.title, item.body, item.user_id),
  );
  const filteredReports = reports.filter((item) =>
    (listStatus === 'all' || item.status === listStatus)
    && includesSearch(item.reason, item.post_id, item.reporter_id),
  );
  const filteredTickets = tickets.filter((item) =>
    (listStatus === 'all' || item.status === listStatus)
    && includesSearch(item.subject, item.user_id),
  );
  const pageSize = 20;
  const listForTab = tab === 'applications' ? filteredApplications
    : tab === 'events' ? filteredEvents
      : tab === 'community' ? filteredPosts
        : tab === 'support' ? filteredTickets
          : [];
  const listPageCount = tab === 'community'
    ? Math.max(1, Math.ceil(filteredPosts.length / pageSize), Math.ceil(filteredReports.length / pageSize))
    : Math.max(1, Math.ceil(listForTab.length / pageSize));
  const pagedApplications = filteredApplications.slice(listPage * pageSize, (listPage + 1) * pageSize);
  const pagedEvents = filteredEvents.slice(listPage * pageSize, (listPage + 1) * pageSize);
  const pagedPosts = filteredPosts.slice(listPage * pageSize, (listPage + 1) * pageSize);
  const pagedReports = filteredReports.slice(listPage * pageSize, (listPage + 1) * pageSize);
  const pagedTickets = filteredTickets.slice(listPage * pageSize, (listPage + 1) * pageSize);
  const listStatusOptions: Record<WorkspaceTab, { value: string; label: string }[]> = {
    applications: [
      { value: 'submitted', label: '受付' }, { value: 'reviewing', label: '審査中' },
      { value: 'needs_information', label: '追加情報待ち' }, { value: 'approved', label: '承認' },
      { value: 'rejected', label: '却下' }, { value: 'withdrawn', label: '取り下げ' },
    ],
    events: [
      { value: 'draft', label: '非公開' }, { value: 'published', label: '公開中' },
      { value: 'cancelled', label: '中止' },
    ],
    notifications: [],
    community: [
      { value: 'pending', label: '審査待ち' }, { value: 'published', label: '公開' },
      { value: 'hidden', label: '非表示' }, { value: 'open', label: '未確認報告' },
      { value: 'reviewed', label: '確認済み報告' }, { value: 'dismissed', label: '対応不要' },
    ],
    support: [
      { value: 'open', label: '未対応' }, { value: 'in_progress', label: '対応中' },
      { value: 'waiting_for_resident', label: '住民の返信待ち' }, { value: 'resolved', label: '解決' },
      { value: 'closed', label: '終了' },
    ],
  };
  const filteredCount = tab === 'community'
    ? `${filteredPosts.length} 件の投稿 · ${filteredReports.length} 件の報告`
    : `${listForTab.length} 件`;

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800">
      <Header />
      <main id="main-content" className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <Breadcrumbs items={[{ label: '管理者パネル', href: '/admin' }, { label: '業務管理' }]} />
        <div className="mt-4 flex flex-wrap items-end justify-between gap-3 border-b border-slate-300 pb-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-blue-700">Operations workspace</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-950">業務管理</h1>
            <p className="mt-2 text-sm text-slate-600">付与された担当権限の範囲で、申請・イベント・通知・投稿・問い合わせを処理します。</p>
          </div>
          <div className="flex gap-3">
            <Link href="/admin/residents" className="text-sm font-semibold text-blue-700 underline">住民登録簿</Link>
            <Link href="/admin" className="text-sm font-semibold text-blue-700 underline">管理者パネルへ</Link>
          </div>
        </div>
        {errorMessage && <p role="alert" className="mt-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">{errorMessage}</p>}
        {notice && <p role="status" className="mt-4 rounded border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
        {loading ? <ContentSkeleton /> : (
          <div className="mt-5 grid items-start gap-5 lg:grid-cols-[230px_minmax(0,1fr)]">
            <nav aria-label="業務管理メニュー" className="rounded border border-slate-200 bg-white p-2">
              {permissionTabs.filter((item) => availableTabs.includes(item.id)).map((item) => (
                <button key={item.id} type="button" aria-pressed={tab === item.id} onClick={() => { setTab(item.id); setListSearch(''); setListStatus('all'); setListPage(0); }} className={`mb-1 min-h-11 w-full rounded px-3 py-3 text-left text-sm font-semibold ${tab === item.id ? 'bg-slate-900 text-white' : 'hover:bg-slate-100'}`}>{item.label}</button>
              ))}
              <Link href="/admin" className="block rounded px-3 py-3 text-sm font-semibold hover:bg-slate-100">CMS・サイト設定</Link>
            </nav>

            <section aria-live="polite" className="min-w-0 space-y-4">
              {tab !== 'notifications' && (
                <div className="grid gap-3 rounded border border-slate-200 bg-white p-3 sm:grid-cols-[minmax(0,1fr)_200px_auto] sm:items-end">
                  <label className="grid gap-1 text-xs font-semibold" htmlFor="operations-search">
                    この一覧を検索
                    <input
                      id="operations-search"
                      type="search"
                      value={listSearch}
                      onChange={(event) => { setListSearch(event.target.value); setListPage(0); }}
                      className={inputClass}
                    />
                  </label>
                  <label className="grid gap-1 text-xs font-semibold" htmlFor="operations-status">
                    状態で絞り込み
                    <select
                      id="operations-status"
                      value={listStatus}
                      onChange={(event) => { setListStatus(event.target.value); setListPage(0); }}
                      className={inputClass}
                    >
                      <option value="all">すべての状態</option>
                      {listStatusOptions[tab].map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </label>
                  <div className="flex items-center justify-between gap-3 text-xs text-slate-600 sm:justify-end">
                    <span className="min-w-0">{filteredCount}{tab === 'community' ? '' : ' · 対象は最新200件'}</span>
                    <div className="flex gap-2">
                      <button type="button" disabled={listPage === 0} onClick={() => setListPage((page) => page - 1)} className="min-h-10 rounded border border-slate-300 px-3 disabled:opacity-40">前へ</button>
                      <span className="self-center whitespace-nowrap">{listPage + 1} / {listPageCount}</span>
                      <button type="button" disabled={listPage + 1 >= listPageCount} onClick={() => setListPage((page) => page + 1)} className="min-h-10 rounded border border-slate-300 px-3 disabled:opacity-40">次へ</button>
                    </div>
                  </div>
                </div>
              )}
              {tab === 'applications' && availableTabs.includes('applications') && (
                <section className="rounded border border-slate-200 bg-white p-5">
                  <h2 className="text-lg font-bold">住民からの申請</h2>
                  {pagedApplications.length === 0 ? <p className="mt-4 text-sm text-slate-500">{t('noRecords')}</p> : pagedApplications.map((application) => (
                    <ApplicationRow key={application.id} application={application} onSave={updateApplication} />
                  ))}
                </section>
              )}

              {tab === 'events' && availableTabs.includes('events') && (
                <>
                  <section className="rounded border border-slate-200 bg-white p-5">
                    <h2 className="text-lg font-bold">{editingEventId ? 'イベントを編集' : 'イベントを作成'}</h2>
                    <form onSubmit={saveEvent} className="mt-4 grid gap-3 md:grid-cols-2">
                      <label className="grid gap-1 text-xs font-semibold">イベント名
                        <input required maxLength={200} value={eventForm.title} onChange={(event) => setEventForm({ ...eventForm, title: event.target.value })} className={inputClass} />
                      </label>
                      <label className="grid gap-1 text-xs font-semibold">{t('location')}
                        <input maxLength={500} value={eventForm.location} onChange={(event) => setEventForm({ ...eventForm, location: event.target.value })} className={inputClass} />
                      </label>
                      <label className="grid gap-1 text-xs font-semibold">{t('startDate')}
                        <input required type="datetime-local" value={eventForm.starts_at} onChange={(event) => setEventForm({ ...eventForm, starts_at: event.target.value })} className={inputClass} />
                      </label>
                      <label className="grid gap-1 text-xs font-semibold">{t('endDate')}
                        <input required type="datetime-local" value={eventForm.ends_at} onChange={(event) => setEventForm({ ...eventForm, ends_at: event.target.value })} className={inputClass} />
                      </label>
                      <label className="grid gap-1 text-xs font-semibold">{t('capacity')}
                        <input type="number" min="1" step="1" value={eventForm.capacity} onChange={(event) => setEventForm({ ...eventForm, capacity: event.target.value })} className={inputClass} />
                      </label>
                      <label className="grid gap-1 text-xs font-semibold">公開状態
                        <select value={eventForm.status} onChange={(event) => setEventForm({ ...eventForm, status: event.target.value })} className={inputClass}>
                          <option value="draft">非公開</option><option value="published">公開中</option><option value="cancelled">中止</option>
                        </select>
                      </label>
                      <label className="grid gap-1 text-xs font-semibold md:col-span-2">{t('description')}
                        <textarea rows={4} maxLength={10000} value={eventForm.description} onChange={(event) => setEventForm({ ...eventForm, description: event.target.value })} className={inputClass} />
                      </label>
                      <div className="flex gap-2 md:col-span-2">
                        <button disabled={busy} className="rounded bg-blue-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{t('save')}</button>
                        {editingEventId && <button type="button" onClick={() => { setEditingEventId(''); setEventForm(emptyEvent); }} className="rounded border border-slate-300 px-4 py-2 text-sm">キャンセル</button>}
                      </div>
                    </form>
                  </section>
                  <section className="rounded border border-slate-200 bg-white p-5">
                    <h2 className="text-lg font-bold">登録済みイベント</h2>
                    <div className="mt-3 divide-y divide-slate-100">
                      {pagedEvents.map((event) => (
                        <div key={event.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                          <div><p className="font-semibold">{event.title}</p><p className="text-xs text-slate-500">{new Date(event.starts_at).toLocaleString()} · {event.status} · 参加登録 {eventRegistrationCounts[event.id] ?? 0}{event.capacity ? ` / ${event.capacity}` : ''}</p></div>
                          <div className="flex gap-2">
                            <button type="button" onClick={() => { setEditingEventId(event.id); setEventForm({ ...event, starts_at: new Date(new Date(event.starts_at).getTime() - new Date(event.starts_at).getTimezoneOffset() * 60000).toISOString().slice(0, 16), ends_at: new Date(new Date(event.ends_at).getTime() - new Date(event.ends_at).getTimezoneOffset() * 60000).toISOString().slice(0, 16), capacity: event.capacity ? String(event.capacity) : '' }); }} className="rounded border border-slate-300 px-3 py-1.5 text-xs">編集</button>
                            <button type="button" onClick={() => void removeEvent(event.id)} className="rounded border border-red-300 px-3 py-1.5 text-xs text-red-700">{t('delete')}</button>
                          </div>
                        </div>
                      ))}
                      {!filteredEvents.length && <p className="py-4 text-sm text-slate-500">{t('noRecords')}</p>}
                    </div>
                  </section>
                </>
              )}

              {tab === 'notifications' && availableTabs.includes('notifications') && (
                <section className="rounded border border-slate-200 bg-white p-5">
                  <h2 className="text-lg font-bold">住民への通知配信</h2>
                  <form onSubmit={sendNotification} className="mt-4 grid gap-3">
                    <label className="grid gap-1 text-sm font-semibold">配信先
                      <select required value={notificationForm.userId} onChange={(event) => setNotificationForm({ ...notificationForm, userId: event.target.value })} className={inputClass}>
                        <option value="">住民を選択</option>
                        {recipients.map((recipient) => <option key={recipient.id} value={recipient.id}>{recipient.full_name || '氏名未登録'} ({recipient.id.slice(0, 8)})</option>)}
                      </select>
                    </label>
                    <label className="grid gap-1 text-sm font-semibold">カテゴリ
                      <input maxLength={100} value={notificationForm.category} onChange={(event) => setNotificationForm({ ...notificationForm, category: event.target.value })} className={inputClass} />
                    </label>
                    <label className="grid gap-1 text-sm font-semibold">件名
                      <input required maxLength={200} value={notificationForm.title} onChange={(event) => setNotificationForm({ ...notificationForm, title: event.target.value })} className={inputClass} />
                    </label>
                    <label className="grid gap-1 text-sm font-semibold">本文
                      <textarea required maxLength={5000} rows={5} value={notificationForm.body} onChange={(event) => setNotificationForm({ ...notificationForm, body: event.target.value })} className={inputClass} />
                    </label>
                    <label className="grid gap-1 text-sm font-semibold">サイト内リンク（任意）
                      <input type="text" placeholder="/toeiken/services" value={notificationForm.href} onChange={(event) => setNotificationForm({ ...notificationForm, href: event.target.value })} className={inputClass} />
                    </label>
                    <button disabled={busy || !recipients.length} className="justify-self-start rounded bg-blue-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{busy ? t('loading') : '通知を配信'}</button>
                  </form>
                </section>
              )}

              {tab === 'community' && availableTabs.includes('community') && (
                <>
                <section className="rounded border border-slate-200 bg-white p-5">
                  <h2 className="text-lg font-bold">住民投稿の審査</h2>
                  <div className="mt-4 space-y-3">
                    {pagedPosts.map((post) => (
                      <article key={post.id} className="rounded border border-slate-200 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div><h3 className="font-semibold">{post.title}</h3><p className="text-xs text-slate-500">投稿者: {post.user_id} · {new Date(post.created_at).toLocaleString()}</p></div>
                          <span className="rounded bg-slate-100 px-2 py-1 text-xs">{post.status}</span>
                        </div>
                        <p className="mt-3 whitespace-pre-wrap text-sm">{post.body}</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {['published', 'pending', 'hidden'].map((status) => <button key={status} type="button" disabled={post.status === status} onClick={() => void moderatePost(post, status)} className="rounded border border-slate-300 px-3 py-1.5 text-xs disabled:opacity-40">{status}</button>)}
                        </div>
                      </article>
                    ))}
                    {!filteredPosts.length && <p className="text-sm text-slate-500">{t('noRecords')}</p>}
                  </div>
                </section>
                <section className="rounded border border-slate-200 bg-white p-5">
                  <h2 className="text-lg font-bold">住民からの報告</h2>
                  <div className="mt-4 divide-y divide-slate-100">
                    {pagedReports.map((report) => (
                      <article key={report.id} className="py-3">
                        <p className="text-sm font-semibold">投稿ID: {report.post_id}</p>
                        <p className="mt-1 text-xs text-slate-500">報告者: {report.reporter_id} · {new Date(report.created_at).toLocaleString()} · {report.status}</p>
                        <p className="mt-2 whitespace-pre-wrap text-sm">{report.reason}</p>
                        <div className="mt-2 flex gap-2">
                          {['reviewed', 'dismissed'].map((status) => <button key={status} type="button" disabled={report.status === status} onClick={() => void updateReport(report, status)} className="rounded border border-slate-300 px-3 py-1 text-xs disabled:opacity-40">{status}</button>)}
                        </div>
                      </article>
                    ))}
                    {!filteredReports.length && <p className="text-sm text-slate-500">{t('noRecords')}</p>}
                  </div>
                </section>
                </>
              )}

              {tab === 'support' && availableTabs.includes('support') && (
                <section className="rounded border border-slate-200 bg-white p-5">
                  <h2 className="text-lg font-bold">住民からの問い合わせ</h2>
                  <div className="mt-4 grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)]">
                    <div className="divide-y divide-slate-100">
                      {pagedTickets.map((ticket) => (
                        <button key={ticket.id} type="button" onClick={() => void openTicket(ticket.id)} className={`block w-full p-3 text-left hover:bg-slate-50 ${ticket.id === ticketId ? 'bg-blue-50' : ''}`}>
                          <span className="block text-sm font-semibold">{ticket.subject}</span>
                          <span className="mt-1 block text-xs text-slate-500">{ticket.status} · {ticket.priority} · {ticket.user_id.slice(0, 8)}</span>
                        </button>
                      ))}
                      {!filteredTickets.length && <p className="p-3 text-sm text-slate-500">{t('noRecords')}</p>}
                    </div>
                    {ticketId && (
                      <div className="border-t border-slate-100 pt-3 xl:border-l xl:border-t-0 xl:pl-4">
                        <div className="space-y-2">
                          {ticketMessages.map((message) => <p key={message.id} className={`rounded p-3 text-sm ${message.is_staff_reply ? 'bg-blue-50' : 'bg-slate-50'}`}>{message.body}<span className="mt-1 block text-[10px] text-slate-400">{new Date(message.created_at).toLocaleString()}</span></p>)}
                        </div>
                        <form onSubmit={sendSupportReply} className="mt-4 space-y-2">
                          <label className="grid gap-1 text-sm font-semibold">返信
                            <textarea required maxLength={10000} rows={4} value={reply} onChange={(event) => setReply(event.target.value)} className={inputClass} />
                          </label>
                          <button disabled={busy} className="rounded bg-blue-700 px-4 py-2 text-sm font-bold text-white">{t('sendMessage')}</button>
                        </form>
                      </div>
                    )}
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

function ApplicationRow({ application, onSave }: { application: Application; onSave: (id: string, status: string, note: string) => Promise<void> }) {
  const [status, setStatus] = useState(application.status);
  const [note, setNote] = useState(application.staff_note ?? '');
  const details = typeof application.details?.description === 'string' ? application.details.description : JSON.stringify(application.details);
  return (
    <article className="border-b border-slate-100 py-4">
      <h3 className="font-semibold">{application.subject}</h3>
      <p className="mt-1 text-xs text-slate-500">{application.application_type} · {new Date(application.created_at).toLocaleString()} · {application.user_id}</p>
      <p className="mt-3 whitespace-pre-wrap rounded bg-slate-50 p-3 text-sm">{details}</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-[180px_1fr_auto]">
        <label className="grid gap-1 text-xs font-semibold">審査状況
          <select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded border border-slate-300 px-2 py-2 text-sm">
            {['submitted', 'reviewing', 'needs_information', 'approved', 'rejected', 'withdrawn'].map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-semibold">住民へ表示する連絡事項
          <input value={note} onChange={(event) => setNote(event.target.value)} className="rounded border border-slate-300 px-2 py-2 text-sm" />
        </label>
        <button type="button" onClick={() => void onSave(application.id, status, note)} className="self-end rounded bg-slate-800 px-3 py-2 text-xs font-semibold text-white">更新</button>
      </div>
    </article>
  );
}
