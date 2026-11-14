-- 20261109000000_digital_products.sql
-- デジタル商品取引プラットフォーム (商品マスタ、注文履歴、ライセンスキー、音声プレビュー対応)

create table if not exists public.digital_products (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text unique not null,
  description text not null default '',
  price_amount integer not null default 0,
  currency text not null default 'jpy',
  billing_type text not null default 'one_time', -- 'one_time' or 'subscription'
  stripe_price_id text,
  file_path text, -- 本体の安全なストレージパス
  preview_audio_path text, -- 試聴用音声ファイルパス（ダウンロード不可プレビュー用）
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.digital_orders (
  id uuid primary key default gen_random_uuid(),
  order_number text unique not null,
  user_id uuid references public.profiles(id) on delete cascade,
  product_id uuid references public.digital_products(id) on delete restrict,
  stripe_session_id text unique,
  stripe_payment_intent text,
  amount_paid integer not null default 0,
  status text not null default 'completed',
  created_at timestamptz not null default now()
);

create table if not exists public.digital_licenses (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.digital_products(id) on delete cascade,
  order_id uuid references public.digital_orders(id) on delete set null,
  user_id uuid references public.profiles(id) on delete set null,
  license_key text not null,
  status text not null default 'available', -- 'available', 'assigned', 'revoked'
  assigned_at timestamptz,
  created_at timestamptz not null default now()
);

-- インデックス
create index if not exists idx_digital_products_slug on public.digital_products(slug);
create index if not exists idx_digital_orders_user_id on public.digital_orders(user_id);
create index if not exists idx_digital_licenses_user_id on public.digital_licenses(user_id);

-- RLS
alter table public.digital_products enable row level security;
alter table public.digital_orders enable row level security;
alter table public.digital_licenses enable row level security;

-- ポリシー
drop policy if exists "digital_products_select_public" on public.digital_products;
create policy "digital_products_select_public"
  on public.digital_products for select
  using (is_published = true or exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

drop policy if exists "digital_products_admin_all" on public.digital_products;
create policy "digital_products_admin_all"
  on public.digital_products for all
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true))
  with check (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

drop policy if exists "digital_orders_select_own" on public.digital_orders;
create policy "digital_orders_select_own"
  on public.digital_orders for select
  using (user_id = auth.uid() or exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

drop policy if exists "digital_orders_insert_service" on public.digital_orders;
create policy "digital_orders_insert_service"
  on public.digital_orders for insert
  with check (user_id = auth.uid() or exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

drop policy if exists "digital_licenses_select_own" on public.digital_licenses;
create policy "digital_licenses_select_own"
  on public.digital_licenses for select
  using (user_id = auth.uid() or exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

-- Realtime
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'digital_products'
  ) then
    alter publication supabase_realtime add table public.digital_products;
  end if;
end $$;
