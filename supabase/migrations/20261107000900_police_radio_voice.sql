-- Voice signaling uses private Supabase Realtime Broadcast topics.
-- Disable "Allow public access" in Supabase Realtime settings to enforce private topics.
drop policy if exists "Police staff receive voice radio broadcasts" on realtime.messages;
create policy "Police staff receive voice radio broadcasts"
  on realtime.messages for select to authenticated
  using (
    (select realtime.topic()) like 'police-radio-voice:%'
    and realtime.messages.extension = 'broadcast'
    and (select public.can_use_police_radio())
  );

drop policy if exists "Police staff send voice radio broadcasts" on realtime.messages;
create policy "Police staff send voice radio broadcasts"
  on realtime.messages for insert to authenticated
  with check (
    (select realtime.topic()) like 'police-radio-voice:%'
    and realtime.messages.extension = 'broadcast'
    and (select public.can_use_police_radio())
  );
