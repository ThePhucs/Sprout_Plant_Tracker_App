-- The old cap (3000 care logs per plant, ever) would block watering after ~8 years of daily use.
-- Replace it with a per-day cap: still stops a script flooding the database, never hit by real use.
create or replace function public.limit_rows() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_table_name = 'plants' then
    if (select count(*) from public.plants where user_id = new.user_id) >= 300 then
      raise exception 'sprout: plant limit reached';
    end if;
  else
    if (select count(*) from public.care_logs
        where plant_id = new.plant_id and created_at > now() - interval '1 day') >= 50 then
      raise exception 'sprout: too many care logs today';
    end if;
  end if;
  return new;
end $$;
