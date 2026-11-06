'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import { locales, useLocale } from '../../lib/i18n';

type EmergencyAlertBanner = {
  id: string;
  title: string;
  message: string;
  severity: 'information' | 'warning' | 'critical';
  area: string;
};

export default function Header() {
  const { locale, setLocale, t } = useLocale();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [residentDisplayName, setResidentDisplayName] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [isPoliceStaff, setIsPoliceStaff] = useState(false);
  const [isFireStaff, setIsFireStaff] = useState(false);
  const [isServiceStaff, setIsServiceStaff] = useState(false);
  const [isActiveResident, setIsActiveResident] = useState(false);
  const [isPhoneStaff, setIsPhoneStaff] = useState(false);
  const [canManagePhoneNumbers, setCanManagePhoneNumbers] = useState(false);
  const [emergencyAlerts, setEmergencyAlerts] = useState<EmergencyAlertBanner[]>([]);
  const isCurrent = (href: string) => href === '/'
    ? pathname === '/'
    : pathname === href || pathname.startsWith(`${href}/`);
  const isResidentCurrent = isCurrent('/toeiken') && !isCurrent('/toeiken/police-result');
  const isAdminCurrent = isCurrent('/admin') && !isCurrent('/admin/services');

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, []);

  useEffect(() => {
    let active = true;
    async function loadEmergencyAlerts() {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('emergency_alerts')
        .select('id, title, message, severity, area, ends_at')
        .eq('status', 'published')
        .lte('starts_at', now)
        .gt('ends_at', now)
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) {
        console.error('緊急情報の取得に失敗しました:', error);
        return;
      }
      if (active) {
        const severityRank = { critical: 0, warning: 1, information: 2 };
        setEmergencyAlerts((data ?? []).sort((left, right) =>
          severityRank[left.severity as keyof typeof severityRank] - severityRank[right.severity as keyof typeof severityRank]));
      }
    }

    void loadEmergencyAlerts();
    const timer = window.setInterval(() => void loadEmergencyAlerts(), 60_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    let active = true;

    const syncUser = async (nextUser: User | null) => {
      if (!active) return;
      setUser(nextUser);
      setResidentDisplayName('');
      setIsAdmin(false);
      setIsPoliceStaff(false);
      setIsFireStaff(false);
      setIsServiceStaff(false);
      setIsActiveResident(false);
      setIsPhoneStaff(false);
      setCanManagePhoneNumbers(false);

      if (!nextUser) return;

      const [{ data: profile, error }, { data: permissions, error: permissionsError }, { data: roles, error: rolesError }] = await Promise.all([
        supabase
          .from('profiles')
          .select('is_admin, is_police_staff, display_name, full_name, resident_status')
          .eq('id', nextUser.id)
          .maybeSingle(),
        supabase
          .from('staff_permissions')
          .select('permission')
          .eq('user_id', nextUser.id),
        supabase
          .from('staff_roles')
          .select('role')
          .eq('user_id', nextUser.id),
      ]);

      if (error || permissionsError || rolesError) {
        console.error('職員権限の確認に失敗しました:', error || permissionsError || rolesError);
        return;
      }

      if (active) {
        setResidentDisplayName(profile?.display_name || profile?.full_name || '住民');
        setIsActiveResident(profile?.resident_status === 'active');
        setIsAdmin(profile?.is_admin === true);
        setIsPoliceStaff(profile?.is_police_staff === true);
        setIsFireStaff(roles?.some((assignment) => assignment.role === 'fire') ?? false);
        const hasDepartmentRole = roles?.some((assignment) =>
          ['operations_bureau', 'administration_bureau', 'development_bureau'].includes(assignment.role)) ?? false;
        setIsServiceStaff(profile?.is_admin === true || (permissions?.length ?? 0) > 0 || hasDepartmentRole);
        const phoneRoles = ['operations_bureau', 'administration_bureau', 'development_bureau', 'police', 'fire', 'corporate'];
        const hasPhoneRole = roles?.some((assignment) => phoneRoles.includes(assignment.role)) ?? false;
        const canManageNumbers = profile?.is_admin === true
          || permissions?.some((assignment) => assignment.permission === 'manage_residents') === true
          || roles?.some((assignment) => assignment.role === 'administration_bureau') === true;
        setIsPhoneStaff(profile?.is_admin === true || profile?.is_police_staff === true || hasPhoneRole
          || permissions?.some((assignment) => assignment.permission === 'manage_support') === true);
        setCanManagePhoneNumbers(canManageNumbers);
      }
    };

    supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        console.error('ログイン状態の確認に失敗しました:', error);
        return;
      }
      void syncUser(data.session?.user ?? null);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        setResidentDisplayName('');
        setIsAdmin(false);
        setIsPoliceStaff(false);
        setIsFireStaff(false);
        setIsServiceStaff(false);
        setIsActiveResident(false);
        setIsPhoneStaff(false);
        setCanManagePhoneNumbers(false);
        return;
      }
      window.setTimeout(() => void syncUser(session.user), 0);
    });

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) console.error('ログアウトに失敗しました:', error);
    setIsOpen(false);
  };

  return (
    <>
    <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
        
        {/* ロゴ・タイトル */}
        <div className="flex items-center gap-2">
          <Link href="/" className="text-sm font-bold tracking-wider hover:text-slate-300">
            東栄県公式ポータル
          </Link>
        </div>

        {/* PC用ナビゲーション */}
        <nav className="hidden md:flex items-center gap-4 text-xs">
          <Link href="/" aria-current={isCurrent('/') ? 'page' : undefined} className={`rounded px-1 py-2 transition-colors ${isCurrent('/') ? 'font-bold text-white underline decoration-blue-400 decoration-2 underline-offset-8' : 'hover:text-blue-400'}`}>{t('home')}</Link>
          <Link href={user ? '/toeiken/dashboard' : '/toeiken'} aria-current={isResidentCurrent ? 'page' : undefined} className={`rounded px-1 py-2 transition-colors ${isResidentCurrent ? 'font-bold text-white underline decoration-blue-400 decoration-2 underline-offset-8' : 'hover:text-blue-400'}`}>{t('residents')}</Link>
          {user && <Link href="/toeiken/messages" aria-current={isCurrent('/toeiken/messages') ? 'page' : undefined} className={`rounded px-1 py-2 transition-colors ${isCurrent('/toeiken/messages') ? 'font-bold text-white underline decoration-blue-400 decoration-2 underline-offset-8' : 'hover:text-blue-400'}`}>チャット</Link>}
          {user && (isActiveResident || isPhoneStaff) && <Link href="/toeiken/phone" aria-current={isCurrent('/toeiken/phone') ? 'page' : undefined} className={`rounded px-1 py-2 transition-colors ${isCurrent('/toeiken/phone') ? 'font-bold text-white underline decoration-blue-400 decoration-2 underline-offset-8' : 'hover:text-blue-400'}`}>電話窓口</Link>}
          {user && canManagePhoneNumbers && <Link href="/admin/phone-numbers" aria-current={isCurrent('/admin/phone-numbers') ? 'page' : undefined} className={`rounded px-1 py-2 transition-colors ${isCurrent('/admin/phone-numbers') ? 'font-bold text-white underline decoration-blue-400 decoration-2 underline-offset-8' : 'hover:text-blue-400'}`}>電話番号管理</Link>}
          <Link href="/toeiken/police-result" aria-current={isCurrent('/toeiken/police-result') ? 'page' : undefined} className={`rounded px-1 py-2 transition-colors ${isCurrent('/toeiken/police-result') ? 'font-bold text-white underline decoration-blue-400 decoration-2 underline-offset-8' : 'hover:text-blue-400'}`}>{t('examResults')}</Link>
          {(isPoliceStaff || isAdmin) && (
            <Link href="/police" aria-current={isCurrent('/police') ? 'page' : undefined} className={`font-semibold transition-colors ${isCurrent('/police') ? 'text-white underline underline-offset-8' : 'text-emerald-300 hover:text-emerald-200'}`}>
              {t('policePage')}
            </Link>
          )}
          {(isFireStaff || isAdmin) && (
            <Link href="/fire" aria-current={isCurrent('/fire') ? 'page' : undefined} className={`font-semibold transition-colors ${isCurrent('/fire') ? 'text-white underline underline-offset-8' : 'text-red-300 hover:text-red-200'}`}>
              消防ページ
            </Link>
          )}
          
          {/* 管理者権限がある場合のみ表示 */}
          {isAdmin && (
            <Link href="/admin" aria-current={isAdminCurrent ? 'page' : undefined} className={`font-semibold transition-colors ${isAdminCurrent ? 'text-white underline underline-offset-8' : 'text-amber-400 hover:text-amber-300'}`}>
              {t('adminPanel')}
            </Link>
          )}
          {isServiceStaff && (
            <Link href="/admin/services" aria-current={isCurrent('/admin/services') ? 'page' : undefined} className={`font-semibold transition-colors ${isCurrent('/admin/services') ? 'text-white underline underline-offset-8' : 'text-blue-300 hover:text-blue-200'}`}>
              業務管理
            </Link>
          )}
          {isServiceStaff && (
            <Link href="/admin/operations" aria-current={isCurrent('/admin/operations') ? 'page' : undefined} className={`font-semibold transition-colors ${isCurrent('/admin/operations') ? 'text-white underline underline-offset-8' : 'text-blue-300 hover:text-blue-200'}`}>
              業務状況
            </Link>
          )}
          {user && isActiveResident && (
            <Link href="/toeiken/messages" aria-current={isCurrent('/toeiken/messages') ? 'page' : undefined} className={`font-semibold transition-colors ${isCurrent('/toeiken/messages') ? 'text-white underline underline-offset-8' : 'text-slate-200 hover:text-white'}`}>
              チャット
            </Link>
          )}

          <label className="sr-only" htmlFor="header-locale">{t('language')}</label>
          <select
            id="header-locale"
            value={locale}
            onChange={(event) => setLocale(event.target.value as (typeof locales)[number])}
            className="rounded border border-slate-700 bg-slate-800 px-2 py-1 text-[11px] text-white"
          >
            <option value="ja">{t('ja')}</option>
            <option value="en">{t('en')}</option>
            <option value="zh-CN">{t('zh')}</option>
            <option value="ko">{t('ko')}</option>
          </select>

          {/* Resident display name and account links */}
          {user ? (
            <div className="flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded border border-slate-700 text-slate-300">
              <span className="text-[11px] text-slate-100">{residentDisplayName || '住民'}</span>
              <Link href="/toeiken/dashboard" className="text-blue-400 hover:underline font-semibold">{t('myPage')}</Link>
              <button onClick={handleSignOut} className="text-slate-300 hover:text-white">{t('signOut')}</button>
            </div>
          ) : (
            <Link href="/toeiken" className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded text-white font-semibold transition-colors">
              {t('signIn')}
            </Link>
          )}
        </nav>

        {/* モバイル用ハンバーガーボタン */}
        <button
          onClick={() => setIsOpen((open) => !open)}
          className="md:hidden p-2 text-slate-300 hover:text-white focus:outline-none"
          aria-label={isOpen ? 'メニューを閉じる' : t('openMenu')}
          aria-expanded={isOpen}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {isOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {/* モバイル用ドロップダウンメニュー（ハンバーガー展開時） */}
      {isOpen && (
        <nav className="md:hidden bg-slate-800 border-t border-slate-700 px-4 py-4 space-y-3 text-xs">
          <Link
            href="/"
            onClick={() => setIsOpen(false)}
            aria-current={isCurrent('/') ? 'page' : undefined}
            className={`block min-h-11 py-3 border-b border-slate-700/50 ${isCurrent('/') ? 'font-bold text-white' : 'text-slate-200 hover:text-white'}`}
          >
            {t('home')}
          </Link>
          <Link
            href={user ? '/toeiken/dashboard' : '/toeiken'}
            onClick={() => setIsOpen(false)}
            aria-current={isResidentCurrent ? 'page' : undefined}
            className={`block min-h-11 py-3 border-b border-slate-700/50 ${isResidentCurrent ? 'font-bold text-white' : 'text-slate-200 hover:text-white'}`}
          >
            {user ? t('myPage') : t('residents')}
          </Link>
          {user && (
            <Link
              href="/toeiken/messages"
              onClick={() => setIsOpen(false)}
              aria-current={isCurrent('/toeiken/messages') ? 'page' : undefined}
              className={`block min-h-11 py-3 border-b border-slate-700/50 ${isCurrent('/toeiken/messages') ? 'font-bold text-white' : 'text-slate-200 hover:text-white'}`}
            >
              チャット
            </Link>
          )}
          {user && (isActiveResident || isPhoneStaff) && (
            <Link
              href="/toeiken/phone"
              onClick={() => setIsOpen(false)}
              aria-current={isCurrent('/toeiken/phone') ? 'page' : undefined}
              className={`block min-h-11 py-3 border-b border-slate-700/50 ${isCurrent('/toeiken/phone') ? 'font-bold text-white' : 'text-slate-200 hover:text-white'}`}
            >
              電話窓口
            </Link>
          )}
          {user && canManagePhoneNumbers && (
            <Link
              href="/admin/phone-numbers"
              onClick={() => setIsOpen(false)}
              aria-current={isCurrent('/admin/phone-numbers') ? 'page' : undefined}
              className={`block min-h-11 py-3 font-semibold border-b border-slate-700/50 ${isCurrent('/admin/phone-numbers') ? 'text-white' : 'text-blue-300 hover:text-blue-200'}`}
            >
              電話番号管理
            </Link>
          )}
          <Link
            href="/toeiken/police-result"
            onClick={() => setIsOpen(false)}
            aria-current={isCurrent('/toeiken/police-result') ? 'page' : undefined}
            className={`block min-h-11 py-3 border-b border-slate-700/50 ${isCurrent('/toeiken/police-result') ? 'font-bold text-white' : 'text-slate-200 hover:text-white'}`}
          >
            {t('examResults')}
          </Link>
          {(isPoliceStaff || isAdmin) && (
            <Link
              href="/police"
              onClick={() => setIsOpen(false)}
              aria-current={isCurrent('/police') ? 'page' : undefined}
              className={`block min-h-11 py-3 font-semibold border-b border-slate-700/50 ${isCurrent('/police') ? 'text-white' : 'text-emerald-300 hover:text-emerald-200'}`}
            >
              {t('policePage')}
            </Link>
          )}
          {(isFireStaff || isAdmin) && (
            <Link
              href="/fire"
              onClick={() => setIsOpen(false)}
              aria-current={isCurrent('/fire') ? 'page' : undefined}
              className={`block min-h-11 border-b border-slate-700/50 py-3 font-semibold ${isCurrent('/fire') ? 'text-white' : 'text-red-300'}`}
            >
              消防ページ
            </Link>
          )}

          {/* 管理者権限がある場合のみ表示 */}
          {isAdmin && (
            <Link
              href="/admin"
              onClick={() => setIsOpen(false)}
              aria-current={isAdminCurrent ? 'page' : undefined}
              className={`block min-h-11 py-3 font-semibold border-b border-slate-700/50 ${isAdminCurrent ? 'text-white' : 'text-amber-400 hover:text-amber-300'}`}
            >
              {t('adminPanel')}
            </Link>
          )}
          {isServiceStaff && (
            <Link
              href="/admin/services"
              onClick={() => setIsOpen(false)}
              aria-current={isCurrent('/admin/services') ? 'page' : undefined}
              className={`block min-h-11 py-3 font-semibold border-b border-slate-700/50 ${isCurrent('/admin/services') ? 'text-white' : 'text-blue-300 hover:text-blue-200'}`}
            >
              業務管理
            </Link>
          )}
          {isServiceStaff && (
            <Link
              href="/admin/operations"
              onClick={() => setIsOpen(false)}
              aria-current={isCurrent('/admin/operations') ? 'page' : undefined}
              className={`block min-h-11 py-3 font-semibold border-b border-slate-700/50 ${isCurrent('/admin/operations') ? 'text-white' : 'text-blue-300 hover:text-blue-200'}`}
            >
              業務状況
            </Link>
          )}
          {user && isActiveResident && (
            <Link
              href="/toeiken/messages"
              onClick={() => setIsOpen(false)}
              aria-current={isCurrent('/toeiken/messages') ? 'page' : undefined}
              className={`block min-h-11 py-3 border-b border-slate-700/50 ${isCurrent('/toeiken/messages') ? 'font-bold text-white' : 'text-slate-200 hover:text-white'}`}
            >
              チャット
            </Link>
          )}

          {/* モバイル用メール・ログイン情報 */}
          <div className="pt-2">
            <label htmlFor="mobile-locale" className="mb-1 block text-slate-300">{t('language')}</label>
            <select
              id="mobile-locale"
              value={locale}
              onChange={(event) => setLocale(event.target.value as (typeof locales)[number])}
              className="mb-3 w-full rounded border border-slate-600 bg-slate-900 px-3 py-2 text-slate-100"
            >
              <option value="ja">{t('ja')}</option>
              <option value="en">{t('en')}</option>
              <option value="zh-CN">{t('zh')}</option>
              <option value="ko">{t('ko')}</option>
            </select>
            {user ? (
              <div className="space-y-2 bg-slate-900/50 p-3 rounded border border-slate-700">
                <p className="text-[11px] text-slate-400 break-words">ログイン中: {residentDisplayName || '住民'}</p>
                <Link
                  href="/toeiken/dashboard"
                  onClick={() => setIsOpen(false)}
                  className="block min-h-11 py-3 text-center bg-blue-600 hover:bg-blue-500 rounded text-white font-semibold transition-colors"
                >
                  {t('myPage')}
                </Link>
                <button
                  onClick={handleSignOut}
                  className="block w-full min-h-11 py-3 text-center border border-slate-600 rounded text-slate-200"
                >
                  {t('signOut')}
                </button>
              </div>
            ) : (
              <Link
                href="/toeiken"
                onClick={() => setIsOpen(false)}
                className="block min-h-11 py-3 text-center bg-blue-600 hover:bg-blue-500 rounded text-white font-semibold transition-colors"
              >
                {t('signIn')}
              </Link>
            )}
          </div>
        </nav>
      )}
    </header>
    {emergencyAlerts.length > 0 && (
      <aside aria-label="緊急情報" className="border-b border-red-300 bg-red-50 text-red-950">
        <div className="mx-auto max-w-6xl space-y-2 px-4 py-3 sm:px-6">
          {emergencyAlerts.map((alert) => (
            <article key={alert.id} role={alert.severity === 'critical' ? 'alert' : 'status'} className="flex flex-col gap-1 sm:flex-row sm:items-start sm:gap-3">
              <span className={`shrink-0 rounded px-2 py-0.5 text-xs font-bold ${alert.severity === 'critical' ? 'bg-red-700 text-white' : alert.severity === 'warning' ? 'bg-amber-200 text-amber-950' : 'bg-blue-100 text-blue-950'}`}>
                {alert.severity === 'critical' ? '緊急' : alert.severity === 'warning' ? '警戒情報' : 'お知らせ'}
              </span>
              <div className="min-w-0">
                <h2 className="text-sm font-bold">{alert.title}</h2>
                <p className="mt-1 whitespace-pre-wrap text-sm">{alert.area} · {alert.message}</p>
              </div>
            </article>
          ))}
        </div>
      </aside>
    )}
    </>
  );
}