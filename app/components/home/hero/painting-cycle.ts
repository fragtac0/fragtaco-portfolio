/** Pure helpers for the hero's painting order, timing and image size. */

export const RECENT_KEY = "heroRecentPaintings";
export const RECENT_LIMIT = 3;

/** "50% 30%" becomes [0.5, 0.3]; anything unparseable is the centre. */
export function parseFocal(focal: string): [number, number] {
  const m = /^\s*(-?\d+(?:\.\d+)?)%\s+(-?\d+(?:\.\d+)?)%\s*$/.exec(focal);
  if (!m) return [0.5, 0.5];
  return [parseFloat(m[1]) / 100, parseFloat(m[2]) / 100];
}

/** Random painting for the session's first reveal, excluding recent ids (unless all are recent). */
export function pickFirst<T extends { id: string }>(
  items: T[],
  recent: string[],
  random: () => number,
): T {
  const fresh = items.filter((i) => recent.indexOf(i.id) === -1);
  const pool = fresh.length > 0 ? fresh : items;
  return pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))];
}

/** Permutation of 0..length-1 that starts with `first`; the rest are Fisher-Yates shuffled. */
export function makeOrder(length: number, first: number, random: () => number): number[] {
  const rest: number[] = [];
  for (let i = 0; i < length; i++) if (i !== first) rest.push(i);
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const t = rest[i];
    rest[i] = rest[j];
    rest[j] = t;
  }
  return [first, ...rest];
}

/** 15 to 20 s between painting changes. */
export function nextDelayMs(random: () => number): number {
  return 15000 + random() * 5000;
}

/** 1600 px copy when the effective width is at most 1400, else the 2560 px copy. */
export function paintingSrc(file: string, viewportWidth: number, dpr: number): string {
  const size = viewportWidth * Math.min(dpr, 1.5) <= 1400 ? 1600 : 2560;
  return `/paintings/${size}/${file}`;
}
