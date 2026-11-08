import { useState, type ReactNode } from 'react';
import { useLang } from '../i18n';
import { navigate } from '../lib/router';
import { usePlants } from '../lib/plants';
import { daysUntilWatering, type Plant } from '../../shared/plants';
import { PlantAvatar } from './PlantAvatar';
import { Icon } from './Icon';
import { useToast } from './Toast';

/** One-tap watering with Undo, the same everywhere (Today, plant list, plant page). */
export function WaterButton({ plant, big, onWatered }: { plant: Plant; big?: boolean; onWatered?: () => void }) {
  const { t } = useLang();
  const { today, addLog, deleteLog } = usePlants();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const water = async () => {
    setBusy(true);
    try {
      const log = await addLog(plant.id, 'WATER', today, null);
      onWatered?.();
      toast({
        message: t('wateredToast', { name: plant.name }),
        action: { label: t('undo'), run: () => deleteLog(log).catch(() => toast({ message: t('errSave') })) },
      });
    } catch {
      toast({ message: t('errSave') });
    }
    setBusy(false);
  };
  return (
    <button className={big ? 'button water-big' : 'water-btn'} onClick={water} disabled={busy}
      aria-label={big ? undefined : `${t('water')}: ${plant.name}`}>
      <Icon name="drop" size={big ? 20 : 18} /><span>{t('water')}</span>
    </button>
  );
}

export function StatusChip({ days }: { days: number }) {
  const { t } = useLang();
  const [cls, text] =
    days < 0 ? ['chip-overdue', t('chipOverdue', { n: String(-days) })]
    : days === 0 ? ['chip-today', t('chipToday')]
    : days === 1 ? ['chip-soon', t('chipTomorrow')]
    : ['chip-later', t('chipIn', { n: String(days) })];
  return <span className={`status ${cls}`}>{text}</span>;
}

/** A tappable plant row; `action` (e.g. a Water button) sits on the right, outside the link. */
export function PlantRow({ plant, today, action }: { plant: Plant; today: string; action?: ReactNode }) {
  const { coverOf } = usePlants();
  return (
    <li className="plant-row">
      <a
        href={`/plants/${plant.id}`}
        className="plant-link"
        onClick={(e) => { e.preventDefault(); navigate(`/plants/${plant.id}`); }}
      >
        <PlantAvatar icon={plant.icon} color={plant.color} photo={coverOf(plant)} />
        <span className="plant-text">
          <strong>{plant.name}</strong>
          {plant.location && <small className="muted">{plant.location}</small>}
          <StatusChip days={daysUntilWatering(plant, today)} />
        </span>
      </a>
      {action}
    </li>
  );
}

export function EmptyState({ title, body, children, celebrate }: {
  title: string; body: string; children?: ReactNode; celebrate?: boolean;
}) {
  return (
    <div className={`empty ${celebrate ? 'celebrate' : ''}`}>
      <span className="empty-art"><Icon name="sprout" size={celebrate ? 64 : 40} /></span>
      <h2>{title}</h2>
      <p className="muted">{body}</p>
      {children}
    </div>
  );
}

export function LoadError() {
  const { t } = useLang();
  return (
    <div className="card">
      <p className="error">{t('errLoad')}</p>
      <button className="button secondary" onClick={() => location.reload()}>{t('retry')}</button>
    </div>
  );
}
