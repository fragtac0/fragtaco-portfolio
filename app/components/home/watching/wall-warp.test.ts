import { describe, expect, it } from "vitest";
import { blockPlan, centredPan, sizeOfPlan } from "./wall-block";
import { layoutTiles, hitTile } from "./wall-math";
import {
  BLUR_INNER,
  BLUR_MAX_PX,
  EDGE_DARK_INNER,
  FRINGE_INNER,
  FRINGE_MAX_PX,
  HEAD_BAND_PX,
  HEAD_DARK,
  WARP_INNER,
  WARP_MAX,
  edgeBlur,
  edgeDark,
  edgeFringe,
  edgeUnwarp,
  edgeWarp,
  warpMargin,
  warpShift,
} from "./wall-warp";
import { contrast } from "../../../styles/contrast";
import { channels, CREAM, GROUND } from "../../../styles/tokens";

const sizes: Array<[number, number]> = [
  [1440, 900],
  [1920, 1080],
  [390, 844],
  [2560, 1440],
];

describe("edgeWarp", () => {
  it("is the identity inside 55% of the half-diagonal", () => {
    for (const [vw, vh] of sizes) {
      const hd = Math.hypot(vw / 2, vh / 2);
      for (let a = 0; a < 360; a += 15) {
        const rad = (a * Math.PI) / 180;
        const r = WARP_INNER * hd;
        const x = vw / 2 + Math.cos(rad) * r;
        const y = vh / 2 + Math.sin(rad) * r;
        const [wx, wy] = edgeWarp(x, y, vw, vh);
        expect(wx).toBeCloseTo(x, 9);
        expect(wy).toBeCloseTo(y, 9);
      }
      expect(edgeWarp(vw / 2, vh / 2, vw, vh)).toEqual([vw / 2, vh / 2]);
    }
  });

  it("pulls the corners in by 2.2% of the half-diagonal, toward the centre", () => {
    for (const [vw, vh] of sizes) {
      const hd = Math.hypot(vw / 2, vh / 2);
      for (const [x, y] of [
        [0, 0],
        [vw, 0],
        [0, vh],
        [vw, vh],
      ]) {
        const [wx, wy] = edgeWarp(x, y, vw, vh);
        const moved = Math.hypot(wx - x, wy - y);
        expect(moved).toBeCloseTo(WARP_MAX * hd, 6);
        const before = Math.hypot(x - vw / 2, y - vh / 2);
        const after = Math.hypot(wx - vw / 2, wy - vh / 2);
        expect(after).toBeLessThan(before);
      }
    }
  });

  it("is smooth at the join: no step, and the pull grows without a kink", () => {
    expect(warpShift(WARP_INNER)).toBe(0);
    expect(warpShift(WARP_INNER - 0.1)).toBe(0);
    expect(warpShift(1)).toBeCloseTo(WARP_MAX, 12);
    expect(warpShift(1.2)).toBeCloseTo(WARP_MAX, 12);
    // the slope just past the join is tiny (continuous with the flat part before it)
    const h = 1e-4;
    expect((warpShift(WARP_INNER + h) - warpShift(WARP_INNER)) / h).toBeLessThan(0.001);
    // and the pull never shrinks outward
    let last = 0;
    for (let r = 0; r <= 1.05; r += 0.01) {
      expect(warpShift(r)).toBeGreaterThanOrEqual(last);
      last = warpShift(r);
    }
  });

  it("stays monotonic: a point further out never lands nearer the centre", () => {
    const vw = 1440;
    const vh = 900;
    let last = -1;
    for (let x = vw / 2; x <= vw + 40; x += 2) {
      const [wx] = edgeWarp(x, vh / 2, vw, vh);
      expect(wx).toBeGreaterThan(last);
      last = wx;
    }
  });

  it("copes with a zero-sized view", () => {
    expect(edgeWarp(5, 6, 0, 0)).toEqual([5, 6]);
    expect(edgeUnwarp(5, 6, 0, 0)).toEqual([5, 6]);
  });
});

describe("edgeUnwarp", () => {
  it("inverts edgeWarp to within 0.5 px over the screen and a margin beyond it", () => {
    for (const [vw, vh] of sizes) {
      let worst = 0;
      for (let x = -40; x <= vw + 40; x += vw / 37) {
        for (let y = -40; y <= vh + 40; y += vh / 29) {
          const [wx, wy] = edgeWarp(x, y, vw, vh);
          const [bx, by] = edgeUnwarp(wx, wy, vw, vh);
          worst = Math.max(worst, Math.hypot(bx - x, by - y));
          const [sx, sy] = edgeUnwarp(x, y, vw, vh);
          const [cx, cy] = edgeWarp(sx, sy, vw, vh);
          worst = Math.max(worst, Math.hypot(cx - x, cy - y));
        }
      }
      expect(worst).toBeLessThan(0.5);
    }
  });

  it("is within 0.01 px: the margin is generous", () => {
    const [wx, wy] = edgeWarp(1400, 880, 1440, 900);
    const [bx, by] = edgeUnwarp(wx, wy, 1440, 900);
    expect(Math.hypot(bx - 1400, by - 880)).toBeLessThan(0.01);
  });

  it("pushes the screen corner out to a wall point beyond the view, inside the margin", () => {
    const [wx, wy] = edgeUnwarp(0, 0, 1440, 900);
    expect(wx).toBeLessThan(0);
    expect(wy).toBeLessThan(0);
    const m = warpMargin(1440, 900);
    expect(-wx).toBeLessThanOrEqual(m);
    expect(-wy).toBeLessThanOrEqual(m);
  });
});

