// Pure checks on the user agent, so they can be tested.

/** Facebook, Messenger, Instagram, Zalo… in-app browsers can't install apps or receive push. */
export const isInAppBrowser = (ua: string) => /FBAN|FBAV|FB_IAB|FB4A|FBIOS|Messenger|Instagram|Zalo|Line\//i.test(ua);

/** iPadOS reports itself as a Mac, so touch points tell them apart. */
export const isIOS = (ua: string, maxTouchPoints = 0) =>
  /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && maxTouchPoints > 1);

export const isAndroid = (ua: string) => /Android/i.test(ua);

/** [major, minor] from an iOS user agent, or null. */
export function iosVersion(ua: string): [number, number] | null {
  const m = /OS (\d+)_(\d+)/.exec(ua);
  return m ? [Number(m[1]), Number(m[2])] : null;
}

/** Web push on iPhone needs iOS 16.4+. */
export function iosSupportsPush(ua: string): boolean {
  const v = iosVersion(ua);
  return !v || v[0] > 16 || (v[0] === 16 && v[1] >= 4);
}

export const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

export const pushApiAvailable = () =>
  'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
