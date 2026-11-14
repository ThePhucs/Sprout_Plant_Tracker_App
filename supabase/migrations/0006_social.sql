-- Sprout: shared garden (likes + comments). Run once in SQL Editor after 0005.
-- Rule of thumb: only VERIFIED people can share, see shared plants, like or comment.
-- Everything not explicitly shared stays private, exactly as before.

-- ── Who is verified ─────────────────────────────────────────────────────────
create function public.is_verified(uid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select verified from public.profiles where id = uid), false)
$$;
create function public.i_am_verified() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_verified(auth.uid())
$$;
revoke execute on function public.is_verified(uuid), public.i_am_verified() from public, anon;
grant execute on function public.is_verified(uuid), public.i_am_verified() to authenticated;

-- Names of verified members, for showing who shared or commented. Only verified people can read it.
create function public.member_names() returns table (id uuid, username text, display_name text)
language sql stable security definer set search_path = '' as $$
  select p.id, p.username, p.display_name from public.profiles p
  where p.verified and public.i_am_verified()
$$;
revoke execute on function public.member_names() from public, anon;
grant execute on function public.member_names() to authenticated;

-- ── The per-plant share switch ──────────────────────────────────────────────
alter table public.plants add column shared boolean not null default false;

create function public.check_share() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.shared and not public.is_verified(new.user_id) then
    raise exception 'sprout: only verified accounts can share plants';
  end if;
  return new;
end $$;
create trigger sprout_check_share before insert or update of shared on public.plants
  for each row execute function public.check_share();

-- Extra read-only access (policies add up): verified people see plants shared by verified people…
create policy "see shared plants" on public.plants for select to authenticated
  using (shared and public.i_am_verified() and public.is_verified(user_id));
-- …and those plants' history (plants' own rules above decide which plants are visible).
create policy "see shared care logs" on public.care_logs for select to authenticated
  using (exists (select 1 from public.plants p where p.id = plant_id and p.shared));

-- …and their photo files (full size and thumbnail).
create index on public.care_logs (photo_path) where photo_path is not null;
create policy "photos: read shared" on storage.objects for select to authenticated
  using (
    bucket_id = 'photos'
    and exists (
      select 1 from public.care_logs l join public.plants p on p.id = l.plant_id
      where p.shared and l.photo_path = regexp_replace(name, '_t\.jpg$', '.jpg')
    )
  );

-- ── Likes (one heart per person per photo) ──────────────────────────────────
create table public.likes (
  log_id bigint not null references public.care_logs (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (log_id, user_id)
);
alter table public.likes enable row level security;

create policy "see likes on visible photos" on public.likes for select to authenticated
  using (exists (select 1 from public.care_logs l where l.id = log_id));
create policy "like visible photos" on public.likes for insert to authenticated
  with check (
    user_id = (select auth.uid()) and public.i_am_verified()
    and exists (select 1 from public.care_logs l where l.id = log_id and l.photo_path is not null)
  );
create policy "unlike" on public.likes for delete to authenticated using (user_id = (select auth.uid()));
grant select, insert, delete on public.likes to authenticated;
grant all on public.likes to service_role;

-- ── Comments ────────────────────────────────────────────────────────────────
create table public.comments (
  id bigint generated always as identity primary key,
  log_id bigint not null references public.care_logs (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 300),
  created_at timestamptz not null default now(),
  notified boolean not null default false -- photo owner was told (hourly grouped push)
);
create index on public.comments (log_id, id);
create index on public.comments (user_id, created_at);
create index on public.comments (notified) where not notified;
alter table public.comments enable row level security;

create policy "see comments on visible photos" on public.comments for select to authenticated
  using (exists (select 1 from public.care_logs l where l.id = log_id));
create policy "comment on visible photos" on public.comments for insert to authenticated
  with check (
    user_id = (select auth.uid()) and public.i_am_verified()
    and exists (select 1 from public.care_logs l where l.id = log_id and l.photo_path is not null)
  );
-- The author, or the owner of the photo, can delete a comment.
create policy "delete own or on own photo" on public.comments for delete to authenticated
  using (
    user_id = (select auth.uid())
    or exists (select 1 from public.care_logs l where l.id = log_id and l.user_id = (select auth.uid()))
  );
grant select, delete on public.comments to authenticated;
grant insert (log_id, body) on public.comments to authenticated; -- can't pre-set "notified"
grant all on public.comments to service_role;

-- Spam guard: at most 20 comments per person per hour.
create function public.limit_comments() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (select count(*) from public.comments
      where user_id = new.user_id and created_at > now() - interval '1 hour') >= 20 then
    raise exception 'sprout: too many comments';
  end if;
  return new;
end $$;
create trigger sprout_limit_comments before insert on public.comments
  for each row execute function public.limit_comments();
