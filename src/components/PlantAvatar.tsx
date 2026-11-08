import type { PlantColor, PlantIcon } from '../../shared/plants';
import { Photo } from './Photo';

// The same 24×24 icons as the Android app. Pots are filled, plants are outlined.
const POT = ['M6.5,15.5h11v2h-11z', 'M7.5,18h9l-1,4h-7z'];
const ICONS: Record<PlantIcon, { fill: string[]; stroke: [string, number][] }> = {
  SEEDLING: { fill: POT, stroke: [
    ['M12,15.5V8.5', 1.5], ['M12,10.5C11.5,7.5 9,6 5.5,6.5C5.5,9.5 8,11.5 12,10.5z', 1.5],
    ['M12,9C12.5,6 15,4.5 18.5,5C18.5,8 16,10 12,9z', 1.5]] },
  MONSTERA: { fill: POT, stroke: [
    ['M12,11.5C13,12.8 15.5,13.2 16.8,12.3L14.4,10.6L17.9,10.9C18.4,10 18.6,9 18.6,8.2L15.2,8L18.3,6.2C17.4,3.8 15,2.5 12,2.5C9,2.5 6.6,3.8 5.7,6.2L8.8,8L5.4,8.2C5.4,9 5.6,10 6.1,10.9L9.6,10.6L7.2,12.3C8.5,13.2 11,12.8 12,11.5z', 1.5],
    ['M12,15.5V5', 1.3]] },
  FERN: { fill: POT, stroke: [
    ['M12,15.5V3.5', 1.3],
    ['M12,6.5l-2.2,-1.5M12,6.5l2.2,-1.5M12,9.5l-2.6,-1.6M12,9.5l2.6,-1.6M12,12.5l-2.6,-1.5M12,12.5l2.6,-1.5', 1.3],
    ['M11.2,15.5Q7.5,14 4.5,9.5M7.75,13.25l-0.4,-2M7.75,13.25l-1.9,0.7M5.74,11.18l-0.1,-1.7M5.74,11.18l-1.6,0.5', 1.3],
    ['M12.8,15.5Q16.5,14 19.5,9.5M16.25,13.25l0.4,-2M16.25,13.25l1.9,0.7M18.26,11.18l0.1,-1.7M18.26,11.18l1.6,0.5', 1.3]] },
  SNAKE_PLANT: { fill: POT, stroke: [
    ['M10.8,15.5C10.3,11 11,6 12,2.5C13,6 13.7,11 13.2,15.5', 1.5],
    ['M7.8,15.5C7.2,12 7,9 8,6C9.3,9 10,12 10.2,15.5', 1.5],
    ['M13.8,15.5C14,12 14.7,9 16,6.5C17,9.5 16.8,12 16.2,15.5', 1.5]] },
  SUCCULENT: { fill: POT, stroke: [
    ['M12,14.5Q9.9,10 12,5.5Q14.1,10 12,14.5z', 1.5], ['M12,14.5Q10.78,9.96 6.5,8Q7.72,12.54 12,14.5z', 1.5],
    ['M12,14.5Q13.22,9.96 17.5,8Q16.28,12.54 12,14.5z', 1.5], ['M12,14.5Q8.71,11.76 4.5,12.5Q7.79,15.24 12,14.5z', 1.5],
    ['M12,14.5Q15.29,11.76 19.5,12.5Q16.21,15.24 12,14.5z', 1.5]] },
  CACTUS: { fill: POT, stroke: [['M12,14.5V5.5', 3.2], ['M11.5,11.5H8.75V8.75', 2.2], ['M12.5,9.5H15.25V6.5', 2.2]] },
  TULIP: { fill: POT, stroke: [
    ['M12,15.5V9.5', 1.5], ['M12,15C9,14 8,11.5 8.5,9.5C10.5,10.5 11.6,12.5 12,15z', 1.5],
    ['M12,15C15,14 16,11.5 15.5,9.5C13.5,10.5 12.4,12.5 12,15z', 1.5],
    ['M8.5,3.8L10.2,5.6L12,3.2L13.8,5.6L15.5,3.8V6.5C15.5,8.5 14,9.5 12,9.5C10,9.5 8.5,8.5 8.5,6.5z', 1.5]] },
  DAISY: { fill: ['M12,8m-2,0a2,2 0 1,0 4,0a2,2 0 1,0 -4,0'], stroke: [
    ['M15.2,8L17.6,8M14.26,10.26L15.96,11.96M9.74,10.26L8.04,11.96M8.8,8L6.4,8M9.74,5.74L8.04,4.04M12,4.8L12,2.4M14.26,5.74L15.96,4.04', 2],
    ['M12,11.2V21.5', 1.5], ['M12,18.5C13,16 15,15.3 17.2,15.8C16.2,18 14.2,18.9 12,18.5z', 1.5],
    ['M12,16C11,14.2 9.2,13.6 7.2,14C8,15.8 9.8,16.5 12,16z', 1.5]] },
};

export function PlantGlyph({ icon, size = 24 }: { icon: PlantIcon; size?: number }) {
  const { fill, stroke } = ICONS[icon];
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      {fill.map((d) => <path key={d} d={d} fill="currentColor" />)}
      {stroke.map(([d, w]) => (
        <path key={d} d={d} fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </svg>
  );
}

/** The plant's photo when it has one, otherwise its icon on its colour. */
export function PlantAvatar({ icon, color, photo, size = 48 }: {
  icon: PlantIcon; color: PlantColor; photo?: string | null; size?: number;
}) {
  return (
    <span className={`avatar c-${color.toLowerCase()}`} style={{ width: size, height: size }}>
      {photo
        ? <Photo path={photo} thumb alt="" className="avatar-photo" />
        : <PlantGlyph icon={icon} size={Math.round(size * 0.6)} />}
    </span>
  );
}
