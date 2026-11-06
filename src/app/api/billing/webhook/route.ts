import Stripe from 'stripe';
import { getErrorMessage } from '@/src/lib/errors';
import { getStripe, getSupabaseAdmin } from '@/src/lib/server/billing';

export async function POST(request: Request) {
  const signature = request.headers.get('stripe-signature');
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret || !process.env.STRIPE_SECRET_KEY) {
    console.error('Stripe webhook endpoint is missing server-side credentials.');
    return Response.json({ error: 'Webhook endpoint is not configured.' }, { status: 503 });
  }
  if (!signature) {
    return Response.json({ error: 'Stripe signature is required.' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(await request.text(), signature, webhookSecret);
  } catch (error) {
    console.error('Stripe webhook signature verification failed:', error);
    return Response.json({ error: 'Invalid Stripe webhook signature.' }, { status: 400 });
  }

  try {
    let subscription: Stripe.Subscription | null = null;
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode === 'subscription' && session.subscription) {
        const subscriptionId = typeof session.subscription === 'string'
          ? session.subscription
          : session.subscription.id;
        subscription = await getStripe().subscriptions.retrieve(subscriptionId);
      }
    } else if (event.type.startsWith('customer.subscription.')) {
      subscription = event.data.object as Stripe.Subscription;
    }

    if (!subscription) return Response.json({ received: true });

    const stripe = getStripe();
    const customerId = typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer.id;
    let userId = subscription.metadata.supabase_user_id;

    if (!userId) {
      const customer = await stripe.customers.retrieve(customerId);
      if (!customer.deleted) userId = customer.metadata.supabase_user_id;
    }
    if (!userId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
      console.error('Stripe subscription has no valid Supabase user mapping:', subscription.id);
      return Response.json({ error: 'Subscription is not linked to an application user.' }, { status: 400 });
    }

    const { error } = await getSupabaseAdmin()
      .from('billing_subscriptions')
      .upsert(
        {
          user_id: userId,
          stripe_customer_id: customerId,
          stripe_subscription_id: subscription.id,
          status: subscription.status,
          price_id: subscription.items.data[0]?.price.id || null,
          current_period_end: subscription.items.data[0]
            ? new Date(subscription.items.data[0].current_period_end * 1000).toISOString()
            : null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      );
    if (error) throw error;

    return Response.json({ received: true });
  } catch (error) {
    console.error('Stripe webhook processing failed:', error);
    return Response.json(
      { error: getErrorMessage(error, 'Webhook processing failed.') },
      { status: 500 },
    );
  }
}
