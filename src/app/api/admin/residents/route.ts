import { getApplicationUrl, getSupabaseAdmin } from '@/src/lib/server/billing';
import { authorizeStaff } from '@/src/lib/server/authorization';
import { getErrorMessage } from '@/src/lib/errors';

type ResidentInput = {
  email?: unknown;
  full_name?: unknown;
  address?: unknown;
  birth_date?: unknown;
};

function isValidBirthDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export async function GET(request: Request) {
  try {
    const authorized = await authorizeStaff(request, 'manage_residents');
    if (!authorized) return Response.json({ error: '住民管理権限が必要です。' }, { status: 403 });

    const url = new URL(request.url);
    const search = (url.searchParams.get('q') ?? '').trim().replace(/[%_(),]/g, '').slice(0, 100);
    const status = url.searchParams.get('status') ?? 'all';
    if (!['all', 'active', 'inactive', 'pending'].includes(status)) {
      return Response.json({ error: '住民状態の絞り込み条件が不正です。' }, { status: 400 });
    }
    const page = Math.max(0, Number.parseInt(url.searchParams.get('page') ?? '0', 10) || 0);
    const from = page * 50;
    const to = from + 49;
    let query = getSupabaseAdmin()
      .from('profiles')
      .select('id, email, full_name, address, birth_date, resident_status, created_at, is_admin, is_super_admin, is_police_staff', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);
    if (search) query = query.or(`email.ilike.%${search}%,full_name.ilike.%${search}%`);
    if (status !== 'all') query = query.eq('resident_status', status);

    const [{ data, error, count }, permissionsResult, rolesResult] = await Promise.all([
      query,
      authorized.isAdmin
        ? getSupabaseAdmin().from('staff_permissions').select('user_id, permission')
        : Promise.resolve({ data: [], error: null }),
      authorized.isAdmin
        ? getSupabaseAdmin().from('staff_roles').select('user_id, role')
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (error) throw error;
    if (permissionsResult.error) throw permissionsResult.error;
    if (rolesResult.error) throw rolesResult.error;
    const rolesByUser = new Map<string, string[]>();
    for (const assignment of rolesResult.data ?? []) {
      rolesByUser.set(assignment.user_id, [...(rolesByUser.get(assignment.user_id) ?? []), assignment.role]);
    }
    for (const resident of data ?? []) {
      if (resident.is_police_staff) {
        rolesByUser.set(resident.id, [...(rolesByUser.get(resident.id) ?? []), 'police']);
      }
    }
    return Response.json({
      residents: data,
      permissions: permissionsResult.data,
      roles: [...rolesByUser].flatMap(([userId, assignedRoles]) => assignedRoles.map((role) => ({ user_id: userId, role }))),
      canManageStaff: authorized.isAdmin,
      total: count ?? 0,
      page,
    });
  } catch (error) {
    console.error('住民一覧の取得に失敗しました:', error);
    return Response.json({ error: getErrorMessage(error, '住民一覧を取得できませんでした。') }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const authorized = await authorizeStaff(request, 'manage_residents');
    if (!authorized) return Response.json({ error: '住民管理権限が必要です。' }, { status: 403 });

    const body = await request.json() as ResidentInput;
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const fullName = typeof body.full_name === 'string' ? body.full_name.trim() : '';
    const address = typeof body.address === 'string' ? body.address.trim() : '';
    const birthDate = typeof body.birth_date === 'string' ? body.birth_date.trim() : '';

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
      return Response.json({ error: '有効なメールアドレスを入力してください。' }, { status: 400 });
    }

    if (fullName.length < 1 || fullName.length > 200 || address.length > 500) {
      return Response.json({ error: '氏名または住所の入力内容を確認してください。' }, { status: 400 });
    }
    if (birthDate && !isValidBirthDate(birthDate)) {
      return Response.json({ error: '生年月日はYYYY-MM-DD形式の実在する日付を入力してください。' }, { status: 400 });
    }

    const appUrl = getApplicationUrl();
    const admin = getSupabaseAdmin();
    const { data: invitation, error: invitationError } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { full_name: fullName },
      redirectTo: `${appUrl}/toeiken/dashboard`,
    });
    if (invitationError) throw invitationError;
    if (!invitation.user) throw new Error('Supabaseから招待ユーザーが返されませんでした。');

    const { error: profileError } = await admin.from('profiles').upsert({
      id: invitation.user.id,
      email,
      full_name: fullName,
      address,
      birth_date: birthDate || null,
      resident_status: 'active',
    });
    if (profileError) {
      console.error('招待後の住民プロフィール保存に失敗しました:', profileError);
      return Response.json(
        { error: '招待メールは送信されましたが、住民情報を保存できませんでした。管理者にお問い合わせください。' },
        { status: 500 },
      );
    }

    const { error: cardError } = await admin.from('resident_cards').upsert(
      { user_id: invitation.user.id },
      { onConflict: 'user_id', ignoreDuplicates: true },
    );
    if (cardError) {
      console.error('住民証の発行に失敗しました:', cardError);
      return Response.json(
        { error: '住民登録は完了しましたが、住民証を発行できませんでした。管理者にお問い合わせください。' },
        { status: 500 },
      );
    }

    return Response.json({ residentId: invitation.user.id }, { status: 201 });
  } catch (error) {
    console.error('住民登録の追加に失敗しました:', error);
    return Response.json({ error: getErrorMessage(error, '住民を追加できませんでした。') }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const authorized = await authorizeStaff(request, 'manage_residents');
    if (!authorized) return Response.json({ error: '住民管理権限が必要です。' }, { status: 403 });

    const body = await request.json() as { residentId?: unknown; status?: unknown };
    if (
      typeof body.residentId !== 'string'
      || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.residentId)
      || (body.status !== 'active' && body.status !== 'inactive' && body.status !== 'pending')
    ) {
      return Response.json({ error: '住民状態の指定が不正です。' }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    const { error: profileError } = await admin
      .from('profiles')
      .update({ resident_status: body.status })
      .eq('id', body.residentId);
    if (profileError) throw profileError;

    const { error: cardError } = body.status === 'active'
      ? await admin.from('resident_cards').upsert(
        { user_id: body.residentId, revoked_at: null },
        { onConflict: 'user_id' },
      )
      : await admin
        .from('resident_cards')
        .update({ revoked_at: new Date().toISOString() })
        .eq('user_id', body.residentId);
    if (cardError) {
      console.error('住民状態を更新しましたが、住民証を同期できませんでした:', cardError);
      return Response.json({ error: '住民状態は更新されましたが、住民証の状態を更新できませんでした。' }, { status: 500 });
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error('住民状態の更新に失敗しました:', error);
    return Response.json({ error: getErrorMessage(error, '住民状態を更新できませんでした。') }, { status: 500 });
  }
}
