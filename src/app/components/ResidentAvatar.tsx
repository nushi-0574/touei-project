'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

type ResidentAvatarProps = {
  path?: string | null;
  previewUrl?: string;
  name: string;
  size?: 'small' | 'medium' | 'large';
};

const sizes = {
  small: 'size-9',
  medium: 'size-16',
  large: 'size-28',
};

export default function ResidentAvatar({ path, previewUrl = '', name, size = 'medium' }: ResidentAvatarProps) {
  const [signedImage, setSignedImage] = useState<{ path: string; url: string } | null>(null);

  useEffect(() => {
    let active = true;
    if (!path) {
      return () => {
        active = false;
      };
    }

    void supabase.storage
      .from('resident-avatars')
      .createSignedUrl(path, 3600)
      .then(({ data, error }) => {
        if (error) throw error;
        if (active) setSignedImage({ path, url: data.signedUrl });
      })
      .catch((error: unknown) => {
        console.error('プロフィール画像を読み込めませんでした:', error);
      });

    return () => {
      active = false;
    };
  }, [path]);

  const imageUrl = previewUrl || (signedImage?.path === path ? signedImage?.url ?? '' : '');

  return (
    <div
      role="img"
      aria-label={`${name}のアイコン`}
      className={`${sizes[size]} shrink-0 overflow-hidden rounded-full border border-slate-300 bg-slate-100`}
    >
      {imageUrl ? (
        <div className="size-full bg-cover bg-center" style={{ backgroundImage: `url("${imageUrl}")` }} />
      ) : (
        <div className="flex size-full items-center justify-center bg-slate-200 text-lg font-bold text-slate-600">
          {name.trim().slice(0, 1) || '住'}
        </div>
      )}
    </div>
  );
}
