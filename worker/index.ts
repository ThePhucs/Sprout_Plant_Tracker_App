import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { buildPushPayload } from '@block65/webcrypto-web-push';
import { translate, type Lang } from '../shared/i18n';
import { localHour } from '../shared/time';
import { todayIn } from '../shared/dates';
import { plantsDue, reminderContent } from '../shared/plants';

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SECRET_KEY: string; // secret: bypasses row-level security, never leaves the Worker
  VAPID_PUBLIC_KEY: string;
  VAPID_PRIVATE_KEY: string; // secret
  VAPID_SUBJECT: string;
  BACKUPS: KVNamespace;
}

type Sub = { id: number; endpoint: string; p256dh: string; auth: string; user_id: string };
type Msg = { title: string; body: string; url?: string; tag?: string };

const TEST_PUSH_COOLDOWN_MS = 20_000;

const admin = (env: Env) =>
  createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

/** Sends one push. Dead subscriptions (phone reset, app removed) are deleted so they don't pile up. */
async function sendPush(env: Env, db: SupabaseClient, sub: Sub, msg: Msg): Promise<boolean> {
  try {
    const payload = await buildPushPayload(
      { data: JSON.stringify(msg), options: { ttl: 12 * 60 * 60, urgency: 'normal' } },
      { endpoint: sub.endpoint, expirationTime: null, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      { subject: env.VAPID_SUBJECT, publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY },
    );
    const res = await fetch(sub.endpoint, payload);
    if (res.status === 404 || res.status === 410) {
      await db.from('push_subscriptions').delete().eq('id', sub.id);
      return false;
    }
    if (!res.ok) {
      await db.from('push_subscriptions').update({ last_error: `${res.status} ${(await res.text()).slice(0, 200)}` }).eq('id', sub.id);
      return false;
    }
    await db.from('push_subscriptions').update({ last_success_at: new Date().toISOString(), last_error: null }).eq('id', sub.id);
    return true;
  } catch (e) {
    await db.from('push_subscriptions').update({ last_error: String(e).slice(0, 200) }).eq('id', sub.id);
    return false;
  }
}

async function sendToUser(env: Env, db: SupabaseClient, userId: string, msg: Msg) {
  const { data: subs } = await db.from('push_subscriptions').select('*').eq('user_id', userId);
  const results = await Promise.all((subs ?? []).map((s: Sub) => sendPush(env, db, s, msg)));
  return results.filter(Boolean).length;
}

/** POST /api/test-push — the signed-in user sends a test notification to their own devices. */
async function testPush(req: Request, env: Env): Promise<Response> {
  const token = req.headers.get('Authorization')?.replace(/^Bearer /, '');
  if (!token) return Response.json({ error: 'unauthorized' }, { status: 401 });
  const db = admin(env);
  const { data: auth } = await db.auth.getUser(token);
  if (!auth.user) return Response.json({ error: 'unauthorized' }, { status: 401 });

  const { data: profile } = await db.from('profiles').select('language, last_test_push_at').eq('id', auth.user.id).single();
  if (!profile) return Response.json({ error: 'no profile' }, { status: 404 });
  if (profile.last_test_push_at && Date.now() - Date.parse(profile.last_test_push_at) < TEST_PUSH_COOLDOWN_MS) {
    return Response.json({ error: 'wait' }, { status: 429 });
  }
  await db.from('profiles').update({ last_test_push_at: new Date().toISOString() }).eq('id', auth.user.id);

  const lang = profile.language as Lang;
  const sent = await sendToUser(env, db, auth.user.id, {
    title: translate(lang, 'pushTestTitle'), body: translate(lang, 'pushTestBody'), tag: 'test',
  });
  return Response.json({ sent });
}

/** Runs every hour. Touching the database here also stops Supabase pausing the free project. */
async function hourly(env: Env) {
  const db = admin(env);
  const now = new Date();
  const { data: profiles, error } = await db.from('profiles').select('id, username, display_name, language, time_zone, reminder_hour, is_admin, announced');
  if (error) throw new Error(`hourly: could not read profiles: ${error.message}`);

  // Daily reminder at each person's chosen hour, in their own time zone, only if something needs water.
  const atHour = profiles.filter((p) => localHour(now, p.time_zone) === p.reminder_hour);
  if (atHour.length) {
    const plants = await selectAll<{ user_id: string; name: string; last_watered_at: string; watering_interval_days: number }>(
      (from, to) => db.from('plants').select('user_id, name, last_watered_at, watering_interval_days')
        .in('user_id', atHour.map((p) => p.id)).order('id').range(from, to));
    await Promise.all(atHour.map((p) => {
      const mine = plants.filter((pl) => pl.user_id === p.id);
      const content = reminderContent(plantsDue(mine, todayIn(p.time_zone, now)), p.language);
      return content && sendToUser(env, db, p.id, { ...content, url: '/today', tag: 'daily' });
    }));
  }

  // Tell admins about new sign-ups so they know who to verify.
  const fresh = profiles.filter((p) => !p.announced);
  if (fresh.length) {
    const names = fresh.map((p) => (p.display_name ? `${p.display_name} (${p.username})` : p.username)).join(', ');
    const admins = profiles.filter((p) => p.is_admin);
    await Promise.all(admins.map((a) => sendToUser(env, db, a.id, {
      title: translate(a.language, 'pushNewUserTitle'), body: translate(a.language, 'pushNewUserBody', { names }), url: '/settings', tag: 'signup',
    })));
    // Only mark as told once an admin exists, so nobody is missed before you set is_admin.
    if (admins.length) await db.from('profiles').update({ announced: true }).in('id', fresh.map((p) => p.id));
  }

  await notifyComments(env, db, profiles);
}

const GB = 1024 ** 3;
const FREE = { storage: 1 * GB, db: 0.5 * GB }; // Supabase free plan
const KEEP_BACKUPS = 8;

/** Sundays 19:00 UTC. Each job runs even if another fails; failures are pushed to admins. */
async function weekly(env: Env) {
  const db = admin(env);
  const { data: profiles } = await db.from('profiles').select('id, language, is_admin');
  const tellAdmins = (key: 'pushBackupFailed' | 'pushUsageHigh', vars: Record<string, string> = {}) =>
    Promise.all((profiles ?? []).filter((p) => p.is_admin).map((a) => sendToUser(env, db, a.id, {
      title: translate(a.language, key, vars), body: '', url: '/settings', tag: key,
    })));

  try { await sweepPhotos(db); } catch (e) { console.error('photo sweep failed', e); }

  try {
    await backup(env, db);
  } catch (e) {
    console.error('backup failed', e);
    await tellAdmins('pushBackupFailed');
  }

  const { data: usage } = await db.rpc('admin_usage');
  if (usage) {
    const storage = usage.storage_bytes / FREE.storage, dbUse = usage.db_bytes / FREE.db;
    if (storage >= 0.8 || dbUse >= 0.8) {
      await tellAdmins('pushUsageHigh', { storage: String(Math.round(storage * 100)), db: String(Math.round(dbUse * 100)) });
    }
  }
}

/** Copies every table's rows to KV as one JSON file per week (photos stay in Supabase; too big for free KV). */
async function backup(env: Env, db: SupabaseClient) {
  const tables = ['profiles', 'plants', 'care_logs', 'comments', 'likes', 'app_settings'] as const;
  const data: Record<string, unknown[]> = {};
  for (const t of tables) {
    // A stable order so paging can't skip or repeat rows (likes have no id column).
    const key = t === 'likes' ? 'log_id' : 'id';
    data[t] = await selectAll((from, to) => db.from(t).select('*').order(key).range(from, to));
  }
  const name = `backup-${new Date().toISOString().slice(0, 10)}`;
  await env.BACKUPS.put(name, JSON.stringify({ created: new Date().toISOString(), data }));
  const { keys } = await env.BACKUPS.list({ prefix: 'backup-' });
  const old = keys.map((k) => k.name).sort().slice(0, -KEEP_BACKUPS);
  await Promise.all(old.map((k) => env.BACKUPS.delete(k)));
}

type ProfileRow = { id: string; username: string; display_name: string | null; language: Lang };

/** One grouped push per photo owner for comments since the last run (at most hourly). Likes never push. */
async function notifyComments(env: Env, db: SupabaseClient, profiles: ProfileRow[]) {
  const { data: fresh, error } = await db.from('comments')
    .select('id, log_id, user_id, care_logs(user_id, plants(name))').eq('notified', false).order('id').limit(500);
  if (error) throw new Error(`comments: ${error.message}`);
  if (!fresh?.length) return;

  type Row = { id: number; log_id: number; user_id: string; care_logs: { user_id: string; plants: { name: string } } | null };
  const byOwner = new Map<string, Row[]>();
  for (const c of fresh as unknown as Row[]) {
    const owner = c.care_logs?.user_id;
    if (owner && owner !== c.user_id) byOwner.set(owner, [...(byOwner.get(owner) ?? []), c]); // own comments don't notify
  }
  const nameOf = (id: string) => {
    const p = profiles.find((x) => x.id === id);
    return p?.display_name || p?.username || '?';
  };
  await Promise.all([...byOwner].map(([owner, list]) => {
    const lang = profiles.find((p) => p.id === owner)?.language ?? 'vi';
    const people = [...new Set(list.map((c) => c.user_id))];
    const photos = [...new Set(list.map((c) => c.log_id))];
    const name = nameOf(people[0]);
    const title = people.length > 1
      ? translate(lang, 'pushCommentMany', { name, n: String(people.length - 1) })
      : photos.length > 1
        ? translate(lang, 'pushCommentPhotos', { name, n: String(photos.length) })
        : translate(lang, 'pushCommentOne', { name, plant: list[0].care_logs!.plants.name });
    // One photo: open it directly. Several: open the shared garden.
    const url = photos.length === 1 ? `/photos/${photos[0]}` : '/garden';
    return sendToUser(env, db, owner, { title, body: '', url, tag: 'comments' });
  }));
  await db.from('comments').update({ notified: true }).in('id', fresh.map((c) => c.id));
}

/** Supabase returns at most 1000 rows per request, so page through everything. Throws on any error. */
async function selectAll<T>(page: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>) {
  const rows: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await page(from, from + 999);
    if (error) throw new Error(`select failed: ${error.message}`);
    rows.push(...(data as T[]));
    if (!data || data.length < 1000) return rows;
  }
}

