import { useEffect, useState } from 'react';

// A tiny router on the History API: phone back buttons and swipes just work.
const listeners = new Set<() => void>();

export function navigate(path: string, opts: { replace?: boolean } = {}) {
  if (path === location.pathname) return;
  history[opts.replace ? 'replaceState' : 'pushState']({ inApp: !opts.replace || history.state?.inApp }, '', path);
  listeners.forEach((l) => l());
  window.scrollTo(0, 0);
}

/** Go back inside the app, or to `fallback` when the page was opened directly (e.g. from a notification). */
export function goBack(fallback: string) {
  if (history.state?.inApp) history.back();
  else navigate(fallback, { replace: true });
}

export function usePath() {
  const [path, setPath] = useState(location.pathname);
  useEffect(() => {
    const update = () => setPath(location.pathname);
    listeners.add(update);
    window.addEventListener('popstate', update);
    return () => { listeners.delete(update); window.removeEventListener('popstate', update); };
  }, []);
  return path;
}
