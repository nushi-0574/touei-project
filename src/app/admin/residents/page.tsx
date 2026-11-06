'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '../../components/Header';
import Breadcrumbs from '../../components/Breadcrumbs';
import { supabase } from '../../../lib/supabase';

type Resident = {
  id: string;
  email: string | null;
  full_name: string | null;
  address: string | null;
  birth_date: string | null;
  resident_status: 'active' | 'inactive' | 'pending';
  created_at: string;
  is_admin: boolean;
  is_super_admin: boolean;
  is_police_staff: boolean;
};

type Permission = {
  user_id: string;
  permission: string;
};

const permissions = [
  ['manage_residents', '住民情報管理'],
  ['manage_applications', '申請審査'],
  ['manage_events', 'イベント管理'],
  ['moderate_community', 'コミュニティ moderation'],
  ['manage_support', '問い合わせ対応'],
  ['manage_map', '地図・施設管理'],
  ['manage_recruitment', '採用管理'],
  ['manage_content', 'コンテンツ管理'],
  ['send_notifications', '住民通知配信'],
] as const;

function getError(payload: unknown): string {
  if (typeof payload === 'object' && payload !== null && 'error' in payload && typeof payload.error === 'string') {
    return payload.error;
  }
  return '処理を完了できませんでした。';
}

