import { useEffect, useState, type FormEvent } from 'react';
import { useLang } from '../i18n';
import { LOG_PAGE, usePlants } from '../lib/plants';
import { removePhotos, uploadPhoto } from '../lib/photos';
import { goBack, navigate } from '../lib/router';
import { useToast } from '../components/Toast';
import { Icon } from '../components/Icon';
import { Photo, PhotoPicker, PhotoViewer, type PickedPhoto } from '../components/Photo';
import { PlantAvatar } from '../components/PlantAvatar';
import { StatusChip, WaterButton } from '../components/PlantBits';
import { useConfirm } from '../components/Confirm';
import { formatDate } from '../../shared/dates';
import { CARE_TYPES, daysUntilWatering, nextWatering, type CareLog, type CareType } from '../../shared/plants';

export function PlantDetail({ id }: { id: number }) {
  const { t, lang } = useLang();
  const { plants, status, today, coverOf, addLog, deleteLog, deletePhoto, setCover, loadLogs, loadPhotos } = usePlants();
  const toast = useToast();
  const confirm = useConfirm();
  const plant = plants.find((p) => p.id === id);
  const [tab, setTab] = useState<'history' | 'photos'>('history');
  const [logs, setLogs] = useState<CareLog[] | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [photos, setPhotos] = useState<CareLog[] | null>(null);
  const [logging, setLogging] = useState<CareType | null>(null); // open form, preset to this care type
  const [viewing, setViewing] = useState<CareLog | null>(null);

  // Back to the newest page (after adding/removing an entry, or the plant changed elsewhere).
  const refreshLogs = async () => {
    try {
      const page = await loadLogs(id, 0);
      setLogs(page);
      setHasMore(page.length === LOG_PAGE);
    } catch {
      setLogs([]);
    }
    loadPhotos(id).then(setPhotos).catch(() => setPhotos([]));
  };
  const showMore = async () => {
    const page = await loadLogs(id, logs?.length ?? 0).catch(() => []);
    setLogs((l) => [...(l ?? []), ...page]);
    setHasMore(page.length === LOG_PAGE);
  };
  useEffect(() => { refreshLogs(); }, [id, plant?.last_watered_at]);

  if (!plant) {
    return status === 'loading' ? null : (
      <>
        <BackButton />
        <p className="card">{t('plantNotFound')}</p>
      </>
    );
  }

  const fmt = (d: string) => formatDate(d, lang, today);
  const careLabel = (type: CareType) => t(`care${type}`);
  const cover = coverOf(plant);

  const removeLog = async (log: CareLog) => {
    if (!(await confirm(t('confirmDeleteLog', { type: careLabel(log.type), date: fmt(log.date) }), t('delete')))) return;
    try {
      await deleteLog(log);
      await refreshLogs();
    } catch {
      toast({ message: t('errSave') });
    }
  };

  return (
    <>
      <BackButton />
      <header className="detail-head">
        <PlantAvatar icon={plant.icon} color={plant.color} photo={cover} size={72} />
        <div>
          <h1>{plant.name}</h1>
          {plant.species && <p className="muted">{plant.species}</p>}
        </div>
      </header>

      <section className="card info">
        <Info label={t('nextWatering')}>
          {fmt(nextWatering(plant))} <StatusChip days={daysUntilWatering(plant, today)} />
        </Info>
        <Info label={t('lastWatered')}>{fmt(plant.last_watered_at)}</Info>
        <Info label={t('schedule')}>
          {plant.watering_interval_days === 1 ? t('everyDay') : t('every', { n: String(plant.watering_interval_days) })}
        </Info>
        <Info label={t('light')}>{t(`light${plant.light_level}`)}</Info>
        {plant.location && <Info label={t('location')}>{plant.location}</Info>}
        {plant.notes && <p className="notes">{plant.notes}</p>}
      </section>

      {logging ? (
        <LogCareForm
          today={today}
          initialType={logging}
          onCancel={() => setLogging(null)}
          onSave={async (type, date, note, photoPath) => {
            await addLog(plant.id, type, date, note, photoPath);
            setLogging(null);
            toast({ message: t('logged', { type: careLabel(type) }) });
            await refreshLogs();
          }}
        />
      ) : (
        <div className="actions">
          <WaterButton plant={plant} big />
          <div className="row">
            <button className="button secondary" onClick={() => setLogging('FERTILISE')}>{t('logCare')}</button>
            <button className="button secondary" onClick={() => navigate(`/plants/${plant.id}/edit`)}>{t('edit')}</button>
          </div>
        </div>
      )}

      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'history'} onClick={() => setTab('history')}>{t('tabHistory')}</button>
        <button role="tab" aria-selected={tab === 'photos'} onClick={() => setTab('photos')}>
          {t('tabPhotos')}{photos?.length ? ` · ${photos.length}` : ''}
        </button>
      </div>

      {tab === 'photos' ? (
        <section className="photos">
          {!logging && (
            <button className="button secondary" onClick={() => setLogging('PHOTO')}>
              <Icon name="plus" size={18} /> {t('photoTabAdd')}
            </button>
          )}
          {photos?.length === 0 ? <p className="muted center">{t('noPhotos')}</p> : (
          <ul className="gallery">
            {photos?.map((log) => (
              <li key={log.id}>
                <button onClick={() => setViewing(log)} aria-label={`${careLabel(log.type)} ${fmt(log.date)}`}>
                  <Photo path={log.photo_path!} thumb alt="" className="gallery-img" />
                  <span className="gallery-date">{fmt(log.date)}</span>
                </button>
              </li>
            ))}
          </ul>
          )}
        </section>
      ) : (
      <section>
        <ul className="history">
          {logs?.map((log) => (
            <li key={log.id}>
              <span className={`care-dot care-${log.type.toLowerCase()}`} aria-hidden="true" />
              <div className="history-text">
                <strong>{careLabel(log.type)}</strong> <span className="muted">{fmt(log.date)}</span>
                {log.note && <p>{log.note}</p>}
                {/* Under the text, away from the delete button, so a tap on the photo can't hit delete. */}
                {log.photo_path && (
                  <button className="history-photo" onClick={() => setViewing(log)} aria-label={`${careLabel(log.type)} ${fmt(log.date)}`}>
                    <Photo path={log.photo_path} thumb alt="" className="thumb" />
                  </button>
                )}
              </div>
              <button className="icon-btn" onClick={() => removeLog(log)} aria-label={t('removeEntry')}><Icon name="close" size={18} /></button>
            </li>
          ))}
        </ul>
        {hasMore && <button className="button secondary" onClick={showMore}>{t('showMore')}</button>}
      </section>
      )}

      {viewing?.photo_path && (
        <PhotoViewer
          path={viewing.photo_path}
          alt={`${plant.name}, ${fmt(viewing.date)}`}
          onClose={() => setViewing(null)}
          actions={<>
            {viewing.photo_path !== cover && (
              <button className="button secondary" onClick={async () => {
                try {
                  await setCover(plant.id, viewing.photo_path);
                  toast({ message: t('coverSet') });
                } catch {
                  toast({ message: t('errSave') });
                }
                setViewing(null);
              }}>{t('setCover')}</button>
            )}
            <button className="button quiet-danger" onClick={async () => {
              if (!(await confirm(t('confirmDeletePhoto'), t('deletePhoto')))) return;
              try {
                await deletePhoto(viewing);
                toast({ message: t('photoDeleted') });
                await refreshLogs();
              } catch {
                toast({ message: t('errSave') });
              }
              setViewing(null);
            }}>{t('deletePhoto')}</button>
          </>}
        />
      )}
    </>
  );
}

