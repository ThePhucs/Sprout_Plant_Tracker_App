import { addDays, daysBetween, type IsoDate } from './dates';
import { translate, type Lang } from './i18n';

export const LIGHT_LEVELS = ['LOW', 'MEDIUM', 'BRIGHT'] as const;
export const PLANT_ICONS = ['SEEDLING', 'MONSTERA', 'FERN', 'SNAKE_PLANT', 'SUCCULENT', 'CACTUS', 'TULIP', 'DAISY'] as const;
export const PLANT_COLORS = ['GREEN', 'MINT', 'TEAL', 'BLUE', 'PURPLE', 'PINK', 'ORANGE', 'YELLOW'] as const;
export const CARE_TYPES = ['WATER', 'FERTILISE', 'REPOT', 'PRUNE', 'PHOTO'] as const;

export type LightLevel = (typeof LIGHT_LEVELS)[number];
export type PlantIcon = (typeof PLANT_ICONS)[number];
export type PlantColor = (typeof PLANT_COLORS)[number];
export type CareType = (typeof CARE_TYPES)[number];

export type Plant = {
  id: number;
  name: string;
  species: string | null;
  location: string;
  light_level: LightLevel;
  watering_interval_days: number;
  last_watered_at: IsoDate;
  notes: string | null;
  icon: PlantIcon;
  color: PlantColor;
  /** Pinned cover photo; when empty the app shows the latest photo. */
  cover_photo_path?: string | null;
};

export type CareLog = { id: number; plant_id: number; type: CareType; date: IsoDate; note: string | null; photo_path: string | null };

export const nextWatering = (p: Pick<Plant, 'last_watered_at' | 'watering_interval_days'>) =>
  addDays(p.last_watered_at, p.watering_interval_days);

/** Negative when overdue, 0 when due today. */
export const daysUntilWatering = (p: Pick<Plant, 'last_watered_at' | 'watering_interval_days'>, today: IsoDate) =>
  daysBetween(today, nextWatering(p));

/** Plants due on or before `today`, most urgent first, then by name. */
export function plantsDue<P extends Pick<Plant, 'name' | 'last_watered_at' | 'watering_interval_days'>>(plants: P[], today: IsoDate): P[] {
  return plants
    .filter((p) => daysUntilWatering(p, today) <= 0)
    .sort((a, b) => daysUntilWatering(a, today) - daysUntilWatering(b, today) || a.name.localeCompare(b.name));
}

// ── Validation (same rules as the Android PlantValidator and the database) ──
export const LIMITS = { name: 50, species: 80, location: 50, notes: 500, minInterval: 1, maxInterval: 365 } as const;
export type PlantField = 'name' | 'species' | 'location' | 'watering_interval_days' | 'notes';
export type ValidationError = 'REQUIRED' | 'TOO_LONG' | 'OUT_OF_RANGE';

export function validatePlant(p: Pick<Plant, 'name' | 'species' | 'location' | 'watering_interval_days' | 'notes'>) {
  const errors: Partial<Record<PlantField, ValidationError>> = {};
  const name = p.name.trim();
  if (!name) errors.name = 'REQUIRED';
  else if (name.length > LIMITS.name) errors.name = 'TOO_LONG';
  if ((p.species?.trim().length ?? 0) > LIMITS.species) errors.species = 'TOO_LONG';
  if (p.location.trim().length > LIMITS.location) errors.location = 'TOO_LONG';
  const n = p.watering_interval_days;
  if (!Number.isInteger(n) || n < LIMITS.minInterval || n > LIMITS.maxInterval) errors.watering_interval_days = 'OUT_OF_RANGE';
  if ((p.notes?.trim().length ?? 0) > LIMITS.notes) errors.notes = 'TOO_LONG';
  return errors;
}

/** Notification text for the daily reminder; null when nothing needs water (no notification). */
export function reminderContent(due: Pick<Plant, 'name'>[], lang: Lang): { title: string; body: string } | null {
  const t = (k: Parameters<typeof translate>[1], v?: Record<string, string>) => translate(lang, k, v);
  const [a, b] = due;
  switch (due.length) {
    case 0: return null;
    case 1: return { title: t('remindOne', { name: a.name }), body: t('remindTap') };
    case 2: return { title: t('remindMany', { count: '2' }), body: t('remindTwo', { a: a.name, b: b.name }) };
    default: return {
      title: t('remindMany', { count: String(due.length) }),
      body: t('remindMore', { a: a.name, b: b.name, more: String(due.length - 2) }),
    };
  }
}
