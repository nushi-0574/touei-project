import { getApplicationUrl, getAuthenticatedUser, getStripe, getStripeCustomerSearchQuery } from '@/src/lib/server/billing';
import { getErrorMessage } from '@/src/lib/errors';

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return Response.json({ error: 'ログインが必要です。' }, { status: 401 });

    const stripe = getStripe();
    const customers = await stripe.customers.search({
      query: getStripeCustomerSearchQuery(user.id),
      limit: 1,
    });
    const customer = customers.data[0];
    if (!customer) {
      return Response.json({ error: 'Stripeの契約情報が見つかりません。' }, { status: 404 });
    }

    const portal = await stripe.billingPortal.sessions.create({
      customer: customer.id,
      return_url: `${getApplicationUrl()}/dashboard`,
    });
    return Response.json({ url: portal.url });
  } catch (error) {
    console.error('Stripe customer portal session creation failed:', error);
    const message = getErrorMessage(error, '契約管理画面を開けませんでした。');
    const status = message.includes('not configured') || message.includes('APP_URL') ? 503 : 500;
    return Response.json({ error: message }, { status });
  }
}
