-- Sprout: plants + care logs (same model as the Android app). Run once in SQL Editor after 0001.

create table public.plants (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 50),
  species text check (char_length(species) <= 80),
  location text not null default '' check (char_length(location) <= 50),
  light_level text not null default 'MEDIUM' check (light_level in ('LOW', 'MEDIUM', 'BRIGHT')),
  watering_interval_days int not null check (watering_interval_days between 1 and 365),
  -- Stored (not derived from logs) so "which plants are due" stays a single-table read.
  last_watered_at date not null,
  notes text check (char_length(notes) <= 500),
  icon text not null default 'SEEDLING'
    check (icon in ('SEEDLING', 'MONSTERA', 'FERN', 'SNAKE_PLANT', 'SUCCULENT', 'CACTUS', 'TULIP', 'DAISY')),
  color text not null default 'GREEN'
    check (color in ('GREEN', 'MINT', 'TEAL', 'BLUE', 'PURPLE', 'PINK', 'ORANGE', 'YELLOW')),
  created_at timestamptz not null default now()
);
create index on public.plants (user_id);

create table public.care_logs (
  id bigint generated always as identity primary key,
  plant_id bigint not null references public.plants (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  type text not null check (type in ('WATER', 'FERTILISE', 'REPOT', 'PRUNE', 'PHOTO')),
  -- One day of slack: "today" in the US is still "yesterday" for the server.
  date date not null check (date <= current_date + 1),
  note text check (char_length(note) <= 500),
  photo_path text check (char_length(photo_path) <= 300),
  created_at timestamptz not null default now(),
  constraint watering_has_no_photo check (type <> 'WATER' or photo_path is null)
);
create index on public.care_logs (plant_id, date desc);

-- ── Security: each person only ever sees and changes their own rows ────────
alter table public.plants enable row level security;
alter table public.care_logs enable row level security;

create policy "own plants" on public.plants for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "own care logs" on public.care_logs for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.plants p where p.id = plant_id and p.user_id = (select auth.uid()))
  );

grant select, insert, update, delete on public.plants, public.care_logs to authenticated;
grant all on public.plants, public.care_logs to service_role;

-- ── Keep last_watered_at in sync with the watering log (as in the Android app) ──
create function public.sync_last_watered() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' and new.type = 'WATER' then
    -- Only moves forward, so back-dating an old watering never makes a plant look more overdue.
    update public.plants set last_watered_at = greatest(last_watered_at, new.date) where id = new.plant_id;
  elsif tg_op = 'DELETE' and old.type = 'WATER' then
    -- Fall back to the latest remaining watering; keep the current value if there is none.
    update public.plants set last_watered_at = coalesce(
      (select max(date) from public.care_logs where plant_id = old.plant_id and type = 'WATER'),
      last_watered_at)
    where id = old.plant_id;
  end if;
  return null;
end $$;
create trigger sprout_sync_last_watered after insert or delete on public.care_logs
  for each row execute function public.sync_last_watered();

-- A new plant's last watering becomes its first log, so undoing a later watering has something to fall back to.
create function public.first_watering_log() returns trigger
language plpgsql set search_path = '' as $$
begin
  insert into public.care_logs (plant_id, user_id, type, date) values (new.id, new.user_id, 'WATER', new.last_watered_at);
  return null;
end $$;
create trigger sprout_first_watering after insert on public.plants
  for each row execute function public.first_watering_log();

-- ── Abuse limits (far above normal use) ────────────────────────────────────
create function public.limit_rows() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_table_name = 'plants'
     and (select count(*) from public.plants where user_id = new.user_id) >= 300 then
    raise exception 'sprout: plant limit reached';
  end if;
  if tg_table_name = 'care_logs'
     and (select count(*) from public.care_logs where plant_id = new.plant_id) >= 3000 then
    raise exception 'sprout: care log limit reached';
  end if;
  return new;
end $$;
create trigger sprout_limit_plants before insert on public.plants for each row execute function public.limit_rows();
create trigger sprout_limit_logs before insert on public.care_logs for each row execute function public.limit_rows();
