import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { buildPushPayload } from '@block65/webcrypto-web-push';
import { translate, type Lang } from '../shared/i18n';
import { localHour } from '../shared/time';

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SECRET_KEY: string; // secret: bypasses row-level security, never leaves the Worker
  VAPID_PUBLIC_KEY: string;
  VAPID_PRIVATE_KEY: string; // secret
  VAPID_SUBJECT: string;
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

  // Prototype reminder: one daily test push at each person's chosen hour, in their own time zone.
  // shortcut: replace with the real "plants due today" summary once plants exist.
  const due = profiles.filter((p) => localHour(now, p.time_zone) === p.reminder_hour);
  await Promise.all(due.map((p) => sendToUser(env, db, p.id, {
    title: translate(p.language, 'pushDailyTitle'), body: translate(p.language, 'pushDailyBody'), tag: 'daily',
  })));

  // Tell admins about new sign-ups so they know who to verify.
  const fresh = profiles.filter((p) => !p.announced);
  if (fresh.length) {
    const names = fresh.map((p) => (p.display_name ? `${p.display_name} (${p.username})` : p.username)).join(', ');
    const admins = profiles.filter((p) => p.is_admin);
    await Promise.all(admins.map((a) => sendToUser(env, db, a.id, {
      title: translate(a.language, 'pushNewUserTitle'), body: translate(a.language, 'pushNewUserBody', { names }), tag: 'signup',
    })));
    // Only mark as told once an admin exists, so nobody is missed before you set is_admin.
    if (admins.length) await db.from('profiles').update({ announced: true }).in('id', fresh.map((p) => p.id));
  }
}

export default {
  async fetch(req, env) {
    const { pathname } = new URL(req.url);
    if (pathname === '/api/test-push' && req.method === 'POST') return testPush(req, env);
    return Response.json({ error: 'not found' }, { status: 404 });
  },
  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(hourly(env));
  },
} satisfies ExportedHandler<Env>;
