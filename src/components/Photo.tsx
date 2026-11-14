import { useEffect, useState } from 'react';
import { useLang } from '../i18n';
import { compressPhoto, photoUsage, thumbPath, usePhotoUrl } from '../lib/photos';
import { ADMIN_MESSENGER } from '../config';
import { Icon } from './Icon';
import type { PhotoUsage } from '../lib/photos';

export type PickedPhoto = { full: Blob; thumb: Blob; preview: string };

/**
 * "Add photo" button + preview. Shrinks the photo right away; shows the limit note,
 * and hides the button when the person is out of photos.
 */
export function PhotoPicker({ photo, onChange }: { photo: PickedPhoto | null; onChange: (p: PickedPhoto | null) => void }) {
  const { t } = useLang();
  const [usage, setUsage] = useState<PhotoUsage | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => { photoUsage().then(setUsage); }, []);
  useEffect(() => () => { if (photo) URL.revokeObjectURL(photo.preview); }, [photo]);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setError(false);
    try {
      const shrunk = await compressPhoto(file);
      onChange({ ...shrunk, preview: URL.createObjectURL(shrunk.thumb) });
    } catch {
      setError(true);
    }
  };
  // No "capture" attribute: iPhone then offers both the camera and the photo library.
  const input = <input type="file" accept="image/*" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} />;

  if (!usage) return null;
  return (
    <>
      <PhotoLimitNote usage={usage} />
      {photo ? (
        <div className="photo-pick">
          <img src={photo.preview} alt="" className="thumb" />
          <label className="button secondary small file-btn">{t('changePhoto')}{input}</label>
          <button type="button" className="link" onClick={() => onChange(null)}>{t('removePhoto')}</button>
        </div>
      ) : usage.used < usage.limit && (
        <label className="button secondary file-btn"><Icon name="plus" size={18} /> {t('addPhoto')}{input}</label>
      )}
      {error && <p className="error" role="alert">{t('photoReadFail')}</p>}
    </>
  );
}

/** A private photo. `thumb` loads the small version (lists, history). */
export function Photo({ path, thumb, alt, className }: { path: string; thumb?: boolean; alt: string; className?: string }) {
  const url = usePhotoUrl(thumb ? thumbPath(path) : path);
  return url
    // crossOrigin lets the service worker cache it (no-cors responses can't be cached properly).
    ? <img src={url} alt={alt} className={className} crossOrigin="anonymous" loading="lazy" decoding="async" />
    : <span className={`${className ?? ''} photo-placeholder`} aria-hidden="true" />;
}

/** "Almost full" / "full" note with the way to get more. Nothing when there's plenty of room. */
export function PhotoLimitNote({ usage }: { usage: PhotoUsage }) {
  const { t } = useLang();
  const full = usage.used >= usage.limit;
  if (!full && usage.used < usage.limit - 10) return null;
  const vars = { used: String(usage.used), limit: String(usage.limit) };
  return (
    <p className="warn">
      {full ? t('photoAtLimit', vars) : t('photoNearLimit', vars)}{' '}
      {usage.verified ? t('photoAskMore') : t('photoAskVerify')}{' '}
      <a href={ADMIN_MESSENGER} target="_blank" rel="noreferrer" className="with-icon">
        <Icon name="message" size={18} />{t('messageAdmin')}
      </a>
    </p>
  );
}
