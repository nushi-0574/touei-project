'use client';

import { useState, useEffect, useRef } from 'react';
import type { User } from '@supabase/supabase-js';
import Link from 'next/link';
import Header from '../../components/Header';
import Breadcrumbs from '../../components/Breadcrumbs';
import { ContentSkeleton } from '@/src/app/components/LoadingScreen';
import Toast from '../../components/Toast';
import { supabase } from '../../../lib/supabase';
import { getDaysInMonth } from '../../../lib/dates';
import { getErrorMessage } from '../../../lib/errors';
import { useCurrentYear } from '../../../lib/useCurrentYear';
import ResidentAvatar from '../../components/ResidentAvatar';
import { UserCheck, Shield, ChevronRight } from 'lucide-react';

type Profile = {
  id: string;
  email?: string | null;
  full_name?: string | null;
  display_name?: string | null;
  bio?: string | null;
  avatar_path?: string | null;
  address?: string | null;
  birth_date?: string | null;
  discord_id?: string | null;
  is_admin?: boolean;
  is_super_admin?: boolean;
  is_police_staff?: boolean;
};

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [linkingDiscord, setLinkingDiscord] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const [fullName, setFullName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState('');
  const avatarPreviewUrlRef = useRef('');
  const [address, setAddress] = useState('');
  const baseYear = useCurrentYear();
  const [birthYear, setBirthYear] = useState('');
  const [birthMonth, setBirthMonth] = useState('');
  const [birthDay, setBirthDay] = useState('');
  const [birthDateError, setBirthDateError] = useState('');
  const years = Array.from({ length: 121 }, (_, i) => baseYear - i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const days = birthYear && birthMonth
    ? Array.from({ length: getDaysInMonth(Number(birthYear), Number(birthMonth)) }, (_, i) => i + 1)
    : [];

  useEffect(() => () => {
    if (avatarPreviewUrlRef.current) URL.revokeObjectURL(avatarPreviewUrlRef.current);
  }, []);

  useEffect(() => {
    let active = true;

    async function loadUserData() {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (!session) {
          if (active) setUser(null);
          return;
        }

        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .maybeSingle();
        if (profileError) throw profileError;

        const discordIdentity = session.user.identities?.find((identity) => identity.provider === 'discord');
        const discordId = discordIdentity?.id ??
          (session.user.app_metadata.provider === 'discord' ? session.user.id : null);
        let nextProfile = profileData as Profile | null;

        if (nextProfile) {
          if (discordId && !nextProfile.discord_id) {
            const { data: updated, error } = await supabase
              .from('profiles')
              .update({ discord_id: discordId })
              .eq('id', session.user.id)
              .select()
              .single();
            if (error) throw error;
            nextProfile = updated as Profile;
          }
        } else {
          const { data: newProfile, error } = await supabase
            .from('profiles')
            .insert([{
              id: session.user.id,
              email: session.user.email,
              full_name: session.user.user_metadata.full_name || '',
              discord_id: discordId,
            }])
            .select()
            .single();
          if (error) throw error;
          nextProfile = newProfile as Profile;
        }

        if (!active) return;
        setUser(session.user);
        setProfile(nextProfile);
        setFullName(nextProfile.full_name || '');
        setDisplayName(nextProfile.display_name || nextProfile.full_name || '');
        setBio(nextProfile.bio || '');
        setAddress(nextProfile.address || '');
        if (nextProfile.birth_date) {
          const [year, month, day] = nextProfile.birth_date.split('-');
          setBirthYear(year ?? '');
          setBirthMonth(month ? String(Number(month)) : '');
          setBirthDay(day ? String(Number(day)) : '');
        }
      } catch (error) {
        console.error('ユーザー情報の取得に失敗しました:', error);
        if (active) setToast({ message: getErrorMessage(error, 'ユーザー情報の取得に失敗しました。'), type: 'error' });
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadUserData();

    return () => {
      active = false;
    };
  }, []);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!displayName.trim() || displayName.trim().length > 40) {
      setToast({ message: '表示名は1〜40文字で入力してください。', type: 'error' });
      return;
    }
    if (bio.length > 500) {
      setToast({ message: '自己紹介は500文字以内で入力してください。', type: 'error' });
      return;
    }
    if (avatarFile && (!['image/jpeg', 'image/png', 'image/webp'].includes(avatarFile.type) || avatarFile.size > 2 * 1024 * 1024)) {
      setToast({ message: 'アイコン画像はJPEG・PNG・WebP形式で2MB以内にしてください。', type: 'error' });
      return;
    }

    if ([birthYear, birthMonth, birthDay].some(Boolean) && ![birthYear, birthMonth, birthDay].every(Boolean)) {
      setBirthDateError('生年月日を登録する場合は、年・月・日をすべて選択してください。');
      return;
    }

    const birthDate = birthYear && birthMonth && birthDay
      ? `${birthYear}-${String(birthMonth).padStart(2, '0')}-${String(birthDay).padStart(2, '0')}`
      : '';
    if (birthDate && new Date(`${birthDate}T00:00:00`).getTime() > Date.now()) {
      setBirthDateError('生年月日に未来の日付は指定できません。');
      return;
    }
    setBirthDateError('');
    setSaving(true);
    let uploadedAvatarPath: string | null = null;
    try {
      let avatarPath = profile?.avatar_path ?? null;
      if (avatarFile) {
        const extension = avatarFile.type === 'image/jpeg' ? 'jpg' : avatarFile.type === 'image/png' ? 'png' : 'webp';
        avatarPath = `${user.id}/${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await supabase.storage
          .from('resident-avatars')
          .upload(avatarPath, avatarFile, { contentType: avatarFile.type, cacheControl: '3600' });
        if (uploadError) throw uploadError;
        uploadedAvatarPath = avatarPath;
      }

      const { data, error } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          email: user.email,
          full_name: fullName.trim(),
          display_name: displayName.trim(),
          bio: bio.trim(),
          avatar_path: avatarPath,
          address: address.trim(),
          birth_date: birthDate || null,
        })
        .select()
        .single();
      if (error) throw error;
      setProfile(data as Profile);
      setAvatarFile(null);
      if (avatarPreviewUrlRef.current) URL.revokeObjectURL(avatarPreviewUrlRef.current);
      avatarPreviewUrlRef.current = '';
      setAvatarPreviewUrl('');
      if (uploadedAvatarPath && profile?.avatar_path) {
        const { error: removeError } = await supabase.storage
          .from('resident-avatars')
          .remove([profile.avatar_path]);
        if (removeError) console.error('以前のプロフィール画像を削除できませんでした:', removeError);
      }
      setToast({ message: '住民登録情報を保存しました。', type: 'success' });
    } catch (error) {
      console.error('プロフィールの保存に失敗しました:', error);
      if (uploadedAvatarPath) {
        const { error: removeError } = await supabase.storage
          .from('resident-avatars')
          .remove([uploadedAvatarPath]);
        if (removeError) console.error('保存に失敗したプロフィール画像を削除できませんでした:', removeError);
      }
      setToast({ message: getErrorMessage(error, 'プロフィールの保存に失敗しました。'), type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleLinkDiscord = async () => {
    setLinkingDiscord(true);
    try {
      const { error } = await supabase.auth.linkIdentity({
        provider: 'discord',
        options: {
          redirectTo: `${window.location.origin}/toeiken/dashboard`,
        },
      });
      if (error) throw error;
    } catch (error) {
      setToast({ message: 'Discord連携エラー: ' + getErrorMessage(error, '不明なエラー'), type: 'error' });
      setLinkingDiscord(false);
    }
  };

  const hasDiscordIdentity =
    user?.identities?.some((identity) => identity.provider === 'discord') ||
    user?.app_metadata?.provider === 'discord' ||
    Boolean(profile?.discord_id);

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col font-sans">
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 flex-1 w-full space-y-6">
        <Breadcrumbs items={[{ label: '東栄県住民マイページ' }]} />

        {loading ? (
          <ContentSkeleton rows={3} />
        ) : !user ? (
          <div className="bg-white border border-slate-300 p-8 text-center rounded-sm">
            <p className="text-xs text-red-700 mb-4 font-bold">ログインが必要です。</p>
            <Link href="/toeiken" className="text-xs bg-slate-900 text-white px-5 py-2.5 rounded-sm font-semibold">
              ログイン画面へ移動
            </Link>
          </div>
        ) : (
          /* 7:3 非対称レイアウト */
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8 items-start">

            {/* 左側メインエリア (7割) */}
            <div className="space-y-6">

              <div className="bg-slate-900 text-white p-6 rounded-sm border border-slate-800 space-y-2">
                <span className="text-xs font-semibold text-emerald-400 bg-slate-800 border border-slate-700 px-2.5 py-0.5 inline-block">
                  東栄民マイページ
                </span>
                <h1 className="text-xl font-bold tracking-tight text-white">東栄民マイページ</h1>
                <p className="text-xs text-slate-300">登録アカウント情報の確認および住民プロフィールの登録・変更を行えます。</p>
              </div>

              {/* 基本アカウント情報 */}
              <div className="bg-white p-5 border border-slate-300 rounded-sm text-xs space-y-2">
                <h2 className="font-bold text-slate-900 text-sm border-b border-slate-200 pb-2 tracking-tight">
                  基本アカウント情報
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 text-slate-700">
                  <p><span className="font-semibold text-slate-900">メールアドレス:</span> <span className="font-mono tabular-nums">{user.email}</span></p>
                  <p><span className="font-semibold text-slate-900">ユーザーID:</span> <span className="font-mono text-[11px] text-slate-500">{user.id}</span></p>
                  <p>
                    <span className="font-semibold text-slate-900">アカウント権限:</span>{' '}
                    <span className={profile?.is_admin || profile?.is_police_staff ? 'text-[#0046ff] font-bold' : 'text-slate-700'}>
                      {profile?.is_super_admin ? '主任管理者' : profile?.is_admin ? '一般管理者' : profile?.is_police_staff ? '警察職員' : '一般住民'}
                    </span>
                  </p>
                </div>
              </div>

              {/* 住民プロフィール変更フォーム */}
              <div className="bg-white border border-slate-300 rounded-sm p-6 space-y-5">
                <h2 className="text-sm font-bold text-slate-900 border-b border-slate-200 pb-2 tracking-tight">
                  住民登録情報の登録・変更
                </h2>

                <form onSubmit={handleSaveProfile} className="space-y-4 text-xs">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                    <ResidentAvatar
                      path={profile?.avatar_path}
                      previewUrl={avatarPreviewUrl}
                      name={displayName || fullName || '住民'}
                      size="large"
                    />
                    <div className="space-y-2">
                      <label htmlFor="resident-avatar" className="block font-semibold text-slate-800 text-[13px]">プロフィールアイコン</label>
                      <input
                        id="resident-avatar"
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={(event) => {
                          const file = event.target.files?.[0] ?? null;
                          if (file && (file.size > 2 * 1024 * 1024 || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type))) {
                            setToast({ message: 'JPEG・PNG・WebP形式の2MB以内の画像を選択してください。', type: 'error' });
                            event.target.value = '';
                            return;
                          }
                          if (avatarPreviewUrlRef.current) URL.revokeObjectURL(avatarPreviewUrlRef.current);
                          avatarPreviewUrlRef.current = file ? URL.createObjectURL(file) : '';
                          setAvatarPreviewUrl(avatarPreviewUrlRef.current);
                          setAvatarFile(file);
                        }}
                        className="block max-w-full text-xs text-slate-700 file:mr-3 file:rounded-sm file:border-0 file:bg-slate-200 file:px-3 file:py-1.5 file:font-semibold"
                      />
                      <p className="text-[11px] text-slate-500">JPEG・PNG・WebP、2MB以内。ログイン中の住民へ表示されます。</p>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="resident-display-name" className="mb-1 block font-semibold text-slate-800 text-[13px]">表示名</label>
                    <input
                      id="resident-display-name"
                      type="text"
                      value={displayName}
                      onChange={(event) => setDisplayName(event.target.value.slice(0, 40))}
                      maxLength={40}
                      required
                      className="w-full rounded-sm border border-slate-300 px-3 py-2 text-xs focus:outline-none focus:border-slate-800 sm:w-1/2"
                    />
                    <p className="mt-1 text-[11px] text-slate-500">掲示板・チャット・ログイン表示に使用されます。</p>
                  </div>

                  <div>
                    <label htmlFor="resident-bio" className="mb-1 block font-semibold text-slate-800 text-[13px]">自己紹介（500字以内）</label>
                    <textarea
                      id="resident-bio"
                      value={bio}
                      onChange={(event) => setBio(event.target.value.slice(0, 500))}
                      maxLength={500}
                      rows={3}
                      className="w-full rounded-sm border border-slate-300 px-3 py-2 text-xs focus:outline-none focus:border-slate-800"
                    />
                    <p className="mt-1 text-right text-[11px] text-slate-500 font-mono tabular-nums">{bio.length} / 500</p>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-800 text-[13px] mb-1">氏名</label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                      autoComplete="name"
                      className="w-full sm:w-1/2 px-3 py-2 border border-slate-300 rounded-sm text-xs focus:outline-none focus:border-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-800 text-[13px] mb-1">生年月日 <span className="font-normal text-slate-500">（任意）</span></label>
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={birthYear}
                        onChange={(e) => {
                          const year = e.target.value;
                          setBirthYear(year);
                          if (year && birthMonth && birthDay) {
                            setBirthDay(String(Math.min(Number(birthDay), getDaysInMonth(Number(year), Number(birthMonth)))));
                          }
                          setBirthDateError('');
                        }}
                        className="px-3 py-2 border border-slate-300 rounded-sm bg-white text-xs focus:outline-none focus:border-slate-800 tabular-nums"
                      >
                        <option value="">年</option>
                        {years.map((y) => (
                          <option key={y} value={y}>{y}年</option>
                        ))}
                      </select>
                      <select
                        value={birthMonth}
                        onChange={(e) => {
                          const month = e.target.value;
                          setBirthMonth(month);
                          if (birthYear && month && birthDay) {
                            setBirthDay(String(Math.min(Number(birthDay), getDaysInMonth(Number(birthYear), Number(month)))));
                          }
                          setBirthDateError('');
                        }}
                        className="px-3 py-2 border border-slate-300 rounded-sm bg-white text-xs focus:outline-none focus:border-slate-800 tabular-nums"
                      >
                        <option value="">月</option>
                        {months.map((m) => (
                          <option key={m} value={m}>{m}月</option>
                        ))}
                      </select>
                      <select
                        value={birthDay}
                        onChange={(e) => { setBirthDay(e.target.value); setBirthDateError(''); }}
                        disabled={!birthYear || !birthMonth}
                        className="px-3 py-2 border border-slate-300 rounded-sm bg-white text-xs focus:outline-none focus:border-slate-800 tabular-nums"
                      >
                        <option value="">日</option>
                        {days.map((d) => (
                          <option key={d} value={d}>{d}日</option>
                        ))}
                      </select>
                    </div>
                    {birthDateError && <p role="alert" className="mt-2 text-xs text-red-700">{birthDateError}</p>}
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-800 text-[13px] mb-1">居住地域・住所</label>
                    <input
                      type="text"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="例: 東栄市中央区1-1"
                      className="w-full px-3 py-2 border border-slate-300 rounded-sm text-xs focus:outline-none focus:border-slate-800"
                    />
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={saving}
                      className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-sm transition-colors disabled:opacity-50 min-h-[44px]"
                    >
                      {saving ? '保存中...' : '登録情報を保存する'}
                    </button>
                  </div>
                </form>
              </div>

            </div>

            {/* 右側サイドバー (3割) */}
            <aside className="space-y-6">

              {/* 迅速アクセスショートカット */}
              <div className="bg-white border border-slate-300 p-5 rounded-sm space-y-3 text-xs">
                <h3 className="font-bold text-slate-900 border-b border-slate-200 pb-2 tracking-tight">
                  権限専用ポータル案内
                </h3>
                <div className="space-y-2">
                  <Link
                    href="/toeiken/portal"
                    className="block p-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 font-semibold rounded-sm"
                  >
                    住民ポータル機能一覧 →
                  </Link>
                  {profile?.is_admin && (
                    <Link
                      href="/admin"
                      className="block p-2.5 bg-blue-950 text-blue-100 border border-blue-800 font-semibold rounded-sm"
                    >
                      管理者パネルを開く →
                    </Link>
                  )}
                  {profile?.is_police_staff && (
                    <Link
                      href="/police"
                      className="block p-2.5 bg-emerald-950 text-emerald-100 border border-emerald-800 font-semibold rounded-sm"
                    >
                      警察職員専用ポータル →
                    </Link>
                  )}
                </div>
              </div>

              {/* 外部サービス連携 */}
              <div className="bg-white border border-slate-300 p-5 rounded-sm space-y-3 text-xs">
                <h3 className="font-bold text-slate-900 border-b border-slate-200 pb-2 tracking-tight">
                  外部サービス連携設定
                </h3>
                <div className="space-y-2">
                  <p className="text-slate-600 leading-relaxed">
                    Discord連携は任意設定です。アカウント認証はGoogleまたはメールアドレスで行われます。
                  </p>
                  {hasDiscordIdentity ? (
                    <span className="inline-block bg-slate-100 text-slate-800 border border-slate-300 px-3 py-1 font-semibold rounded-sm">
                      Discord 連携済み
                    </span>
                  ) : (
                    <button
                      onClick={handleLinkDiscord}
                      disabled={linkingDiscord}
                      className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-sm transition-colors disabled:opacity-50"
                    >
                      {linkingDiscord ? '連携処理中...' : 'Discordを連携設定'}
                    </button>
                  )}
                </div>
              </div>

            </aside>

          </div>
        )}
      </main>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}