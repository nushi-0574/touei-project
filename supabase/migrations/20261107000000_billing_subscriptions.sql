create table public.billing_subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text not null,
  stripe_subscription_id text not null unique,
  status text not null,
  price_id text,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.billing_subscriptions enable row level security;

revoke all on table public.billing_subscriptions from public, anon, authenticated;
grant select on table public.billing_subscriptions to authenticated;
grant all on table public.billing_subscriptions to service_role;

create policy "Users can read their own billing subscription"
  on public.billing_subscriptions
  for select
  to authenticated
  using (auth.uid() = user_id);
