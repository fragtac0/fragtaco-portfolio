// Pure maths for the timeline page: dates counted in UTC days, the grid, and the zoom view.
// Nothing here reads the clock, the window or the machine's time zone.

const DAY_MS = 86_400_000;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

function utcMs(iso: string): number {
  const match = ISO_DATE.exec(iso);
  if (!match) throw new Error(`Not an ISO date (YYYY-MM-DD): ${iso}`);
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const ms = Date.UTC(year, month - 1, day);
  const check = new Date(ms);
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) {
    throw new Error(`Not a real date: ${iso}`);
  }
  return ms;
}

/** Whole days from `startIso` to `iso` (negative before the start). */
export function dayIndex(iso: string, startIso: string): number {
  return Math.round((utcMs(iso) - utcMs(startIso)) / DAY_MS);
}

/** The ISO date `index` days after `startIso`. */
export function dateOfIndex(index: number, startIso: string): string {
  return new Date(utcMs(startIso) + index * DAY_MS).toISOString().slice(0, 10);
}

/** Days from the start to today, both included. 0 when today is before the start. */
export function totalDays(startIso: string, todayIso: string): number {
  return Math.max(0, dayIndex(todayIso, startIso) + 1);
}

/** The role in force on a day: the last role whose `from` is on or before it, or -1 before the first. */
export function roleAt(index: number, roles: { from: string }[], startIso: string): number {
  let found = -1;
  for (let i = 0; i < roles.length; i++) {
    if (dayIndex(roles[i].from, startIso) <= index) found = i;
    else break;
  }
  return found;
}

/** Days per role up to and including today. A role that starts after today counts 0. */
export function roleCounts(roles: { from: string }[], startIso: string, todayIso: string): number[] {
  const total = totalDays(startIso, todayIso);

  return roles.map((role, i) => {
    const first = dayIndex(role.from, startIso);
    const next = i + 1 < roles.length ? dayIndex(roles[i + 1].from, startIso) : Infinity;
    const last = Math.min(next, total) - 1;

    return Math.max(0, last - Math.max(first, 0) + 1);
  });
}

/** 8 weeks across on wide screens, 4 weeks under 700px, so a column is always one weekday. */
export function columnsFor(vw: number): number {
  return vw < 700 ? 28 : 56;
}

export function cellAt(index: number, cols: number): { col: number; row: number } {
  return { col: index % cols, row: Math.floor(index / cols) };
}

/** `scale` is pixels per cell; `x` and `y` are the grid's top-left corner in screen pixels. */
export interface View {
  scale: number;
  x: number;
  y: number;
}

/** The whole grid inside the screen with `margin` on every side, centred. */
export function fitView(cols: number, rows: number, vw: number, vh: number, margin: number): View {
  const scale = Math.min((vw - margin * 2) / cols, (vh - margin * 2) / rows);

  return { scale, x: (vw - cols * scale) / 2, y: (vh - rows * scale) / 2 };
}

/** Zooms by `factor`, limited to `min` and `max`, keeping the grid point under (px, py) where it is. */
export function zoomAt(view: View, factor: number, px: number, py: number, min: number, max: number): View {
  const scale = Math.min(max, Math.max(min, view.scale * factor));
  const ratio = scale / view.scale;

  return { scale, x: px - (px - view.x) * ratio, y: py - (py - view.y) * ratio };
}

/**
 * Keeps the grid in reach: its near edge can pass the middle of the screen no further, so the
 * grid is never more than half a viewport away from the screen on any side.
 */
export function clampView(view: View, cols: number, rows: number, vw: number, vh: number): View {
  const axis = (pos: number, size: number, viewport: number) =>
    Math.min(viewport / 2, Math.max(viewport / 2 - size, pos));

  return {
    scale: view.scale,
    x: axis(view.x, cols * view.scale, vw),
    y: axis(view.y, rows * view.scale, vh),
  };
}

/** The day index under a screen point, or null outside the grid or past the last day. */
export function hitCell(view: View, px: number, py: number, cols: number, total: number): number | null {
  const col = Math.floor((px - view.x) / view.scale);
  const row = Math.floor((py - view.y) / view.scale);
  if (col < 0 || col >= cols || row < 0) return null;
  const index = row * cols + col;

  return index < total ? index : null;
}

/** 0: colour only (under 10px). 1: month names and year rules (10 to 28px). 2: day numbers (over 28px). */
export function detailLevel(scale: number): 0 | 1 | 2 {
  if (scale < 10) return 0;
  return scale <= 28 ? 1 : 2;
}
