import { describe, expect, it } from "vitest";
import { CLIFF_SPAN, EXPLORE_MIN, FIT_RING_SHARE, MAX_SCALE, clampView, exploreScale, fitScale, fitView, flyTo, zoomAbout, type View } from "./view";

const m = { size: 8192 };
const SCREENS: [number, number][] = [[1440, 900], [1920, 1080], [390, 844], [844, 390], [320, 568], [2560, 1440], [1024, 768]];

describe("fitView", () => {
  it("centres the summit and puts the cliff ring at 78% of the smaller screen side", () => {
    for (const [vw, vh] of SCREENS) {
      const v = fitView(vw, vh, m);

      expect(v.cx).toBe(4096);
      expect(v.cy).toBe(4096);
      expect(CLIFF_SPAN * m.size * v.scale).toBeCloseTo(FIT_RING_SHARE * Math.min(vw, vh), 9);
    }
  });

  it("scales with the screen and uses the picture's size", () => {
    expect(fitView(1000, 1000, m).scale).toBeCloseTo(fitView(500, 500, m).scale * 2, 12);
    expect(fitView(1000, 1000, { size: 4096 }).scale).toBeCloseTo(fitView(1000, 1000, m).scale * 2, 12);
  });

  it("starts explore at twice the fit scale", () => {
    expect(EXPLORE_MIN).toBe(2);
    expect(exploreScale(1440, 900, m)).toBeCloseTo(2 * fitScale(1440, 900, m), 12);
  });
});

describe("clampView", () => {
  // what the screen shows, in picture pixels
  const shown = (v: View, vw: number, vh: number) => ({
    left: v.cx - vw / (2 * v.scale),
    right: v.cx + vw / (2 * v.scale),
    top: v.cy - vh / (2 * v.scale),
    bottom: v.cy + vh / (2 * v.scale),
  });

  it("keeps the screen inside the picture where the picture is bigger, and centres the picture where it is smaller, for any wild centre", () => {
    for (const [vw, vh] of SCREENS) {
      const fit = fitScale(vw, vh, m);

      for (let i = 0; i <= 24; i++) {
        const scale = fit * (MAX_SCALE / fit) ** (i / 24);

        for (const [cx, cy] of [[-5000, -5000], [20000, 20000], [0, 9000], [4096, 4096], [8192, 0], [1234, 6789]]) {
          const v = clampView({ cx, cy, scale }, vw, vh, m);
          const s = shown(v, vw, vh);

          // on an axis where the picture is bigger than the screen, the screen stays inside it
          if (m.size * v.scale >= vw) {
            expect(s.left).toBeGreaterThanOrEqual(-1e-6);
            expect(s.right).toBeLessThanOrEqual(m.size + 1e-6);
          } else {
            expect(v.cx).toBe(m.size / 2); // otherwise it is centred
          }
          if (m.size * v.scale >= vh) {
            expect(s.top).toBeGreaterThanOrEqual(-1e-6);
            expect(s.bottom).toBeLessThanOrEqual(m.size + 1e-6);
          } else {
            expect(v.cy).toBe(m.size / 2);
          }
        }
      }
    }
  });

  it("keeps the scale between the fit scale and the native size", () => {
    expect(clampView({ cx: 4096, cy: 4096, scale: 0.0001 }, 1440, 900, m).scale).toBeCloseTo(fitScale(1440, 900, m), 12);
    expect(clampView({ cx: 4096, cy: 4096, scale: 50 }, 1440, 900, m).scale).toBe(MAX_SCALE);
  });

  it("leaves a legal view alone", () => {
    const v = { cx: 3000, cy: 5000, scale: 0.6 };

    expect(clampView(v, 1440, 900, m)).toEqual(v);
  });

  it("holds the overview on the summit on a screen wider than the picture", () => {
    const fit = fitView(1440, 900, m);

    expect(clampView({ ...fit, cx: 100 }, 1440, 900, m)).toEqual(fit);
  });

  it("is idempotent", () => {
    const once = clampView({ cx: -9, cy: 99999, scale: 0.3 }, 800, 600, m);

    expect(clampView(once, 800, 600, m)).toEqual(once);
  });
});

describe("zoomAbout", () => {
  it("keeps the picture point under the pointer where it was", () => {
    const v: View = { cx: 3000, cy: 4000, scale: 0.4 };
    const [px, py] = [200, -120]; // from the screen's centre
    const z = zoomAbout(v, 1.7, px, py);
    const under = (w: View) => ({ x: w.cx + px / w.scale, y: w.cy + py / w.scale });

    expect(z.scale).toBeCloseTo(0.68, 12);
    expect(under(z).x).toBeCloseTo(under(v).x, 9);
    expect(under(z).y).toBeCloseTo(under(v).y, 9);
  });

  it("zooming about the centre only changes the scale", () => {
    expect(zoomAbout({ cx: 10, cy: 20, scale: 1 }, 2, 0, 0)).toEqual({ cx: 10, cy: 20, scale: 2 });
  });

  it("is undone by the opposite factor", () => {
    const v: View = { cx: 3000, cy: 4000, scale: 0.4 };
    const back = zoomAbout(zoomAbout(v, 2.5, 90, 40), 1 / 2.5, 90, 40);

    expect(back.cx).toBeCloseTo(v.cx, 9);
    expect(back.cy).toBeCloseTo(v.cy, 9);
    expect(back.scale).toBeCloseTo(v.scale, 12);
  });
});

describe("flyTo", () => {
  const a: View = { cx: 4096, cy: 4096, scale: 0.13 };
  const b: View = { cx: 2500, cy: 5200, scale: 0.9 };

  it("is the start at 0 and the end at 1, and clamps t", () => {
    expect(flyTo(a, b, 0)).toEqual(a);
    expect(flyTo(a, b, 1)).toEqual(b);
    expect(flyTo(a, b, -2)).toEqual(a);
    expect(flyTo(a, b, 9)).toEqual(b);
  });

  it("moves steadily from one to the other: the scale and both coordinates only go one way", () => {
    let prev = flyTo(a, b, 0);

    for (let i = 1; i <= 50; i++) {
      const v = flyTo(a, b, i / 50);

      expect(v.scale).toBeGreaterThanOrEqual(prev.scale);
      expect(v.cx).toBeLessThanOrEqual(prev.cx + 1e-9);
      expect(v.cy).toBeGreaterThanOrEqual(prev.cy - 1e-9);
      prev = v;
    }
  });

  it("is eased: slow at the ends, fast in the middle, halfway at t = 0.5", () => {
    const d = (t: number) => Math.log(flyTo(a, b, t).scale / a.scale);
    const full = Math.log(b.scale / a.scale);

    expect(d(0.1)).toBeLessThan(0.1 * full);
    expect(d(0.5)).toBeCloseTo(0.5 * full, 9);
    expect(d(0.9)).toBeGreaterThan(0.9 * full);
  });

  it("pans when the scale does not change, and zooms in place when the centre does not", () => {
    const pan = flyTo({ cx: 0, cy: 0, scale: 0.5 }, { cx: 100, cy: 200, scale: 0.5 }, 0.5);
    const zoom = flyTo({ cx: 7, cy: 9, scale: 0.5 }, { cx: 7, cy: 9, scale: 2 }, 0.5);

    expect(pan).toEqual({ cx: 50, cy: 100, scale: 0.5 });
    expect(zoom.cx).toBeCloseTo(7, 12);
    expect(zoom.cy).toBeCloseTo(9, 12);
    expect(zoom.scale).toBeCloseTo(1, 12);
  });
});
