import { expect, test } from 'vitest';
import { addDays, daysBetween, formatDate, todayIn } from './dates';
import { daysUntilWatering, plantsDue, reminderContent, validatePlant, type Plant } from './plants';

const plant = (name: string, last: string, every: number): Plant => ({
  id: 1, name, species: null, location: '', light_level: 'MEDIUM', watering_interval_days: every,
  last_watered_at: last, notes: null, icon: 'SEEDLING', color: 'GREEN',
});

test('date maths across months, years and leap days', () => {
  expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
  expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
  expect(daysBetween('2026-03-01', '2026-02-27')).toBe(-2);
  expect(todayIn('Asia/Ho_Chi_Minh', new Date('2026-11-07T18:00:00Z'))).toBe('2026-11-08');
  expect(todayIn('America/Los_Angeles', new Date('2026-11-07T18:00:00Z'))).toBe('2026-11-07');
});

test('dates show day/month in Vietnamese and month/day in English', () => {
  expect(formatDate('2026-11-07', 'vi', '2026-11-20')).toBe('7/11');
  expect(formatDate('2026-11-07', 'en', '2026-11-20')).toBe('11/7');
  expect(formatDate('2025-11-07', 'vi', '2026-11-20')).toBe('7/11/2025');
});

test('days until watering: negative when overdue, 0 when due today', () => {
  expect(daysUntilWatering(plant('a', '2026-11-01', 7), '2026-11-08')).toBe(0);
  expect(daysUntilWatering(plant('a', '2026-11-01', 3), '2026-11-08')).toBe(-4);
  expect(daysUntilWatering(plant('a', '2026-11-07', 3), '2026-11-08')).toBe(2);
});

test('due plants: most overdue first, then by name, future ones left out', () => {
  const due = plantsDue([
    plant('Basil', '2026-11-07', 1), plant('Aloe', '2026-11-07', 1),
    plant('Fern', '2026-11-01', 2), plant('Cactus', '2026-11-07', 30),
  ], '2026-11-08');
  expect(due.map((p) => p.name)).toEqual(['Fern', 'Aloe', 'Basil']);
});

test('validation matches the Android rules', () => {
  const ok = { name: ' Monty ', species: null, location: '', watering_interval_days: 7, notes: null };
  expect(validatePlant(ok)).toEqual({});
  expect(validatePlant({ ...ok, name: '   ' })).toEqual({ name: 'REQUIRED' });
  expect(validatePlant({ ...ok, name: 'x'.repeat(51) })).toEqual({ name: 'TOO_LONG' });
  expect(validatePlant({ ...ok, watering_interval_days: 0 })).toEqual({ watering_interval_days: 'OUT_OF_RANGE' });
  expect(validatePlant({ ...ok, watering_interval_days: 366 })).toEqual({ watering_interval_days: 'OUT_OF_RANGE' });
  expect(validatePlant({ ...ok, notes: 'x'.repeat(501) })).toEqual({ notes: 'TOO_LONG' });
});

test('reminder text: none, one, two, many', () => {
  const p = (name: string) => ({ name });
  expect(reminderContent([], 'en')).toBeNull();
  expect(reminderContent([p('Monty')], 'en')?.title).toBe('Monty needs watering');
  expect(reminderContent([p('A'), p('B')], 'vi')).toEqual({ title: '2 cây cần tưới nước', body: 'A và B' });
  expect(reminderContent([p('A'), p('B'), p('C'), p('D')], 'en')).toEqual({
    title: '4 plants need watering', body: 'A, B and 2 more',
  });
});
