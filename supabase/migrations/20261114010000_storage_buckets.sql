-- 20261104010000_storage_buckets.sql
-- ストレージバケット（digital-product-contents, digital-product-previews, resident-avatars）の自動作成とポリシー設定

insert into storage.buckets (id, name, public)
values
  ('digital-product-contents', 'digital-product-contents', false),
  ('digital-product-previews', 'digital-product-previews', true),
  ('resident-avatars', 'resident-avatars', false)
on conflict (id) do nothing;

-- 1. digital-product-contents (非公開バケット: 管理者のみアップロード、購入者は署名付きURL)
drop policy if exists "digital_product_contents_admin_all" on storage.objects;
create policy "digital_product_contents_admin_all"
  on storage.objects for all
  using (bucket_id = 'digital-product-contents' and exists (select 1 from public.profiles where id = auth.uid() and is_admin = true))
  with check (bucket_id = 'digital-product-contents' and exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

-- 2. digital-product-previews (公開バケット: 誰でも試聴可能、管理者は全操作)
drop policy if exists "digital_product_previews_public_select" on storage.objects;
create policy "digital_product_previews_public_select"
  on storage.objects for select
  using (bucket_id = 'digital-product-previews');

drop policy if exists "digital_product_previews_admin_all" on storage.objects;
create policy "digital_product_previews_admin_all"
  on storage.objects for all
  using (bucket_id = 'digital-product-previews' and exists (select 1 from public.profiles where id = auth.uid() and is_admin = true))
  with check (bucket_id = 'digital-product-previews' and exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

-- 3. resident-avatars (非公開バケット: 住民アバター用)
drop policy if exists "resident_avatars_all" on storage.objects;
create policy "resident_avatars_all"
  on storage.objects for all
  using (bucket_id = 'resident-avatars' and auth.uid() is not null)
  with check (bucket_id = 'resident-avatars' and auth.uid() is not null);
