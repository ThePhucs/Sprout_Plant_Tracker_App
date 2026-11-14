-- Sprout: verify members from inside the app (admins only). Run once in SQL Editor after 0007.
-- The checks live here, so nobody can verify themselves by calling the API directly.

create function public.i_am_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false)
$$;

-- Everyone's account, newest first, but only for admins (others get nothing).
create function public.admin_members()
returns table (id uuid, username text, display_name text, verified boolean, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select p.id, p.username, p.display_name, p.verified, p.created_at
  from public.profiles p
  where public.i_am_admin()
  order by p.verified, p.created_at desc
$$;

create function public.admin_set_verified(member uuid, value boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.i_am_admin() then raise exception 'sprout: admins only'; end if;
  update public.profiles set verified = value where id = member;
end $$;

revoke execute on function public.i_am_admin(), public.admin_members(), public.admin_set_verified(uuid, boolean) from public, anon;
grant execute on function public.i_am_admin(), public.admin_members(), public.admin_set_verified(uuid, boolean) to authenticated;