/**
 * Leftovers come from uploads whose log was never saved, deleted logs/plants whose file removal failed,
 * and deleted accounts. Files younger than a day are skipped (could be mid-upload).
 */
async function sweepPhotos(db: SupabaseClient) {
  const bucket = db.storage.from('photos');
  // If this read fails it throws, so we never treat "couldn't read" as "nothing to keep".
  const keep = new Set((await selectAll<{ photo_path: string }>((from, to) =>
    db.from('care_logs').select('photo_path').not('photo_path', 'is', null).order('id').range(from, to))).map((r) => r.photo_path));

  const { data: folders, error } = await bucket.list('', { limit: 1000 });
  if (error) throw new Error(`sweep: could not list folders: ${error.message}`);
  const dayAgo = Date.now() - 86_400_000;
  const orphans: string[] = [];
  for (const folder of folders) {
    for (let offset = 0; ; offset += 1000) {
      const { data: files, error: listError } = await bucket.list(folder.name, { limit: 1000, offset });
      if (listError) throw new Error(`sweep: could not list ${folder.name}: ${listError.message}`);
      for (const f of files) {
        const path = `${folder.name}/${f.name}`;
        if (!keep.has(path.replace(/_t\.jpg$/, '.jpg')) && f.created_at && Date.parse(f.created_at) < dayAgo) orphans.push(path);
      }
      if (files.length < 1000) break;
    }
  }
  for (let i = 0; i < orphans.length; i += 100) await bucket.remove(orphans.slice(i, i + 100));
}

export default {
  async fetch(req, env) {
    const { pathname } = new URL(req.url);
    if (pathname === '/api/test-push' && req.method === 'POST') return testPush(req, env);
    return Response.json({ error: 'not found' }, { status: 404 });
  },
  async scheduled(controller, env, ctx) {
    ctx.waitUntil(controller.cron === '0 19 * * SUN' ? weekly(env) : hourly(env));
  },
} satisfies ExportedHandler<Env>;
