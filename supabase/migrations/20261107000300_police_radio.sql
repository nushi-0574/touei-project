create table if not exists public.police_radio_messages (
  id uuid primary key default gen_random_uuid(),
  channel text not null check (channel in ('県内', 'Ch1', 'CH2', '非常用', '教育')),
  author_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  sender_name text not null default '警察職員',
  body text not null check (char_length(btrim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);

create index if not exists police_radio_messages_channel_created_idx
  on public.police_radio_messages (channel, created_at desc);

create or replace function public.can_use_police_radio()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles as profile
    where profile.id = (select auth.uid())
      and (profile.is_admin is true or profile.is_police_staff is true)
  );
$$;

create or replace function public.set_police_radio_sender()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.author_id := auth.uid();
  select coalesce(nullif(btrim(profile.full_name), ''), nullif(btrim(profile.email), ''), '警察職員')
  into new.sender_name
  from public.profiles as profile
  where profile.id = new.author_id;
  new.sender_name := coalesce(new.sender_name, '警察職員');
  return new;
end;
$$;

revoke all on function public.can_use_police_radio() from public, anon;
revoke all on function public.set_police_radio_sender() from public, anon, authenticated;
grant execute on function public.can_use_police_radio() to authenticated;

drop trigger if exists set_police_radio_sender_before_insert on public.police_radio_messages;
create trigger set_police_radio_sender_before_insert
before insert on public.police_radio_messages
for each row execute function public.set_police_radio_sender();

alter table public.police_radio_messages enable row level security;
drop policy if exists "Police staff and administrators read radio messages" on public.police_radio_messages;
create policy "Police staff and administrators read radio messages"
  on public.police_radio_messages for select to authenticated
  using (public.can_use_police_radio());
drop policy if exists "Police staff and administrators send radio messages" on public.police_radio_messages;
create policy "Police staff and administrators send radio messages"
  on public.police_radio_messages for insert to authenticated
  with check (public.can_use_police_radio() and author_id = (select auth.uid()));

revoke all on public.police_radio_messages from public, anon;
grant select, insert on public.police_radio_messages to authenticated;
grant all on public.police_radio_messages to service_role;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'police_radio_messages'
    ) then
    alter publication supabase_realtime add table public.police_radio_messages;
  end if;
end;
$$;
