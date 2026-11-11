// The timeline's data made ready for drawing: the role of every day worked out once (never inside the
// draw loop), the first day of each role, the marked days, the month starts, and the small pure helpers
// the drawing uses (dates in words, ink colour, the year rule). Nothing here reads the clock or the window.
import type { SiteTimeline } from "../../types";
import { dateOfIndex, dayIndex, roleCounts, totalDays } from "./timeline-math";

export const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** The bright yellow of a marked day (the F1 graphic's title squares). */
export const MARK_COLOR = "#FFD60A";
const DARK_INK = "#0b0907";
const LIGHT_INK = "#fdfce6";

export interface MonthStart {
  /** Day index of the 1st. */
  index: number;
  /** Short name: "Dec". */
  short: string;
  year: number;
  /** True for a 1 January: the year rule and its number are drawn here. */
  newYear: boolean;
}

export interface TimelineModel {
  start: string;
  total: number;
  /** The role of each day (an index into `roles`), or -1 before the first role. */
  roleOfDay: Int8Array;
  roles: { id: string; label: string; color: string; ink: string }[];
  /** Day indexes that are a role's first day, with that role's index. */
  firstDays: Map<number, number>;
  /** Marked days (past today dropped) and their labels. */
  marks: Map<number, string>;
  monthStarts: MonthStart[];
  /** The 1st of each month: day index to the month's short name, for the name on that square. */
  monthAt: Map<number, string>;
  /** The day of the month (1 to 31) of each day. */
  dayOfMonth: Uint8Array;
}

/** "11 November 2026" from "2026-11-11". */
export function formatLongDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);

  return `${day} ${MONTHS[month - 1]} ${year}`;
}

