-- Sprout: accounts + push notifications (prototype step).
-- Run once in Supabase → SQL Editor. Safe to read top to bottom: every table is locked down
-- (RLS on, explicit grants) because the project has "automatically expose new tables" OFF.

-- ── Settings you can change in Table Editor ────────────────────────────────
create table public.app_settings (
  id boolean primary key default true check (id), -- exactly one row
  max_accounts int not null default 30 check (max_accounts >= 0)
);
insert into public.app_settings default values;
alter table public.app_settings enable row level security; -- no policies: only service role / dashboard

-- ── Profiles (one per account) ─────────────────────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9_]{3,20}$'),
  display_name text check (char_length(display_name) between 1 and 40),
  language text not null default 'vi' check (language in ('vi', 'en')),
  time_zone text not null default 'Asia/Ho_Chi_Minh' check (char_length(time_zone) <= 64),
  reminder_hour smallint not null default 8 check (reminder_hour between 0 and 23),
  verified boolean not null default false,      -- you tick this: 30 → 150 photos
  photo_limit int check (photo_limit >= 0),     -- optional per-person override
  is_admin boolean not null default false,      -- gets "new sign-up" notifications
  announced boolean not null default false,     -- admin was told about this sign-up
  last_test_push_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

create policy "read own profile" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "update own profile" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

grant select on public.profiles to authenticated;
-- Users may only change these columns (not verified / photo_limit / is_admin).
grant update (display_name, language, time_zone, reminder_hour) on public.profiles to authenticated;

-- ── Push subscriptions (one per device) ────────────────────────────────────
create table public.push_subscriptions (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique check (endpoint like 'https://%' and char_length(endpoint) <= 1000),
  p256dh text not null check (char_length(p256dh) <= 200),
  auth text not null check (char_length(auth) <= 100),
  created_at timestamptz not null default now(),
  last_success_at timestamptz,  -- you can see in the dashboard who is really receiving pushes
  last_error text
);
create index on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;

create policy "read own subscriptions" on public.push_subscriptions
  for select to authenticated using (user_id = (select auth.uid()));
create policy "delete own subscriptions" on public.push_subscriptions
  for delete to authenticated using (user_id = (select auth.uid()));
grant select, delete on public.push_subscriptions to authenticated;

-- Saving goes through this function: a device that switches account moves its
-- subscription to the new user, and each user keeps at most 10 devices.
create function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth)
  on conflict (endpoint) do update
    set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth, last_error = null;
  delete from public.push_subscriptions
  where user_id = auth.uid()
    and id not in (select id from public.push_subscriptions where user_id = auth.uid()
                   order by created_at desc limit 10);
end $$;
revoke execute on function public.save_push_subscription(text, text, text) from public, anon;
grant execute on function public.save_push_subscription(text, text, text) to authenticated;

-- ── Sign-up rules ──────────────────────────────────────────────────────────
-- Lets the sign-up screen say "full" before people type anything.
create function public.signup_open() returns boolean
language sql stable security definer set search_path = '' as $$
  select (select count(*) from auth.users) < (select max_accounts from public.app_settings)
$$;
revoke execute on function public.signup_open() from public;
grant execute on function public.signup_open() to anon, authenticated;

-- Enforced in the database, so the app can't be bypassed.
create function public.before_signup() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from auth.users) >= (select max_accounts from public.app_settings) then
    raise exception 'sprout: account limit reached';
  end if;
  if new.email !~ '^[a-z0-9_]{3,20}@sprout\.local$' then
    raise exception 'sprout: invalid username';
  end if;
  return new;
end $$;
create trigger sprout_before_signup before insert on auth.users
  for each row execute function public.before_signup();

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, username, display_name, language, time_zone)
  values (
    new.id,
    split_part(new.email, '@', 1),
    nullif(left(trim(new.raw_user_meta_data ->> 'display_name'), 40), ''),
    case when new.raw_user_meta_data ->> 'language' = 'en' then 'en' else 'vi' end,
    coalesce(left(new.raw_user_meta_data ->> 'time_zone', 64), 'Asia/Ho_Chi_Minh')
  );
  return new;
end $$;
create trigger sprout_after_signup after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── The Worker (service role) needs explicit access too ────────────────────
grant all on public.app_settings, public.profiles, public.push_subscriptions to service_role;
