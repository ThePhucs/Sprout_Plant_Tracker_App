-- Sprout: storage and database size, for the Worker's weekly "running out of space" alert.
-- Only the Worker (service role) can call it.
create function public.admin_usage() returns json
language sql stable security definer set search_path = '' as $$
  select json_build_object(
    'db_bytes', pg_database_size(current_database()),
    'storage_bytes', coalesce((select sum((metadata ->> 'size')::bigint) from storage.objects), 0)
  )
$$;
revoke execute on function public.admin_usage() from public, anon, authenticated;
grant execute on function public.admin_usage() to service_role;