function channel(hex: string, from: number): number {
  const v = parseInt(hex.slice(from, from + 2), 16) / 255;

  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

/** WCAG relative luminance of `#rrggbb`. */
export function luminance(hex: string): number {
  return 0.2126 * channel(hex, 1) + 0.7152 * channel(hex, 3) + 0.0722 * channel(hex, 5);
}

/** The ink (dark or cream) with the better contrast on a fill, chosen by the fill's luminance. */
export function inkFor(hex: string): string {
  const l = luminance(hex);
  const onDark = (l + 0.05) / (luminance(DARK_INK) + 0.05);
  const onLight = (luminance(LIGHT_INK) + 0.05) / (l + 0.05);

  return onDark >= onLight ? DARK_INK : LIGHT_INK;
}

/** The first day of every month from `start` to `total` days. */
function monthStartsOf(start: string, total: number): MonthStart[] {
  const out: MonthStart[] = [];
  if (total === 0) return out;
  const first = dateOfIndex(0, start);
  let year = Number(first.slice(0, 4));
  let month = Number(first.slice(5, 7));
  // the month of the start day itself counts when the start is a 1st; otherwise begin with the next month
  if (first.slice(8) !== "01") month++;

  for (;;) {
    if (month > 12) {
      month = 1;
      year++;
    }
    const iso = `${year}-${String(month).padStart(2, "0")}-01`;
    const index = dayIndex(iso, start);
    if (index >= total) break;
    out.push({ index, short: MONTHS[month - 1].slice(0, 3), year, newYear: month === 1 });
    month++;
  }

  return out;
}

/** Builds the per-day tables for `total` days (from `start` to `today`). */
export function buildModel(data: SiteTimeline, today: string): TimelineModel {
  const total = totalDays(data.start, today);
  const roleOfDay = new Int8Array(total).fill(-1);
  const firstDays = new Map<number, number>();
  const starts = data.roles.map((role) => dayIndex(role.from, data.start));

  data.roles.forEach((_, i) => {
    const from = Math.max(0, starts[i]);
    const to = Math.min(total, i + 1 < starts.length ? starts[i + 1] : total);
    if (from < to) {
      roleOfDay.fill(i, from, to);
      firstDays.set(from, i);
    }
  });

  const marks = new Map<number, string>();
  for (const mark of data.marks) {
    const index = dayIndex(mark.date, data.start);
    if (index >= 0 && index < total) marks.set(index, mark.label);
  }

  const monthStarts = monthStartsOf(data.start, total);
  const dayOfMonth = new Uint8Array(total);
  for (let i = 0; i < total; i++) dayOfMonth[i] = Number(dateOfIndex(i, data.start).slice(8));

  return {
    start: data.start,
    total,
    roleOfDay,
    roles: data.roles.map((r) => ({ id: r.id, label: r.label, color: r.color, ink: inkFor(r.color) })),
    firstDays,
    marks,
    monthStarts,
    monthAt: new Map(monthStarts.map((m) => [m.index, m.short])),
    dayOfMonth,
  };
}

/** The cell's fill colour: a marked day is yellow, otherwise its role's colour. */
export function fillOf(model: TimelineModel, index: number): string {
  if (model.marks.has(index)) return MARK_COLOR;
  const role = model.roleOfDay[index];

  return role >= 0 ? model.roles[role].color : "transparent";
}

/** The ink for the number on a cell. */
export function inkOf(model: TimelineModel, index: number): string {
  if (model.marks.has(index)) return inkFor(MARK_COLOR);
  const role = model.roleOfDay[index];

  return role >= 0 ? model.roles[role].ink : LIGHT_INK;
}

/**
 * The line between the days before `index` and the days from it, in cell units: along the top of its
 * row from its column to the right edge, up the left side of the cell, then back along the bottom of
 * the row above to the left edge (a straight line when `index` starts a row).
 */
export function stairPath(index: number, cols: number): { x: number; y: number }[] {
  const col = index % cols;
  const row = Math.floor(index / cols);
  if (col === 0) return [{ x: 0, y: row }, { x: cols, y: row }];

  return [
    { x: 0, y: row + 1 },
    { x: col, y: row + 1 },
    { x: col, y: row },
    { x: cols, y: row },
  ];
}

/** A small, fixed wobble (as a fraction of the cell) for each side of a square, so edges read like ink on paper. */
export function edgeJitter(index: number): [number, number, number, number] {
  const side = (k: number) => {
    let h = Math.imul(index + 1, 374761393) ^ Math.imul(k + 1, 668265263);
    h = Math.imul(h ^ (h >>> 13), 1274126177);

    return (((h ^ (h >>> 16)) >>> 0) / 4294967296 - 0.5) * 0.03;
  };

  return [side(0), side(1), side(2), side(3)];
}

/** What the tooltip and the screen reader say for a day. */
export function describeDay(model: TimelineModel, index: number): { date: string; iso: string; role: string; mark: string | null } {
  const iso = dateOfIndex(index, model.start);
  const role = model.roleOfDay[index];

  return {
    iso,
    date: formatLongDate(iso),
    role: role >= 0 ? model.roles[role].label : "",
    mark: model.marks.get(index) ?? null,
  };
}

/** "Dec 2020" from "2020-12-01". */
export function formatMonthYear(iso: string): string {
  const [year, month] = iso.split("-").map(Number);

  return `${MONTHS[month - 1].slice(0, 3)} ${year}`;
}

export interface RoleSummary {
  id: string;
  label: string;
  color: string;
  days: number;
  /** First and last day it covered (up to today); null for a role that has not started yet. */
  from: string | null;
  to: string | null;
}

/** Each role with its day count and the dates it covered, for the legend and the screen-reader table. */
export function summariseRoles(data: SiteTimeline, today: string): RoleSummary[] {
  const counts = roleCounts(data.roles, data.start, today);

  return data.roles.map((role, i) => {
    const first = Math.max(0, dayIndex(role.from, data.start));

    return {
      id: role.id,
      label: role.label,
      color: role.color,
      days: counts[i],
      from: counts[i] > 0 ? dateOfIndex(first, data.start) : null,
      to: counts[i] > 0 ? dateOfIndex(first + counts[i] - 1, data.start) : null,
    };
  });
}
