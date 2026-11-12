// Drawing for the timeline canvas: everything that puts pixels down, given the state to draw. No
// timers, events or DOM reads here (the canvas context is handed in); `timeline-canvas.ts` decides when.
import { GROUND, rgba } from "../../styles/tokens";
import { detailLevel, type View } from "./timeline-math";
import { edgeJitter, fillOf, inkOf, stairPath, type TimelineModel } from "./timeline-model";

export interface DrawState {
  model: TimelineModel;
  view: View;
  /** Screen size in CSS pixels. */
  vw: number;
  vh: number;
  cols: number;
  rows: number;
  hover: number | null;
  focus: number | null;
  /** Today's opacity, 0.7 to 1 (1 when nothing pulses). */
  pulse: number;
  grain: CanvasPattern | null;
}

/** Squares sit this far in from the cell's edge on each side, so the grid lines show between them. */
const INSET = 0.08;
const LINE = "rgba(253, 252, 230, 0.10)";
const RULE = "rgba(253, 252, 230, 0.4)";
const TEXT = "rgba(253, 252, 230, 0.78)";
const MONO = '"IBM Plex Mono", ui-monospace, monospace';

/** One 128px canvas of grey noise, tiled over the squares in `overlay`. */
export function makeGrain(ctx: CanvasRenderingContext2D): CanvasPattern | null {
  const tile = document.createElement("canvas");
  tile.width = 128;
  tile.height = 128;
  const t = tile.getContext("2d");
  if (!t) return null;
  const image = t.createImageData(128, 128);
  for (let i = 0; i < image.data.length; i += 4) {
    const v = Math.floor(Math.random() * 256);
    image.data[i] = image.data[i + 1] = image.data[i + 2] = v;
    image.data[i + 3] = 255;
  }
  t.putImageData(image, 0, 0);

  return ctx.createPattern(tile, "repeat");
}

interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

function squareOf(st: DrawState, index: number): Box {
  const s = st.view.scale;
  const x = st.view.x + (index % st.cols) * s;
  const y = st.view.y + Math.floor(index / st.cols) * s;
  const j = edgeJitter(index);

  return { x0: x + (INSET + j[0]) * s, y0: y + (INSET + j[1]) * s, x1: x + s - (INSET + j[2]) * s, y1: y + s - (INSET + j[3]) * s };
}

/** Adds one square to the path; the first day of a role has its top right corner cut off. */
function addSquare(ctx: CanvasRenderingContext2D, st: DrawState, index: number): void {
  const b = squareOf(st, index);
  if (!st.model.firstDays.has(index)) {
    ctx.rect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
    return;
  }
  const n = 0.32 * (b.x1 - b.x0);
  ctx.moveTo(b.x0, b.y0);
  ctx.lineTo(b.x1 - n, b.y0);
  ctx.lineTo(b.x1, b.y0 + n);
  ctx.lineTo(b.x1, b.y1);
  ctx.lineTo(b.x0, b.y1);
  ctx.closePath();
}

/** The cells on screen, as inclusive row and column ranges (empty when the grid is off screen). */
function visible(st: DrawState): { r0: number; r1: number; c0: number; c1: number } {
  const s = st.view.scale;

  return {
    r0: Math.max(0, Math.floor(-st.view.y / s)),
    r1: Math.min(st.rows - 1, Math.floor((st.vh - st.view.y) / s)),
    c0: Math.max(0, Math.floor(-st.view.x / s)),
    c1: Math.min(st.cols - 1, Math.floor((st.vw - st.view.x) / s)),
  };
}

function visibleCells(st: DrawState): number[] {
  const { r0, r1, c0, c1 } = visible(st);
  const out: number[] = [];
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      const i = r * st.cols + c;
      if (i < st.model.total) out.push(i);
    }
  }

  return out;
}

