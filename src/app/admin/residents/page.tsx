'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '../../components/Header';
import Breadcrumbs from '../../components/Breadcrumbs';
import { ContentSkeleton } from '@/src/app/components/LoadingScreen';
import { supabase } from '../../../lib/supabase';
import { Users, UserPlus, Shield, ChevronRight } from 'lucide-react';

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
type RoleAssignment = { user_id: string; role: string };

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

const staffRoles = [
  ['operations_bureau', '運営局'],
  ['administration_bureau', '管理局'],
  ['development_bureau', '開発局'],
  ['police', '警察'],
  ['fire', '消防'],
  ['corporate', '企業'],
  ['general', '一般'],
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
  const [assignedRoles, setAssignedRoles] = useState<RoleAssignment[]>([]);
  const [canManageStaff, setCanManageStaff] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | Resident['resident_status']>('all');
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const [notice, setNotice] = useState('');
  const [inviteForm, setInviteForm] = useState({ email: '', full_name: '', address: '', birth_date: '' });
  const [permissionsDraft, setPermissionsDraft] = useState<Record<string, string[]>>({});
  const [rolesDraft, setRolesDraft] = useState<Record<string, string[]>>({});
  const [savingPermissionsFor, setSavingPermissionsFor] = useState('');
  const [savingRolesFor, setSavingRolesFor] = useState('');
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
      if (statusFilter !== 'all') params.set('status', statusFilter);
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
        roles?: RoleAssignment[];
        canManageStaff?: boolean;
        total?: number;
      };
      setResidents(payload.residents);
      setAssignedPermissions(payload.permissions ?? []);
      setAssignedRoles(payload.roles ?? []);
      setTotal(payload.total ?? 0);
      setCanManageStaff(payload.canManageStaff === true);
      setPermissionsDraft(Object.fromEntries(
        payload.residents.map((resident) => [
          resident.id,
          (payload.permissions ?? [])
            .filter((entry) => entry.user_id === resident.id)
            .map((entry) => entry.permission),
        ]),
      ));
      setRolesDraft(Object.fromEntries(
        payload.residents.map((resident) => [
          resident.id,
          (payload.roles ?? [])
            .filter((entry) => entry.user_id === resident.id)
            .map((entry) => entry.role),
        ]),
      ));
    } catch (error) {
      console.error('住民登録簿の取得に失敗しました:', error);
      setErrorMessage(error instanceof Error ? error.message : '住民一覧を取得できませんでした。');
    } finally {
      setLoading(false);
    }
  }, [getAccessToken, page, search, statusFilter]);

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

  async function saveRoles(userId: string) {
    setSavingRolesFor(userId);
    setErrorMessage('');
    setNotice('');
    try {
      const token = await getAccessToken();
      const response = await fetch('/api/admin/roles', {
        method: 'PUT',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, roles: rolesDraft[userId] ?? [] }),
      });
      const result: unknown = await response.json();
      if (!response.ok) throw new Error(getError(result));
      setNotice('ユーザーロールを更新しました。');
      await loadResidents();
    } catch (error) {
      console.error('ユーザーロールの保存に失敗しました:', error);
      setErrorMessage(error instanceof Error ? error.message : 'ユーザーロールを更新できませんでした。');
    } finally {
      setSavingRolesFor('');
    }
  }

  async function toggleResidentStatus(resident: Resident) {
    const status = resident.resident_status === 'active' ? 'inactive' : 'active';
    const action = status === 'active' ? '有効化' : '利用停止';
    if (!window.confirm(`${resident.full_name || resident.email || resident.id} を${action}しますか。`)) return;
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

  function toggleRole(userId: string, role: string) {
    setRolesDraft((current) => {
      const existing = current[userId] ?? [];
      return {
        ...current,
        [userId]: existing.includes(role)
          ? existing.filter((value) => value !== role)
          : [...existing, role],
      };
    });
  }

  function roleLabel(role: string): string {
    return staffRoles.find(([key]) => key === role)?.[1] ?? role;
  }

  const activeCount = residents.filter((resident) => resident.resident_status === 'active').length;
  const pageCount = Math.max(1, Math.ceil(total / 50));

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col font-sans">
      <Header />
      <main id="main-content" className="max-w-7xl mx-auto px-4 sm:px-6 py-8 flex-1 w-full">
        <Breadcrumbs items={[{ label: '管理者パネル', href: '/admin' }, { label: '住民登録・職員管理' }]} />

        {/* 7:3 非対称レイアウト */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-8 items-start mt-4">

          {/* 左側メインエリア (7割) */}
          <div className="space-y-6">

            <div className="bg-slate-900 text-white p-6 rounded-sm border border-slate-800 space-y-2">
              <span className="text-[11px] font-mono tracking-widest text-emerald-400 font-bold uppercase">
                RESIDENT REGISTRY / STAFF OPERATIONS
              </span>
              <h1 className="text-xl font-bold tracking-tight text-white">住民登録簿・職員権限管理</h1>
              <p className="text-xs text-slate-300">
                登録住民情報の検索・確認、アカウント状態変更、および業務担当職員のアクセス権限・組織ロール設定を管理します。
              </p>
            </div>

            {/* 統計サマリー (ドロップシャドウ全廃・高コントラスト) */}
            <section aria-label="住民登録状況" className="grid grid-cols-2 gap-3 md:grid-cols-4 text-xs">
              <div className="rounded-sm border border-slate-300 bg-white p-4">
                <p className="text-slate-600 font-semibold">検索ヒット総数</p>
                <p className="mt-1 text-2xl font-bold font-mono tabular-nums text-slate-900">{errorMessage ? '—' : total}<span className="ml-1 text-xs font-normal text-slate-600">件</span></p>
              </div>
              <div className="rounded-sm border border-slate-300 bg-white p-4">
                <p className="text-slate-600 font-semibold">ページ内有効住民</p>
                <p className="mt-1 text-2xl font-bold font-mono tabular-nums text-slate-900">{activeCount}<span className="ml-1 text-xs font-normal text-slate-600">名</span></p>
              </div>
              <div className="rounded-sm border border-slate-300 bg-white p-4">
                <p className="text-slate-600 font-semibold">表示単位</p>
                <p className="mt-1 text-2xl font-bold font-mono tabular-nums text-slate-900">50<span className="ml-1 text-xs font-normal text-slate-600">件/頁</span></p>
              </div>
              <div className="rounded-sm border border-slate-300 bg-white p-4">
                <p className="text-slate-600 font-semibold">権限編集状態</p>
                <p className="mt-1 text-sm font-bold text-slate-900">{canManageStaff ? '編集可能' : '閲覧制限中'}</p>
              </div>
            </section>

            {errorMessage && <p role="alert" className="border border-red-300 bg-red-50 p-3 text-xs font-bold text-red-900 rounded-sm">{errorMessage}</p>}
            {notice && <p role="status" className="border border-emerald-300 bg-emerald-50 p-3 text-xs font-bold text-emerald-900 rounded-sm">{notice}</p>}

            {/* 住民データテーブル */}
            <section className="bg-white border border-slate-300 rounded-sm overflow-hidden text-xs">
              <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between bg-slate-50">
                <div>
                  <h2 className="font-bold text-slate-900 text-sm tracking-tight">住民登録簿一覧</h2>
                  <p className="mt-0.5 text-[11px] text-slate-500">生年月日・住所情報は管理業務目的のみで厳重に取り扱ってください。</p>
                </div>
                <form
                  className="flex flex-wrap gap-2 w-full sm:w-auto text-xs"
                  onSubmit={(event) => {
                    event.preventDefault();
                    setPage(0);
                    setSearch(query.trim());
                  }}
                >
                  <input
                    id="resident-search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="氏名・メールアドレス"
                    className="px-3 py-1.5 border border-slate-300 rounded-sm text-xs bg-white focus:outline-none focus:border-slate-800"
                  />
                  <select
                    id="resident-status-filter"
                    value={statusFilter}
                    onChange={(event) => {
                      setPage(0);
                      setStatusFilter(event.target.value as typeof statusFilter);
                    }}
                    className="border border-slate-300 bg-white px-2.5 py-1.5 text-xs rounded-sm focus:outline-none focus:border-slate-800"
                  >
                    <option value="all">全ステータス</option>
                    <option value="active">有効アカウント</option>
                    <option value="inactive">利用停止中</option>
                    <option value="pending">確認待ち</option>
                  </select>
                  <button className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-sm transition-colors">
                    検索
                  </button>
                </form>
              </div>

              {loading ? (
                <ContentSkeleton rows={5} />
              ) : residents.length === 0 ? (
                <p className="p-8 text-center text-slate-500 font-mono">条件に該当する住民は存在しません。</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-slate-800 text-white text-[11px]">
                      <tr>
                        <th scope="col" className="px-3.5 py-2.5 font-semibold border-r border-slate-700">住民氏名・ID</th>
                        <th scope="col" className="px-3.5 py-2.5 font-semibold border-r border-slate-700">連絡先・住所・ロール</th>
                        <th scope="col" className="px-3.5 py-2.5 font-semibold border-r border-slate-700">生年月日</th>
                        <th scope="col" className="px-3.5 py-2.5 font-semibold">状態 / 操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {residents.map((resident) => (
                        <tr key={resident.id} className="align-top hover:bg-slate-50">
                          <td className="px-3.5 py-3 border-r border-slate-200">
                            <p className="font-bold text-slate-900">{resident.full_name || '氏名未登録'}</p>
                            <p className="mt-0.5 font-mono text-[11px] text-slate-600 break-all">{resident.email || 'メール未登録'}</p>
                            <p className="mt-0.5 font-mono text-[10px] text-slate-400">{resident.id}</p>
                          </td>
                          <td className="px-3.5 py-3 border-r border-slate-200 max-w-xs">
                            <p className="break-all text-slate-700">{resident.address || '住所未登録'}</p>
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              {resident.is_super_admin && <span className="bg-slate-800 text-white px-2 py-0.5 text-[10px] font-bold">主任管理者</span>}
                              {resident.is_admin && !resident.is_super_admin && <span className="bg-slate-700 text-white px-2 py-0.5 text-[10px] font-bold">管理者</span>}
                              {(rolesDraft[resident.id] ?? []).map((role) => (
                                <span key={role} className="bg-slate-200 text-slate-800 border border-slate-300 px-1.5 py-0.5 text-[10px] font-bold">{roleLabel(role)}</span>
                              ))}
                            </div>
                          </td>
                          <td className="px-3.5 py-3 border-r border-slate-200 whitespace-nowrap font-mono tabular-nums text-slate-700">
                            {resident.birth_date || '未登録'}
                          </td>
                          <td className="px-3.5 py-3 whitespace-nowrap space-y-1.5">
                            <span className={`inline-block px-2 py-0.5 text-[11px] font-bold border ${resident.resident_status === 'active' ? 'bg-emerald-100 text-emerald-900 border-emerald-300' : 'bg-slate-200 text-slate-800 border-slate-300'}`}>
                              {resident.resident_status === 'active' ? '有効' : resident.resident_status === 'inactive' ? '停止中' : '確認待ち'}
                            </span>
                            <div>
                              <button
                                type="button"
                                disabled={updatingResidentId === resident.id || resident.is_super_admin}
                                onClick={() => void toggleResidentStatus(resident)}
                                className="px-2.5 py-1 text-[11px] border border-slate-300 bg-white hover:bg-slate-100 font-semibold rounded-sm disabled:opacity-40"
                              >
                                {updatingResidentId === resident.id ? '処理中...' : resident.resident_status === 'active' ? '利用停止' : '有効化'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 p-3 bg-slate-50 text-xs">
                <span className="text-slate-600 font-mono tabular-nums">Page {page + 1} of {pageCount} ({total} items)</span>
                <div className="flex gap-2">
                  <button type="button" disabled={page === 0 || loading} onClick={() => setPage((value) => value - 1)} className="px-3 py-1 border border-slate-300 bg-white hover:bg-slate-100 text-xs rounded-sm disabled:opacity-40">前へ</button>
                  <button type="button" disabled={page + 1 >= pageCount || loading} onClick={() => setPage((value) => value + 1)} className="px-3 py-1 border border-slate-300 bg-white hover:bg-slate-100 text-xs rounded-sm disabled:opacity-40">次へ</button>
                </div>
              </div>
            </section>

          </div>

          {/* 右側サイドバー (3割 - 360px): 新規住民登録フォーム */}
          <aside className="space-y-6">

            <div className="bg-white border border-slate-300 rounded-sm p-5 space-y-4 text-xs">
              <div className="border-b border-slate-200 pb-2">
                <h2 className="font-bold text-slate-900 text-sm tracking-tight flex items-center gap-1.5">
                  <UserPlus className="w-4 h-4 text-slate-700" />
                  <span>新規住民アカウント登録</span>
                </h2>
                <p className="mt-1 text-[11px] text-slate-500 leading-relaxed">
                  住民アカウントを手動作成し、確認用招待メールを発行送信します。
                </p>
              </div>

              <form onSubmit={addResident} className="space-y-3">
                <div>
                  <label htmlFor="invite-name" className="block text-[11px] font-semibold text-slate-700 mb-1">
                    氏名 <span className="text-red-700">*</span>
                  </label>
                  <input
                    id="invite-name"
                    required
                    maxLength={200}
                    value={inviteForm.full_name}
                    onChange={(event) => setInviteForm({ ...inviteForm, full_name: event.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-sm text-xs bg-white focus:outline-none focus:border-slate-800"
                  />
                </div>

                <div>
                  <label htmlFor="invite-email" className="block text-[11px] font-semibold text-slate-700 mb-1">
                    メールアドレス <span className="text-red-700">*</span>
                  </label>
                  <input
                    id="invite-email"
                    type="email"
                    required
                    maxLength={254}
                    autoComplete="email"
                    value={inviteForm.email}
                    onChange={(event) => setInviteForm({ ...inviteForm, email: event.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-sm text-xs bg-white focus:outline-none focus:border-slate-800 font-mono"
                  />
                </div>

                <div>
                  <label htmlFor="invite-address" className="block text-[11px] font-semibold text-slate-700 mb-1">住所</label>
                  <input
                    id="invite-address"
                    maxLength={500}
                    autoComplete="street-address"
                    value={inviteForm.address}
                    onChange={(event) => setInviteForm({ ...inviteForm, address: event.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-sm text-xs bg-white focus:outline-none focus:border-slate-800"
                  />
                </div>

                <div>
                  <label htmlFor="invite-birth-date" className="block text-[11px] font-semibold text-slate-700 mb-1">生年月日</label>
                  <input
                    id="invite-birth-date"
                    type="date"
                    value={inviteForm.birth_date}
                    onChange={(event) => setInviteForm({ ...inviteForm, birth_date: event.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-sm text-xs bg-white focus:outline-none focus:border-slate-800 font-mono tabular-nums"
                  />
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-sm transition-colors disabled:opacity-50 min-h-[44px]"
                >
                  {saving ? '処理中...' : '登録して招待メール送信'}
                </button>
              </form>
            </div>

            <div className="bg-slate-100 border border-slate-300 p-4 rounded-sm text-xs space-y-2">
              <Link href="/admin" className="font-bold text-blue-800 hover:underline block">
                ← 管理者パネルへ戻る
              </Link>
            </div>

          </aside>

        </div>
      </main>
    </div>
  );
}