describe("a click at a warped corner", () => {
  it("hits the tile drawn there", () => {
    const vw = 1440;
    const vh = 900;
    // a block bigger than the screen, the view in the middle of it
    const plan = blockPlan(400, vw, vh);
    const size = sizeOfPlan(plan);
    const [px, py] = centredPan(plan, vw, vh);
    const tiles = layoutTiles({ viewX: px + 37, viewY: py + 12, vw, vh, plan, count: 400 });
    // every tile that shows on screen: click where its warped centre is, get that tile back
    let checked = 0;
    let corner = 0;
    for (const tl of tiles) {
      const [sx, sy] = edgeWarp(tl.x + size.cw / 2, tl.y + size.ch / 2, vw, vh);
      if (sx < 0 || sx > vw || sy < 0 || sy > vh) continue;
      const [wx, wy] = edgeUnwarp(sx, sy, vw, vh);
      expect(hitTile(tiles, wx, wy, size)).toBe(tl.key);
      checked++;
      if (Math.hypot(sx - vw / 2, sy - vh / 2) > 0.8 * Math.hypot(vw / 2, vh / 2)) corner++;
    }
    expect(checked).toBeGreaterThan(10);
    expect(corner).toBeGreaterThan(2);
  });

  it("takes the tile at the very corner of the screen", () => {
    const vw = 1440;
    const vh = 900;
    const plan = blockPlan(400, vw, vh);
    const size = sizeOfPlan(plan);
    const [px, py] = centredPan(plan, vw, vh);
    const tiles = layoutTiles({ viewX: px, viewY: py, vw, vh, plan, count: 400 });
    for (const [sx, sy] of [
      [2, 2],
      [vw - 2, 2],
      [2, vh - 2],
      [vw - 2, vh - 2],
    ]) {
      const [wx, wy] = edgeUnwarp(sx, sy, vw, vh);
      expect(hitTile(tiles, wx, wy, size)).not.toBeNull();
      // the unwarped point lies where the warp would put it back on the pixel clicked
      const [bx, by] = edgeWarp(wx, wy, vw, vh);
      expect(Math.hypot(bx - sx, by - sy)).toBeLessThan(0.01);
    }
  });
});

const CORNERS = (vw: number, vh: number): Array<[number, number]> => [
  [0, 0],
  [vw, 0],
  [0, vh],
  [vw, vh],
];

