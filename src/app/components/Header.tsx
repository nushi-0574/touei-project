'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import { locales, useLocale } from '../../lib/i18n';

export default function Header() {
  const { locale, setLocale, t } = useLocale();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isPoliceStaff, setIsPoliceStaff] = useState(false);
  const [isServiceStaff, setIsServiceStaff] = useState(false);
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

    const syncUser = async (nextUser: User | null) => {
      if (!active) return;
      setUser(nextUser);
      setIsAdmin(false);
      setIsPoliceStaff(false);
      setIsServiceStaff(false);

      if (!nextUser) return;

      const [{ data: profile, error }, { data: permissions, error: permissionsError }] = await Promise.all([
        supabase
          .from('profiles')
          .select('is_admin, is_police_staff')
          .eq('id', nextUser.id)
          .maybeSingle(),
        supabase
          .from('staff_permissions')
          .select('permission')
          .eq('user_id', nextUser.id),
      ]);

      if (error || permissionsError) {
        console.error('職員権限の確認に失敗しました:', error || permissionsError);
        return;
      }

      if (active) {
        setIsAdmin(profile?.is_admin === true);
        setIsPoliceStaff(profile?.is_police_staff === true);
        setIsServiceStaff(profile?.is_admin === true || (permissions?.length ?? 0) > 0);
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
        setIsAdmin(false);
        setIsPoliceStaff(false);
        setIsServiceStaff(false);
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
          <Link href="/toeiken/police-result" aria-current={isCurrent('/toeiken/police-result') ? 'page' : undefined} className={`rounded px-1 py-2 transition-colors ${isCurrent('/toeiken/police-result') ? 'font-bold text-white underline decoration-blue-400 decoration-2 underline-offset-8' : 'hover:text-blue-400'}`}>{t('examResults')}</Link>
          {isPoliceStaff && (
            <Link href="/police" aria-current={isCurrent('/police') ? 'page' : undefined} className={`font-semibold transition-colors ${isCurrent('/police') ? 'text-white underline underline-offset-8' : 'text-emerald-300 hover:text-emerald-200'}`}>
              {t('policePage')}
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

          {/* メールアドレス・マイページ情報の表示（復活） */}
          {user ? (
            <div className="flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded border border-slate-700 text-slate-300">
              <span className="text-[11px] font-mono text-slate-300">{user.email}</span>
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
          <Link
            href="/toeiken/police-result"
            onClick={() => setIsOpen(false)}
            aria-current={isCurrent('/toeiken/police-result') ? 'page' : undefined}
            className={`block min-h-11 py-3 border-b border-slate-700/50 ${isCurrent('/toeiken/police-result') ? 'font-bold text-white' : 'text-slate-200 hover:text-white'}`}
          >
            {t('examResults')}
          </Link>
          {isPoliceStaff && (
            <Link
              href="/police"
              onClick={() => setIsOpen(false)}
              aria-current={isCurrent('/police') ? 'page' : undefined}
              className={`block min-h-11 py-3 font-semibold border-b border-slate-700/50 ${isCurrent('/police') ? 'text-white' : 'text-emerald-300 hover:text-emerald-200'}`}
            >
              {t('policePage')}
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
                <p className="text-[11px] text-slate-400 font-mono break-all">ログイン中: {user.email}</p>
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
  );
}