import 'server-only';

import { createClient } from '@supabase/supabase-js';
import type { User } from '@supabase/supabase-js';

export function getApplicationUrl(): string {
  const configuredUrl = process.env.APP_URL;
  if (!configuredUrl) throw new Error('APP_URL is not configured.');

  let url: URL;
  try {
    url = new URL(configuredUrl);
  } catch {
    throw new Error('APP_URL must be a valid absolute URL.');
  }
  if (url.protocol !== 'https:' && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
    throw new Error('APP_URL must use HTTPS except for local development.');
  }
  return url.origin;
}

export async function getAuthenticatedUser(request: Request): Promise<User | null> {
  const token = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return null;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase is not configured for server-side authentication.');
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  const { data, error } = await supabase.auth.getUser(token);
  if (error) {
    console.error('Server authentication failed:', error);
    return null;
  }
  return data.user;
}

export function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured for server-side operations.');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
