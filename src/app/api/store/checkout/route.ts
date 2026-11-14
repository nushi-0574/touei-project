import { getApplicationUrl, getAuthenticatedUser, getStripe, getStripeCustomerSearchQuery, getSupabaseAdmin } from '@/src/lib/server/billing';
import { getErrorMessage } from '@/src/lib/errors';

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return Response.json({ error: 'ログインが必要です。' }, { status: 401 });
    if (!user.email) return Response.json({ error: 'メールアドレスが登録されていません。' }, { status: 400 });

    const body = await request.json() as { productId?: string };
    if (!body.productId) {
      return Response.json({ error: '商品IDを指定してください。' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const { data: product, error: productError } = await supabaseAdmin
      .from('digital_products')
      .select('*')
      .eq('id', body.productId)
      .eq('is_published', true)
      .maybeSingle();

    if (productError || !product) {
      return Response.json({ error: '指定された商品は存在しないか公開されていません。' }, { status: 404 });
    }

    const stripe = getStripe();
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

    const appUrl = getApplicationUrl();
    const isSubscription = product.billing_type === 'subscription';

    const checkout = await stripe.checkout.sessions.create({
      mode: isSubscription ? 'subscription' : 'payment',
      customer: customer.id,
      client_reference_id: user.id,
      metadata: {
        supabase_user_id: user.id,
        product_id: product.id,
      },
      line_items: [{
        price: product.stripe_price_id || undefined,
        price_data: !product.stripe_price_id ? {
          currency: product.currency || 'jpy',
          product_data: { name: product.title, description: product.description || undefined },
          unit_amount: product.price_amount,
          ...(isSubscription ? { recurring: { interval: 'month' } } : {}),
        } : undefined,
        quantity: 1,
      }],
      success_url: `${appUrl}/dashboard/library?store=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/store/${product.slug}?store=cancelled`,
    });

    if (!checkout.url) throw new Error('Stripe did not return a Checkout URL.');
    return Response.json({ url: checkout.url });
  } catch (error) {
    console.error('Digital store checkout creation failed:', error);
    const message = getErrorMessage(error, '決済ページを作成できませんでした。');
    const status = message.includes('not configured') || message.includes('APP_URL') ? 503 : 500;
    return Response.json({ error: message }, { status });
  }
}
