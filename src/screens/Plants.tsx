import { useState } from 'react';
import { useLang } from '../i18n';
import { usePlants } from '../lib/plants';
import { navigate } from '../lib/router';
import { EmptyState, LoadError, PlantRow, WaterButton } from '../components/PlantBits';
import { Icon } from '../components/Icon';
import { daysUntilWatering } from '../../shared/plants';

const SEARCH_FROM = 6; // a search box only helps once the list is longer than a screen

// Accent-insensitive, so "luoi ho" finds "Lưỡi hổ".
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase();

export function Plants() {
  const { t } = useLang();
  const { plants, status, today } = usePlants();
  const [q, setQ] = useState('');
  const needle = fold(q.trim());
  // Most thirsty first, so the list answers "what needs me?" before "what do I have?".
  const shown = (needle
    ? plants.filter((p) => [p.name, p.species ?? '', p.location].some((s) => fold(s).includes(needle)))
    : plants
  ).map((p) => ({ p, d: daysUntilWatering(p, today) }))
    .sort((a, b) => a.d - b.d || a.p.name.localeCompare(b.p.name));

  return (
    <>
      <div className="title-row">
        <h1>{t('myPlants')}</h1>
        <button className="button small" onClick={() => navigate('/plants/new')}><Icon name="plus" size={18} />{t('addPlant')}</button>
      </div>
      {status === 'error' && <LoadError />}
      {status === 'ready' && plants.length === 0 && <EmptyState title={t('noPlantsYet')} body={t('noPlantsBody')} />}
      {plants.length >= SEARCH_FROM && (
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('search')} aria-label={t('search')} />
      )}
      {plants.length > 0 && shown.length === 0 && <p className="muted center">{t('noMatches', { q: q.trim() })}</p>}
      <ul className="plant-list">
        {shown.map(({ p, d }) => (
          <PlantRow key={p.id} plant={p} today={today} action={d <= 0 && <WaterButton plant={p} />} />
        ))}
      </ul>
    </>
  );
}