/** Grid lines between the cells, only over the days that exist (the last row stops at today). */
function drawLines(ctx: CanvasRenderingContext2D, st: DrawState): void {
  const s = st.view.scale;
  if (s < 5 || st.model.total === 0) return;
  const { cols, rows, view, vw, vh } = st;
  const lastRow = st.model.total - (rows - 1) * cols;
  const { r0, r1, c0, c1 } = visible(st);
  ctx.beginPath();
  for (let c = c0; c <= Math.min(cols, c1 + 1); c++) {
    const x = view.x + c * s;
    ctx.moveTo(x, Math.max(0, view.y + r0 * s));
    ctx.lineTo(x, Math.min(vh, view.y + (c <= lastRow ? rows : rows - 1) * s));
  }
  for (let r = r0; r <= Math.min(rows, r1 + 1); r++) {
    const y = view.y + r * s;
    ctx.moveTo(Math.max(0, view.x + c0 * s), y);
    ctx.lineTo(Math.min(vw, view.x + (r === rows ? lastRow : cols) * s), y);
  }
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 1;
  ctx.stroke();
}

/** Flat squares (one fill per run of one colour), today's at its pulse opacity, then the grain over them all. */
function paintCells(ctx: CanvasRenderingContext2D, st: DrawState, cells: number[]): void {
  const today = st.model.total - 1;
  let colour = "";
  let open = false;
  const close = () => {
    if (open) ctx.fill();
    open = false;
  };
  for (const i of cells) {
    if (i === today && st.pulse < 1) continue;
    const fill = fillOf(st.model, i);
    if (fill !== colour) {
      close();
      colour = fill;
      ctx.fillStyle = fill;
      ctx.beginPath();
      open = true;
    }
    addSquare(ctx, st, i);
  }
  close();
  if (cells.includes(today) && st.pulse < 1) {
    ctx.globalAlpha = st.pulse;
    ctx.fillStyle = fillOf(st.model, today);
    ctx.beginPath();
    addSquare(ctx, st, today);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  if (st.grain && cells.length > 0) {
    ctx.save();
    ctx.globalCompositeOperation = "overlay";
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = st.grain;
    ctx.beginPath();
    for (const i of cells) addSquare(ctx, st, i);
    ctx.fill();
    ctx.restore();
  }
}

/** A ring round the square under the pointer or the keyboard's focus: cream on a dark edge, so it shows on every colour. */
function drawRings(ctx: CanvasRenderingContext2D, st: DrawState, only: Set<number> | null): void {
  for (const i of new Set([st.hover, st.focus])) {
    if (i === null || i >= st.model.total || (only && !only.has(i))) continue;
    const s = st.view.scale;
    const x = st.view.x + (i % st.cols) * s;
    const y = st.view.y + Math.floor(i / st.cols) * s;
    const o = Math.max(1, s * INSET * 0.5);
    ctx.strokeStyle = rgba(GROUND, 0.9);
    ctx.lineWidth = 4;
    ctx.strokeRect(x + o, y + o, s - o * 2, s - o * 2);
    ctx.strokeStyle = "#fdfce6";
    ctx.lineWidth = 2;
    ctx.strokeRect(x + o, y + o, s - o * 2, s - o * 2);
  }
}

/** Day numbers (ink chosen for each fill) and the month name on the 1st. Text sizes follow the cell size. */
function drawDays(ctx: CanvasRenderingContext2D, st: DrawState, cells: number[]): void {
  const s = st.view.scale;
  const big = Math.max(10, s * 0.3);
  const small = Math.max(10, s * 0.21);
  ctx.textAlign = "left";
  for (const i of cells) {
    const x = st.view.x + (i % st.cols) * s + s * 0.2;
    const y = st.view.y + Math.floor(i / st.cols) * s + s * 0.2;
    ctx.fillStyle = inkOf(st.model, i);
    ctx.textBaseline = "top";
    ctx.font = `500 ${big}px ${MONO}`;
    ctx.fillText(String(st.model.dayOfMonth[i]), x, y);
    const month = st.model.monthAt.get(i);
    if (month) {
      ctx.textBaseline = "bottom";
      ctx.font = `600 ${small}px ${MONO}`;
      ctx.fillText(month.toUpperCase(), x, y + s * 0.6);
    }
  }
}

/** A label that sits beside the grid; it sticks to the screen's edge, on a dark plate, when the grid has moved off. */
function drawEdgeLabel(
  ctx: CanvasRenderingContext2D,
  st: DrawState,
  text: string,
  y: number,
  side: "left" | "right",
  size: number,
  weight: number,
): void {
  ctx.font = `${weight} ${size}px ${MONO}`;
  ctx.textBaseline = "middle";
  const w = ctx.measureText(text).width;
  const gap = Math.max(6, st.view.scale * 0.4);
  let x = side === "left" ? st.view.x - gap - w : st.view.x + st.cols * st.view.scale + gap;
  const stuck = side === "left" ? x < 6 : x + w > st.vw - 6;
  if (stuck) {
    x = side === "left" ? 6 : st.vw - 6 - w;
    ctx.fillStyle = rgba(GROUND, 0.82);
    ctx.fillRect(x - 3, y - size * 0.7, w + 6, size * 1.4);
  }
  ctx.textAlign = "left";
  ctx.fillStyle = TEXT;
  ctx.fillText(text, x, y);
}

/** Level 1: month names in the left margin at each month's first row (two months in one row share a line), and a rule with its year at each new year. */
function drawMonths(ctx: CanvasRenderingContext2D, st: DrawState): void {
  const s = st.view.scale;
  const size = Math.min(14, Math.max(10, s * 0.5));
  const rows = new Map<number, string[]>();
  for (const m of st.model.monthStarts) {
    const row = Math.floor(m.index / st.cols);
    const y = st.view.y + row * s;
    if (y > st.vh || y + s < 0) continue;
    rows.set(row, [...(rows.get(row) ?? []), m.short]);
  }
  for (const [row, names] of rows) {
    drawEdgeLabel(ctx, st, names.join(" "), st.view.y + (row + 0.5) * s, "left", size, 500);
  }
  for (const m of st.model.monthStarts) {
    if (!m.newYear || m.index === 0) continue;
    const path = stairPath(m.index, st.cols);
    ctx.beginPath();
    path.forEach((p, k) => {
      const px = st.view.x + p.x * s;
      const py = st.view.y + p.y * s;
      if (k === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.strokeStyle = RULE;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    const top = st.view.y + path[path.length - 1].y * s;
    if (top > -size && top < st.vh + size) drawEdgeLabel(ctx, st, String(m.year), top, "right", size, 600);
  }
}

function details(ctx: CanvasRenderingContext2D, st: DrawState, cells: number[]): void {
  const level = detailLevel(st.view.scale);
  if (level >= 1) drawMonths(ctx, st);
  if (level === 2) drawDays(ctx, st, cells);
}

/** The whole picture. */
export function drawFrame(ctx: CanvasRenderingContext2D, st: DrawState): void {
  ctx.clearRect(0, 0, st.vw, st.vh);
  if (st.model.total === 0) return;
  const cells = visibleCells(st);
  drawLines(ctx, st);
  paintCells(ctx, st, cells);
  drawRings(ctx, st, null);
  details(ctx, st, cells);
}

/** The screen box (CSS pixels, a pixel wider on each side) that holds one cell, or null when it is off screen. */
export function cellBox(st: DrawState, index: number): { x: number; y: number; w: number; h: number } | null {
  const s = st.view.scale;
  const x = st.view.x + (index % st.cols) * s;
  const y = st.view.y + Math.floor(index / st.cols) * s;
  if (x + s < 0 || y + s < 0 || x > st.vw || y > st.vh) return null;
  const x0 = Math.floor(x) - 1;
  const y0 = Math.floor(y) - 1;

  return { x: x0, y: y0, w: Math.ceil(x + s) + 1 - x0, h: Math.ceil(y + s) + 1 - y0 };
}

/** Redraws one cell's patch of the picture (the cell and the cells touching it), for the pulse. */
export function drawRegion(ctx: CanvasRenderingContext2D, st: DrawState, index: number): void {
  const box = cellBox(st, index);
  if (!box) return;
  const near: number[] = [];
  const col = index % st.cols;
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const c = col + dc;
      const i = index + dr * st.cols + dc;
      if (c >= 0 && c < st.cols && i >= 0 && i < st.model.total) near.push(i);
    }
  }
  near.sort((a, b) => a - b);
  ctx.save();
  ctx.beginPath();
  ctx.rect(box.x, box.y, box.w, box.h);
  ctx.clip();
  ctx.clearRect(box.x, box.y, box.w, box.h);
  drawLines(ctx, st);
  paintCells(ctx, st, near);
  drawRings(ctx, st, new Set(near));
  details(ctx, st, near);
  ctx.restore();
}
