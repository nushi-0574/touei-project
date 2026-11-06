'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import type { User } from '@supabase/supabase-js';
import Header from '../../components/Header';
import Breadcrumbs from '../../components/Breadcrumbs';
import { useLocale } from '../../../lib/i18n';
import { supabase } from '../../../lib/supabase';

type ServiceApplication = {
  id: string;
  application_type: string;
  subject: string;
  status: string;
  created_at: string;
  staff_note: string | null;
};
type ResidentNotification = {
  id: string;
  category: string;
  title: string;
  body: string;
  href: string | null;
  read_at: string | null;
  created_at: string;
};
type PublicEvent = {
  id: string;
  title: string;
  description: string;
  location: string;
  starts_at: string;
  ends_at: string;
  capacity: number | null;
};
type CommunityPost = {
  id: string;
  user_id: string;
  title: string;
  body: string;
  status: string;
  created_at: string;
};
type CommunityComment = {
  id: string;
  post_id: string;
  body: string;
  created_at: string;
};
type SupportTicket = {
  id: string;
  subject: string;
  category: string;
  status: string;
  created_at: string;
};
type SupportMessage = {
  id: string;
  user_id: string;
  body: string;
  is_staff_reply: boolean;
  created_at: string;
};

type Tab = 'applications' | 'events' | 'notifications' | 'community' | 'support' | 'id';

const tabKeys: { id: Tab; label: string }[] = [
  { id: 'applications', label: 'applications' },
  { id: 'events', label: 'events' },
  { id: 'notifications', label: 'notifications' },
  { id: 'community', label: 'community' },
  { id: 'support', label: 'support' },
  { id: 'id', label: 'digitalId' },
];

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : '処理を完了できませんでした。';
}

function internalHref(value: string | null): string | null {
  return value?.startsWith('/') && !value.startsWith('//') ? value : null;
}