describe("the edges: blur, colour fringe and dark fade", () => {
  it("are exactly zero in the middle of the screen", () => {
    for (const [vw, vh] of sizes) {
      const hd = Math.hypot(vw / 2, vh / 2);
      // the blur and the fringe: everything inside 60% of the half-diagonal
      for (let a = 0; a < 360; a += 10) {
        const rad = (a * Math.PI) / 180;
        for (const k of [0, 0.3, Math.min(BLUR_INNER, FRINGE_INNER) - 0.01]) {
          const x = vw / 2 + Math.cos(rad) * k * hd;
          const y = vh / 2 + Math.sin(rad) * k * hd;
          // (exactly zero; at the very radius where they start, a rounding of 1e-30 is the same thing)
          expect(edgeBlur(x, y, vw, vh)).toBeCloseTo(0, 12);
          expect(edgeFringe(x, y, vw, vh)).toBeCloseTo(0, 12);
        }
      }
      // the dark fade: the middle 62% of the width and of the height, below the top band
      const band = Math.min(HEAD_BAND_PX, vh * 0.25);
      for (let u = -EDGE_DARK_INNER; u <= EDGE_DARK_INNER; u += 0.1) {
        for (let v = -EDGE_DARK_INNER; v <= EDGE_DARK_INNER; v += 0.1) {
          const x = vw / 2 + (u * vw) / 2;
          const y = vh / 2 + (v * vh) / 2;
          if (y >= band) expect(edgeDark(x, y, vw, vh)).toBe(0);
        }
      }
      expect(edgeDark(vw / 2, vh / 2, vw, vh)).toBe(0);
      expect(edgeBlur(vw / 2, vh / 2, vw, vh)).toBe(0);
    }
  });

  it("are bounded, and the blur and the fringe reach their maximum at the corners", () => {
    for (const [vw, vh] of sizes) {
      for (const [x, y] of CORNERS(vw, vh)) {
        expect(edgeBlur(x, y, vw, vh)).toBeCloseTo(BLUR_MAX_PX, 9);
        expect(edgeFringe(x, y, vw, vh)).toBeCloseTo(FRINGE_MAX_PX, 9);
        expect(edgeDark(x, y, vw, vh)).toBeLessThanOrEqual(1);
        expect(edgeDark(x, y, vw, vh)).toBeGreaterThan(0.5);
      }
      for (let x = -20; x <= vw + 20; x += vw / 24) {
        for (let y = -20; y <= vh + 20; y += vh / 24) {
          const b = edgeBlur(x, y, vw, vh);
          const f = edgeFringe(x, y, vw, vh);
          const d = edgeDark(x, y, vw, vh);
          expect(b).toBeGreaterThanOrEqual(0);
          expect(b).toBeLessThanOrEqual(BLUR_MAX_PX);
          expect(f).toBeGreaterThanOrEqual(0);
          expect(f).toBeLessThanOrEqual(FRINGE_MAX_PX);
          expect(d).toBeGreaterThanOrEqual(0);
          expect(d).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it("grow outward and never shrink (along a ray to each corner and along each side's middle)", () => {
    const vw = 1440;
    const vh = 900;
    const rays: Array<[number, number]> = [...CORNERS(vw, vh), [vw / 2, 0], [vw / 2, vh], [0, vh / 2], [vw, vh / 2]];
    for (const [ex, ey] of rays) {
      let b = 0;
      let f = 0;
      let d = 0;
      for (let t = 0; t <= 1.0001; t += 0.01) {
        const x = vw / 2 + (ex - vw / 2) * t;
        const y = vh / 2 + (ey - vh / 2) * t;
        // the top band is darkest at the very top and falls away downward, so the ray to the top middle is read from the middle out
        expect(edgeBlur(x, y, vw, vh)).toBeGreaterThanOrEqual(b - 1e-12);
        expect(edgeFringe(x, y, vw, vh)).toBeGreaterThanOrEqual(f - 1e-12);
        expect(edgeDark(x, y, vw, vh)).toBeGreaterThanOrEqual(d - 1e-12);
        b = edgeBlur(x, y, vw, vh);
        f = edgeFringe(x, y, vw, vh);
        d = edgeDark(x, y, vw, vh);
      }
    }
  });

  it("are the same on the left and the right, the top fade apart (it is the heading's band)", () => {
    const vw = 1440;
    const vh = 900;
    for (let y = 0; y <= vh; y += 45) {
      for (let x = 0; x <= vw / 2; x += 40) {
        expect(edgeDark(x, y, vw, vh)).toBeCloseTo(edgeDark(vw - x, y, vw, vh), 9);
        expect(edgeBlur(x, y, vw, vh)).toBeCloseTo(edgeBlur(vw - x, y, vw, vh), 9);
        expect(edgeFringe(x, y, vw, vh)).toBeCloseTo(edgeFringe(vw - x, y, vw, vh), 9);
      }
    }
    // each of the four sides has a fade
    for (const [x, y] of [
      [vw / 2, vh - 1],
      [1, vh / 2],
      [vw - 1, vh / 2],
    ]) {
      expect(edgeDark(x, y, vw, vh)).toBeGreaterThan(0.1);
    }
  });

  it("is darkest in the top band the heading and the Esc pill stand in, at least HEAD_DARK, and gone below it", () => {
    for (const [vw, vh] of sizes) {
      const band = Math.min(HEAD_BAND_PX, vh * 0.25);
      for (const x of [vw * 0.05, vw * 0.3, vw * 0.5, vw * 0.95]) {
        expect(edgeDark(x, 0, vw, vh)).toBeGreaterThanOrEqual(HEAD_DARK - 1e-9);
        expect(edgeDark(x, band * 0.5, vw, vh)).toBeGreaterThanOrEqual(HEAD_DARK - 1e-9);
        expect(edgeDark(x, band, vw, vh)).toBeLessThan(0.51); // below the band only the sides' own fade remains
      }
    }
  });

  it("keeps the blur and the fringe inside the warp's margin, so no read falls off the drawn wall", () => {
    for (const [vw, vh] of sizes) {
      const reach = Math.ceil(WARP_MAX * Math.hypot(vw / 2, vh / 2)) + BLUR_MAX_PX * Math.SQRT1_2 + FRINGE_MAX_PX;
      expect(warpMargin(vw, vh)).toBeGreaterThanOrEqual(reach);
    }
  });

  it("leaves the quietest text (cream at 62%) over even a pure white picture at 4.5 to 1 or better, in the top band", () => {
    // the fade is a mix toward the ground in the shader's own (sRGB) numbers; text is then laid over it
    const hex = (v: readonly number[]) => `#${v.map((c) => Math.round(c).toString(16).padStart(2, "0")).join("")}`;
    const ground = channels(GROUND);
    const cream = channels(CREAM);
    const d = edgeDark(300, 90, 1440, 900); // behind the heading's count
    const bg = ground.map((g) => 255 * (1 - d) + g * d);
    const ink = cream.map((c, i) => c * 0.62 + bg[i] * 0.38);
    expect(contrast(hex(ink), hex(bg))).toBeGreaterThanOrEqual(4.5);
  });
});
