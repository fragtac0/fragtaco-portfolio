// Pure layout maths for the picked views on /work. No DOM.
import { countLabel } from "../../utils/count-label";

export type ViewId = "all" | "long" | "short" | "clients";

const PHONE_WIDTH = 700;
const COLUMNS = {
  long: [4, 2],
  short: [7, 3],
  clients: [6, 3],
} as const;

export function viewFromSearch(search: string): ViewId {
  const v = new URLSearchParams(search).get("view");
  return v === "long" || v === "short" || v === "clients" ? v : "all";
}

export function viewColumns(view: Exclude<ViewId, "all">, vw: number): number {
  const [wide, narrow] = COLUMNS[view];
  return vw < PHONE_WIDTH ? narrow : wide;
}

/**
 * Brick pattern. Even rows hold `cols` items; odd rows hold `cols - 1`, so they sit half a pitch
 * in. With one column there is nothing to shift, so every row holds one item. Each row is centred
 * in `width` on its own, so a short row (the last one, say) sits in the middle instead of at the
 * left. Positions are top-left corners; a row wider than `width` starts at 0 (size the items with
 * `fitItemWidth` so none is).
 */
export function brickLayout(p: {
  count: number;
  cols: number;
  itemW: number;
  itemH: number;
  gapX: number;
  gapY: number;
  width: number;
  top: number;
}): { x: number; y: number }[] {
  const cols = Number.isFinite(p.cols) ? Math.max(1, Math.floor(p.cols)) : 1;
  const count = Number.isFinite(p.count) ? Math.max(0, Math.floor(p.count)) : 0;
  const pitchX = p.itemW + p.gapX;
  const pitchY = p.itemH + p.gapY;
  const out: { x: number; y: number }[] = [];
  for (let row = 0; out.length < count; row++) {
    const slots = cols > 1 && row % 2 === 1 ? cols - 1 : cols;
    const inRow = Math.min(slots, count - out.length);
    const rowW = inRow * p.itemW + (inRow - 1) * p.gapX;
    const x0 = Math.max(0, (p.width - rowW) / 2);
    for (let i = 0; i < inRow; i++) out.push({ x: x0 + i * pitchX, y: p.top + row * pitchY });
  }
  return out;
}

/** Bottom edge of the lowest item. */
export function contentHeight(positions: { y: number }[], itemH: number): number {
  if (positions.length === 0) return 0;
  return Math.max(...positions.map((q) => q.y)) + itemH;
}

/**
 * The widest item (up to `maxW`) for which `cols` items and their gaps fit in `avail`, so the
 * widest row of a brick layout never runs past the screen.
 */
export function fitItemWidth(p: { cols: number; gapX: number; avail: number; maxW: number }): number {
  const cols = Math.max(1, Math.floor(p.cols));
  const room = (p.avail - (cols - 1) * p.gapX) / cols;
  return Math.max(1, Math.min(p.maxW, Math.floor(room)));
}

export type PickedView = Exclude<ViewId, "all">;

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ViewLayout {
  /** One per item, in item order, in the scrolling stage's own coordinates. */
  boxes: Box[];
  /** Where the content ends, caption zone included (the page adds the dock's height below it). */
  height: number;
  /** Width the caption under an item may use. */
  capW: number;
}

const AVATAR = 72;

/**
 * Where each item of a picked view goes. Long form and short form are brick patterns of covers
 * (16:9 and 9:16) with a caption line under each; clients are avatars in a looser honeycomb with
 * a name, a handle and the socials under each. Sizes come from the screen's width so the widest
 * row fits (`fitItemWidth`).
 */
export function pickedLayout(view: PickedView, count: number, vw: number): ViewLayout {
  const phone = vw < PHONE_WIDTH;
  const margin = phone ? 16 : 48;
  const top = phone ? 112 : 132;
  const cols = viewColumns(view, vw);
  const avail = Math.max(1, vw - 2 * margin);
  let itemW: number;
  let itemH: number;
  let gapX: number;
  let gapY: number;
  let capW: number;

  if (view === "clients") {
    const pitch = Math.min(180, avail / cols);
    itemW = AVATAR;
    itemH = AVATAR;
    gapX = pitch - AVATAR;
    gapY = 104;
    capW = Math.floor(pitch - 8);
  } else {
    const wide = view === "long";
    gapX = phone ? (wide ? 12 : 10) : wide ? 24 : 16;
    itemW = fitItemWidth({ cols, gapX, avail, maxW: wide ? 360 : 180 });
    itemH = Math.round(wide ? (itemW * 9) / 16 : (itemW * 16) / 9);
    gapY = 56;
    capW = itemW;
  }

  const spots = brickLayout({ count, cols, itemW, itemH, gapX, gapY, width: vw, top });
  const boxes = spots.map((q) => ({ x: Math.round(q.x), y: Math.round(q.y), w: itemW, h: itemH }));
  return { boxes, height: contentHeight(spots, itemH) + (count > 0 ? gapY : 0), capW };
}

/**
 * The stack's still row at the top right of a picked view: items at 70% of their ring size, one
 * row on a desktop and two rows of up to four on a phone, each row against the right edge.
 */
export function stackRow(count: number, ringWidth: number, vw: number): Box[] {
  const phone = vw < PHONE_WIDTH;
  const n = Math.max(0, Math.floor(count));
  const size = Math.max(1, Math.round(ringWidth * 0.7));
  const gap = phone ? 6 : 8;
  const margin = phone ? 16 : 24;
  const top = phone ? 20 : 28;
  const perRow = phone ? 4 : Math.max(1, n);
  const out: Box[] = [];
  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / perRow);
    const inRow = Math.min(perRow, n - row * perRow);
    const rowW = inRow * size + (inRow - 1) * gap;
    out.push({
      x: Math.round(vw - margin - rowW + (i % perRow) * (size + gap)),
      y: top + row * (size + gap),
      w: size,
      h: size,
    });
  }
  return out;
}

const VIEW_NAME: Record<PickedView, string> = { long: "Long form", short: "Short form", clients: "Clients" };

/** The picked view's title, shown top left in place of the intro. */
export function viewTitle(view: PickedView): string {
  return VIEW_NAME[view];
}

/** What sits under the title: "16 videos" or "10 clients". */
export function viewCount(view: PickedView, n: number): string {
  return view === "clients" ? countLabel(n, "client", "clients") : countLabel(n, "video", "videos");
}
