import { getApplicationUrl, getAuthenticatedUser, getStripe, getStripeCustomerSearchQuery } from '@/src/lib/server/billing';
import { getErrorMessage } from '@/src/lib/errors';

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return Response.json({ error: 'ログインが必要です。' }, { status: 401 });
    if (!user.email) return Response.json({ error: 'メールアドレスが登録されていません。' }, { status: 400 });

    const priceId = process.env.STRIPE_PRICE_ID;
    if (!priceId) {
      return Response.json({ error: 'Stripeの商品価格が設定されていません。' }, { status: 503 });
    }

    const stripe = getStripe();
    const price = await stripe.prices.retrieve(priceId);
    if (!price.active || !price.recurring) {
      return Response.json({ error: '設定されたStripe価格が有効な定期プランではありません。' }, { status: 503 });
    }

    const customers = await stripe.customers.search({
      query: getStripeCustomerSearchQuery(user.id),
      limit: 1,
    });

    let customer = customers.data[0];
    if (!customer) {
      customer = await stripe.customers.create(
        {
          email: user.email,
          name: typeof user.user_metadata.full_name === 'string' ? user.user_metadata.full_name : undefined,
          metadata: { supabase_user_id: user.id },
        },
        { idempotencyKey: `toei-user-${user.id}` },
      );
    }

    const subscriptions = await stripe.subscriptions.list({
      customer: customer.id,
      status: 'all',
      limit: 100,
    });
    const existingSubscription = subscriptions.data.find((subscription) =>
      ['active', 'trialing', 'past_due', 'unpaid', 'incomplete', 'paused'].includes(subscription.status),
    );
    if (existingSubscription) {
      return Response.json(
        { error: '契約情報が既にあります。契約管理画面をご利用ください。' },
        { status: 409 },
      );
    }

    const appUrl = getApplicationUrl();
    const checkout = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customer.id,
      client_reference_id: user.id,
      metadata: { supabase_user_id: user.id },
      subscription_data: { metadata: { supabase_user_id: user.id } },
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/dashboard?billing=success`,
      cancel_url: `${appUrl}/dashboard?billing=cancelled`,
    });

    if (!checkout.url) throw new Error('Stripe did not return a Checkout URL.');
    return Response.json({ url: checkout.url });
  } catch (error) {
    console.error('Stripe Checkout session creation failed:', error);
    const message = getErrorMessage(error, '決済ページを作成できませんでした。');
    const status = message.includes('not configured') || message.includes('APP_URL') ? 503 : 500;
    return Response.json({ error: message }, { status });
  }
}
