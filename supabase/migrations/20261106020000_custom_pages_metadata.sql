alter table public.custom_pages
  add column if not exists description text not null default '',
  add column if not exists keywords text not null default '',
  add column if not exists category text not null default '一般案内',
  add column if not exists is_published boolean not null default true,
  add column if not exists display_order integer not null default 0,
  add column if not exists updated_at timestamptz not null default now();
