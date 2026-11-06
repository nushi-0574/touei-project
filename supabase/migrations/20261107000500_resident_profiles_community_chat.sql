alter table public.profiles
  add column if not exists display_name text not null default '住民'
    check (char_length(btrim(display_name)) between 1 and 40),
  add column if not exists bio text not null default ''
    check (char_length(bio) <= 500),
  add column if not exists avatar_path text;

update public.profiles
set display_name = coalesce(nullif(btrim(full_name), ''), '住民')
where display_name = '住民';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('resident-avatars', 'resident-avatars', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Active residents read resident avatars" on storage.objects;
create policy "Active residents read resident avatars"
  on storage.objects for select to authenticated
  using (bucket_id = 'resident-avatars' and public.is_active_resident());
drop policy if exists "Residents upload their own avatar" on storage.objects;
create policy "Residents upload their own avatar"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'resident-avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and public.is_active_resident()
  );
drop policy if exists "Residents update their own avatar" on storage.objects;
create policy "Residents update their own avatar"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'resident-avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and public.is_active_resident()
  )
  with check (
    bucket_id = 'resident-avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and public.is_active_resident()
  );
drop policy if exists "Residents delete their own avatar" on storage.objects;
create policy "Residents delete their own avatar"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'resident-avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and public.is_active_resident()
  );

