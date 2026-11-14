import { useEffect, useState } from 'react';
import { useLang } from '../i18n';
import { supabase } from '../lib/supabase';
import { useMe } from '../lib/me';
import { useMemberNames } from '../lib/social';
import { navigate } from '../lib/router';
import { ADMIN_MESSENGER } from '../config';
import { Icon } from '../components/Icon';
import { Photo } from '../components/Photo';
import { EmptyState } from '../components/PlantBits';

const PAGE = 30;
type Item = { id: number; user_id: string; photo_path: string; plants: { name: string } };

/** Newest photos from plants people share, as a grid of thumbnails (small downloads on slow 4G). */
export function Garden() {
  const { t } = useLang();
  const me = useMe();
  const names = useMemberNames();
  const [items, setItems] = useState<Item[] | null>(null);
  const [counts, setCounts] = useState<Record<number, { likes: number; comments: number }>>({});
  const [more, setMore] = useState(false);

  const load = async (beforeId?: number) => {
    let q = supabase.from('care_logs').select('id, user_id, photo_path, plants!inner(name, shared)')
      .eq('plants.shared', true).not('photo_path', 'is', null).order('id', { ascending: false }).limit(PAGE);
    if (beforeId) q = q.lt('id', beforeId);
    const { data } = await q;
    const page = (data ?? []) as unknown as Item[];
    setItems((old) => [...(beforeId ? old ?? [] : []), ...page]);
    setMore(page.length === PAGE);
    if (!page.length) return;
    const ids = page.map((i) => i.id);
    const [l, c] = await Promise.all([
      supabase.from('likes').select('log_id').in('log_id', ids),
      supabase.from('comments').select('log_id').in('log_id', ids),
    ]);
    setCounts((old) => {
      const next = { ...old };
      for (const id of ids) next[id] = { likes: 0, comments: 0 };
      for (const r of l.data ?? []) next[r.log_id].likes++;
      for (const r of c.data ?? []) next[r.log_id].comments++;
      return next;
    });
  };

  useEffect(() => { if (me.verified) load(); }, [me.verified]);

  return (
    <>
      <header className="today-head">
        <h1>{t('gardenTitle')}</h1>
        <p className="muted">{t('gardenIntro')}</p>
      </header>

      {!me.verified ? (
        <p className="card">
          {t('gardenLocked')}{' '}
          <a href={ADMIN_MESSENGER} target="_blank" rel="noreferrer" className="with-icon"><Icon name="message" size={18} />{t('messageAdmin')}</a>
        </p>
      ) : items?.length === 0 ? (
        <EmptyState title={t('gardenTitle')} body={t('gardenEmpty')} />
      ) : (
        <>
          <ul className="garden-grid">
            {items?.map((it) => (
              <li key={it.id}>
                <a href={`/photos/${it.id}`} onClick={(e) => { e.preventDefault(); navigate(`/photos/${it.id}`); }}>
                  <Photo path={it.photo_path} thumb alt={it.plants.name} className="gallery-img" />
                  <span className="garden-caption">
                    <strong>{it.plants.name}</strong>
                    <small>{it.user_id === me.id ? t('you') : names[it.user_id] ?? t('someone')}</small>
                  </span>
                  {(counts[it.id]?.likes || counts[it.id]?.comments) ? (
                    <span className="garden-counts">
                      {!!counts[it.id].likes && <><Icon name="heart" size={14} filled /> {counts[it.id].likes}</>}
                      {!!counts[it.id].comments && <><Icon name="message" size={14} /> {counts[it.id].comments}</>}
                    </span>
                  ) : null}
                </a>
              </li>
            ))}
          </ul>
          {more && <button className="button secondary" onClick={() => load(items![items!.length - 1].id)}>{t('showMore')}</button>}
        </>
      )}
    </>
  );
}
