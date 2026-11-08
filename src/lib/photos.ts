import { useEffect, useState } from 'react';
import { supabase } from './supabase';

const BUCKET = 'photos';
// Leaves and soil are full of fine detail, which JPEG compresses badly, so one fixed quality can give
// 500 KB+. Step down quality, then size, until the photo fits the budget. Phone screens never need more.
const FULL_MAX_BYTES = 300_000;
const FULL_STEPS: [px: number, quality: number][] = [[1280, 0.8], [1280, 0.65], [1080, 0.6], [900, 0.55]];
const THUMB_PX = 300;

// crypto.randomUUID needs iOS 15.4+; this works on older iPhones too.
const randomId = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');

export const thumbPath = (fullPath: string) => fullPath.replace(/\.jpg$/, '_t.jpg');

/**
 * Shrinks a photo on the phone before upload. Redrawing on a canvas also drops EXIF data,
 * including GPS (relatives' home locations), and turns iPhone HEIC into JPEG.
 * JPEG, not WebP: Safari can't reliably encode WebP.
 */
async function resize(img: HTMLImageElement, maxPx: number, quality: number): Promise<Blob> {
  const scale = Math.min(1, maxPx / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encode failed'))), 'image/jpeg', quality));
}

/** Throws if the browser can't read the file (e.g. HEIC on a Windows PC). */
export async function compressPhoto(file: File): Promise<{ full: Blob; thumb: Blob }> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode(); // browsers apply the photo's rotation (EXIF orientation) when drawing
    let full!: Blob;
    for (const [px, q] of FULL_STEPS) {
      full = await resize(img, px, q);
      if (full.size <= FULL_MAX_BYTES) break; // otherwise keep the smallest attempt
    }
    return { full, thumb: await resize(img, THUMB_PX, 0.75) };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Uploads both sizes into the signed-in user's folder; returns the full image's path. Cleans up if the second upload fails. */
export async function uploadPhoto(photo: { full: Blob; thumb: Blob }): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('not signed in');
  const path = `${session.user.id}/${randomId()}.jpg`;
  const bucket = supabase.storage.from(BUCKET);
  const opts = { contentType: 'image/jpeg', cacheControl: '31536000' };
  const a = await bucket.upload(path, photo.full, opts);
  if (a.error) throw a.error;
  const b = await bucket.upload(thumbPath(path), photo.thumb, opts);
  if (b.error) {
    await bucket.remove([path]);
    throw b.error;
  }
  return path;
}

/** Best effort: anything left behind is removed by the Worker's weekly clean-up. */
export async function removePhotos(fullPaths: string[]) {
  if (fullPaths.length) await supabase.storage.from(BUCKET).remove(fullPaths.flatMap((p) => [p, thumbPath(p)]));
}

export type PhotoUsage = { used: number; limit: number; verified: boolean };

export async function photoUsage(): Promise<PhotoUsage | null> {
  const { data } = await supabase.rpc('my_photo_usage');
  return (data as PhotoUsage | null) ?? null;
}

// ── Showing photos ──────────────────────────────────────────────────────────
// Private photos need signed links. Requests made in the same moment are batched into one call,
// and links are reused for 50 minutes. The service worker caches the images themselves by path,
// so each photo downloads once per phone (protects the free bandwidth).
const LINK_TTL_S = 3600;
const links = new Map<string, { url: string; until: number }>();
let pending: { path: string; resolve: (u: string | null) => void }[] = [];

function flush() {
  const batch = pending;
  pending = [];
  const paths = [...new Set(batch.map((b) => b.path))];
  supabase.storage.from(BUCKET).createSignedUrls(paths, LINK_TTL_S).then(({ data }) => {
    for (const row of data ?? []) {
      if (row.signedUrl && row.path) links.set(row.path, { url: row.signedUrl, until: Date.now() + (LINK_TTL_S - 600) * 1000 });
    }
    batch.forEach((b) => b.resolve(links.get(b.path)?.url ?? null));
  }, () => batch.forEach((b) => b.resolve(null)));
}

function signedUrl(path: string): Promise<string | null> {
  const hit = links.get(path);
  if (hit && hit.until > Date.now()) return Promise.resolve(hit.url);
  return new Promise((resolve) => {
    if (!pending.length) queueMicrotask(flush);
    pending.push({ path, resolve });
  });
}

export function usePhotoUrl(path: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    setUrl(null);
    if (path) signedUrl(path).then((u) => alive && setUrl(u));
    return () => { alive = false; };
  }, [path]);
  return url;
}
