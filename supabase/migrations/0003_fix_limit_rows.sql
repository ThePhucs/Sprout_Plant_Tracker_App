-- Fix: adding a plant failed. The limit check read new.plant_id while inserting a plant
-- (plants have no plant_id), which errors in PL/pgSQL. Check each table in its own branch.
create or replace function public.limit_rows() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_table_name = 'plants' then
    if (select count(*) from public.plants where user_id = new.user_id) >= 300 then
      raise exception 'sprout: plant limit reached';
    end if;
  else
    if (select count(*) from public.care_logs where plant_id = new.plant_id) >= 3000 then
      raise exception 'sprout: care log limit reached';
    end if;
  end if;
  return new;
end $$;
