import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) throw new Error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY in .env.local');

// The publishable key is public by design; row-level security protects the data.
export const supabase = createClient(url, key);

export type Profile = {
  id: string;
  username: string;
  display_name: string | null;
  language: 'vi' | 'en';
  time_zone: string;
  reminder_hour: number;
  verified: boolean;
  photo_limit: number | null;
};
