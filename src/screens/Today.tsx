import { useState } from 'react';
import { useLang } from '../i18n';
import { usePlants } from '../lib/plants';
import { navigate } from '../lib/router';
import { EmptyState, LoadError, PlantRow, WaterButton } from '../components/PlantBits';
import { NotificationsBanner } from '../components/NotificationsBanner';
import { daysUntilWatering, type Plant } from '../../shared/plants';

const UPCOMING_DAYS = 3; // same window as the Android app

const greetingKey = (h: number) => (h < 11 ? 'goodMorning' : h < 18 ? 'goodAfternoon' : 'goodEvening');

export function Today({ name }: { name: string }) {
  const { t } = useLang();
  const { plants, status, today } = usePlants();
  // Set once something is watered here, so finishing the last plant gets its own moment.
  const [wateredHere, setWateredHere] = useState(false);

  const byDays = (min: number, max: number) =>
    plants
      .map((p) => ({ p, d: daysUntilWatering(p, today) }))
      .filter(({ d }) => d >= min && d <= max)
      .sort((a, b) => a.d - b.d || a.p.name.localeCompare(b.p.name))
      .map(({ p }) => p);
  const overdue = byDays(-Infinity, -1);
  const dueToday = byDays(0, 0);
  const upcoming = byDays(1, UPCOMING_DAYS);
  const due = overdue.length + dueToday.length;

  const action = (p: Plant) => <WaterButton plant={p} onWatered={() => setWateredHere(true)} />;

  return (
    <>
      <NotificationsBanner />
      <header className="today-head">
        <h1>{t(greetingKey(new Date().getHours()), { name })}</h1>
        {status === 'ready' && plants.length > 0 && (
          <p className="muted">{due === 0 ? t('summaryNone') : due === 1 ? t('summaryOne') : t('summaryDue', { n: String(due) })}</p>
        )}
      </header>
      {status === 'error' && <LoadError />}
      {status === 'ready' && plants.length === 0 && (
        <EmptyState title={t('noPlantsYet')} body={t('noPlantsBody')}>
          <button className="button" onClick={() => navigate('/plants/new')}>{t('addPlant')}</button>
        </EmptyState>
      )}
      {status === 'ready' && plants.length > 0 && due === 0 && (
        wateredHere
          ? <EmptyState celebrate title={t('allWateredTitle')} body={t('allWateredBody')} />
          : !upcoming.length && <EmptyState title={t('allCaughtUp')} body={t('allCaughtUpBody')} />
      )}
      <Section title={t('overdue')} plants={overdue} today={today} action={action} />
      <Section title={t('dueToday')} plants={dueToday} today={today} action={action} />
      <Section title={t('comingUp')} plants={upcoming} today={today} action={action} />
    </>
  );
}

function Section({ title, plants, today, action }: {
  title: string; plants: Plant[]; today: string; action: (p: Plant) => React.ReactNode;
}) {
  if (!plants.length) return null;
  return (
    <section>
      <h2 className="section-title">{title} · {plants.length}</h2>
      <ul className="plant-list">
        {plants.map((p) => <PlantRow key={p.id} plant={p} today={today} action={action(p)} />)}
      </ul>
    </section>
  );
}
