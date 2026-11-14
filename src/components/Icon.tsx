// Simple 24×24 line icons, drawn for Sprout so they look the same on every phone (emoji don't).
const PATHS = {
  calendar: 'M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM4 10h16M9 3v4M15 3v4',
  sprout: 'M12 21v-8M12 13c0-4.4 3-7 8-7 0 4.6-3 7-8 7zM12 15c0-3.3-2.2-5.5-7-5.5 0 3.6 2.4 5.5 7 5.5z',
  settings: 'M4 7h9M17 7h3M4 17h3M11 17h9',
  drop: 'M12 3.5s-6 6.4-6 10.7a6 6 0 0 0 12 0c0-4.3-6-10.7-6-10.7z',
  pin: 'M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11zM12 12.2a2.2 2.2 0 1 0 0-4.4 2.2 2.2 0 0 0 0 4.4z',
  bell: 'M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0',
  message: 'M5 4.5h14a1.5 1.5 0 0 1 1.5 1.5v9a1.5 1.5 0 0 1-1.5 1.5H10l-5 4v-4a1.5 1.5 0 0 1-1.5-1.5V6A1.5 1.5 0 0 1 5 4.5z',
  back: 'M15 5l-7 7 7 7',
  forward: 'M9 5l7 7-7 7',
  down: 'M6 9l6 6 6-6',
  close: 'M6 6l12 12M18 6L6 18',
  plus: 'M12 5v14M5 12h14',
  heart: 'M12 20.5s-7.5-4.6-8.9-9.4C2.2 7.8 4.4 5 7.4 5c2 0 3.6 1.2 4.6 2.8C13 6.2 14.6 5 16.6 5c3 0 5.2 2.8 4.3 6.1-1.4 4.8-8.9 9.4-8.9 9.4z',
  // two neighbours' sprouts: the shared garden
  garden: 'M3 20h18M7 20v-5M7 15c0-2.5-1.7-4-4-4 0 2.3 1.7 4 4 4zM16 20v-8M16 12c0-3 2-5 5-5 0 3-2 5-5 5zM16 15.5c0-2-1.4-3.4-3.6-3.4 0 2 1.4 3.4 3.6 3.4z',
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 20, className, filled }: { name: IconName; size?: number; className?: string; filled?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={`icon ${className ?? ''}`} aria-hidden="true"
      fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d={PATHS[name]} />
      {/* the two knobs of the "settings" sliders */}
      {name === 'settings' && <><circle cx="15" cy="7" r="2" /><circle cx="9" cy="17" r="2" /></>}
    </svg>
  );
}
