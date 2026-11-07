import { expect, test } from 'vitest';
import { isValidUsername, normalizeUsername, usernameToEmail } from './username';

test('usernames are case-insensitive and trimmed', () => {
  expect(normalizeUsername('  Huong_1 ')).toBe('huong_1');
  expect(usernameToEmail('Mom')).toBe('mom@sprout.local');
});

test('only plain letters, digits and _ (3-20 chars)', () => {
  for (const ok of ['mom', 'huong_1', 'a'.repeat(20)]) expect(isValidUsername(ok)).toBe(true);
  for (const bad of ['ab', 'a'.repeat(21), 'hương', 'mom dad', 'mom@x', 'Mom']) expect(isValidUsername(bad)).toBe(false);
});
