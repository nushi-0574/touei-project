'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

type Subscription = {
  status: string;
  current_period_end: string | null;
};

type BillingAction = 'checkout' | 'portal';

function readApiError(payload: unknown): string | null {
  if (
    typeof payload === 'object' &&
    payload !== null &&
    'error' in payload &&
    typeof payload.error === 'string'
  ) {
    return payload.error;
  }
  return null;
}

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    active: '利用中',
    trialing: 'トライアル中',
    past_due: '支払い確認中',
    unpaid: '未払い',
    incomplete: '決済手続き中',
    paused: '一時停止中',
    canceled: '解約済み',
    incomplete_expired: '決済期限切れ',
  };
  return labels[status] ?? status;
}

export default function BillingPanel({ userId }: { userId: string }) {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<BillingAction | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  const fetchSubscription = useCallback(async (): Promise<Subscription | null> => {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    if (!session || session.user.id !== userId) {
      throw new Error('ログイン状態を確認できませんでした。再度ログインしてください。');
    }

    const { data, error } = await supabase
      .from('billing_subscriptions')
      .select('status, current_period_end')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw error;
    return data;
  }, [userId]);

  useEffect(() => {
    let active = true;

    async function loadSubscription() {
      try {
        const data = await fetchSubscription();
        if (active) {
          setErrorMessage('');
          setSubscription(data);
        }
      } catch (error) {
        console.error('契約状態の取得に失敗しました:', error);
        if (active) {
          setErrorMessage(error instanceof Error ? error.message : '契約状態を取得できませんでした。');
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadSubscription();
    return () => {
      active = false;
    };
  }, [fetchSubscription]);

  const refreshSubscription = useCallback(async () => {
    setLoading(true);
    setErrorMessage('');
    try {
      setSubscription(await fetchSubscription());
    } catch (error) {
      console.error('契約状態の取得に失敗しました:', error);
      setErrorMessage(error instanceof Error ? error.message : '契約状態を取得できませんでした。');
    } finally {
      setLoading(false);
    }
  }, [fetchSubscription]);

  async function openBillingAction(action: BillingAction) {
    setBusy(action);
    setErrorMessage('');
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!session || session.user.id !== userId) {
        throw new Error('ログイン状態を確認できませんでした。再度ログインしてください。');
      }

      const response = await fetch(`/api/billing/${action}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const payload: unknown = await response.json();
      if (!response.ok) {
        throw new Error(readApiError(payload) ?? 'Stripeに接続できませんでした。');
      }

      const url = typeof payload === 'object' && payload !== null && 'url' in payload
        ? payload.url
        : null;
      if (typeof url !== 'string') throw new Error('Stripeの遷移先を取得できませんでした。');

      const destination = new URL(url);
      if (destination.protocol !== 'https:' || !destination.hostname.endsWith('.stripe.com')) {
        throw new Error('Stripeから無効な遷移先が返されました。');
      }
      window.location.assign(destination.href);
    } catch (error) {
      console.error('決済画面を開けませんでした:', error);
      setErrorMessage(error instanceof Error ? error.message : '決済画面を開けませんでした。');
    } finally {
      setBusy(null);
    }
  }

  const canStartSubscription = !subscription || ['canceled', 'incomplete_expired'].includes(subscription.status);

  return (
    <div className="space-y-3">
      {loading ? (
        <p className="text-xs text-slate-500">契約状態を確認しています...</p>
      ) : errorMessage ? (
        <p role="alert" className="text-xs text-red-700">{errorMessage}</p>
      ) : subscription ? (
        <div className="rounded border border-slate-200 bg-slate-50 p-3 text-xs">
          <p>
            契約状態: <span className="font-semibold text-slate-900">{getStatusLabel(subscription.status)}</span>
          </p>
          {subscription.current_period_end && (
            <p className="mt-1 text-slate-500">
              次回更新日: {new Intl.DateTimeFormat('ja-JP').format(new Date(subscription.current_period_end))}
            </p>
          )}
        </div>
      ) : (
        <p className="text-xs text-slate-600">
          定期プランの契約と管理ができます。料金・契約条件はStripeの決済画面で確認できます。
        </p>
      )}

      {!loading && (
        <button
          type="button"
          onClick={() => void refreshSubscription()}
          className="text-xs text-[#0046ff] underline"
        >
          契約情報を更新
        </button>
      )}

      <div className="flex flex-col gap-2">
        {canStartSubscription && (
          <button
            type="button"
            onClick={() => void openBillingAction('checkout')}
            disabled={loading || errorMessage !== '' || busy !== null}
            className="w-full rounded bg-[#0046ff] py-2 text-xs font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy === 'checkout' ? 'Stripeに接続中...' : 'Stripeでプランを申し込む'}
          </button>
        )}
        {subscription && subscription.status !== 'canceled' && subscription.status !== 'incomplete_expired' && (
          <button
            type="button"
            onClick={() => void openBillingAction('portal')}
            disabled={loading || errorMessage !== '' || busy !== null}
            className="w-full rounded border border-slate-300 bg-white py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy === 'portal' ? 'Stripeに接続中...' : '契約・支払い方法を管理'}
          </button>
        )}
      </div>
    </div>
  );
}
