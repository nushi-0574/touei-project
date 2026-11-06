import 'server-only';

import Stripe from 'stripe';
export { getApplicationUrl, getAuthenticatedUser, getSupabaseAdmin } from './supabase';

let stripeClient: Stripe | undefined;

export function getStripe(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) throw new Error('Stripe is not configured: STRIPE_SECRET_KEY is missing.');
  stripeClient ??= new Stripe(secretKey);
  return stripeClient;
}

export function getStripeCustomerSearchQuery(userId: string): string {
  return `metadata['supabase_user_id']:'${userId}'`;
}
