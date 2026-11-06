create table if not exists public.newsletter_consents (
  user_id uuid primary key references auth.users(id) on delete cascade,
  subscribed boolean not null,
  decision_at timestamptz not null default now(),
  source text not null check (source in ('email', 'google'))
);

create index if not exists newsletter_consents_subscribed_idx
  on public.newsletter_consents (decision_at)
  where subscribed;

alter table public.newsletter_consents enable row level security;
drop policy if exists "Users read their own newsletter preference" on public.newsletter_consents;
create policy "Users read their own newsletter preference"
  on public.newsletter_consents for select to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists "Users create their own newsletter preference" on public.newsletter_consents;
create policy "Users create their own newsletter preference"
  on public.newsletter_consents for insert to authenticated
  with check (user_id = (select auth.uid()));
drop policy if exists "Users update their own newsletter preference" on public.newsletter_consents;
create policy "Users update their own newsletter preference"
  on public.newsletter_consents for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
revoke all on public.newsletter_consents from public, anon;
grant select, insert, update on public.newsletter_consents to authenticated;
grant all on public.newsletter_consents to service_role;

create or replace function public.capture_signup_newsletter_consent()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if new.raw_user_meta_data ->> 'newsletter_consent' in ('true', 'false') then
    insert into public.newsletter_consents (user_id, subscribed, source)
    values (
      new.id,
      (new.raw_user_meta_data ->> 'newsletter_consent') = 'true',
      'email'
    )
    on conflict (user_id) do nothing;
  end if;

  return new;
end;
$function$;

revoke all on function public.capture_signup_newsletter_consent() from public, anon, authenticated;
drop trigger if exists capture_signup_newsletter_consent on auth.users;
create trigger capture_signup_newsletter_consent
  after insert on auth.users
  for each row execute function public.capture_signup_newsletter_consent();
