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
type StaffAuthorizationPermission = StaffPermission
  | 'manage_staff'
  | 'manage_profile_changes'
  | 'manage_documents'
  | 'manage_emergency_alerts'
  | 'manage_phone_numbers'
  | 'read_audit_logs';

const permissionRole: Partial<Record<StaffAuthorizationPermission, string[]>> = {
  manage_applications: ['administration_bureau'],
  manage_support: ['operations_bureau', 'administration_bureau', 'development_bureau'],
  manage_profile_changes: ['administration_bureau'],
  manage_documents: ['administration_bureau'],
  manage_emergency_alerts: ['operations_bureau'],
  manage_phone_numbers: ['administration_bureau'],
};

const permissionFallbacks: Partial<Record<StaffAuthorizationPermission, StaffPermission[]>> = {
  manage_profile_changes: ['manage_residents'],
  manage_documents: ['manage_residents', 'manage_applications'],
  manage_emergency_alerts: ['manage_map'],
  manage_phone_numbers: ['manage_residents'],
};

export type StaffAuthorization = {
  user: User;
  isAdmin: boolean;
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
    return { user, isAdmin: true, isSuperAdmin: profile.is_super_admin === true };
  }
  if (permission === 'manage_staff' || permission === 'read_audit_logs') return null;

  const { data: assignment, error: permissionError } = await admin
    .from('staff_permissions')
    .select('permission')
    .eq('user_id', user.id)
    .in('permission', [permission, ...(permissionFallbacks[permission] ?? [])])
    .maybeSingle();
  if (permissionError) throw permissionError;
  if (assignment) return { user, isAdmin: false, isSuperAdmin: false };

  const requiredRoles = permissionRole[permission];
  if (!requiredRoles?.length) return null;
  const { data: role, error: roleError } = await admin
    .from('staff_roles')
    .select('role')
    .eq('user_id', user.id)
    .in('role', requiredRoles)
    .maybeSingle();
  if (roleError) throw roleError;
  return role ? { user, isAdmin: false, isSuperAdmin: false } : null;
}

export function isStaffPermission(value: unknown): value is StaffPermission {
  return typeof value === 'string' && STAFF_PERMISSIONS.includes(value as StaffPermission);
}
