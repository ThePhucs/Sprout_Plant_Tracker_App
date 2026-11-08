// Light / dark / follow the phone. Saved per device; index.html applies it before the first paint.
export type ThemePref = 'system' | 'light' | 'dark';

const media = window.matchMedia('(prefers-color-scheme: dark)');

export function getThemePref(): ThemePref {
  try {
    const v = localStorage.getItem('theme');
    if (v === 'light' || v === 'dark') return v;
  } catch { /* storage blocked */ }
  return 'system';
}

function apply(pref: ThemePref) {
  const dark = pref === 'dark' || (pref === 'system' && media.matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
}

export function setThemePref(pref: ThemePref) {
  try {
    if (pref === 'system') localStorage.removeItem('theme');
    else localStorage.setItem('theme', pref);
  } catch { /* storage blocked: still applies for this visit */ }
  apply(pref);
}

/** Follow the phone switching between light and dark (e.g. at sunset) while "system" is chosen. */
export function watchSystemTheme() {
  media.addEventListener?.('change', () => apply(getThemePref()));
}
