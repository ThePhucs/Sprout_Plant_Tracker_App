import { supabase } from './supabase';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string;

function base64UrlToBytes(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

const sameKey = (a: ArrayBuffer | null | undefined, b: Uint8Array) =>
  !!a && a.byteLength === b.length && new Uint8Array(a).every((v, i) => v === b[i]);

export const registerServiceWorker = () => navigator.serviceWorker.register('/sw.js');

/**
 * Makes sure this device has a push subscription saved for the signed-in user.
 * Runs on every app open, so expired or replaced subscriptions heal themselves.
 */
export async function syncPushSubscription(): Promise<boolean> {
  if (Notification.permission !== 'granted') return false;
  const reg = await navigator.serviceWorker.ready;
  const key = base64UrlToBytes(VAPID_PUBLIC_KEY);
  let sub = await reg.pushManager.getSubscription();
  if (sub && !sameKey(sub.options.applicationServerKey, key)) {
    await sub.unsubscribe(); // made with an old key: pushes would be rejected
    sub = null;
  }
  sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
  const { endpoint, keys } = sub.toJSON();
  if (!endpoint || !keys?.p256dh || !keys.auth) return false;
  const { error } = await supabase.rpc('save_push_subscription', {
    p_endpoint: endpoint, p_p256dh: keys.p256dh, p_auth: keys.auth,
  });
  if (error) throw error;
  return true;
}

/** Must be called straight from a tap: iOS only shows the prompt for a user gesture. */
export async function enablePush(): Promise<NotificationPermission> {
  const permission = await Notification.requestPermission();
  if (permission === 'granted') await syncPushSubscription();
  return permission;
}

/** On log out, stop this device getting the previous user's reminders. */
export async function forgetThisDevice() {
  const reg = await navigator.serviceWorker?.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (sub) await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
}

export type TestResult = 'sent' | 'wait' | 'failed';

export async function sendTestPush(accessToken: string): Promise<TestResult> {
  try {
    const res = await fetch('/api/test-push', { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` } });
    if (res.status === 429) return 'wait';
    return res.ok && (await res.json()).sent > 0 ? 'sent' : 'failed';
  } catch {
    return 'failed';
  }
}
