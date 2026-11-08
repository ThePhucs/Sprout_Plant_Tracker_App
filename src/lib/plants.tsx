import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from './supabase';
import { removePhotos } from './photos';
import { todayIn } from '../../shared/dates';
import type { CareLog, CareType, Plant } from '../../shared/plants';

export type PlantInput = Omit<Plant, 'id' | 'cover_photo_path'>;

type Ctx = {
  plants: Plant[];
  status: 'loading' | 'ready' | 'error';
  today: string;
  /** Photo shown for each plant: the pinned cover, else the latest photo. */
  coverOf: (p: Plant) => string | null;
  reload: () => Promise<void>;
  addPlant: (p: PlantInput) => Promise<Plant>;
  updatePlant: (id: number, p: PlantInput) => Promise<void>;
  setCover: (id: number, path: string | null) => Promise<void>;
  deletePlant: (id: number) => Promise<void>;
  addLog: (plantId: number, type: CareType, date: string, note: string | null, photoPath?: string | null) => Promise<CareLog>;
  deleteLog: (log: Pick<CareLog, 'id' | 'photo_path'>) => Promise<void>;
  /** Removes a log's photo. A "Photo" entry is only its picture, so the whole entry goes. */
  deletePhoto: (log: CareLog) => Promise<void>;
  /** One page of history, newest first, starting at row `from`. */
  loadLogs: (plantId: number, from: number) => Promise<CareLog[]>;
  loadPhotos: (plantId: number) => Promise<CareLog[]>;
};

/** History loads in pages so a plant with years of entries still opens fast. */
export const LOG_PAGE = 30;

const PlantsContext = createContext<Ctx | null>(null);

/** Throws the Supabase error so screens can show "couldn't save". */
function must<T>({ data, error }: { data: T | null; error: unknown }): T {
  if (error) throw error;
  return data as T;
}

export function PlantsProvider({ children }: { children: ReactNode }) {
  const [plants, setPlants] = useState<Plant[]>([]);
  const [latestPhoto, setLatestPhoto] = useState<Record<number, string>>({});
  const [status, setStatus] = useState<Ctx['status']>('loading');
  const [today, setToday] = useState(() => todayIn());

  const reload = useCallback(async () => {
    const [p, photos] = await Promise.all([
      supabase.from('plants').select('*').order('name'),
      supabase.from('care_logs').select('plant_id, photo_path').not('photo_path', 'is', null)
        .order('date', { ascending: false }).order('id', { ascending: false }),
    ]);
    if (p.error) return setStatus((s) => (s === 'ready' ? s : 'error')); // keep showing old data if we had it
    setPlants(p.data as Plant[]);
    const latest: Record<number, string> = {};
    for (const row of photos.data ?? []) latest[row.plant_id] ??= row.photo_path;
    setLatestPhoto(latest);
    setStatus('ready');
  }, []);

  useEffect(() => {
    reload();
    // Coming back to the app (e.g. next morning): refresh the date and the list.
    const onShow = () => {
      if (document.visibilityState !== 'visible') return;
      setToday(todayIn());
      reload();
    };
    document.addEventListener('visibilitychange', onShow);
    return () => document.removeEventListener('visibilitychange', onShow);
  }, [reload]);

  const value: Ctx = {
    plants, status, today, reload,
    coverOf: (p) => p.cover_photo_path || latestPhoto[p.id] || null,
    async addPlant(p) {
      const plant = must(await supabase.from('plants').insert(p).select().single<Plant>());
      await reload();
      return plant;
    },
    async updatePlant(id, p) {
      must(await supabase.from('plants').update(p).eq('id', id).select().single());
      await reload();
    },
    async setCover(id, path) {
      must(await supabase.from('plants').update({ cover_photo_path: path }).eq('id', id).select().single());
      await reload();
    },
    async deletePlant(id) {
      const { data: withPhotos } = await supabase.from('care_logs').select('photo_path').eq('plant_id', id).not('photo_path', 'is', null);
      must(await supabase.from('plants').delete().eq('id', id).select());
      await removePhotos((withPhotos ?? []).map((r) => r.photo_path)).catch(() => {});
      await reload();
    },
    async addLog(plantId, type, date, note, photoPath = null) {
      const log = must(await supabase.from('care_logs')
        .insert({ plant_id: plantId, type, date, note, photo_path: photoPath }).select().single<CareLog>());
      if (type === 'WATER' || photoPath) await reload(); // last watered or cover photo may have changed
      return log;
    },
    async deleteLog(log) {
      must(await supabase.from('care_logs').delete().eq('id', log.id).select());
      if (log.photo_path) await removePhotos([log.photo_path]).catch(() => {});
      await reload();
    },
    async deletePhoto(log) {
      if (!log.photo_path) return;
      if (log.type === 'PHOTO') return value.deleteLog(log);
      must(await supabase.from('care_logs').update({ photo_path: null }).eq('id', log.id).select());
      // Un-pin it if it was the plant's picture (the database does this itself only when a whole entry is deleted).
      await supabase.from('plants').update({ cover_photo_path: null }).eq('id', log.plant_id).eq('cover_photo_path', log.photo_path);
      await removePhotos([log.photo_path]).catch(() => {});
      await reload();
    },
    async loadLogs(plantId, from) {
      return must(await supabase.from('care_logs').select('*').eq('plant_id', plantId)
        .order('date', { ascending: false }).order('id', { ascending: false })
        .range(from, from + LOG_PAGE - 1));
    },
    async loadPhotos(plantId) {
      // Bounded by the person's photo limit, so one request is enough.
      return must(await supabase.from('care_logs').select('*').eq('plant_id', plantId).not('photo_path', 'is', null)
        .order('date', { ascending: false }).order('id', { ascending: false }));
    },
  };

  return <PlantsContext.Provider value={value}>{children}</PlantsContext.Provider>;
}

export const usePlants = () => useContext(PlantsContext)!;
