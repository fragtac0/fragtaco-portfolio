import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SiteBook } from "~/types";
import {
  FADE_SECONDS,
  MAX_FADES,
  createSpineFace,
  firstColours,
  resizeSpines,
  retintSpine,
  showSpinePhoto,
  spinePixels,
  stepSpineFades,
  type SpineBook,
} from "./shelf-spines";
import { contrast } from "./spine-styles";

/** A canvas stand-in: sizes and a context that records what was drawn. */
type FakeCanvas = {
  width: number;
  height: number;
  drawn: { fn: string; alpha: number }[];
  getContext(): unknown;
};
const made: FakeCanvas[] = [];
function fakeCanvas(): FakeCanvas {
  const state = { globalAlpha: 1, font: "", fillStyle: "", strokeStyle: "", lineWidth: 1 };
  const c: FakeCanvas = {
    width: 0,
    height: 0,
    drawn: [],
    getContext: () =>
      new Proxy(state, {
        get(t, k: string) {
          if (k in t) return (t as Record<string, unknown>)[k];
          if (k === "measureText") return (s: string) => ({ width: s.length * 5 });
          return () => c.drawn.push({ fn: k, alpha: t.globalAlpha });
        },
        set(t, k: string, v) {
          (t as Record<string, unknown>)[k] = v;
          return true;
        },
      }),
  };
  made.push(c);
  return c;
}

const book = (over: Partial<SiteBook> = {}): SiteBook => ({
  id: "story",
  title: "Story",
  author: "Robert McKee",
  pages: 466,
  isbn: "9780060391683",
  heightIn: 9.5,
  aspect: 0.66,
  color: "#151312",
  style: "band",
  note: "n",
  ...over,
});

function spineBook(d = book(), size = { w: 90, h: 600 }): SpineBook & { disposed: number; uploads: number } {
  const state = { disposed: 0, uploads: 0 };
  const tex = {
    dispose: () => state.disposed++,
    set needsUpdate(_: boolean) {
      state.uploads++;
    },
  };
  const spine = createSpineFace(d, size, () => tex as never);
  return Object.assign(state, { d, spine, H: 1.6, T: 0.26 });
}

beforeEach(() => {
  made.length = 0;
  vi.stubGlobal("document", { createElement: () => fakeCanvas() });
});
afterEach(() => vi.unstubAllGlobals());

describe("spinePixels", () => {
  it("is the on-screen size times the pixel ratio, at most 2", () => {
    expect(spinePixels(0.26, 1.6, 375, 1)).toEqual({ w: 98, h: 600 });
    expect(spinePixels(0.26, 1.6, 375, 2)).toEqual({ w: 195, h: 1200 });
    expect(spinePixels(0.26, 1.6, 375, 3)).toEqual({ w: 195, h: 1200 });
    expect(spinePixels(0.26, 1.6, 375, 0.5)).toEqual({ w: 98, h: 600 });
  });
  it("never goes under 8 pixels", () => {
    expect(spinePixels(0.001, 0.001, 1, 1)).toEqual({ w: 8, h: 8 });
  });
});

describe("firstColours", () => {
  it("is the book's own colour with ink that reads on it", () => {
    for (const hex of ["#151312", "#ece6d6", "#c21f2b", "#8a6a4a"]) {
      const c = firstColours(hex);
      expect(contrast(c.ink, c.ground)).toBeGreaterThanOrEqual(4.5);
    }
    expect(firstColours("#151312").ground).toBe("#151312");
  });
});

