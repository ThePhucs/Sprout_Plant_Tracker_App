import { useEffect, useState } from 'react';
import { supabase } from './supabase';

// Names of verified members (who shared, who commented). Fetched once per app session.
let cache: Promise<Record<string, string>> | null = null;

function load() {
  cache ??= Promise.resolve(supabase.rpc('member_names')).then(({ data }) =>
    Object.fromEntries((data ?? []).map((m: { id: string; username: string; display_name: string | null }) =>
      [m.id, m.display_name || m.username])));
  return cache;
}

export function useMemberNames() {
  const [names, setNames] = useState<Record<string, string>>({});
  useEffect(() => { load().then(setNames, () => { cache = null; }); }, []);
  return names;
}
