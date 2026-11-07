import { expect, test } from 'vitest';
import { localHour } from './time';

test('local hour follows each time zone, including US daylight saving', () => {
  const t = new Date('2026-07-01T01:00:00Z');
  expect(localHour(t, 'Asia/Ho_Chi_Minh')).toBe(8);
  expect(localHour(t, 'America/New_York')).toBe(21); // EDT, UTC-4
  expect(localHour(new Date('2026-12-01T01:00:00Z'), 'America/New_York')).toBe(20); // EST, UTC-5
});

test('unknown zone falls back to Vietnam time', () => {
  expect(localHour(new Date('2026-07-01T01:00:00Z'), 'Not/AZone')).toBe(8);
});