create or replace function public.get_resident_public_profiles(target_user_ids uuid[])
returns table (user_id uuid, display_name text, avatar_path text, bio text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.is_active_resident() then
    raise exception 'Active resident access is required';
  end if;
  if coalesce(cardinality(target_user_ids), 0) > 100 then
    raise exception 'At most 100 profiles can be requested';
  end if;

  return query
  select profile.id,
    coalesce(nullif(btrim(profile.display_name), ''), nullif(btrim(profile.full_name), ''), '住民'),
    profile.avatar_path,
    coalesce(profile.bio, '')
  from public.profiles as profile
  where profile.id = any(coalesce(target_user_ids, array[]::uuid[]))
    and profile.resident_status = 'active';
end;
$$;

create or replace function public.search_resident_directory(search_text text default '', result_limit integer default 50)
returns table (user_id uuid, display_name text, avatar_path text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.is_active_resident() then
    raise exception 'Active resident access is required';
  end if;

  return query
  select profile.id,
    coalesce(nullif(btrim(profile.display_name), ''), nullif(btrim(profile.full_name), ''), '住民'),
    profile.avatar_path
  from public.profiles as profile
  where profile.resident_status = 'active'
    and profile.id <> auth.uid()
    and (coalesce(btrim(search_text), '') = ''
      or profile.display_name ilike '%' || left(btrim(search_text), 40) || '%')
  order by profile.display_name
  limit greatest(1, least(coalesce(result_limit, 50), 50));
end;
$$;

create table if not exists public.resident_conversations (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('direct', 'group')),
  title text check (title is null or char_length(btrim(title)) between 1 and 60),
  direct_key text unique,
  created_by uuid not null references auth.users(id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  check ((kind = 'direct' and title is null and direct_key is not null)
    or (kind = 'group' and title is not null and direct_key is null))
);

create table if not exists public.resident_conversation_members (
  conversation_id uuid not null references public.resident_conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create table if not exists public.resident_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.resident_conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  body text not null check (char_length(btrim(body)) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index if not exists resident_conversation_members_user_idx
  on public.resident_conversation_members (user_id, conversation_id);
create index if not exists resident_messages_conversation_created_idx
  on public.resident_messages (conversation_id, created_at desc);

create or replace function public.is_resident_conversation_member(target_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_active_resident() and exists (
    select 1
    from public.resident_conversation_members as member
    where member.conversation_id = target_conversation_id
      and member.user_id = (select auth.uid())
  );
$$;

create or replace function public.create_resident_conversation(
  conversation_kind text,
  conversation_title text,
  target_user_ids uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  other_user_ids uuid[];
  conversation_id uuid;
  direct_pair text;
  active_count integer;
begin
  if caller_id is null or not public.is_active_resident() then
    raise exception 'Active resident access is required';
  end if;
  if conversation_kind not in ('direct', 'group') then
    raise exception 'Invalid conversation type';
  end if;

  select coalesce(array_agg(distinct member_id order by member_id), array[]::uuid[])
  into other_user_ids
  from unnest(coalesce(target_user_ids, array[]::uuid[])) as requested(member_id)
  where requested.member_id is not null and requested.member_id <> caller_id;

  if conversation_kind = 'direct' and cardinality(other_user_ids) <> 1 then
    raise exception 'A direct conversation requires one other resident';
  end if;
  if conversation_kind = 'group'
    and (cardinality(other_user_ids) < 2 or cardinality(other_user_ids) > 49) then
    raise exception 'A group requires 2 to 49 other residents';
  end if;
  if conversation_kind = 'group'
    and (conversation_title is null or char_length(btrim(conversation_title)) not between 1 and 60) then
    raise exception 'Group names must be between 1 and 60 characters';
  end if;

  select count(*) into active_count
  from public.profiles as profile
  where profile.id = any(other_user_ids)
    and profile.resident_status = 'active';
  if active_count <> cardinality(other_user_ids) then
    raise exception 'One or more selected users are not active residents';
  end if;

  if conversation_kind = 'direct' then
    direct_pair := least(caller_id::text, other_user_ids[1]::text)
      || ':' || greatest(caller_id::text, other_user_ids[1]::text);
    insert into public.resident_conversations (kind, direct_key)
    values ('direct', direct_pair)
    on conflict (direct_key) do nothing
    returning id into conversation_id;

    if conversation_id is null then
      select conversation.id into conversation_id
      from public.resident_conversations as conversation
      where conversation.direct_key = direct_pair;
    end if;
  else
    insert into public.resident_conversations (kind, title)
    values ('group', btrim(conversation_title))
    returning id into conversation_id;
  end if;

  insert into public.resident_conversation_members (conversation_id, user_id)
  select conversation_id, requested.member_id
  from unnest(array_append(other_user_ids, caller_id)) as requested(member_id)
  on conflict do nothing;

  return conversation_id;
end;
$$;

create or replace function public.touch_resident_conversation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.resident_conversations
  set last_message_at = new.created_at
  where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists touch_resident_conversation_after_message on public.resident_messages;
create trigger touch_resident_conversation_after_message
after insert on public.resident_messages
for each row execute function public.touch_resident_conversation();

revoke all on function public.get_resident_public_profiles(uuid[]) from public, anon;
revoke all on function public.search_resident_directory(text, integer) from public, anon;
revoke all on function public.is_resident_conversation_member(uuid) from public, anon;
revoke all on function public.create_resident_conversation(text, text, uuid[]) from public, anon;
revoke all on function public.touch_resident_conversation() from public, anon, authenticated;
grant execute on function public.get_resident_public_profiles(uuid[]) to authenticated;
grant execute on function public.search_resident_directory(text, integer) to authenticated;
grant execute on function public.is_resident_conversation_member(uuid) to authenticated;
grant execute on function public.create_resident_conversation(text, text, uuid[]) to authenticated;

alter table public.resident_conversations enable row level security;
alter table public.resident_conversation_members enable row level security;
alter table public.resident_messages enable row level security;

drop policy if exists "Conversation members read their conversations" on public.resident_conversations;
create policy "Conversation members read their conversations"
  on public.resident_conversations for select to authenticated
  using (public.is_resident_conversation_member(id));
drop policy if exists "Members read participants in their conversations" on public.resident_conversation_members;
create policy "Members read participants in their conversations"
  on public.resident_conversation_members for select to authenticated
  using (public.is_resident_conversation_member(conversation_id));
drop policy if exists "Conversation members read messages" on public.resident_messages;
create policy "Conversation members read messages"
  on public.resident_messages for select to authenticated
  using (public.is_resident_conversation_member(conversation_id));
drop policy if exists "Active conversation members send messages" on public.resident_messages;
create policy "Active conversation members send messages"
  on public.resident_messages for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and public.is_resident_conversation_member(conversation_id)
  );

revoke all on public.resident_conversations, public.resident_conversation_members, public.resident_messages from public, anon;
grant select on public.resident_conversations, public.resident_conversation_members, public.resident_messages to authenticated;
grant insert on public.resident_messages to authenticated;
grant all on public.resident_conversations, public.resident_conversation_members, public.resident_messages to service_role;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'resident_messages'
    ) then
      alter publication supabase_realtime add table public.resident_messages;
    end if;
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'resident_conversation_members'
    ) then
      alter publication supabase_realtime add table public.resident_conversation_members;
    end if;
  end if;
end;
$$;
