import 'server-only';

import type { User } from '@supabase/supabase-js';
import { getAuthenticatedUser, getSupabaseAdmin } from './supabase';

export const STAFF_PERMISSIONS = [
  'manage_residents',
  'manage_applications',
  'manage_events',
  'moderate_community',
  'manage_support',
  'manage_map',
  'manage_recruitment',
  'manage_content',
  'send_notifications',
] as const;

export type StaffPermission = (typeof STAFF_PERMISSIONS)[number];
type StaffAuthorizationPermission = StaffPermission | 'manage_staff';

export type StaffAuthorization = {
  user: User;
  isSuperAdmin: boolean;
};

export async function authorizeStaff(
  request: Request,
  permission: StaffAuthorizationPermission,
): Promise<StaffAuthorization | null> {
  const user = await getAuthenticatedUser(request);
  if (!user) return null;

  const admin = getSupabaseAdmin();
  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('is_admin, is_super_admin')
    .eq('id', user.id)
    .maybeSingle();
  if (profileError) throw profileError;

  if (profile?.is_admin) {
    return { user, isSuperAdmin: profile.is_super_admin === true };
  }
  if (permission === 'manage_staff') return null;

  const { data: assignment, error: permissionError } = await admin
    .from('staff_permissions')
    .select('permission')
    .eq('user_id', user.id)
    .eq('permission', permission)
    .maybeSingle();
  if (permissionError) throw permissionError;
  return assignment ? { user, isSuperAdmin: false } : null;
}

export function isStaffPermission(value: unknown): value is StaffPermission {
  return typeof value === 'string' && STAFF_PERMISSIONS.includes(value as StaffPermission);
}
