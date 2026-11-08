-- Sprout: photos. Run once in SQL Editor after 0003.
-- Files live in a private bucket as <user id>/<photo id>.jpg (1280px) + <photo id>_t.jpg (300px thumbnail).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 2097152, array['image/jpeg']); -- 2 MB, JPEG only

-- ── Limits: 30 photos, 150 once verified, or the per-person override ─────────
-- These only ever look at the signed-in user, so nobody can query someone else's numbers.
create function public.my_photo_limit() returns int
language sql stable security definer set search_path = '' as $$
  select coalesce(photo_limit, case when verified then 150 else 30 end) from public.profiles where id = auth.uid()
$$;

create function public.my_photo_files() returns int
language sql stable security definer set search_path = '' as $$
  select count(*)::int from storage.objects
  where bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text
$$;

-- What the app shows in Settings: { used, limit, verified }.
create function public.my_photo_usage() returns json
language sql stable security definer set search_path = '' as $$
  select json_build_object(
    'used', public.my_photo_files() / 2, -- each photo is a full image + a thumbnail
    'limit', public.my_photo_limit(),
    'verified', (select verified from public.profiles where id = auth.uid()))
$$;

revoke execute on function public.my_photo_limit(), public.my_photo_files(), public.my_photo_usage() from public, anon;
grant execute on function public.my_photo_limit(), public.my_photo_files(), public.my_photo_usage() to authenticated;

-- ── Storage rules: only your own folder, and uploads stop at the limit ────────
create policy "photos: read own" on storage.objects for select to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid()::text));

create policy "photos: delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid()::text));

-- Enforced here, not just in the app, so nobody can fill the free 1 GB by calling the API directly.
create policy "photos: upload own within limit" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
    and public.my_photo_files() < 2 * public.my_photo_limit()
  );

-- ── Plant cover photo (optional pin; otherwise the app shows the latest photo) ─
alter table public.plants add column cover_photo_path text check (char_length(cover_photo_path) <= 300);

-- Photo paths must point into your own folder.
drop policy "own plants" on public.plants;
create policy "own plants" on public.plants for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and (cover_photo_path is null or cover_photo_path like (select auth.uid()::text) || '/%')
  );

drop policy "own care logs" on public.care_logs;
create policy "own care logs" on public.care_logs for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.plants p where p.id = plant_id and p.user_id = (select auth.uid()))
    and (photo_path is null or photo_path like (select auth.uid()::text) || '/%')
  );

-- Deleting a log un-pins its photo as the cover.
create function public.clear_cover() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.photo_path is not null then
    update public.plants set cover_photo_path = null where id = old.plant_id and cover_photo_path = old.photo_path;
  end if;
  return null;
end $$;
create trigger sprout_clear_cover after delete on public.care_logs
  for each row execute function public.clear_cover();
