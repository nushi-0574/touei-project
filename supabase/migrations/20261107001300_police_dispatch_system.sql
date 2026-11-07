-- 20261107001300_police_dispatch_system.sql
-- 警察指令システム (110番緊急指令・事件管理) テーブルと RLS ポリシー

create table if not exists public.police_dispatch_incidents (
  id uuid primary key default gen_random_uuid(),
  incident_number text not null,
  title text not null,
  category text not null default 'その他',
  location text not null default '',
  reporter_name text not null default '',
  reporter_phone text not null default '',
  details text not null default '',
  priority text not null default '一般(C)',
  status text not null default '通報受付',
  assigned_unit text not null default '',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- インデックス
create index if not exists idx_police_dispatch_incidents_status on public.police_dispatch_incidents(status);
create index if not exists idx_police_dispatch_incidents_created_at on public.police_dispatch_incidents(created_at desc);

-- RLS の有効化
alter table public.police_dispatch_incidents enable row level security;

-- 警察職員または管理者のみ全件参照・登録・更新・削除可能
create policy "police_dispatch_incidents_select"
  on public.police_dispatch_incidents for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and (profiles.is_admin = true or profiles.is_police_staff = true)
    )
  );

create policy "police_dispatch_incidents_insert"
  on public.police_dispatch_incidents for insert
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and (profiles.is_admin = true or profiles.is_police_staff = true)
    )
  );

create policy "police_dispatch_incidents_update"
  on public.police_dispatch_incidents for update
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and (profiles.is_admin = true or profiles.is_police_staff = true)
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and (profiles.is_admin = true or profiles.is_police_staff = true)
    )
  );

create policy "police_dispatch_incidents_delete"
  on public.police_dispatch_incidents for delete
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and (profiles.is_admin = true or profiles.is_police_staff = true)
    )
  );

-- Realtime publication
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'police_dispatch_incidents'
  ) then
    alter publication supabase_realtime add table public.police_dispatch_incidents;
  end if;
end $$;