export default function ResidentRegistryPage() {
  const [residents, setResidents] = useState<Resident[]>([]);
  const [assignedPermissions, setAssignedPermissions] = useState<Permission[]>([]);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const [notice, setNotice] = useState('');
  const [inviteForm, setInviteForm] = useState({ email: '', full_name: '', address: '', birth_date: '' });
  const [permissionsDraft, setPermissionsDraft] = useState<Record<string, string[]>>({});
  const [savingPermissionsFor, setSavingPermissionsFor] = useState('');
  const [updatingResidentId, setUpdatingResidentId] = useState('');
  const router = useRouter();

  const getAccessToken = useCallback(async () => {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) throw error;
    if (!session) {
      router.replace('/login');
      throw new Error('ログインしてください。');
    }
    return session.access_token;
  }, [router]);

  const loadResidents = useCallback(async () => {
    setLoading(true);
    setErrorMessage('');
    try {
      const token = await getAccessToken();
      const params = new URLSearchParams({ page: String(page) });
      if (search) params.set('q', search);
      const response = await fetch(`/api/admin/residents?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const result: unknown = await response.json();
      if (!response.ok) throw new Error(getError(result));
      if (typeof result !== 'object' || result === null || !('residents' in result) || !Array.isArray(result.residents)) {
        throw new Error('住民一覧の応答形式が正しくありません。');
      }

      const payload = result as {
        residents: Resident[];
        permissions?: Permission[];
        isSuperAdmin?: boolean;
        total?: number;
      };
      setResidents(payload.residents);
      setAssignedPermissions(payload.permissions ?? []);
      setTotal(payload.total ?? 0);
      setIsSuperAdmin(payload.isSuperAdmin === true);
      setPermissionsDraft(Object.fromEntries(
        payload.residents.map((resident) => [
          resident.id,
          (payload.permissions ?? [])
            .filter((entry) => entry.user_id === resident.id)
            .map((entry) => entry.permission),
        ]),
      ));
    } catch (error) {
      console.error('住民登録簿の取得に失敗しました:', error);
      setErrorMessage(error instanceof Error ? error.message : '住民一覧を取得できませんでした。');
    } finally {
      setLoading(false);
    }
  }, [getAccessToken, page, search]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadResidents(), 0);
    return () => window.clearTimeout(timer);
  }, [loadResidents]);

  async function addResident(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setErrorMessage('');
    setNotice('');
    try {
      const token = await getAccessToken();
      const response = await fetch('/api/admin/residents', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(inviteForm),
      });
      const result: unknown = await response.json();
      if (!response.ok) throw new Error(getError(result));
      setInviteForm({ email: '', full_name: '', address: '', birth_date: '' });
      setNotice('住民を登録し、Supabaseの招待メールを送信しました。');
      setPage(0);
      setSearch('');
      await loadResidents();
    } catch (error) {
      console.error('住民の招待に失敗しました:', error);
      setErrorMessage(error instanceof Error ? error.message : '住民を登録できませんでした。');
    } finally {
      setSaving(false);
    }
  }

  async function savePermissions(userId: string) {
    setSavingPermissionsFor(userId);
    setErrorMessage('');
    setNotice('');
    try {
      const token = await getAccessToken();
      const response = await fetch('/api/admin/permissions', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, permissions: permissionsDraft[userId] ?? [] }),
      });
      const result: unknown = await response.json();
      if (!response.ok) throw new Error(getError(result));
      setNotice('職員権限を更新しました。');
      await loadResidents();
    } catch (error) {
      console.error('職員権限の保存に失敗しました:', error);
      setErrorMessage(error instanceof Error ? error.message : '職員権限を更新できませんでした。');
    } finally {
      setSavingPermissionsFor('');
    }
  }

  async function toggleResidentStatus(resident: Resident) {
    const status = resident.resident_status === 'active' ? 'inactive' : 'active';
    const action = status === 'active' ? '有効化' : '利用停止';
    if (!window.confirm(`${resident.full_name || resident.email || resident.id} を${action}しますか。${status === 'inactive' ? '住民証も無効になります。' : ''}`)) return;
    setUpdatingResidentId(resident.id);
    setErrorMessage('');
    setNotice('');
    try {
      const token = await getAccessToken();
      const response = await fetch('/api/admin/residents', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ residentId: resident.id, status }),
      });
      const result: unknown = await response.json();
      if (!response.ok) throw new Error(getError(result));
      setNotice(status === 'active' ? '住民を有効化しました。' : '住民を利用停止にしました。');
      await loadResidents();
    } catch (error) {
      console.error('住民状態を変更できませんでした:', error);
      setErrorMessage(error instanceof Error ? error.message : '住民状態を変更できませんでした。');
    } finally {
      setUpdatingResidentId('');
    }
  }

  function togglePermission(userId: string, permission: string) {
    setPermissionsDraft((current) => {
      const existing = current[userId] ?? [];
      return {
        ...current,
        [userId]: existing.includes(permission)
          ? existing.filter((value) => value !== permission)
          : [...existing, permission],
      };
    });
  }

  const activeCount = residents.filter((resident) => resident.resident_status === 'active').length;
  const pageCount = Math.max(1, Math.ceil(total / 50));

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800">
      <Header />
      <main id="main-content" className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <Breadcrumbs items={[{ label: '管理者パネル', href: '/admin' }, { label: '住民登録・職員管理' }]} />
        <div className="mt-4 flex flex-col gap-4 border-b border-slate-300 pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-blue-700">Resident registry / staff operations</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-950">住民登録・職員管理</h1>
            <p className="mt-2 text-sm text-slate-600">登録情報の検索・確認、招待による住民登録、担当業務ごとの職員権限を管理します。</p>
          </div>
          <Link href="/admin" className="text-sm font-semibold text-blue-700 hover:underline">管理者パネルへ戻る</Link>
        </div>

        <section aria-label="住民登録状況" className="my-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-500">検索結果</p>
            <p className="mt-1 text-2xl font-bold">{errorMessage ? '—' : total}<span className="ml-1 text-xs font-normal">件</span></p>
          </div>
          <div className="rounded border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-500">このページの有効住民</p>
            <p className="mt-1 text-2xl font-bold">{activeCount}<span className="ml-1 text-xs font-normal">名</span></p>
          </div>
          <div className="rounded border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-500">1ページの表示件数</p>
            <p className="mt-1 text-2xl font-bold">50<span className="ml-1 text-xs font-normal">件</span></p>
          </div>
          <div className="rounded border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-500">職員権限設定</p>
            <p className="mt-1 text-sm font-bold">{isSuperAdmin ? '主任管理者' : '閲覧のみ'}</p>
          </div>
        </section>

        {errorMessage && <p role="alert" className="mb-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">{errorMessage}</p>}
        {notice && <p role="status" className="mb-4 rounded border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}

        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <section className="min-w-0 overflow-hidden rounded border border-slate-200 bg-white">
            <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-bold text-slate-900">住民登録簿</h2>
                <p className="mt-1 text-xs text-slate-500">登録済みの住民情報を確認できます。生年月日・住所は管理業務上の取扱いに注意してください。</p>
              </div>
              <form
                className="flex gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  setPage(0);
                  setSearch(query.trim());
                }}
              >
                <label className="sr-only" htmlFor="resident-search">氏名またはメールアドレスで検索</label>
                <input id="resident-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="氏名・メールアドレス" className="min-w-0 rounded border border-slate-300 px-3 py-2 text-sm" />
                <button className="rounded bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700">検索</button>
              </form>
            </div>

            {loading ? (
              <p className="p-8 text-center text-sm text-slate-500">住民情報を読み込んでいます...</p>
            ) : errorMessage ? (
              <p className="p-8 text-center text-sm text-slate-500">住民一覧を表示できません。</p>
            ) : residents.length === 0 ? (
              <p className="p-8 text-center text-sm text-slate-500">該当する住民は登録されていません。</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[860px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs text-slate-600">
                    <tr>
                      <th scope="col" className="px-4 py-3">住民</th>
                      <th scope="col" className="px-4 py-3">連絡先・住所</th>
                      <th scope="col" className="px-4 py-3">生年月日</th>
                      <th scope="col" className="px-4 py-3">状態・登録日・操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {residents.map((resident) => (
                      <tr key={resident.id} className="align-top">
                        <td className="px-4 py-4">
                          <p className="font-semibold text-slate-900">{resident.full_name || '氏名未登録'}</p>
                          <p className="mt-1 break-all text-xs text-slate-500">{resident.email || 'メール未登録'}</p>
                          <p className="mt-1 font-mono text-[10px] text-slate-400">{resident.id}</p>
                        </td>
                        <td className="max-w-xs px-4 py-4">
                          <p className="break-all">{resident.address || '住所未登録'}</p>
                          <div className="mt-2 flex flex-wrap gap-1">
                            {resident.is_super_admin && <span className="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-900">主任管理者</span>}
                            {resident.is_admin && !resident.is_super_admin && <span className="rounded bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-900">管理者</span>}
                            {resident.is_police_staff && <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-900">警察職員</span>}
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-4 py-4">{resident.birth_date || '未登録'}</td>
                        <td className="whitespace-nowrap px-4 py-4">
                          <span className={`rounded px-2 py-1 text-xs font-semibold ${resident.resident_status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'}`}>
                            {resident.resident_status === 'active' ? '有効' : resident.resident_status === 'inactive' ? '無効' : '確認待ち'}
                          </span>
                          <p className="mt-2 text-xs text-slate-500">{new Intl.DateTimeFormat('ja-JP', { dateStyle: 'medium' }).format(new Date(resident.created_at))}</p>
                          <button
                            type="button"
                            disabled={updatingResidentId === resident.id || resident.is_super_admin}
                            onClick={() => void toggleResidentStatus(resident)}
                            className="mt-2 rounded border border-slate-300 px-2 py-1 text-[11px] font-semibold disabled:opacity-40"
                          >
                            {updatingResidentId === resident.id ? '更新中...' : resident.resident_status === 'active' ? '利用停止' : '有効化'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex items-center justify-between border-t border-slate-200 p-3 text-sm">
              <span className="text-xs text-slate-500">ページ {page + 1} / {pageCount}</span>
              <div className="flex gap-2">
                <button type="button" disabled={page === 0 || loading} onClick={() => setPage((value) => value - 1)} className="rounded border border-slate-300 px-3 py-1.5 disabled:opacity-40">前へ</button>
                <button type="button" disabled={page + 1 >= pageCount || loading} onClick={() => setPage((value) => value + 1)} className="rounded border border-slate-300 px-3 py-1.5 disabled:opacity-40">次へ</button>
              </div>
            </div>

            {isSuperAdmin && (
              <div className="border-t border-slate-200 p-4">
                <h2 className="font-bold text-slate-900">職員業務権限</h2>
                <p className="mt-1 text-xs text-slate-500">チェックした担当業務だけを付与します。管理者権限・主任管理者権限はこの設定では変更できません。</p>
                <div className="mt-4 space-y-3">
                  {residents.filter((resident) => !resident.is_super_admin).map((resident) => (
                    <details key={resident.id} className="rounded border border-slate-200 p-3">
                      <summary className="cursor-pointer text-sm font-semibold">{resident.full_name || resident.email || resident.id} — {(assignedPermissions.filter((item) => item.user_id === resident.id).length)} 権限</summary>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        {permissions.map(([key, label]) => (
                          <label key={key} className="flex items-center gap-2 text-xs">
                            <input type="checkbox" checked={(permissionsDraft[resident.id] ?? []).includes(key)} onChange={() => togglePermission(resident.id, key)} />
                            {label}
                          </label>
                        ))}
                      </div>
                      <button type="button" disabled={savingPermissionsFor === resident.id} onClick={() => void savePermissions(resident.id)} className="mt-3 rounded bg-slate-800 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">
                        {savingPermissionsFor === resident.id ? '保存中...' : '担当権限を保存'}
                      </button>
                    </details>
                  ))}
                </div>
              </div>
            )}
          </section>

          <aside className="rounded border border-slate-200 bg-white">
            <div className="border-b border-slate-200 bg-slate-900 p-4 text-white">
              <p className="text-[10px] font-bold uppercase tracking-widest text-blue-300">Resident onboarding</p>
              <h2 className="mt-1 text-lg font-bold">住民を新規登録</h2>
              <p className="mt-1 text-xs text-slate-300">登録後、本人確認用のSupabase招待メールを送信します。</p>
            </div>
            <form onSubmit={addResident} className="space-y-4 p-4">
              <div>
                <label htmlFor="invite-name" className="mb-1 block text-xs font-semibold">氏名 <span className="text-red-600">*</span></label>
                <input id="invite-name" required maxLength={200} value={inviteForm.full_name} onChange={(event) => setInviteForm({ ...inviteForm, full_name: event.target.value })} className="w-full rounded border border-slate-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label htmlFor="invite-email" className="mb-1 block text-xs font-semibold">メールアドレス <span className="text-red-600">*</span></label>
                <input id="invite-email" type="email" required maxLength={254} autoComplete="email" value={inviteForm.email} onChange={(event) => setInviteForm({ ...inviteForm, email: event.target.value })} className="w-full rounded border border-slate-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label htmlFor="invite-address" className="mb-1 block text-xs font-semibold">住所</label>
                <input id="invite-address" maxLength={500} autoComplete="street-address" value={inviteForm.address} onChange={(event) => setInviteForm({ ...inviteForm, address: event.target.value })} className="w-full rounded border border-slate-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label htmlFor="invite-birth-date" className="mb-1 block text-xs font-semibold">生年月日</label>
                <input id="invite-birth-date" type="date" value={inviteForm.birth_date} onChange={(event) => setInviteForm({ ...inviteForm, birth_date: event.target.value })} className="w-full rounded border border-slate-300 px-3 py-2 text-sm" />
              </div>
              <div className="rounded border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
                招待メールの配信にはSupabase Authのメール送信設定が必要です。個人情報の入力・閲覧は業務上必要な範囲に限定してください。
              </div>
              <button type="submit" disabled={saving} className="w-full rounded bg-[#0046ff] px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
                {saving ? '登録・招待を処理しています...' : '住民登録して招待メールを送信'}
              </button>
            </form>
          </aside>
        </div>
      </main>
    </div>
  );
}
