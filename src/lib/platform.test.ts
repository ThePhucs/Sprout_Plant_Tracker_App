import { expect, test } from 'vitest';
import { iosSupportsPush, iosVersion, isIOS, isInAppBrowser } from './platform';

const iphone = (v: string) => `Mozilla/5.0 (iPhone; CPU iPhone OS ${v} like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.4 Mobile/15E148 Safari/604.1`;
const messengerAndroid = 'Mozilla/5.0 (Linux; Android 14; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36 [FB_IAB/Orca-Android;FBAV/480.0.0;]';
const chromeAndroid = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';
const fbIOS = `${iphone('17_5')} [FBAN/FBIOS;FBAV/480.0.0]`;

test('detects Facebook / Messenger in-app browsers', () => {
  expect(isInAppBrowser(messengerAndroid)).toBe(true);
  expect(isInAppBrowser(fbIOS)).toBe(true);
  expect(isInAppBrowser(chromeAndroid)).toBe(false);
  expect(isInAppBrowser(iphone('17_5'))).toBe(false);
});

test('iOS push needs 16.4+', () => {
  expect(iosVersion(iphone('15_8'))).toEqual([15, 8]);
  expect(iosSupportsPush(iphone('15_8'))).toBe(false); // iPhone 7
  expect(iosSupportsPush(iphone('16_3'))).toBe(false);
  expect(iosSupportsPush(iphone('16_4'))).toBe(true);
  expect(iosSupportsPush(iphone('18_1'))).toBe(true);
});

test('iPadOS desktop-style UA counts as iOS only with touch', () => {
  const mac = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';
  expect(isIOS(mac, 5)).toBe(true);
  expect(isIOS(mac, 0)).toBe(false);
});