describe("a spine face", () => {
  it("is painted when made, at the size given", () => {
    const b = spineBook();
    expect(b.spine.canvas.width).toBe(90);
    expect(b.spine.canvas.height).toBe(600);
    expect((b.spine.canvas as unknown as FakeCanvas).drawn.some((d) => d.fn === "fillText")).toBe(true);
    expect(b.spine.style).toBeGreaterThanOrEqual(0);
  });

  it("goes over to the cover's colours at once without animation", () => {
    const b = spineBook();
    const before = b.uploads;
    retintSpine(b, { ground: "#a8352a", ink: "#f6f0e2", accent: "#f6f0e2" }, false);
    expect(b.spine.colours.ground).toBe("#a8352a");
    expect(b.spine.fade).toBeNull();
    expect(b.uploads).toBe(before + 1);
  });

  it("crossfades to the cover's colours over the fade time, then lets the helper canvases go", () => {
    const b = spineBook();
    retintSpine(b, { ground: "#a8352a", ink: "#f6f0e2", accent: "#f6f0e2" }, true);
    expect(b.spine.fade).not.toBeNull();
    const live = b.spine.canvas as unknown as FakeCanvas;
    live.drawn.length = 0;
    expect(stepSpineFades([b], FADE_SECONDS / 2)).toBe(true);
    const alphas = live.drawn.filter((d) => d.fn === "drawImage").map((d) => d.alpha);
    expect(alphas).toEqual([1, 0.5]);
    const { from, to } = b.spine.fade!;
    expect(stepSpineFades([b], FADE_SECONDS)).toBe(false);
    expect(b.spine.fade).toBeNull();
    expect([from.width, from.height, to.width, to.height]).toEqual([0, 0, 0, 0]);
    expect(stepSpineFades([b], 1)).toBe(false);
  });

  it("runs only a few crossfades at once; the rest wait showing the old look, then take their turn", () => {
    const bs = Array.from({ length: 7 }, () => spineBook());
    for (const b of bs) retintSpine(b, { ground: "#a8352a", ink: "#f6f0e2", accent: "#f6f0e2" }, true);
    const drawn = () => bs.map((b) => (b.spine.canvas as unknown as FakeCanvas).drawn.length);
    const before = drawn();
    expect(stepSpineFades(bs, 0.1)).toBe(true);
    const moved = drawn().filter((n, i) => n > before[i]);
    expect(moved).toHaveLength(MAX_FADES);
    expect(bs.filter((b) => b.spine.fade?.live)).toHaveLength(MAX_FADES);
    let frames = 0;
    while (stepSpineFades(bs, 0.1) && frames < 200) {
      frames++;
      expect(bs.filter((b) => b.spine.fade?.live).length).toBeLessThanOrEqual(MAX_FADES);
    }
    expect(bs.every((b) => b.spine.fade === null)).toBe(true);
    expect(frames).toBeLessThan(200);
  });

  it("keeps the picture when it has one, and shows it when it arrives", () => {
    const b = spineBook(book({ spine: "/books/story-spine.webp" }));
    const img = { naturalWidth: 90, naturalHeight: 600 } as HTMLImageElement;
    showSpinePhoto(b, img, false);
    expect(b.spine.photo).toBe(img);
    const live = b.spine.canvas as unknown as FakeCanvas;
    live.drawn.length = 0;
    retintSpine(b, { ground: "#a8352a", ink: "#f6f0e2", accent: "#f6f0e2" }, false);
    expect(b.spine.colours.ground).toBe("#151312"); // the cover's colours do not replace the picture
    expect(live.drawn.length).toBe(0);
  });
});

describe("resizeSpines", () => {
  it("repaints only a changed size, on the same canvas and texture, disposing the old storage", () => {
    const b = spineBook(book(), spinePixels(0.26, 1.6, 375, 1));
    const canvas = b.spine.canvas;
    const tex = b.spine.tex;
    expect(resizeSpines([b], 375, 1)).toBe(false);
    expect(b.disposed).toBe(0);
    expect(resizeSpines([b], 300, 2)).toBe(true);
    expect(b.spine.canvas).toBe(canvas);
    expect(b.spine.tex).toBe(tex);
    expect([canvas.width, canvas.height]).toEqual([156, 960]);
    expect(b.disposed).toBe(1);
    expect(resizeSpines([b], 300, 2)).toBe(false);
    expect(b.disposed).toBe(1);
  });

  it("drops a crossfade in progress and zeroes its helper canvases", () => {
    const b = spineBook(book(), spinePixels(0.26, 1.6, 375, 1));
    retintSpine(b, { ground: "#a8352a", ink: "#f6f0e2", accent: "#f6f0e2" }, true);
    const { from, to } = b.spine.fade!;
    resizeSpines([b], 200, 1);
    expect(b.spine.fade).toBeNull();
    expect([from.width, from.height, to.width, to.height]).toEqual([0, 0, 0, 0]);
  });

  it("zeroes a pending crossfade's canvases when the look changes without animation, and when it is replaced", () => {
    const b = spineBook();
    retintSpine(b, { ground: "#a8352a", ink: "#f6f0e2", accent: "#f6f0e2" }, true);
    const first = b.spine.fade!;
    showSpinePhoto(b, { naturalWidth: 90, naturalHeight: 600 } as HTMLImageElement, true);
    expect([first.from.width, first.to.width]).toEqual([0, 0]); // replaced
    const second = b.spine.fade!;
    expect(second).not.toBe(first);
    showSpinePhoto(b, { naturalWidth: 90, naturalHeight: 600 } as HTMLImageElement, false);
    expect(b.spine.fade).toBeNull();
    expect([second.from.width, second.from.height, second.to.width, second.to.height]).toEqual([0, 0, 0, 0]);
  });
});