function Info({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="info-row">
      <span className="muted">{label}</span>
      <span>{children}</span>
    </div>
  );
}

function BackButton() {
  const { t } = useLang();
  return <button className="link back" onClick={() => goBack('/plants')}><Icon name="back" size={18} />{t('back')}</button>;
}

function LogCareForm({ today, initialType, onSave, onCancel }: {
  today: string;
  initialType: CareType;
  onCancel: () => void;
  onSave: (type: CareType, date: string, note: string | null, photoPath: string | null) => Promise<void>;
}) {
  const { t } = useLang();
  const [type, setType] = useState<CareType>(initialType);
  const [date, setDate] = useState(today);
  const [note, setNote] = useState('');
  const [photo, setPhoto] = useState<PickedPhoto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadFailed, setUploadFailed] = useState(false);
  const [busy, setBusy] = useState<false | 'saving' | 'uploading'>(false);

  const photosAllowed = type !== 'WATER'; // watering logs never have photos

  const save = async (withPhoto: boolean) => {
    const cleanNote = note.trim() || null;
    if (!date || date > today) return setError(t('errFuture'));
    if (type === 'PHOTO' && !photo) return setError(t('photoNeeded'));
    setError(null);
    let path: string | null = null;
    if (withPhoto && photosAllowed && photo) {
      setBusy('uploading');
      try {
        path = await uploadPhoto(photo);
      } catch (err) {
        console.error('photo upload failed', err);
        setError(t('uploadFail'));
        setUploadFailed(true);
        setBusy(false);
        return;
      }
    }
    setBusy('saving');
    try {
      await onSave(type, date, cleanNote, path);
    } catch (err) {
      console.error('save care log failed', err);
      if (path) removePhotos([path]).catch(() => {});
      setError(t('errSave'));
      setBusy(false);
    }
  };

  const submit = (e: FormEvent) => { e.preventDefault(); save(true); };

  return (
    <form className="card form" onSubmit={submit}>
      <h2>{t('logCare')}</h2>
      <div className="chips" role="radiogroup" aria-label={t('logCare')}>
        {CARE_TYPES.map((c) => (
          <button type="button" key={c} role="radio" aria-checked={type === c}
            className={`chip ${type === c ? 'active' : ''}`} onClick={() => setType(c)}>
            {t(`care${c}`)}
          </button>
        ))}
      </div>
      <label>
        {t('date')}
        <input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} required />
      </label>
      <label>
        {t('noteOptional')}
        <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={2} />
      </label>

      {photosAllowed && <PhotoPicker photo={photo} onChange={setPhoto} />}

      {error && <p className="error" role="alert">{error}</p>}
      {busy === 'uploading' && <p className="muted">{t('uploading')}</p>}
      {uploadFailed && type !== 'PHOTO' && (
        <button type="button" className="button secondary" disabled={!!busy} onClick={() => save(false)}>{t('saveWithoutPhoto')}</button>
      )}
      <div className="row">
        <button type="button" className="button secondary" onClick={onCancel}>{t('cancel')}</button>
        <button className="button" disabled={!!busy}>{t('save')}</button>
      </div>
    </form>
  );
}
