import { useState, type FormEvent } from 'react';
import { useLang } from '../i18n';
import { usePlants, type PlantInput } from '../lib/plants';
import { goBack, navigate } from '../lib/router';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/Confirm';
import { useMe } from '../lib/me';
import { Icon } from '../components/Icon';
import { PlantAvatar, PlantGlyph } from '../components/PlantAvatar';
import { PhotoPicker, type PickedPhoto } from '../components/Photo';
import { removePhotos, uploadPhoto } from '../lib/photos';
import {
  LIGHT_LEVELS, LIMITS, PLANT_COLORS, PLANT_ICONS, validatePlant, type Plant, type PlantField, type ValidationError,
} from '../../shared/plants';

/** Add (id undefined) or edit a plant. Waits for the plant list so the form starts filled in. */
export function PlantEdit({ id }: { id?: number }) {
  const { t } = useLang();
  const { plants, status } = usePlants();
  const existing = id === undefined ? undefined : plants.find((p) => p.id === id);
  if (id !== undefined && !existing) return status === 'loading' ? null : <p className="card">{t('plantNotFound')}</p>;
  return <PlantForm existing={existing} />;
}

function PlantForm({ existing }: { existing?: Plant }) {
  const { t } = useLang();
  const { today, addPlant, updatePlant, deletePlant, addLog, coverOf } = usePlants();
  const toast = useToast();
  const [form, setForm] = useState<PlantInput>(() => existing ?? {
    name: '', species: '', location: '', light_level: 'MEDIUM', watering_interval_days: 7,
    last_watered_at: today, notes: '', icon: 'SEEDLING', color: 'GREEN', shared: false,
  });
  const [errors, setErrors] = useState<Partial<Record<PlantField, ValidationError>>>({});
  const [busy, setBusy] = useState(false);
  const [photo, setPhoto] = useState<PickedPhoto | null>(null); // new plants only
  const [more, setMore] = useState(!!existing); // "More details" open when editing
  const confirm = useConfirm();
  const me = useMe();

  const set = <K extends keyof PlantInput>(k: K, v: PlantInput[K]) => setForm((f) => ({ ...f, [k]: v }));
  const errText = (f: PlantField, max?: number) => {
    const e = errors[f];
    if (!e) return null;
    const msg = e === 'REQUIRED' ? t('errRequired') : e === 'OUT_OF_RANGE' ? t('errRange') : t('errTooLong', { max: String(max) });
    return <small className="error" role="alert">{msg}</small>;
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const found = validatePlant(form);
    setErrors(found);
    if (found.species || found.location || found.notes) setMore(true); // show the field that's wrong
    if (Object.keys(found).length) return;
    // Only the editable columns: an existing plant also carries id/user_id/created_at, which the database refuses to change.
    const clean: PlantInput = {
      light_level: form.light_level,
      watering_interval_days: form.watering_interval_days,
      icon: form.icon,
      color: form.color,
      name: form.name.trim(),
      species: form.species?.trim() || null,
      location: form.location.trim(),
      notes: form.notes?.trim() || null,
      last_watered_at: form.last_watered_at > today ? today : form.last_watered_at,
      shared: !!form.shared && me.verified,
    };
    setBusy(true);
    try {
      if (existing) {
        await updatePlant(existing.id, clean);
        toast({ message: t('savedPlant', { name: clean.name }) });
        goBack(`/plants/${existing.id}`);
      } else {
        // Upload first: if it fails nothing is saved yet, and they can retry or remove the photo.
        let path: string | null = null;
        if (photo) {
          try {
            path = await uploadPhoto(photo);
          } catch (err) {
            console.error('photo upload failed', err);
            toast({ message: t('uploadFail') });
            setBusy(false);
            return;
          }
        }
        let created;
        try {
          created = await addPlant(clean);
        } catch (err) {
          if (path) removePhotos([path]).catch(() => {});
          throw err;
        }
        // The first photo becomes a "Photo" entry in the plant's history, and so its picture.
        if (path) await addLog(created.id, 'PHOTO', today, null, path).catch(() => removePhotos([path]).catch(() => {}));
        toast({ message: t('addedPlant', { name: clean.name }) });
        navigate(`/plants/${created.id}`, { replace: true });
      }
    } catch (err) {
      console.error('save plant failed', err); // visible in the browser console when debugging
      toast({ message: t('errSave') });
      setBusy(false);
    }
  };

  const interval = form.watering_interval_days;
  const setInterval = (n: number) => set('watering_interval_days', Math.min(LIMITS.maxInterval, Math.max(LIMITS.minInterval, n)));

  return (
    <form className="form" onSubmit={submit} noValidate>
      <div className="title-row">
        <button type="button" className="link back" onClick={() => goBack(existing ? `/plants/${existing.id}` : '/plants')}>
          <Icon name="back" size={18} />{t('cancel')}
        </button>
      </div>
      <header className="detail-head">
        {photo
          ? <span className="avatar" style={{ width: 72, height: 72 }}><img src={photo.preview} alt="" className="avatar-photo" /></span>
          : <PlantAvatar icon={form.icon} color={form.color} photo={existing && coverOf(existing)} size={72} />}
        <h1>{existing ? t('editPlant') : t('newPlant')}</h1>
      </header>

      {/* The essentials: what most people fill in. Everything else is under "More details". */}
      <section className="card form">
        {!existing && <PhotoPicker photo={photo} onChange={setPhoto} />}
        <label>
          {t('plantName')}
          <input value={form.name} onChange={(e) => set('name', e.target.value)} maxLength={LIMITS.name + 10}
            placeholder={t('namePlaceholder')} required />
          {errText('name', LIMITS.name)}
        </label>
        <div className="field">
          <span className="field-label" id="interval-label">{t('waterEvery')}</span>
          <div className="stepper" role="group" aria-labelledby="interval-label">
            <button type="button" className="step-btn" onClick={() => setInterval(interval - 1)} aria-label={t('fewerDays')}>−</button>
            <input type="number" inputMode="numeric" min={1} max={365} value={interval}
              onChange={(e) => set('watering_interval_days', Number(e.target.value))} aria-labelledby="interval-label" />
            <button type="button" className="step-btn" onClick={() => setInterval(interval + 1)} aria-label={t('moreDays')}>+</button>
            <span>{t('days')}</span>
          </div>
          {errText('watering_interval_days')}
        </div>
        <label className="switch-row">
          <span>
            <strong>{t('shareLabel')}</strong>
            <small className="muted">{me.verified ? t('shareHint') : t('shareNeedsVerify')}</small>
          </span>
          <input type="checkbox" role="switch" className="switch" checked={!!form.shared} disabled={!me.verified}
            onChange={(e) => set('shared', e.target.checked)} />
        </label>
      </section>

      {/* A photo already shows the plant, so icon and colour only matter without one. */}
      {!photo && !(existing && coverOf(existing)) && (
        <section className="card form">
          <span className="field-label">{t('appearance')}</span>
          <div className="icon-grid" role="radiogroup" aria-label={t('appearance')}>
            {PLANT_ICONS.map((i) => (
              <button type="button" key={i} role="radio" aria-checked={form.icon === i} aria-label={t(`icon${i}`)}
                className={`icon-choice ${form.icon === i ? 'active' : ''}`} onClick={() => set('icon', i)}>
                <PlantGlyph icon={i} size={28} />
              </button>
            ))}
          </div>
          <div className="swatches" role="radiogroup" aria-label={t('appearance')}>
            {PLANT_COLORS.map((c) => (
              <button type="button" key={c} role="radio" aria-checked={form.color === c} aria-label={t(`color${c}`)}
                className={`swatch c-${c.toLowerCase()} ${form.color === c ? 'active' : ''}`} onClick={() => set('color', c)} />
            ))}
          </div>
        </section>
      )}

      <details className="card more" open={more} onToggle={(e) => setMore(e.currentTarget.open)}>
        <summary>{t('moreDetails')}</summary>
        <div className="form">
        <label>
          {t('species')}
          <input value={form.species ?? ''} onChange={(e) => set('species', e.target.value)} maxLength={LIMITS.species + 10} />
          {errText('species', LIMITS.species)}
        </label>
        <label>
          {t('location')}
          <input value={form.location} onChange={(e) => set('location', e.target.value)} maxLength={LIMITS.location + 10} />
          {errText('location', LIMITS.location)}
        </label>
        <label>
          {t('lastWatered')}
          <input type="date" value={form.last_watered_at} max={today} onChange={(e) => set('last_watered_at', e.target.value || today)} />
        </label>
        <div className="field">
          <span className="field-label">{t('light')}</span>
          <div className="segmented" role="radiogroup" aria-label={t('light')}>
            {LIGHT_LEVELS.map((l) => (
              <button type="button" key={l} role="radio" aria-checked={form.light_level === l}
                className={form.light_level === l ? 'active' : ''} onClick={() => set('light_level', l)}>
                {t(`light${l}`)}
              </button>
            ))}
          </div>
          <small className="muted">{t('lightHint')}</small>
        </div>
        <label>
          {t('notes')}
          <textarea value={form.notes ?? ''} onChange={(e) => set('notes', e.target.value)} rows={3} maxLength={LIMITS.notes + 10} />
          {errText('notes', LIMITS.notes)}
        </label>
        </div>
      </details>

      <button className="button" disabled={busy}>{existing ? t('saveChanges') : t('addPlant')}</button>

      {existing && (
        <button type="button" className="link danger" disabled={busy} onClick={async () => {
          if (!(await confirm(t('confirmDeletePlant', { name: existing.name }), t('deletePlant')))) return;
          setBusy(true);
          try {
            await deletePlant(existing.id);
            navigate('/plants', { replace: true });
          } catch {
            toast({ message: t('errSave') });
            setBusy(false);
          }
        }}>{t('deletePlant')}</button>
      )}
    </form>
  );
}
