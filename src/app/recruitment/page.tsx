'use client';

import { useCallback, useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import Header from '../components/Header';
import Breadcrumbs from '../components/Breadcrumbs';
import { ContentSkeleton } from '@/src/app/components/LoadingScreen';
import { useLocale } from '../../lib/i18n';
import { supabase } from '../../lib/supabase';

type Posting = {
  id: string;
  title: string;
  department: string;
  description: string;
  application_opens_at: string;
  application_closes_at: string;
  eligibility: string;
  hiring_conditions: string;
  notes: string;
  is_published: boolean;
};
type JobApplication = {
  id: string;
  posting_id: string;
  user_id: string;
  answers: { motivation?: string; notes?: string };
  status: string;
  staff_note: string | null;
  submitted_at: string;
};
type PostingForm = Omit<Posting, 'id'> & { id?: string };

const emptyPosting: PostingForm = {
  title: '',
  department: '',
  description: '',
  application_opens_at: '',
  application_closes_at: '',
  eligibility: '',
  hiring_conditions: '',
  notes: '',
  is_published: false,
};

const applicationStatuses = ['received', 'screening', 'interview', 'offered', 'rejected'];

function toLocalDateTime(value: string) {
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function dateLabel(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

export default function RecruitmentPage() {
  const { t, locale } = useLocale();
  const dateLocale = locale === 'ja' ? 'ja-JP' : locale === 'zh-CN' ? 'zh-CN' : locale === 'ko' ? 'ko-KR' : 'en-US';
  const [user, setUser] = useState<User | null>(null);
  const [postings, setPostings] = useState<Posting[]>([]);
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState('');
  const [form, setForm] = useState<PostingForm>(emptyPosting);
  const [applicationText, setApplicationText] = useState<Record<string, string>>({});
  const [errorMessage, setErrorMessage] = useState('');
  const [notice, setNotice] = useState('');

  const loadData = useCallback(async () => {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    if (!session) throw new Error('採用情報の利用にはログインが必要です。');
    const [{ data: profile, error: profileError }, { data: permissions, error: permissionsError }, { data: jobs, error: jobsError }, { data: submitted, error: applicationsError }] = await Promise.all([
      supabase.from('profiles').select('is_admin').eq('id', session.user.id).maybeSingle(),
      supabase.from('staff_permissions').select('permission').eq('user_id', session.user.id).eq('permission', 'manage_recruitment'),
      supabase.from('recruitment_postings').select('*').order('application_opens_at', { ascending: false }),
      supabase.from('recruitment_applications').select('*').order('submitted_at', { ascending: false }).limit(200),
    ]);
    if (profileError) throw profileError;
    if (permissionsError) throw permissionsError;
    if (jobsError) throw jobsError;
    if (applicationsError) throw applicationsError;
    setUser(session.user);
    setCanManage(profile?.is_admin === true || permissions?.some((item) => item.permission === 'manage_recruitment') === true);
    setPostings(jobs ?? []);
    setApplications(submitted ?? []);
  }, []);

  useEffect(() => {
    let active = true;
    async function initialize() {
      try {
        await loadData();
        if (active) setNow(Date.now());
      } catch (error) {
        console.error('採用情報の読み込みに失敗しました:', error);
        if (active) setErrorMessage(error instanceof Error ? error.message : t('error'));
      } finally {
        if (active) setLoading(false);
      }
    }
    const timer = window.setTimeout(() => void initialize(), 0);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [loadData, t]);

  function setField<K extends keyof PostingForm>(key: K, value: PostingForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function savePosting(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setErrorMessage('');
    setNotice('');
    try {
      const opensAt = new Date(form.application_opens_at);
      const closesAt = new Date(form.application_closes_at);
      if (!Number.isFinite(opensAt.getTime()) || !Number.isFinite(closesAt.getTime()) || closesAt <= opensAt) {
        throw new Error('応募期間の開始日時と終了日時を正しく設定してください。');
      }
      const payload = {
        title: form.title.trim(),
        department: form.department.trim(),
        description: form.description.trim(),
        application_opens_at: opensAt.toISOString(),
        application_closes_at: closesAt.toISOString(),
        eligibility: form.eligibility.trim(),
        hiring_conditions: form.hiring_conditions.trim(),
        notes: form.notes.trim(),
        is_published: form.is_published,
        updated_at: new Date().toISOString(),
      };
      const result = editingId
        ? await supabase.from('recruitment_postings').update(payload).eq('id', editingId)
        : await supabase.from('recruitment_postings').insert({ ...payload, created_by: user?.id });
      if (result.error) throw result.error;
      setForm(emptyPosting);
      setEditingId('');
      setNotice('採用情報を保存しました。');
      await loadData();
    } catch (error) {
      console.error('採用情報を保存できませんでした:', error);
      setErrorMessage(error instanceof Error ? error.message : t('error'));
    } finally {
      setBusy(false);
    }
  }

  async function editPosting(posting: Posting) {
    setEditingId(posting.id);
    setForm({
      ...posting,
      application_opens_at: toLocalDateTime(posting.application_opens_at),
      application_closes_at: toLocalDateTime(posting.application_closes_at),
    });
  }

  async function deletePosting(postingId: string) {
    if (!window.confirm('この採用情報を削除しますか。応募者がいる場合は削除できません。')) return;
    setErrorMessage('');
    try {
      const { error } = await supabase.from('recruitment_postings').delete().eq('id', postingId);
      if (error) throw error;
      setNotice('採用情報を削除しました。');
      await loadData();
    } catch (error) {
      console.error('採用情報を削除できませんでした:', error);
      setErrorMessage(error instanceof Error ? error.message : t('error'));
    }
  }

  async function apply(postingId: string) {
    if (!user) return;
    const motivation = applicationText[postingId]?.trim() ?? '';
    if (motivation.length < 20) {
      setErrorMessage('応募内容を20文字以上入力してください。');
      return;
    }
    setBusy(true);
    setErrorMessage('');
    setNotice('');
    try {
      const { error } = await supabase.from('recruitment_applications').insert({
        posting_id: postingId,
        user_id: user.id,
        answers: { motivation },
      });
      if (error) throw error;
      setApplicationText((current) => ({ ...current, [postingId]: '' }));
      setNotice(t('applicationSubmitted'));
      await loadData();
    } catch (error) {
      console.error('採用応募を送信できませんでした:', error);
      setErrorMessage(error instanceof Error ? error.message : t('error'));
    } finally {
      setBusy(false);
    }
  }

  async function updateApplication(applicationId: string, status: string, staffNote: string) {
    setErrorMessage('');
    try {
      const { error } = await supabase.from('recruitment_applications').update({
        status,
        staff_note: staffNote.trim() || null,
        updated_at: new Date().toISOString(),
      }).eq('id', applicationId);
      if (error) throw error;
      setNotice('応募状況を更新しました。');
      await loadData();
    } catch (error) {
      console.error('応募状況を更新できませんでした:', error);
      setErrorMessage(error instanceof Error ? error.message : t('error'));
    }
  }

  const inputClass = 'w-full rounded border border-slate-300 px-3 py-2 text-sm';

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800">
      <Header />
      <main id="main-content" className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <Breadcrumbs items={[{ label: t('residents'), href: '/toeiken/portal' }, { label: t('recruitment') }]} />
        <div className="mt-4 border-b border-slate-300 pb-5">
          <p className="text-xs font-bold uppercase tracking-widest text-blue-700">Recruitment office</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-950">{t('recruitment')}</h1>
          <p className="mt-2 text-sm text-slate-600">{t('recruitmentIntro')}</p>
        </div>
        {errorMessage && <p role="alert" className="mt-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">{errorMessage}</p>}
        {notice && <p role="status" className="mt-4 rounded border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
        {loading ? <ContentSkeleton /> : (
          <div className="mt-5 grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
            <section className="space-y-4">
              <h2 className="text-lg font-bold">{t('recruitment')}</h2>
              {postings.length === 0 ? (
                <p className="rounded border border-slate-200 bg-white p-5 text-sm text-slate-500">{t('noRecords')}</p>
              ) : postings.map((posting) => {
                const existingApplication = applications.find((application) => application.posting_id === posting.id && application.user_id === user?.id);
                const currentlyOpen = now !== null && posting.is_published && now >= new Date(posting.application_opens_at).getTime() && now <= new Date(posting.application_closes_at).getTime();
                return (
                  <article key={posting.id} className="rounded border border-slate-200 bg-white p-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-xs font-semibold text-blue-700">{posting.department}</p>
                        <h3 className="mt-1 text-lg font-bold">{posting.title}</h3>
                      </div>
                      <span className={`self-start rounded px-2 py-1 text-xs font-semibold ${currentlyOpen ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                        {currentlyOpen ? t('acceptingApplications') : t('applicationsClosed')}
                      </span>
                    </div>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{posting.description}</p>
                    <dl className="mt-4 grid gap-3 border-t border-slate-100 pt-4 text-sm sm:grid-cols-2">
                      <div><dt className="text-xs font-bold text-slate-500">{t('applicationWindow')}</dt><dd className="mt-1">{dateLabel(posting.application_opens_at, dateLocale)} – {dateLabel(posting.application_closes_at, dateLocale)}</dd></div>
                      <div><dt className="text-xs font-bold text-slate-500">{t('eligibility')}</dt><dd className="mt-1 whitespace-pre-wrap">{posting.eligibility || '—'}</dd></div>
                      <div><dt className="text-xs font-bold text-slate-500">{t('hiringConditions')}</dt><dd className="mt-1 whitespace-pre-wrap">{posting.hiring_conditions || '—'}</dd></div>
                      <div><dt className="text-xs font-bold text-slate-500">{t('notes')}</dt><dd className="mt-1 whitespace-pre-wrap">{posting.notes || '—'}</dd></div>
                    </dl>
                    {existingApplication ? (
                      <p className="mt-4 rounded bg-blue-50 p-3 text-sm text-blue-900">{t('status')}: {existingApplication.status} · {dateLabel(existingApplication.submitted_at, dateLocale)}</p>
                    ) : currentlyOpen && (
                      <div className="mt-4 border-t border-slate-100 pt-4">
                        <label className="grid gap-1 text-sm font-semibold">{t('motivation')}
                          <textarea required minLength={20} maxLength={10000} rows={5} value={applicationText[posting.id] ?? ''} onChange={(event) => setApplicationText((current) => ({ ...current, [posting.id]: event.target.value }))} className={inputClass} />
                        </label>
                        <button type="button" disabled={busy} onClick={() => void apply(posting.id)} className="mt-3 rounded bg-blue-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{t('apply')}</button>
                      </div>
                    )}
                    {canManage && (
                      <div className="mt-4 flex gap-2 border-t border-slate-100 pt-3">
                        <button type="button" onClick={() => void editPosting(posting)} className="rounded border border-slate-300 px-3 py-1.5 text-xs font-semibold">{t('editPosting')}</button>
                        <button type="button" onClick={() => void deletePosting(posting.id)} className="rounded border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700">{t('delete')}</button>
                      </div>
                    )}
                  </article>
                );
              })}

              {canManage && (
                <section className="rounded border border-slate-200 bg-white p-5">
                  <h2 className="text-lg font-bold">応募者・選考状況</h2>
                  {applications.length === 0 ? <p className="mt-3 text-sm text-slate-500">{t('noRecords')}</p> : (
                    <div className="mt-4 divide-y divide-slate-100">
                      {applications.map((application) => (
                        <ApplicationReview
                          key={application.id}
                          application={application}
                          postings={postings}
                          onSave={updateApplication}
                          selectionStatusLabel={t('selectionStatus')}
                          internalNoteLabel={t('internalNote')}
                        />
                      ))}
                    </div>
                  )}
                </section>
              )}
            </section>

            {canManage && (
              <aside className="rounded border border-slate-200 bg-white">
                <div className="bg-slate-900 p-4 text-white">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-blue-300">{t('recruitmentManagement')}</p>
                  <h2 className="mt-1 font-bold">{editingId ? t('editPosting') : t('createPosting')}</h2>
                </div>
                <form onSubmit={savePosting} className="space-y-3 p-4">
                  <label className="grid gap-1 text-xs font-semibold">募集職種・タイトル
                    <input required maxLength={200} value={form.title} onChange={(event) => setField('title', event.target.value)} className={inputClass} />
                  </label>
                  <label className="grid gap-1 text-xs font-semibold">{t('department')}
                    <input maxLength={200} value={form.department} onChange={(event) => setField('department', event.target.value)} className={inputClass} />
                  </label>
                  <label className="grid gap-1 text-xs font-semibold">{t('description')}
                    <textarea rows={4} maxLength={10000} value={form.description} onChange={(event) => setField('description', event.target.value)} className={inputClass} />
                  </label>
                  <label className="grid gap-1 text-xs font-semibold">{t('applicationWindow')} — 開始
                    <input required aria-label={`${t('applicationWindow')} ${t('periodStart')}`} type="datetime-local" value={form.application_opens_at} onChange={(event) => setField('application_opens_at', event.target.value)} className={inputClass} />
                  </label>
                  <label className="grid gap-1 text-xs font-semibold">{t('applicationWindow')} — 終了
                    <input required aria-label={`${t('applicationWindow')} ${t('periodEnd')}`} type="datetime-local" value={form.application_closes_at} onChange={(event) => setField('application_closes_at', event.target.value)} className={inputClass} />
                  </label>
                  <label className="grid gap-1 text-xs font-semibold">{t('eligibility')}
                    <textarea rows={3} maxLength={5000} value={form.eligibility} onChange={(event) => setField('eligibility', event.target.value)} className={inputClass} />
                  </label>
                  <label className="grid gap-1 text-xs font-semibold">{t('hiringConditions')}
                    <textarea rows={3} maxLength={5000} value={form.hiring_conditions} onChange={(event) => setField('hiring_conditions', event.target.value)} className={inputClass} />
                  </label>
                  <label className="grid gap-1 text-xs font-semibold">{t('notes')}
                    <textarea rows={2} maxLength={5000} value={form.notes} onChange={(event) => setField('notes', event.target.value)} className={inputClass} />
                  </label>
                  <label className="flex items-center gap-2 text-xs font-semibold">
                    <input type="checkbox" checked={form.is_published} onChange={(event) => setField('is_published', event.target.checked)} />
                    {t('published')}
                  </label>
                  <button disabled={busy} className="w-full rounded bg-blue-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{busy ? t('loading') : t('save')}</button>
                  {editingId && <button type="button" onClick={() => { setEditingId(''); setForm(emptyPosting); }} className="w-full rounded border border-slate-300 px-4 py-2 text-sm">{'編集をキャンセル'}</button>}
                </form>
              </aside>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function ApplicationReview({
  application,
  postings,
  onSave,
  selectionStatusLabel,
  internalNoteLabel,
}: {
  application: JobApplication;
  postings: Posting[];
  onSave: (id: string, status: string, note: string) => Promise<void>;
  selectionStatusLabel: string;
  internalNoteLabel: string;
}) {
  const [status, setStatus] = useState(application.status);
  const [note, setNote] = useState(application.staff_note ?? '');
  const postingTitle = postings.find((posting) => posting.id === application.posting_id)?.title ?? application.posting_id;
  return (
    <article className="py-4">
      <p className="font-semibold">{postingTitle}</p>
      <p className="mt-1 text-xs text-slate-500">応募者ID: {application.user_id} · {new Date(application.submitted_at).toLocaleString()}</p>
      <p className="mt-2 whitespace-pre-wrap rounded bg-slate-50 p-3 text-sm">{application.answers?.motivation ?? ''}</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-[160px_1fr_auto]">
        <label className="grid gap-1 text-xs font-semibold">{selectionStatusLabel}
          <select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded border border-slate-300 px-2 py-2">
            {applicationStatuses.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-semibold">{internalNoteLabel}
          <input value={note} onChange={(event) => setNote(event.target.value)} className="rounded border border-slate-300 px-2 py-2" />
        </label>
        <button type="button" onClick={() => void onSave(application.id, status, note)} className="self-end rounded bg-slate-800 px-3 py-2 text-xs font-semibold text-white">更新</button>
      </div>
    </article>
  );
}
