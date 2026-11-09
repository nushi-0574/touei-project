'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import type { User } from '@supabase/supabase-js';
import Header from '../../components/Header';
import Breadcrumbs from '../../components/Breadcrumbs';
import { ContentSkeleton } from '@/src/app/components/LoadingScreen';
import { useLocale } from '../../../lib/i18n';
import { supabase } from '../../../lib/supabase';
import ResidentAvatar from '../../components/ResidentAvatar';

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
  user_id: string;
  body: string;
  created_at: string;
};
type CommunityProfile = {
  user_id: string;
  display_name: string;
  avatar_path: string | null;
  bio: string;
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
type ProfileData = {
  full_name: string | null;
  address: string | null;
  birth_date: string | null;
  preferred_locale: string;
  resident_status?: string | null;
};
type ProfileChangeRequest = {
  id: string;
  requested_changes: Record<string, string>;
  reason: string;
  status: string;
  staff_response: string | null;
  created_at: string;
};
type ResidentDocumentRequest = {
  id: string;
  document_type: 'residence_certificate' | 'resident_status_certificate';
  purpose: string;
  status: string;
  staff_response: string | null;
  document_number: string | null;
  verification_token: string;
  issued_at: string | null;
  created_at: string;
};
type NotificationPreference = {
  category: 'service' | 'news' | 'emergency' | 'community' | 'account';
  enabled: boolean;
};
const supportCategoryKeys = [
  'operations_question',
  'operations_proposal',
  'development_question',
  'development_proposal',
  'appeal',
] as const;
type SupportCategory = (typeof supportCategoryKeys)[number];

function isSupportCategory(value: string): value is SupportCategory {
  return supportCategoryKeys.some((category) => category === value);
}

type Tab = 'applications' | 'events' | 'notifications' | 'community' | 'support' | 'id' | 'documents' | 'profile';
type ResidentApplicationForm = {
  discordName: string;
  robloxUsername: string;
  robloxDisplayName: string;
  birthDate: string;
  occupation: string;
  phoneNumber: string;
  address: string;
  housingType: string;
};

const emptyResidentApplicationForm: ResidentApplicationForm = {
  discordName: '',
  robloxUsername: '',
  robloxDisplayName: '',
  birthDate: '',
  occupation: '',
  phoneNumber: '030-///-///',
  address: '',
  housingType: '',
};

const tabKeys: { id: Tab; label: string }[] = [
  { id: 'applications', label: 'applications' },
  { id: 'events', label: 'events' },
  { id: 'notifications', label: 'notifications' },
  { id: 'community', label: 'community' },
  { id: 'support', label: 'support' },
  { id: 'documents', label: 'officialDocuments' },
  { id: 'profile', label: 'profileChanges' },
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
  const [notificationPreferences, setNotificationPreferences] = useState<Record<NotificationPreference['category'], boolean>>({
    service: true,
    news: true,
    emergency: true,
    community: true,
    account: true,
  });
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [profileChangeRequests, setProfileChangeRequests] = useState<ProfileChangeRequest[]>([]);
  const [documentRequests, setDocumentRequests] = useState<ResidentDocumentRequest[]>([]);
  const [events, setEvents] = useState<PublicEvent[]>([]);
  const [registrations, setRegistrations] = useState<string[]>([]);
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [communityProfiles, setCommunityProfiles] = useState<Record<string, CommunityProfile>>({});
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState('');
  const [ticketMessages, setTicketMessages] = useState<SupportMessage[]>([]);
  const [cardToken, setCardToken] = useState('');
  const [residentName, setResidentName] = useState('');
  const [origin, setOrigin] = useState('');
  const [applicationForm, setApplicationForm] = useState<ResidentApplicationForm>(emptyResidentApplicationForm);
  const [profileChangeForm, setProfileChangeForm] = useState({ full_name: '', address: '', birth_date: '', preferred_locale: 'ja', reason: '' });
  const [documentForm, setDocumentForm] = useState<{ document_type: ResidentDocumentRequest['document_type']; purpose: string }>({ document_type: 'residence_certificate', purpose: '' });
  const [postForm, setPostForm] = useState({ title: '', body: '' });
  const [commentForm, setCommentForm] = useState({ postId: '', body: '' });
  const [reportForm, setReportForm] = useState({ postId: '', reason: '' });
  const [ticketForm, setTicketForm] = useState<{ category: SupportCategory | 'general'; subject: string; body: string }>({ category: 'general', subject: '', body: '' });
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
      supabase.from('community_comments').select('id, post_id, user_id, body, created_at').eq('status', 'published').order('created_at').limit(200),
      supabase.from('support_tickets').select('id, subject, category, status, created_at').eq('user_id', currentUser.id).order('created_at', { ascending: false }).limit(50),
      supabase.from('resident_cards').select('verification_token').eq('user_id', currentUser.id).maybeSingle(),
      supabase.from('profiles').select('full_name, address, birth_date, preferred_locale, resident_status').eq('id', currentUser.id).maybeSingle(),
      supabase.from('profile_change_requests').select('id, requested_changes, reason, status, staff_response, created_at').eq('user_id', currentUser.id).order('created_at', { ascending: false }).limit(50),
      supabase.from('resident_document_requests').select('id, document_type, purpose, status, staff_response, document_number, verification_token, issued_at, created_at').eq('user_id', currentUser.id).order('created_at', { ascending: false }).limit(50),
      supabase.from('resident_notification_preferences').select('category, enabled').eq('user_id', currentUser.id),
    ]);
    const failed = results.find((result) => result.error);
    if (failed?.error) throw failed.error;
    const communityUserIds = [...new Set([
      currentUser.id,
      ...(results[4].data ?? []).map((post) => post.user_id),
      ...(results[5].data ?? []).map((comment) => comment.user_id),
    ])];
    const communityProfileResults = await Promise.all(
      Array.from({ length: Math.ceil(communityUserIds.length / 100) }, (_, index) =>
        supabase.rpc('get_resident_public_profiles', {
          target_user_ids: communityUserIds.slice(index * 100, (index + 1) * 100),
        }),
      ),
    );
    const failedProfileResult = communityProfileResults.find((result) => result.error);
    if (failedProfileResult?.error) throw failedProfileResult.error;
    setCommunityProfiles(Object.fromEntries(
      communityProfileResults.flatMap((result) => (result.data ?? []) as CommunityProfile[])
        .map((profile) => [profile.user_id, profile]),
    ));
    setApplications(results[0].data ?? []);
    setNotifications(results[1].data ?? []);
    setEvents(results[2].data ?? []);
    setRegistrations((results[3].data ?? []).map((item) => item.event_id));
    setPosts(results[4].data ?? []);
    setComments(results[5].data ?? []);
    setTickets(results[6].data ?? []);
    setCardToken(results[7].data?.verification_token ?? '');
    setResidentName(results[8].data?.full_name ?? '');
    const residentProfile = results[8].data as ProfileData | null;
    setProfileData(residentProfile);
    setProfileChangeForm((current) => ({
      ...current,
      full_name: residentProfile?.full_name ?? '',
      address: residentProfile?.address ?? '',
      birth_date: residentProfile?.birth_date ?? '',
      preferred_locale: residentProfile?.preferred_locale ?? 'ja',
    }));
    setProfileChangeRequests((results[9].data ?? []) as ProfileChangeRequest[]);
    setDocumentRequests((results[10].data ?? []) as ResidentDocumentRequest[]);
    setNotificationPreferences((current) => ({
      ...current,
      ...Object.fromEntries((results[11].data ?? []).map((item) => [item.category, item.enabled])),
    }));
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
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', session.user.id)
          .maybeSingle();
        if (profileError) throw profileError;
        if (!profile) {
          const { error: insertError } = await supabase.from('profiles').insert({
            id: session.user.id,
            email: session.user.email,
            full_name: session.user.user_metadata.full_name || '',
          });
          if (insertError) throw insertError;
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

  useEffect(() => {
    if (!loading && window.location.hash === '#new-application') {
      document.getElementById('new-application')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [loading]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      const requestedTab = params.get('tab');
      if (requestedTab === 'documents' || requestedTab === 'profile') {
        setTab(requestedTab);
        return;
      }
      if (requestedTab === 'community') {
        setTab('community');
        return;
      }
      if (requestedTab !== 'support') return;
      setTab('support');
      const requestedCategory = params.get('category');
      if (requestedCategory && isSupportCategory(requestedCategory)) {
        setTicketForm((current) => ({ ...current, category: requestedCategory }));
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!loading && tab === 'support' && window.location.hash === '#contact-form') {
      document.getElementById('contact-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [loading, tab]);

  async function refresh() {
    if (!user) return;
    await loadData(user);
  }

  async function submitApplication(event: React.FormEvent) {
    event.preventDefault();
    if (!user) return;
    const requiredValues = [
      applicationForm.discordName,
      applicationForm.robloxUsername,
      applicationForm.robloxDisplayName,
      applicationForm.birthDate,
      applicationForm.occupation,
    ];
    if (requiredValues.some((value) => !value.trim())) {
      setErrorMessage(t('requiredApplicationFields'));
      return;
    }
    setBusy(true);
    setErrorMessage('');
    setNotice('');
    try {
      const { error } = await supabase.from('service_applications').insert({
        user_id: user.id,
        application_type: 'resident_service',
        subject: '住民登録申請',
        details: {
          application_kind: 'resident_registration',
          discord_name: applicationForm.discordName.trim(),
          roblox_username: applicationForm.robloxUsername.trim(),
          roblox_display_name: applicationForm.robloxDisplayName.trim(),
          birth_date: applicationForm.birthDate,
          occupation: applicationForm.occupation.trim(),
          phone_number: applicationForm.phoneNumber.trim(),
          address: applicationForm.address.trim(),
          housing_type: applicationForm.housingType,
        },
      });
      if (error) throw error;
      setApplicationForm(emptyResidentApplicationForm);
      setNotice(t('applicationSubmitted'));
      await refresh();
    } catch (error) {
      console.error('行政申請を送信できませんでした:', error);
      setErrorMessage(messageOf(error));
    } finally {
      setBusy(false);
    }
  }

  async function submitProfileChange(event: React.FormEvent) {
    event.preventDefault();
    if (!user || !profileData) return;
    if (profileChangeForm.full_name.trim().length < 1 || profileChangeForm.full_name.length > 200
      || profileChangeForm.address.length > 500 || profileChangeForm.reason.trim().length < 1
      || profileChangeForm.reason.length > 2000) {
      setErrorMessage('氏名・住所・申請理由を確認してください。');
      return;
    }
    if (profileChangeForm.birth_date) {
      const date = new Date(`${profileChangeForm.birth_date}T00:00:00.000Z`);
      if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== profileChangeForm.birth_date) {
        setErrorMessage('生年月日を正しく入力してください。');
        return;
      }
    }
    if (!['ja', 'en', 'zh-CN', 'ko'].includes(profileChangeForm.preferred_locale)) {
      setErrorMessage('表示言語を選択してください。');
      return;
    }
    const requestedChanges: Record<string, string> = {};
    if (profileChangeForm.full_name.trim() !== (profileData.full_name ?? '')) requestedChanges.full_name = profileChangeForm.full_name.trim();
    if (profileChangeForm.address.trim() !== (profileData.address ?? '')) requestedChanges.address = profileChangeForm.address.trim();
    if (profileChangeForm.birth_date !== (profileData.birth_date ?? '')) requestedChanges.birth_date = profileChangeForm.birth_date;
    if (profileChangeForm.preferred_locale !== profileData.preferred_locale) requestedChanges.preferred_locale = profileChangeForm.preferred_locale;
    if (!Object.keys(requestedChanges).length) {
      setErrorMessage('変更する項目がありません。');
      return;
    }

    setBusy(true);
    setErrorMessage('');
    setNotice('');
    try {
      const { error } = await supabase.from('profile_change_requests').insert({
        user_id: user.id,
        requested_changes: requestedChanges,
        reason: profileChangeForm.reason.trim(),
      });
      if (error) throw error;
      setProfileChangeForm((current) => ({ ...current, reason: '' }));
      setNotice('住民情報の変更申請を受け付けました。');
      await refresh();
    } catch (error) {
      console.error('住民情報変更申請を送信できませんでした:', error);
      setErrorMessage(messageOf(error));
    } finally {
      setBusy(false);
    }
  }

  async function submitDocumentRequest(event: React.FormEvent) {
    event.preventDefault();
    if (!user) return;
    setBusy(true);
    setErrorMessage('');
    setNotice('');
    try {
      const { error } = await supabase.from('resident_document_requests').insert({
        user_id: user.id,
        document_type: documentForm.document_type,
        purpose: documentForm.purpose.trim(),
      });
      if (error) throw error;
      setDocumentForm((current) => ({ ...current, purpose: '' }));
      setNotice('公的書類の発行申請を受け付けました。');
      await refresh();
    } catch (error) {
      console.error('公的書類申請を送信できませんでした:', error);
      setErrorMessage(messageOf(error));
    } finally {
      setBusy(false);
    }
  }

  async function updateNotificationPreference(category: NotificationPreference['category'], enabled: boolean) {
    if (!user) return;
    setBusy(true);
    setErrorMessage('');
    try {
      const { error } = await supabase.from('resident_notification_preferences').upsert({
        user_id: user.id,
        category,
        enabled,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,category' });
      if (error) throw error;
      setNotificationPreferences((current) => ({ ...current, [category]: enabled }));
      setNotice('通知設定を保存しました。');
    } catch (error) {
      console.error('通知設定を保存できませんでした:', error);
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
        category: ticketForm.category,
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
      setTicketForm({ category: 'general', subject: '', body: '' });
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
          <ContentSkeleton />
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
                            : item.id === 'support' ? tickets.length
                              : item.id === 'documents' ? documentRequests.length
                                : item.id === 'profile' ? profileChangeRequests.length : ''}
                  </span>
                </button>
              ))}
              <Link href="/pages" className="block rounded px-3 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100">{t('publicDocuments')}</Link>
            </nav>

            <section aria-live="polite" className="min-w-0 space-y-5">
              {tab === 'applications' && (
                <>
                  <section id="new-application" className="scroll-mt-24 rounded border border-slate-200 bg-white p-5">
                    <h2 className="text-lg font-bold">{t('residentRegistrationApplication')}</h2>
                    <p className="mt-2 text-sm text-slate-600">{t('applicationFormNote')}</p>
                    <div className="mt-4 lg:hidden">
                      <p role="status" className="rounded border border-amber-300 bg-amber-50 p-4 text-sm leading-relaxed text-amber-950">
                        {t('applicationPcOnly')}
                      </p>
                    </div>
                    <div className="mt-4 hidden gap-6 lg:grid lg:grid-cols-2">
                      <form onSubmit={submitApplication} className="grid content-start gap-4">
                        <label className="grid gap-1 text-sm font-medium">{t('discordName')}
                          <input required maxLength={100} value={applicationForm.discordName} onChange={(event) => setApplicationForm({ ...applicationForm, discordName: event.target.value })} className={inputClass} />
                          <span className="text-xs font-normal text-slate-600">{t('discordNameHint')}</span>
                        </label>
                        <label className="grid gap-1 text-sm font-medium">{t('robloxUsername')}
                          <input required maxLength={100} value={applicationForm.robloxUsername} onChange={(event) => setApplicationForm({ ...applicationForm, robloxUsername: event.target.value })} className={inputClass} />
                        </label>
                        <label className="grid gap-1 text-sm font-medium">{t('robloxDisplayName')}
                          <input required maxLength={100} value={applicationForm.robloxDisplayName} onChange={(event) => setApplicationForm({ ...applicationForm, robloxDisplayName: event.target.value })} className={inputClass} />
                        </label>
                        <label className="grid gap-1 text-sm font-medium">{t('dateOfBirth')}
                          <input required type="date" value={applicationForm.birthDate} onChange={(event) => setApplicationForm({ ...applicationForm, birthDate: event.target.value })} className={inputClass} />
                        </label>
                        <label className="grid gap-1 text-sm font-medium">{t('occupation')}
                          <input required maxLength={200} value={applicationForm.occupation} onChange={(event) => setApplicationForm({ ...applicationForm, occupation: event.target.value })} className={inputClass} />
                          <span className="text-xs font-normal text-slate-600">{t('qualifiedOccupationHint')}</span>
                        </label>
                        <label className="grid gap-1 text-sm font-medium">{t('desiredPhoneNumber')}
                          <input maxLength={30} value={applicationForm.phoneNumber} onChange={(event) => setApplicationForm({ ...applicationForm, phoneNumber: event.target.value })} className={inputClass} />
                          <span className="text-xs font-normal text-slate-600">{t('phoneNumberHint')}</span>
                        </label>
                        <label className="grid gap-1 text-sm font-medium">{t('desiredAddress')}
                          <input maxLength={300} value={applicationForm.address} onChange={(event) => setApplicationForm({ ...applicationForm, address: event.target.value })} className={inputClass} />
                          <span className="text-xs font-normal text-slate-600">{t('addressInsidePrefectureHint')}</span>
                        </label>
                        <label className="grid gap-1 text-sm font-medium">{t('desiredHousingType')}
                          <select value={applicationForm.housingType} onChange={(event) => setApplicationForm({ ...applicationForm, housingType: event.target.value })} className={inputClass}>
                            <option value="">{t('noPreference')}</option>
                            <option value="tower_apartment">{t('towerApartment')}</option>
                            <option value="apartment">{t('apartment')}</option>
                            <option value="detached_house">{t('detachedHouse')}</option>
                            <option value="shared_housing">{t('sharedHousing')}</option>
                          </select>
                          <span className="text-xs font-normal text-slate-600">{t('addressHousingNotice')}</span>
                        </label>
                        <div>
                          <button disabled={busy} className={buttonClass}>{busy ? t('loading') : t('submit')}</button>
                        </div>
                      </form>
                      <article aria-label={t('applicationPreview')} className="h-fit rounded border border-slate-300 bg-[#fffdf8] p-6 shadow-sm sm:p-8">
                        <h3 className="border-b border-slate-300 pb-4 text-center text-lg font-bold tracking-widest">{t('applicationPreview')}</h3>
                        <dl className="mt-5 space-y-3 text-sm leading-relaxed">
                          {[
                            [t('discordName'), applicationForm.discordName],
                            [t('robloxUsername'), applicationForm.robloxUsername],
                            [t('robloxDisplayName'), applicationForm.robloxDisplayName],
                            [t('dateOfBirth'), applicationForm.birthDate],
                            [t('occupation'), applicationForm.occupation],
                            [t('desiredPhoneNumber'), applicationForm.phoneNumber],
                            [t('desiredAddress'), applicationForm.address],
                            [t('desiredHousingType'), applicationForm.housingType ? t(applicationForm.housingType) : ''],
                          ].map(([label, value]) => (
                            <div key={label} className="grid grid-cols-[auto_1fr] gap-2 border-b border-dotted border-slate-400 pb-1">
                              <dt className="font-semibold">{label}：</dt>
                              <dd className="min-h-5 break-words">{value}</dd>
                            </div>
                          ))}
                        </dl>
                        <p className="mt-8 text-sm leading-7">{t('applicationDeclaration')}</p>
                      </article>
                    </div>
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
                  <section className="mt-4 rounded border border-slate-200 bg-slate-50 p-4">
                    <h3 className="font-semibold">通知の受信設定</h3>
                    <p className="mt-1 text-xs text-slate-600">緊急情報は設定にかかわらず表示されます。</p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {([
                        ['service', '申請・行政手続き'],
                        ['news', 'お知らせ'],
                        ['community', 'コミュニティ'],
                        ['account', 'アカウント'],
                      ] as const).map(([category, label]) => (
                        <label key={category} className="flex items-center gap-2 rounded bg-white p-3 text-sm">
                          <input
                            type="checkbox"
                            checked={notificationPreferences[category]}
                            disabled={busy}
                            onChange={(event) => void updateNotificationPreference(category, event.target.checked)}
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                  </section>
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
                          <div className="min-w-0">
                            <h3 className="font-bold">{post.title}</h3>
                            <div className="mt-2 flex items-center gap-2">
                              <ResidentAvatar
                                path={communityProfiles[post.user_id]?.avatar_path}
                                name={communityProfiles[post.user_id]?.display_name || '住民'}
                                size="small"
                              />
                              <Link href={`/toeiken/profile/${post.user_id}`} className="text-sm font-semibold text-blue-800 hover:underline">
                                {communityProfiles[post.user_id]?.display_name || '住民'}
                              </Link>
                              <span className="text-xs text-slate-400">{readableDate(post.created_at, dateLocale)} · {post.status === 'pending' ? t('status') + ': pending' : t('published')}</span>
                            </div>
                          </div>
                          {post.user_id !== user?.id && (
                            <button type="button" onClick={() => setReportForm({ postId: post.id, reason: '' })} className="text-xs text-red-700 underline">{t('report')}</button>
                          )}
                        </div>
                        <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{post.body}</p>
                        {comments.filter((comment) => comment.post_id === post.id).map((comment) => (
                          <div key={comment.id} className="mt-3 flex items-start gap-2 border-l-2 border-slate-200 pl-3">
                            <ResidentAvatar
                              path={communityProfiles[comment.user_id]?.avatar_path}
                              name={communityProfiles[comment.user_id]?.display_name || '住民'}
                              size="small"
                            />
                            <div className="min-w-0">
                              <Link href={`/toeiken/profile/${comment.user_id}`} className="text-xs font-semibold text-blue-800 hover:underline">
                                {communityProfiles[comment.user_id]?.display_name || '住民'}
                              </Link>
                              <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-600">{comment.body}</p>
                            </div>
                          </div>
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
                  <section id="contact-form" className="scroll-mt-24 rounded border border-slate-200 bg-white p-5">
                    <h2 className="text-lg font-bold">{t('openTicket')}</h2>
                    <form onSubmit={createTicket} className="mt-4 grid gap-3">
                      <label className="grid gap-1 text-sm font-medium">{t('contactCategory')}
                        <select value={ticketForm.category} onChange={(event) => {
                          const value = event.target.value;
                          if (value === 'general' || isSupportCategory(value)) {
                            const category = value;
                            setTicketForm({ ...ticketForm, category });
                          }
                        }} className={inputClass}>
                          <option value="general">{t('generalInquiry')}</option>
                          <option value="operations_question">{t('operationsQuestion')}</option>
                          <option value="operations_proposal">{t('operationsProposal')}</option>
                          <option value="development_question">{t('developmentQuestion')}</option>
                          <option value="development_proposal">{t('developmentProposal')}</option>
                          <option value="appeal">{t('submitAppeal')}</option>
                        </select>
                      </label>
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
                              <span className="ml-2 text-xs text-slate-500">{ticket.category === 'general' ? t('generalInquiry') : t(ticket.category)} · {ticket.status}</span>
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

              {tab === 'documents' && (
                <>
                  <section className="rounded border border-slate-200 bg-white p-5">
                    <h2 className="text-lg font-bold">公的書類の発行申請</h2>
                    <p className="mt-2 text-sm text-slate-600">管理局の審査後、照合番号付きの書類を発行します。発行書類はこの画面から印刷できます。</p>
                    <form onSubmit={submitDocumentRequest} className="mt-4 grid gap-3">
                      <label className="grid gap-1 text-sm font-medium">書類の種類
                        <select value={documentForm.document_type} onChange={(event) => setDocumentForm({ ...documentForm, document_type: event.target.value as ResidentDocumentRequest['document_type'] })} className={inputClass}>
                          <option value="residence_certificate">居住証明書</option>
                          <option value="resident_status_certificate">住民登録証明書</option>
                        </select>
                      </label>
                      <label className="grid gap-1 text-sm font-medium">使用目的
                        <textarea required maxLength={500} rows={3} value={documentForm.purpose} onChange={(event) => setDocumentForm({ ...documentForm, purpose: event.target.value })} className={inputClass} />
                      </label>
                      <button disabled={busy} className={buttonClass}>{busy ? t('loading') : '発行を申請'}</button>
                    </form>
                  </section>
                  <section className="rounded border border-slate-200 bg-white p-5">
                    <h2 className="text-lg font-bold">書類申請履歴</h2>
                    <div className="mt-3 divide-y divide-slate-100">
                      {documentRequests.map((request) => (
                        <article key={request.id} className="py-4">
                          <h3 className="font-semibold">{request.document_type === 'residence_certificate' ? '居住証明書' : '住民登録証明書'}</h3>
                          <p className="mt-1 text-xs text-slate-500">{readableDate(request.created_at, dateLocale)} · 状態: {request.status}</p>
                          <p className="mt-2 whitespace-pre-wrap text-sm">使用目的: {request.purpose}</p>
                          {request.staff_response && <p className="mt-2 rounded bg-blue-50 p-3 text-sm text-blue-900">{request.staff_response}</p>}
                          {request.status === 'approved' && (
                            <Link href={`/toeiken/documents/${request.id}`} className="mt-3 inline-block rounded bg-blue-700 px-3 py-2 text-sm font-semibold text-white">
                              発行書類を表示・印刷
                            </Link>
                          )}
                        </article>
                      ))}
                      {!documentRequests.length && <p className="py-3 text-sm text-slate-500">{t('noRecords')}</p>}
                    </div>
                  </section>
                </>
              )}

              {tab === 'profile' && (
                <>
                  <section className="rounded border border-slate-200 bg-white p-5">
                    <h2 className="text-lg font-bold">住民情報の変更申請</h2>
                    <p className="mt-2 text-sm text-slate-600">申請内容は管理局が確認し、承認後に住民登録へ反映します。</p>
                    <form onSubmit={submitProfileChange} className="mt-4 grid gap-3 sm:grid-cols-2">
                      <label className="grid gap-1 text-sm font-medium">氏名
                        <input required maxLength={200} value={profileChangeForm.full_name} onChange={(event) => setProfileChangeForm({ ...profileChangeForm, full_name: event.target.value })} className={inputClass} />
                      </label>
                      <label className="grid gap-1 text-sm font-medium">住所
                        <input maxLength={500} value={profileChangeForm.address} onChange={(event) => setProfileChangeForm({ ...profileChangeForm, address: event.target.value })} className={inputClass} />
                      </label>
                      <label className="grid gap-1 text-sm font-medium">生年月日
                        <input type="date" value={profileChangeForm.birth_date} onChange={(event) => setProfileChangeForm({ ...profileChangeForm, birth_date: event.target.value })} className={inputClass} />
                      </label>
                      <label className="grid gap-1 text-sm font-medium">表示言語
                        <select value={profileChangeForm.preferred_locale} onChange={(event) => setProfileChangeForm({ ...profileChangeForm, preferred_locale: event.target.value })} className={inputClass}>
                          <option value="ja">日本語</option><option value="en">English</option><option value="zh-CN">简体中文</option><option value="ko">한국어</option>
                        </select>
                      </label>
                      <label className="grid gap-1 text-sm font-medium sm:col-span-2">変更理由
                        <textarea required maxLength={2000} rows={3} value={profileChangeForm.reason} onChange={(event) => setProfileChangeForm({ ...profileChangeForm, reason: event.target.value })} className={inputClass} />
                      </label>
                      <button disabled={busy || !profileData} className={`${buttonClass} justify-self-start sm:col-span-2`}>{busy ? t('loading') : '変更を申請'}</button>
                    </form>
                  </section>
                  <section className="rounded border border-slate-200 bg-white p-5">
                    <h2 className="text-lg font-bold">変更申請の状況</h2>
                    <div className="mt-3 divide-y divide-slate-100">
                      {profileChangeRequests.map((request) => (
                        <article key={request.id} className="py-4">
                          <p className="text-xs text-slate-500">{readableDate(request.created_at, dateLocale)} · 状態: {request.status}</p>
                          <dl className="mt-2 grid gap-2 sm:grid-cols-2">
                            {Object.entries(request.requested_changes).map(([field, value]) => (
                              <div key={field} className="rounded bg-slate-50 p-2 text-sm"><dt className="font-semibold">{field}</dt><dd className="break-words">{value || '未入力'}</dd></div>
                            ))}
                          </dl>
                          {request.staff_response && <p className="mt-2 rounded bg-blue-50 p-3 text-sm text-blue-900">{request.staff_response}</p>}
                        </article>
                      ))}
                      {!profileChangeRequests.length && <p className="py-3 text-sm text-slate-500">{t('noRecords')}</p>}
                    </div>
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
