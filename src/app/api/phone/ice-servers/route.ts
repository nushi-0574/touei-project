import { createHmac } from 'node:crypto';
import { getAuthenticatedUser } from '@/src/lib/server/supabase';
import { getErrorMessage } from '@/src/lib/errors';

const stunServers = [{ urls: 'stun:stun.l.google.com:19302' }];

export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return Response.json({ error: 'ログインしてください。' }, { status: 401 });

    const turnUrl = process.env.TURN_SERVER_URL;
    const turnSecret = process.env.TURN_SHARED_SECRET;
    if (Boolean(turnUrl) !== Boolean(turnSecret)) {
      throw new Error('TURN_SERVER_URL and TURN_SHARED_SECRET must be configured together.');
    }

    if (!turnUrl || !turnSecret) {
      return Response.json({ iceServers: stunServers, turnAvailable: false }, {
        headers: { 'Cache-Control': 'private, no-store' },
      });
    }
    const turnUrls = turnUrl.split(',').map((url) => url.trim()).filter(Boolean);
    if (!turnUrls.length || turnUrls.some((url) => !url.startsWith('turn:') && !url.startsWith('turns:'))) {
      throw new Error('TURN_SERVER_URL must contain one or more turn: or turns: URLs.');
    }

    const username = `${Math.floor(Date.now() / 1000) + 3600}:${user.id}`;
    const credential = createHmac('sha1', turnSecret).update(username).digest('base64');
    return Response.json({
      iceServers: [...stunServers, { urls: turnUrls, username, credential }],
      turnAvailable: true,
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('通話接続情報を準備できませんでした:', error);
    return Response.json({ error: getErrorMessage(error, '通話接続を準備できませんでした。') }, { status: 500 });
  }
}
