// The pixel and DOM comparisons of make-arrival.mjs (R56, round 7 change-arrival spec 5.4).
import sharp from "sharp";

export const LUMA_STEP = 25;
/** A masked 32 px cell counts as changed when its mean luma moves by more than this (the wall's tiles are the same picture drawn two ways: a rim differs by a few levels, a tile that swaps or dips by tens). */
export const CELL_LEVELS = 12;

export async function luma(png) {
  const { data, info } = await sharp(png).greyscale().raw().toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height };
}
const share = (n, of) => +((100 * n) / Math.max(1, of)).toFixed(3);
/** The share of pixels that differ by more than LUMA_STEP, over everything and outside the masked boxes (device pixels), and the coarse difference inside them. */
export function compare(a, b, masks) {
  const { w, h } = a;
  const inMask = new Uint8Array(w * h);
  for (const m of masks) for (let y = Math.max(0, m.y0); y < Math.min(h, m.y1); y++) inMask.fill(1, y * w + Math.max(0, m.x0), y * w + Math.min(w, m.x1));
  let all = 0, outside = 0, outsideCount = 0;
  for (let i = 0; i < w * h; i++) {
    const d = Math.abs(a.data[i] - b.data[i]) > LUMA_STEP;
    if (d) all++;
    if (!inMask[i]) {
      outsideCount++;
      if (d) outside++;
    }
  }
  const CELL = 32;
  let cells = 0, sum = 0, worst = 0, over = 0;
  for (let cy = 0; cy < h; cy += CELL)
    for (let cx = 0; cx < w; cx += CELL) {
      let sa = 0, sb = 0, n = 0, masked = 0;
      for (let y = cy; y < Math.min(h, cy + CELL); y++)
        for (let x = cx; x < Math.min(w, cx + CELL); x++) {
          const i = y * w + x;
          sa += a.data[i];
          sb += b.data[i];
          n++;
          masked += inMask[i];
        }
      if (masked < n / 2) continue;
      const d = Math.abs(sa - sb) / n;
      cells++;
      sum += d;
      worst = Math.max(worst, d);
      if (d > CELL_LEVELS) over++;
    }
  return { pct: share(all, w * h), pctOutside: share(outside, outsideCount), maskedCells: cells, maskedMeanDiff: cells ? +(sum / cells).toFixed(2) : 0, maskedWorstCell: +worst.toFixed(1), maskedOverShare: cells ? share(over, cells) : 0 };
}

export function domChanges(e, l) {
  const appeared = [], disappeared = [], resized = [], moved = [], swapped = [], faded = [];
  for (const [k, a] of Object.entries(e.els)) {
    const b = l.els[k];
    if (!b) {
      if (a.shown) disappeared.push(a.n);
      continue;
    }
    if (!a.shown && b.shown) appeared.push(b.n);
    else if (a.shown && !b.shown) disappeared.push(a.n);
    else if (a.shown && b.shown) {
      if (Math.abs(a.w - b.w) > 1 || Math.abs(a.h - b.h) > 1) resized.push(`${a.n} ${Math.round(a.w)}x${Math.round(a.h)}->${Math.round(b.w)}x${Math.round(b.h)}`);
      else if (Math.abs(a.x - b.x) > 1 || Math.abs(a.y - b.y) > 1) moved.push(a.n);
      if (Math.abs(a.op - b.op) > 0.3) faded.push(`${a.n} ${a.op}->${b.op}`);
      if (a.src !== b.src) swapped.push(a.n);
    }
  }
  for (const [k, b] of Object.entries(l.els)) if (!e.els[k] && b.shown) appeared.push(b.n);
  const ringsSwapped = e.ringPictures.length !== l.ringPictures.length || e.ringPictures.some((p, i) => p.src !== l.ringPictures[i].src);
  // a ring picture the window shows that came in or changed opacity between E and L (the rings' boxes are masked in the pixels, so this is what sees a cover that is late)
  const ringsFaded = e.ringPictures.length === l.ringPictures.length ? e.ringPictures.filter((p, i) => p.vis && (p.ready !== l.ringPictures[i].ready || Math.abs(p.op - l.ringPictures[i].op) > 0.05)).length : 0;
  const wallSwapped = e.wallPictures.length !== l.wallPictures.length || e.wallPictures.some((s, i) => s !== l.wallPictures[i]);
  return { appeared, disappeared, resized, moved, swapped, faded, ringsSwapped, ringsFaded, wallSwapped, wallDrawnAtE: e.drawn, wallDrawnAtL: l.drawn };
}

export const sameBox = (p, q) => !!p && !!q && Math.abs(p.x - q.x) <= 1 && Math.abs(p.y - q.y) <= 1 && Math.abs(p.w - q.w) <= 1 && Math.abs(p.h - q.h) <= 1;