function readableDate(value: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

export default function ServiceCenter() {
  const { t, locale } = useLocale();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('applications');
  const [errorMessage, setErrorMessage] = useState('');
  const [notice, setNotice] = useState('');
  const [applications, setApplications] = useState<ServiceApplication[]>([]);
  const [notifications, setNotifications] = useState<ResidentNotification[]>([]);
  const [events, setEvents] = useState<PublicEvent[]>([]);
  const [registrations, setRegistrations] = useState<string[]>([]);
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState('');
  const [ticketMessages, setTicketMessages] = useState<SupportMessage[]>([]);
  const [cardToken, setCardToken] = useState('');
  const [residentName, setResidentName] = useState('');
  const [origin, setOrigin] = useState('');
  const [applicationForm, setApplicationForm] = useState({ application_type: 'resident_service', subject: '', details: '' });
  const [postForm, setPostForm] = useState({ title: '', body: '' });
  const [commentForm, setCommentForm] = useState({ postId: '', body: '' });
  const [reportForm, setReportForm] = useState({ postId: '', reason: '' });
  const [ticketForm, setTicketForm] = useState({ subject: '', body: '' });
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);

  const dateLocale = locale === 'ja' ? 'ja-JP' : locale === 'zh-CN' ? 'zh-CN' : locale === 'ko' ? 'ko-KR' : 'en-US';
  const registeredEventIds = useMemo(() => new Set(registrations), [registrations]);

  const loadData = useCallback(async (currentUser: User) => {
    const results = await Promise.all([
      supabase.from('service_applications').select('id, application_type, subject, status, created_at, staff_note').eq('user_id', currentUser.id).order('created_at', { ascending: false }).limit(50),
      supabase.from('resident_notifications').select('id, category, title, body, href, read_at, created_at').eq('user_id', currentUser.id).order('created_at', { ascending: false }).limit(100),
      supabase.from('events').select('id, title, description, location, starts_at, ends_at, capacity').eq('status', 'published').gte('ends_at', new Date().toISOString()).order('starts_at').limit(50),
      supabase.from('event_registrations').select('event_id, status').eq('user_id', currentUser.id).eq('status', 'registered'),
      supabase.from('community_posts').select('id, user_id, title, body, status, created_at').or(`status.eq.published,user_id.eq.${currentUser.id}`).order('created_at', { ascending: false }).limit(50),
      supabase.from('community_comments').select('id, post_id, body, created_at').eq('status', 'published').order('created_at').limit(200),
      supabase.from('support_tickets').select('id, subject, category, status, created_at').eq('user_id', currentUser.id).order('created_at', { ascending: false }).limit(50),
      supabase.from('resident_cards').select('verification_token').eq('user_id', currentUser.id).maybeSingle(),
      supabase.from('profiles').select('full_name').eq('id', currentUser.id).maybeSingle(),
    ]);
    const failed = results.find((result) => result.error);
    if (failed?.error) throw failed.error;
    setApplications(results[0].data ?? []);
    setNotifications(results[1].data ?? []);
    setEvents(results[2].data ?? []);
    setRegistrations((results[3].data ?? []).map((item) => item.event_id));
    setPosts(results[4].data ?? []);
    setComments(results[5].data ?? []);
    setTickets(results[6].data ?? []);
    setCardToken(results[7].data?.verification_token ?? '');
    setResidentName(results[8].data?.full_name ?? '');
  }, []);

  useEffect(() => {
    let active = true;
    async function initialize() {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (!session) {
          router.replace('/toeiken');
          return;
        }
        await loadData(session.user);
        if (active) {
          setUser(session.user);
          setOrigin(window.location.origin);
        }
      } catch (error) {
        console.error('住民サービスの読み込みに失敗しました:', error);
        if (active) setErrorMessage(messageOf(error));
      } finally {
        if (active) setLoading(false);
      }
    }
    const timer = window.setTimeout(() => void initialize(), 0);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [loadData, router]);

  async function refresh() {
    if (!user) return;
    await loadData(user);
  }

  async function submitApplication(event: React.FormEvent) {
    event.preventDefault();
    if (!user) return;
    setBusy(true);
    setErrorMessage('');
    setNotice('');
    try {
      const { error } = await supabase.from('service_applications').insert({
        user_id: user.id,
        application_type: applicationForm.application_type,
        subject: applicationForm.subject.trim(),
        details: { description: applicationForm.details.trim() },
      });
      if (error) throw error;
      setApplicationForm({ application_type: 'resident_service', subject: '', details: '' });
      setNotice(t('applicationSubmitted'));
      await refresh();
    } catch (error) {
      console.error('行政申請を送信できませんでした:', error);
      setErrorMessage(messageOf(error));
    } finally {
      setBusy(false);
    }
  }

  async function changeNotification(id: string) {
    try {
      const { error } = await supabase.from('resident_notifications').update({ read_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
      setNotifications((current) => current.map((item) => item.id === id ? { ...item, read_at: new Date().toISOString() } : item));
    } catch (error) {
      console.error('通知を更新できませんでした:', error);
      setErrorMessage(messageOf(error));
    }
  }

  async function registerEvent(eventId: string) {
    if (!user) return;
    setBusy(true);
    setErrorMessage('');
    try {
      if (registeredEventIds.has(eventId)) {
        const { error } = await supabase.from('event_registrations').update({ status: 'cancelled' }).eq('event_id', eventId).eq('user_id', user.id);
        if (error) throw error;
        setRegistrations((current) => current.filter((id) => id !== eventId));
      } else {
        const { error } = await supabase.from('event_registrations').insert({ event_id: eventId, user_id: user.id });
        if (error) throw error;
        setRegistrations((current) => [...current, eventId]);
      }
    } catch (error) {
      console.error('イベント参加登録を更新できませんでした:', error);
      setErrorMessage(messageOf(error));
    } finally {
      setBusy(false);
    }
  }

  async function submitPost(event: React.FormEvent) {
    event.preventDefault();
    if (!user) return;
    setBusy(true);
    setErrorMessage('');
    setNotice('');
    try {
      const { error } = await supabase.from('community_posts').insert({
        user_id: user.id,
        title: postForm.title.trim(),
        body: postForm.body.trim(),
        status: 'pending',
      });
      if (error) throw error;
      setPostForm({ title: '', body: '' });
      setNotice(t('moderationNotice'));
      await refresh();
    } catch (error) {
      console.error('コミュニティ投稿を送信できませんでした:', error);
      setErrorMessage(messageOf(error));
    } finally {
      setBusy(false);
    }
  }

  async function submitComment(event: React.FormEvent) {
    event.preventDefault();
    if (!user) return;
    setBusy(true);
    setErrorMessage('');
    try {
      const { error } = await supabase.from('community_comments').insert({
        post_id: commentForm.postId,
        user_id: user.id,
        body: commentForm.body.trim(),
        status: 'pending',
      });
      if (error) throw error;
      setCommentForm({ postId: '', body: '' });
      setNotice(t('moderationNotice'));
    } catch (error) {
      console.error('コメントを送信できませんでした:', error);
      setErrorMessage(messageOf(error));
    } finally {
      setBusy(false);
    }
  }

  async function submitReport(event: React.FormEvent) {
    event.preventDefault();
    if (!user) return;
    setBusy(true);
    setErrorMessage('');
    try {
      const { error } = await supabase.from('community_reports').insert({
        post_id: reportForm.postId,
        reporter_id: user.id,
        reason: reportForm.reason.trim(),
      });
      if (error) throw error;
      setReportForm({ postId: '', reason: '' });
      setNotice(t('submit'));
    } catch (error) {
      console.error('投稿を報告できませんでした:', error);
      setErrorMessage(messageOf(error));
    } finally {
      setBusy(false);
    }
  }

  async function createTicket(event: React.FormEvent) {
    event.preventDefault();
    if (!user) return;
    setBusy(true);
    setErrorMessage('');
    setNotice('');
    try {
      const { data: ticket, error } = await supabase.from('support_tickets').insert({
        user_id: user.id,
        subject: ticketForm.subject.trim(),
      }).select('id').single();
      if (error) throw error;
      const { error: messageError } = await supabase.from('support_messages').insert({
        ticket_id: ticket.id,
        user_id: user.id,
        body: ticketForm.body.trim(),
        is_staff_reply: false,
      });
      if (messageError) {
        console.error('問い合わせは作成されましたが本文を保存できませんでした:', messageError);
        throw new Error('問い合わせは作成されましたが、本文を保存できませんでした。お問い合わせ一覧から追記してください。');
      }
      setTicketForm({ subject: '', body: '' });
      setNotice(t('submit'));
      await refresh();
    } catch (error) {
      console.error('問い合わせを作成できませんでした:', error);
      setErrorMessage(messageOf(error));
    } finally {
      setBusy(false);
    }
  }

  async function openTicket(ticketId: string) {
    setSelectedTicketId(ticketId);
    setErrorMessage('');
    try {
      const { data, error } = await supabase.from('support_messages').select('id, user_id, body, is_staff_reply, created_at').eq('ticket_id', ticketId).order('created_at');
      if (error) throw error;
      setTicketMessages(data ?? []);
    } catch (error) {
      console.error('問い合わせの内容を取得できませんでした:', error);
      setErrorMessage(messageOf(error));
    }
  }

  async function sendTicketReply(event: React.FormEvent) {
    event.preventDefault();
    if (!user || !selectedTicketId) return;
    setBusy(true);
    setErrorMessage('');
    try {
      const { error } = await supabase.from('support_messages').insert({
        ticket_id: selectedTicketId,
        user_id: user.id,
        body: reply.trim(),
        is_staff_reply: false,
      });
      if (error) throw error;
      setReply('');
      await openTicket(selectedTicketId);
    } catch (error) {
      console.error('問い合わせに返信できませんでした:', error);
      setErrorMessage(messageOf(error));
    } finally {
      setBusy(false);
    }
  }

  async function withdrawApplication(applicationId: string) {
    try {
      const { error } = await supabase.from('service_applications').update({ status: 'withdrawn' }).eq('id', applicationId);
      if (error) throw error;
      await refresh();
    } catch (error) {
      console.error('申請を取り下げられませんでした:', error);
      setErrorMessage(messageOf(error));
    }
  }

  const inputClass = 'w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100';
  const buttonClass = 'rounded bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50';

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800">
      <Header />
      <main id="main-content" className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <Breadcrumbs items={[{ label: t('residents'), href: '/toeiken/portal' }, { label: t('serviceCenter') }]} />
        <div className="mt-4 flex flex-col gap-3 border-b border-slate-300 pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-blue-700">Resident service desk</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-950">{t('serviceCenter')}</h1>
            <p className="mt-2 text-sm text-slate-600">{t('serviceCenterDescription')}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/map" className="rounded border border-slate-300 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-50">{t('map')}</Link>
            <Link href="/recruitment" className="rounded border border-slate-300 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-50">{t('recruitment')}</Link>
          </div>
        </div>

        {errorMessage && <p role="alert" className="mt-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">{errorMessage}</p>}
        {notice && <p role="status" className="mt-4 rounded border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
        {loading ? (
          <p className="py-16 text-center text-sm text-slate-500">{t('loading')}</p>
        ) : !user ? (
          <p className="py-16 text-center text-sm text-slate-500">{t('signIn')}</p>
        ) : (
          <div className="mt-6 grid items-start gap-5 lg:grid-cols-[230px_minmax(0,1fr)]">
            <nav aria-label={t('serviceCenter')} className="rounded border border-slate-200 bg-white p-2">
              {tabKeys.map((item) => (
                <button key={item.id} type="button" onClick={() => setTab(item.id)} aria-current={tab === item.id ? 'page' : undefined} className={`mb-1 w-full rounded px-3 py-3 text-left text-sm font-semibold ${tab === item.id ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'}`}>
                  {t(item.label)}
                  <span className="float-right text-xs opacity-70">
                    {item.id === 'applications' ? applications.length
                      : item.id === 'events' ? events.length
                        : item.id === 'notifications' ? notifications.filter((notification) => !notification.read_at).length
                          : item.id === 'community' ? posts.length
                            : item.id === 'support' ? tickets.length : ''}
                  </span>
                </button>
              ))}
              <Link href="/pages" className="block rounded px-3 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100">{t('publicDocuments')}</Link>
            </nav>

            <section aria-live="polite" className="min-w-0 space-y-5">
              {tab === 'applications' && (
                <>
                  <section className="rounded border border-slate-200 bg-white p-5">
                    <h2 className="text-lg font-bold">{t('newApplication')}</h2>
                    <form onSubmit={submitApplication} className="mt-4 grid gap-3">
                      <label className="grid gap-1 text-sm font-medium">{t('applicationType')}
                        <select value={applicationForm.application_type} onChange={(event) => setApplicationForm({ ...applicationForm, application_type: event.target.value })} className={inputClass}>
                          <option value="resident_service">{t('applications')}</option>
                          <option value="permit">許可・届出</option>
                          <option value="other">その他</option>
                        </select>
                      </label>
                      <label className="grid gap-1 text-sm font-medium">{t('subject')}
                        <input required maxLength={200} value={applicationForm.subject} onChange={(event) => setApplicationForm({ ...applicationForm, subject: event.target.value })} className={inputClass} />
                      </label>
                      <label className="grid gap-1 text-sm font-medium">{t('details')}
                        <textarea required maxLength={10000} rows={5} value={applicationForm.details} onChange={(event) => setApplicationForm({ ...applicationForm, details: event.target.value })} className={inputClass} />
                      </label>
                      <div><button disabled={busy} className={buttonClass}>{busy ? t('loading') : t('submit')}</button></div>
                    </form>
                  </section>
                  <section className="rounded border border-slate-200 bg-white p-5">
                    <h2 className="text-lg font-bold">{t('myApplications')}</h2>
                    {applications.length === 0 ? <p className="mt-4 text-sm text-slate-500">{t('noRecords')}</p> : (
                      <div className="mt-4 divide-y divide-slate-100">
                        {applications.map((application) => (
                          <article key={application.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <h3 className="font-semibold">{application.subject}</h3>
                              <p className="mt-1 text-xs text-slate-500">{readableDate(application.created_at, dateLocale)} · {t('status')}: {application.status}</p>
                              {application.staff_note && <p className="mt-2 rounded bg-blue-50 p-2 text-sm text-blue-900">{application.staff_note}</p>}
                            </div>
                            {['submitted', 'needs_information'].includes(application.status) && <button type="button" onClick={() => void withdrawApplication(application.id)} className="self-start text-xs font-semibold text-red-700 underline">取り下げ</button>}
                          </article>
                        ))}
                      </div>
                    )}
                  </section>
                </>
              )}

              {tab === 'events' && (
                <section className="rounded border border-slate-200 bg-white p-5">
                  <h2 className="text-lg font-bold">{t('events')}</h2>
                  {events.length === 0 ? <p className="mt-4 text-sm text-slate-500">{t('noRecords')}</p> : (
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      {events.map((event) => {
                        const registered = registeredEventIds.has(event.id);
                        return (
                          <article key={event.id} className="rounded border border-slate-200 p-4">
                            <h3 className="font-bold">{event.title}</h3>
                            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{event.description}</p>
                            <dl className="mt-3 space-y-1 text-xs text-slate-600">
                              <div><dt className="inline font-semibold">{t('startDate')}: </dt><dd className="inline">{readableDate(event.starts_at, dateLocale)}</dd></div>
                              <div><dt className="inline font-semibold">{t('endDate')}: </dt><dd className="inline">{readableDate(event.ends_at, dateLocale)}</dd></div>
                              {event.location && <div><dt className="inline font-semibold">{t('location')}: </dt><dd className="inline">{event.location}</dd></div>}
                              {event.capacity && <div><dt className="inline font-semibold">{t('capacity')}: </dt><dd className="inline">{event.capacity}</dd></div>}
                            </dl>
                            <button type="button" disabled={busy} onClick={() => void registerEvent(event.id)} className={`mt-4 rounded px-3 py-2 text-sm font-semibold ${registered ? 'border border-slate-300 bg-white text-slate-700' : buttonClass}`}>
                              {registered ? t('cancelRegistration') : t('register')}
                            </button>
                          </article>
                        );
                      })}
                    </div>
                  )}
                </section>
              )}

              {tab === 'notifications' && (
                <section className="rounded border border-slate-200 bg-white p-5">
                  <h2 className="text-lg font-bold">{t('notifications')}</h2>
                  {notifications.length === 0 ? <p className="mt-4 text-sm text-slate-500">{t('noRecords')}</p> : (
                    <div className="mt-4 divide-y divide-slate-100">
                      {notifications.map((notification) => {
                        const href = internalHref(notification.href);
                        return (
                          <article key={notification.id} className={`py-4 ${notification.read_at ? '' : 'border-l-4 border-blue-600 pl-3'}`}>
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                              <div>
                                <h3 className="font-semibold">{notification.title}</h3>
                                <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{notification.body}</p>
                                <p className="mt-2 text-xs text-slate-400">{readableDate(notification.created_at, dateLocale)} · {notification.category}</p>
                                {href && <Link href={href} className="mt-2 inline-block text-sm font-semibold text-blue-700 underline">詳細を確認</Link>}
                              </div>
                              {!notification.read_at && <button type="button" onClick={() => void changeNotification(notification.id)} className="self-start text-xs font-semibold text-blue-700 underline">{t('markRead')}</button>}
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  )}
                </section>
              )}

              {tab === 'community' && (
                <>
                  <section className="rounded border border-slate-200 bg-white p-5">
                    <h2 className="text-lg font-bold">{t('community')}</h2>
                    <p className="mt-1 text-xs text-slate-500">{t('moderationNotice')}</p>
                    <form onSubmit={submitPost} className="mt-4 grid gap-3">
                      <label className="grid gap-1 text-sm font-medium">{t('postTitle')}
                        <input required maxLength={200} value={postForm.title} onChange={(event) => setPostForm({ ...postForm, title: event.target.value })} className={inputClass} />
                      </label>
                      <label className="grid gap-1 text-sm font-medium">{t('postBody')}
                        <textarea required maxLength={10000} rows={4} value={postForm.body} onChange={(event) => setPostForm({ ...postForm, body: event.target.value })} className={inputClass} />
                      </label>
                      <div><button disabled={busy} className={buttonClass}>{t('createPost')}</button></div>
                    </form>
                  </section>
                  <section className="space-y-3">
                    {posts.length === 0 ? <p className="rounded border border-slate-200 bg-white p-5 text-sm text-slate-500">{t('noRecords')}</p> : posts.map((post) => (
                      <article key={post.id} className="rounded border border-slate-200 bg-white p-5">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="font-bold">{post.title}</h3>
                            <p className="mt-1 text-xs text-slate-400">{readableDate(post.created_at, dateLocale)} · {post.status === 'pending' ? t('status') + ': pending' : t('published')}</p>
                          </div>
                          {post.user_id !== user?.id && (
                            <button type="button" onClick={() => setReportForm({ postId: post.id, reason: '' })} className="text-xs text-red-700 underline">{t('report')}</button>
                          )}
                        </div>
                        <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{post.body}</p>
                        {comments.filter((comment) => comment.post_id === post.id).map((comment) => (
                          <p key={comment.id} className="mt-3 border-l-2 border-slate-200 pl-3 text-sm text-slate-600">{comment.body}</p>
                        ))}
                        {post.status === 'published' && (
                          <form onSubmit={submitComment} className="mt-4 flex flex-col gap-2 sm:flex-row">
                            <label className="sr-only" htmlFor={`comment-${post.id}`}>コメント</label>
                            <input id={`comment-${post.id}`} required maxLength={5000} value={commentForm.postId === post.id ? commentForm.body : ''} onChange={(event) => setCommentForm({ postId: post.id, body: event.target.value })} placeholder="コメントを入力" className={inputClass} />
                            <button disabled={busy} className="shrink-0 rounded border border-slate-300 px-3 py-2 text-xs font-semibold">{t('submit')}</button>
                          </form>
                        )}
                      </article>
                    ))}
                    {reportForm.postId && (
                      <form onSubmit={submitReport} className="rounded border border-red-200 bg-red-50 p-4">
                        <label className="grid gap-2 text-sm font-semibold">{t('reportReason')}
                          <textarea required maxLength={1000} value={reportForm.reason} onChange={(event) => setReportForm({ ...reportForm, reason: event.target.value })} className={inputClass} />
                        </label>
                        <div className="mt-3 flex gap-2">
                          <button disabled={busy} className="rounded bg-red-700 px-3 py-2 text-xs font-semibold text-white">{t('report')}</button>
                          <button type="button" onClick={() => setReportForm({ postId: '', reason: '' })} className="rounded border border-slate-300 px-3 py-2 text-xs">キャンセル</button>
                        </div>
                      </form>
                    )}
                  </section>
                </>
              )}

              {tab === 'support' && (
                <>
                  <section className="rounded border border-slate-200 bg-white p-5">
                    <h2 className="text-lg font-bold">{t('openTicket')}</h2>
                    <form onSubmit={createTicket} className="mt-4 grid gap-3">
                      <label className="grid gap-1 text-sm font-medium">{t('subject')}
                        <input required maxLength={200} value={ticketForm.subject} onChange={(event) => setTicketForm({ ...ticketForm, subject: event.target.value })} className={inputClass} />
                      </label>
                      <label className="grid gap-1 text-sm font-medium">{t('ticketMessage')}
                        <textarea required maxLength={10000} rows={4} value={ticketForm.body} onChange={(event) => setTicketForm({ ...ticketForm, body: event.target.value })} className={inputClass} />
                      </label>
                      <div><button disabled={busy} className={buttonClass}>{t('openTicket')}</button></div>
                    </form>
                  </section>
                  <section className="rounded border border-slate-200 bg-white p-5">
                    <h2 className="text-lg font-bold">{t('support')}</h2>
                    {tickets.length === 0 ? <p className="mt-4 text-sm text-slate-500">{t('noRecords')}</p> : (
                      <div className="mt-4 space-y-3">
                        {tickets.map((ticket) => (
                          <article key={ticket.id} className="rounded border border-slate-200 p-4">
                            <button type="button" onClick={() => void openTicket(ticket.id)} className="w-full text-left">
                              <span className="font-semibold">{ticket.subject}</span>
                              <span className="ml-2 text-xs text-slate-500">{ticket.status}</span>
                            </button>
                            {selectedTicketId === ticket.id && (
                              <div className="mt-3 border-t border-slate-100 pt-3">
                                <div className="space-y-2">
                                  {ticketMessages.map((item) => (
                                    <p key={item.id} className={`rounded p-3 text-sm ${item.is_staff_reply ? 'bg-blue-50' : 'bg-slate-50'}`}>{item.body}<span className="mt-1 block text-[10px] text-slate-400">{readableDate(item.created_at, dateLocale)}</span></p>
                                  ))}
                                </div>
                                {!['closed', 'resolved'].includes(ticket.status) && (
                                  <form onSubmit={sendTicketReply} className="mt-3 flex gap-2">
                                    <label className="sr-only" htmlFor={`reply-${ticket.id}`}>{t('ticketMessage')}</label>
                                    <input id={`reply-${ticket.id}`} required maxLength={10000} value={reply} onChange={(event) => setReply(event.target.value)} className={inputClass} />
                                    <button disabled={busy} className="shrink-0 rounded bg-slate-800 px-3 py-2 text-xs font-semibold text-white">{t('sendMessage')}</button>
                                  </form>
                                )}
                              </div>
                            )}
                          </article>
                        ))}
                      </div>
                    )}
                  </section>
                </>
              )}

              {tab === 'id' && (
                <section className="rounded border border-slate-200 bg-white p-5">
                  <h2 className="text-lg font-bold">{t('digitalId')}</h2>
                  {!cardToken ? (
                    <p className="mt-4 text-sm text-amber-800">住民証がまだ発行されていません。プロフィール登録後に管理者へお問い合わせください。</p>
                  ) : (
                    <div className="mt-5 max-w-lg rounded-xl border-2 border-slate-800 bg-white p-6 shadow-sm">
                      <p className="text-xs font-bold uppercase tracking-widest text-blue-700">TOEI RESIDENT CARD</p>
                      <h3 className="mt-3 text-xl font-bold">{residentName || user?.user_metadata.full_name || '氏名未登録'}</h3>
                      <p className="mt-1 text-xs text-slate-500">住民アカウントと連動する本人確認用カード</p>
                      <div className="mt-6 flex items-end justify-between gap-4">
                        <div className="text-xs text-slate-600">
                          <p>住民証番号</p>
                          <p className="mt-1 font-mono">{cardToken.slice(0, 8).toUpperCase()}</p>
                          <p className="mt-4 font-semibold text-emerald-700">有効な住民証</p>
                        </div>
                        {origin && <QRCodeSVG value={`${origin}/id/verify/${cardToken}`} size={128} level="M" title="住民証の確認用QRコード" />}
                      </div>
                    </div>
                  )}
                  <p className="mt-4 max-w-2xl text-xs leading-relaxed text-slate-500">QRコードにはランダムな確認用トークンを含みます。カードの画像やQRコードを第三者に共有しないでください。QR照会では氏名と有効状態のみ表示します。</p>
                  <Link href="/toeiken/dashboard" className="mt-4 inline-block text-sm font-semibold text-blue-700 underline">プロフィール情報を確認</Link>
                </section>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
