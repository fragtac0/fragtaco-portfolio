import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  DOCK_STEP,
  KEEP_FEATHER,
  KEEP_MARGIN,
  keepOutFor,
  keepOutVars,
  maskAlpha,
  nominalDock,
  sameRect,
  settleDock,
  visibleArea,
  type KeepOut,
} from "./ring-keep-out";

const K: KeepOut = { l: 300, r: 700, t: 600, f: 40 };

/** The visible area of a box by brute force: a fine grid of the mask's alpha. */
function brute(k: KeepOut, x0: number, x1: number, y0: number, y1: number, step = 0.5) {
  let sum = 0;
  for (let x = x0 + step / 2; x < x1; x += step) for (let y = y0 + step / 2; y < y1; y += step) sum += maskAlpha(k, x, y) * step * step;
  return sum;
}

describe("the keep-out (R117)", () => {
  it("is clear inside the box and down to the screen's foot, solid beyond the feather, and in between a product of the two ramps", () => {
    expect(maskAlpha(K, 500, 700)).toBe(0);
    expect(maskAlpha(K, 300, 600)).toBe(0);
    expect(maskAlpha(K, 700, 2000)).toBe(0);
    expect(maskAlpha(K, 259, 700)).toBe(1); // beyond the feather across
    expect(maskAlpha(K, 500, 559)).toBe(1); // beyond the feather above
    expect(maskAlpha(K, 280, 700)).toBeCloseTo(0.5, 9); // half way across the feather
    expect(maskAlpha(K, 500, 580)).toBeCloseTo(0.5, 9); // half way down it
    // a corner: both ramps at half, so the hidden share is a quarter and the alpha three quarters
    expect(maskAlpha(K, 280, 580)).toBeCloseTo(0.75, 9);
  });

  it("gives a tile's visible area exactly (the integral of the alpha), for tiles in the clear, in the feather, across the edge and outside", () => {
    const boxes: [number, number, number, number][] = [
      [400, 520, 650, 740], // wholly clear
      [250, 330, 580, 650], // a corner, in both feathers
      [100, 200, 100, 200], // far away
      [650, 760, 560, 700], // across the right edge and the top feather
      [0, 1000, 0, 1000], // everything
    ];
    for (const [x0, x1, y0, y1] of boxes) {
      expect(visibleArea(K, x0, x1, y0, y1), `${x0},${y0}`).toBeCloseTo(brute(K, x0, x1, y0, y1), 0);
    }
    expect(visibleArea(K, 100, 200, 100, 200)).toBeCloseTo(100 * 100, 9);
    expect(visibleArea(K, 400, 520, 650, 740)).toBeCloseTo(0, 9);
    expect(visibleArea(K, 5, 5, 0, 10)).toBe(0);
  });

  it("is built round the dock's glass: its box and the margin, hidden down to the foot, with the feather beyond", () => {
    const dock = { l: 496, t: 763, r: 944, b: 876 };
    const k = keepOutFor(dock);
    expect(k).toEqual({ l: 496 - KEEP_MARGIN, r: 944 + KEEP_MARGIN, t: 763 - KEEP_MARGIN, f: KEEP_FEATHER });
    // nothing shows under any part of the glass
    for (const x of [dock.l, 720, dock.r]) for (const y of [dock.t, 820, dock.b]) expect(maskAlpha(k, x, y)).toBe(0);
    // and a tile just clear of it, past the feather, shows in full
    expect(maskAlpha(k, dock.l - KEEP_MARGIN - KEEP_FEATHER - 1, 820)).toBe(1);
    expect(maskAlpha(k, 720, dock.t - KEEP_MARGIN - KEEP_FEATHER - 1)).toBe(1);
  });

  it("is tight: the hidden box and its feather take under 8% of a laptop screen", () => {
    const k = keepOutFor(nominalDock(1440, 900));
    const hidden = 1440 * 900 - visibleArea(k, 0, 1440, 0, 900);
    expect(hidden / (1440 * 900)).toBeLessThan(0.08);
  });

  it("rounds a measured dock outward to a few pixels and compares boxes", () => {
    const box = settleDock({ l: 495.4, t: 762.2, r: 944.6, b: 875.1 });
    expect(box).toEqual({ l: 492, t: 760, r: 948, b: 876 });
    expect(box.l % DOCK_STEP).toBe(0);
    expect(sameRect(box, { ...box })).toBe(true);
    expect(sameRect(box, null)).toBe(false);
    expect(sameRect(null, null)).toBe(true);
  });

  it("has a nominal dock (the audit's measure, 448 by 113, 24 above the foot; 350 by 93, 12 above it under 640 px) centred at the foot", () => {
    const desk = nominalDock(1440, 900);
    expect(desk.r - desk.l).toBeGreaterThanOrEqual(448);
    expect(desk.r - desk.l).toBeLessThanOrEqual(448 + 2 * DOCK_STEP);
    expect(desk.b - desk.t).toBeGreaterThanOrEqual(113);
    expect(900 - desk.b).toBeGreaterThanOrEqual(24 - DOCK_STEP);
    expect((desk.l + desk.r) / 2).toBe(720);
    const phone = nominalDock(390, 844);
    expect(phone.r - phone.l).toBeGreaterThanOrEqual(350);
    expect(nominalDock(320, 568).r - nominalDock(320, 568).l).toBeLessThanOrEqual(300 + 2 * DOCK_STEP);
  });

  it("hands the stylesheet its four custom properties in pixels", () => {
    expect(keepOutVars({ l: 10, r: 20, t: 30, f: 8 })).toEqual({ "--keep-l": "10px", "--keep-r": "20px", "--keep-t": "30px", "--keep-f": "8px" });
  });
});

describe("the keep-out in the stylesheet (work-keep-out.css)", () => {
  const css = readFileSync(new URL("./work-keep-out.css", import.meta.url), "utf8");
  const across = "linear-gradient(to right, #000 calc(var(--keep-l) - var(--keep-f)), transparent var(--keep-l), transparent var(--keep-r), #000 calc(var(--keep-r) + var(--keep-f)))";
  const down = "linear-gradient(to bottom, #000 calc(var(--keep-t) - var(--keep-f)), transparent var(--keep-t))";

  it("masks the long and short ring groups, and only those, with the across gradient and the down one (what maskAlpha mirrors)", () => {
    expect(css).toContain('.work-ring-group[data-ring="long"],\n.work-ring-group[data-ring="short"] {');
    expect(css).not.toContain('data-ring="stack"');
    for (const prop of ["-webkit-mask-image", "mask-image"]) {
      expect(css.replace(/\s+/g, " ")).toContain(`${prop}: ${across}, ${down};`);
    }
  });

  it("drops the mask from a ring that has a focused tile", () => {
    expect(css).toMatch(/\.work-ring-group:has\(\.work-item-face:focus-visible\) \{\s*-webkit-mask-image: none;\s*mask-image: none;/);
  });

  it("blocks the pointer over the keep-out and half its feather, above the rings", () => {
    const block = /\.work-keep-out \{([^}]*)\}/.exec(css)?.[1] ?? "";
    expect(block).toContain("pointer-events: auto");
    expect(block).toContain("left: calc(var(--keep-l) - var(--keep-f) / 2)");
    expect(block).toContain("width: calc(var(--keep-r) - var(--keep-l) + var(--keep-f))");
    expect(block).toContain("top: calc(var(--keep-t) - var(--keep-f) / 2)");
    expect(block).toContain("bottom: 0");
    expect(block).toContain("z-index: var(--z-cards)");
  });
});
