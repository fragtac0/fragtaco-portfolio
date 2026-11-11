// Pure layout maths for the picked views on /work. No DOM.

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
 * Brick pattern. Even rows hold `cols` items; odd rows hold `cols - 1`, shifted
 * right by half a pitch. With one column there is nothing to shift, so every row
 * holds one item. Positions are top-left corners; the block is centred in
 * `width` and never starts left of 0.
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
  const blockW = cols * p.itemW + (cols - 1) * p.gapX;
  const x0 = Math.max(0, (p.width - blockW) / 2);
  const out: { x: number; y: number }[] = [];
  for (let row = 0; out.length < count; row++) {
    const odd = cols > 1 && row % 2 === 1;
    const inRow = odd ? cols - 1 : cols;
    const shift = odd ? pitchX / 2 : 0;
    for (let i = 0; i < inRow && out.length < count; i++) {
      out.push({ x: x0 + shift + i * pitchX, y: p.top + row * pitchY });
    }
  }
  return out;
}

/** Bottom edge of the lowest item. */
export function contentHeight(positions: { y: number }[], itemH: number): number {
  if (positions.length === 0) return 0;
  return Math.max(...positions.map((q) => q.y)) + itemH;
}
