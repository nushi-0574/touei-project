'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import Header from '../../../components/Header';
import Breadcrumbs from '../../../components/Breadcrumbs';
import { ContentSkeleton } from '@/src/app/components/LoadingScreen';
import ResidentAvatar from '../../../components/ResidentAvatar';
import { supabase } from '../../../../lib/supabase';

type PublicProfile = {
  user_id: string;
  display_name: string;
  avatar_path: string | null;
  bio: string;
};

export default function ResidentProfilePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [currentUserId, setCurrentUserId] = useState('');
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (!session) {
          router.replace('/toeiken');
          return;
        }
        if (active) setCurrentUserId(session.user.id);

        const { data, error } = await supabase.rpc('get_resident_public_profiles', {
          target_user_ids: [id],
        });
        if (error) throw error;
        if (active) setProfile(data?.[0] ?? null);
      } catch (error) {
        console.error('住民プロフィールを取得できませんでした:', error);
        if (active) setErrorMessage('プロフィールを表示できませんでした。ログイン状態と住民登録をご確認ください。');
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadProfile();
    return () => {
      active = false;
    };
  }, [id, router]);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800">
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <Breadcrumbs items={[{ label: '住民プロフィール' }]} />
        {loading ? <ContentSkeleton rows={3} /> : errorMessage ? (
          <p role="alert" className="mt-4 rounded border border-red-300 bg-red-50 p-4 text-sm text-red-800">{errorMessage}</p>
        ) : !profile ? (
          <p className="mt-4 rounded border border-slate-200 bg-white p-6 text-sm text-slate-600">プロフィールが見つからないか、公開されていません。</p>
        ) : (
          <section className="mt-4 rounded border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
              <ResidentAvatar path={profile.avatar_path} name={profile.display_name} size="large" />
              <div className="min-w-0 flex-1">
                <h1 className="break-words text-2xl font-bold text-slate-900">{profile.display_name}</h1>
                {currentUserId !== profile.user_id && (
                  <Link
                    href={`/toeiken/messages?user=${encodeURIComponent(profile.user_id)}`}
                    className="mt-3 inline-flex min-h-10 items-center rounded bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
                  >
                    個人チャットを開始
                  </Link>
                )}
              </div>
            </div>
            <div className="mt-6 border-t border-slate-200 pt-5">
              <h2 className="text-sm font-bold text-slate-700">自己紹介</h2>
              <p className="mt-2 min-h-16 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-700">
                {profile.bio || '自己紹介はまだ登録されていません。'}
              </p>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
