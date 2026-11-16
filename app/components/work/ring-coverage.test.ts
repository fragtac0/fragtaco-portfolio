import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BEFORE } from "./ring-before.fixture";
import { COVERAGE_STEPS, coverage } from "./ring-coverage";
import { layoutRings } from "./ring-layout";
import {
  INTRO_GAP,
  clear,
  introRadius,
  ringPlan,
  L_MAX,
  stackGrow,
  stackIconSize,
  stackRadius,
  targetL,
  tileSize,
  type PlannedRing,
  type RingPlan,
} from "./ring-math";

const REAL = { stack: 8, long: 21, short: 35 };
/** The seven sizes the ring audit photographs (scripts/audit/make-rings.mjs), and the two it only measures. */
const AUDIT_SIZES: [number, number][] = [
  [1440, 900], [1920, 1080], [820, 1180], [390, 844], [375, 667], [568, 320], [320, 568], [1024, 768], [2560, 1440],
];

const ring = (kind: PlannedRing["kind"], radius: number, count: number, size: { w: number; h: number }): PlannedRing => ({
  id: kind,
  kind,
  radius,
  count,
  size,
  periodS: 100,
  dir: 1,
});
const plan = (rings: PlannedRing[]): Pick<RingPlan, "rings"> => ({ rings });

/**
 * What the page drew before R54.2 (the plan of ringPlan(vw, vh, REAL) at the commit before this one, copied here as it was),
 * so today's coverage can be measured against what replaced it.
 */
function before(vw: number, vh: number, L: number, rings: [("long" | "short"), number, number][]): Pick<RingPlan, "rings"> {
  return plan(rings.map(([kind, radius, count]) => ring(kind, radius, count, tileSize(kind, L))));
}
const TODAY_1440 = before(1440, 900, 112, [["long", 357.28, 8], ["short", 498.57, 14], ["long", 639.85, 13], ["short", 781.13, 21]]);
const TODAY_390 = before(390, 844, 104, [["long", 295.74, 13], ["short", 427.69, 19]]);
const TODAY_1920 = before(1920, 1080, 155, [["long", 447.73, 7], ["short", 636.27, 13], ["long", 824.8, 14], ["short", 1013.34, 22]]);

describe("coverage", () => {
  it("is the share of the screen under video tiles, only the part on screen, over a turn of 24 steps", () => {
    expect(COVERAGE_STEPS).toBe(24);
    // one 100 by 50 tile in the middle of a 1000 by 1000 screen (radius 0): 5000 of 1 000 000
    expect(coverage(plan([ring("long", 0, 1, { w: 100, h: 50 })]), 1000, 1000)).toBeCloseTo(0.005, 9);
    // half of it on screen: a 50 by 100 screen holds 50 by 50 of the tile
    expect(coverage(plan([ring("long", 0, 1, { w: 100, h: 50 })]), 50, 100)).toBeCloseTo(0.5, 9);
    // wholly off screen
    expect(coverage(plan([ring("long", 5000, 4, { w: 100, h: 50 })]), 1000, 1000)).toBe(0);
  });

  it("averages over the turn: a ring of tiles gone round once covers the same however many steps it is read at", () => {
    const one = coverage(plan([ring("long", 400, 6, { w: 150, h: 84 })]), 1440, 900);
    expect(one).toBeGreaterThan(0.05);
    // adding a ring only ever adds coverage, and the stack ring's icons are not counted
    const withStack = coverage(plan([ring("stack", 216, 8, { w: 76, h: 76 }), ring("long", 400, 6, { w: 150, h: 84 })]), 1440, 900);
    expect(withStack).toBe(one);
    expect(coverage(plan([ring("long", 400, 6, { w: 150, h: 84 }), ring("short", 640, 12, { w: 84, h: 150 })]), 1440, 900)).toBeGreaterThan(one);
  });

  it("is 0 for no video rings, no screen, or a screen that is not a size", () => {
    expect(coverage(plan([]), 1440, 900)).toBe(0);
    expect(coverage(ringPlan(500, 400, REAL), 500, 400)).toBe(0);
    expect(coverage(ringPlan(1440, 900, REAL), 0, 900)).toBe(0);
    expect(coverage(ringPlan(1440, 900, REAL), Number.NaN, 900)).toBe(0);
  });
});

describe("coverage of the plans (R54.2, spec 5)", () => {
  it("was 0.151 at 1440 by 900 before (about 15%), 0.175 at 390 by 844 and 0.165 at 1920 by 1080", () => {
    expect(coverage(TODAY_1440, 1440, 900)).toBeCloseTo(0.151, 3);
    expect(coverage(TODAY_390, 390, 844)).toBeCloseTo(0.175, 3);
    expect(coverage(TODAY_1920, 1920, 1080)).toBeCloseTo(0.165, 3);
  });

  it("covers 0.30 to 0.40 of the screen at 1440 by 900, the brief's number, counted in full: nothing is cut out round the dock (R56.4)", () => {
    for (const counts of [REAL, { stack: 8, long: 35, short: 35 }]) {
      const share = coverage(ringPlan(1440, 900, counts), 1440, 900);
      expect(share).toBeGreaterThanOrEqual(0.3);
      expect(share).toBeLessThanOrEqual(0.4);
    }
  });

  it("counts a tile under the dock in full: coverage takes the plan and the screen, no keep-out", () => {
    expect(coverage.length).toBe(3);
    // one tile on a ring of radius 400 round the middle of 1440 by 900: at a quarter of the turn it is at the foot of the screen, where the dock is
    const sum = Array.from({ length: COVERAGE_STEPS }, (_, k) => {
      const a = (k / COVERAGE_STEPS) * 2 * Math.PI;
      const cx = 720 + 400 * Math.cos(a);
      const cy = 450 + 400 * Math.sin(a);
      const w = Math.max(0, Math.min(cx + 100, 1440) - Math.max(cx - 100, 0));
      const h = Math.max(0, Math.min(cy + 56, 900) - Math.max(cy - 56, 0));
      return w * h;
    }).reduce((x, y) => x + y, 0);
    expect(coverage(plan([ring("long", 400, 1, { w: 200, h: 112 })]), 1440, 900)).toBeCloseTo(sum / COVERAGE_STEPS / (1440 * 900), 9);
  });

  it("covers at least 1.3 times what it covered at 390 by 844, and about twice at 1440 by 900 (the brief's numbers, with no mask to cost any of it)", () => {
    expect(coverage(TODAY_390, 390, 844)).toBeCloseTo(0.175, 3);
    expect(coverage(ringPlan(390, 844, REAL), 390, 844)).toBeGreaterThanOrEqual(1.3 * coverage(TODAY_390, 390, 844));
    expect(coverage(ringPlan(1440, 900, REAL), 1440, 900)).toBeGreaterThan(1.9 * coverage(TODAY_1440, 1440, 900));
    expect(coverage(ringPlan(1920, 1080, REAL), 1920, 1080)).toBeGreaterThan(1.5 * coverage(TODAY_1920, 1920, 1080));
  });

  it("has a tile whose long side is 180 to 200 px at 1440 by 900 (spec: about 190 by 107, 104 by 185 short form), icons of 76 px", () => {
    const p = ringPlan(1440, 900, REAL);
    expect(p.L).toBeGreaterThanOrEqual(180);
    expect(p.L).toBeLessThanOrEqual(200);
    for (const r of p.rings.filter((x) => x.kind !== "stack")) expect(Math.max(r.size.w, r.size.h)).toBe(p.L);
    expect(stackIconSize(1440)).toBe(76);
  });
});

describe("no audit size gets smaller tiles or fewer tiles than at 4621443 (R56.4)", () => {
  const video = (vw: number, vh: number) => layoutRings(REAL, vw, vh).rings.filter((r) => r.kind !== "stack");

  it("pins what 4621443 drew: the fixture's plans give its own coverage, counted in full", () => {
    for (const [vw, vh] of AUDIT_SIZES) {
      const before = BEFORE[`${vw}x${vh}`];
      const rings = before.rings.map(([kind, radius, count]) => ring(kind, radius, count, tileSize(kind, before.L)));
      expect(before.tiles, `${vw}x${vh}`).toBe(before.rings.reduce((n, r) => n + r[2], 0));
      expect(coverage(plan(rings), vw, vh), `${vw}x${vh}`).toBeCloseTo(before.full, 3);
    }
  });

  it("has tiles at least as long as before at every audit size", () => {
    for (const [vw, vh] of AUDIT_SIZES) {
      expect(ringPlan(vw, vh, REAL).L, `${vw}x${vh}`).toBeGreaterThanOrEqual(BEFORE[`${vw}x${vh}`].L);
    }
  });

  it("draws at least as many tiles, in at least as many rings, as before at every audit size", () => {
    for (const [vw, vh] of AUDIT_SIZES) {
      const before = BEFORE[`${vw}x${vh}`];
      const rings = video(vw, vh);
      expect(rings.reduce((n, r) => n + r.slots.length, 0), `${vw}x${vh} tiles`).toBeGreaterThanOrEqual(before.tiles);
      expect(rings.length, `${vw}x${vh} rings`).toBeGreaterThanOrEqual(before.rings.length);
    }
  });

  it("covers at least as much of the screen as before at every audit size (counted in full)", () => {
    for (const [vw, vh] of AUDIT_SIZES) {
      expect(coverage(ringPlan(vw, vh, REAL), vw, vh), `${vw}x${vh}`).toBeGreaterThanOrEqual(BEFORE[`${vw}x${vh}`].full - 1e-6);
    }
  });

  it("keeps a video ring at every audit size, 568 by 320 included", () => {
    for (const [vw, vh] of AUDIT_SIZES) {
      expect(ringPlan(vw, vh, REAL).rings.filter((r) => r.kind !== "stack").length, `${vw}x${vh}`).toBeGreaterThanOrEqual(1);
    }
  });

  it("makes a tile at least 1.3 times larger on a phone where the round 6 one was not already large (390 by 844: 104 to 220)", () => {
    expect(ringPlan(390, 844, REAL).L).toBeGreaterThanOrEqual(1.3 * 104);
    expect(ringPlan(1920, 1080, REAL).L).toBeGreaterThan(155);
    expect(ringPlan(1024, 768, REAL).L).toBeGreaterThan(104);
  });
});

describe("what the rings keep clear (R54.2)", () => {
  it("keeps every video tile 40 px or more from the title block, at every audit size and at every phase of the stack ring", () => {
    for (const [vw, vh] of AUDIT_SIZES) {
      const intro = introRadius(vw, vh);
      for (const r of layoutRings(REAL, vw, vh).rings.filter((x) => x.kind !== "stack")) {
        // the nearest a tile's corner can come to the middle: the ring's radius less the tile's half diagonal
        const nearest = r.radius - Math.hypot(r.size.w, r.size.h) / 2;
        expect(nearest, `${vw}x${vh} ${r.id}`).toBeGreaterThanOrEqual(intro + 40);
      }
    }
  });

  it("has the intro's radius in the stylesheet (--intro-r) the same as introRadius(), at every audit size (R54.2b: the two cannot drift)", () => {
    const css = readFileSync(new URL("./work.css", import.meta.url), "utf8");
    const rule = (src: string) => {
      const icon = Number(/--stack-icon:\s*(\d+)px/.exec(src)?.[1]);
      const grow = Number(/--stack-grow:\s*(\d+)px/.exec(src)?.[1]);
      const edge = Number(/--stack-r:\s*min\(calc\(max\(190px, 24vh\) \+ var\(--stack-grow\)\), 42vw, calc\(50vw - (\d+)px\)\)/.exec(src)?.[1]);
      return { icon, grow, edge };
    };
    const desk = rule(css.slice(0, css.indexOf("@media")));
    const phone = rule(css.slice(css.indexOf("@media (max-width: 699.98px) {")));
    const gap = Number(/--intro-gap:\s*(\d+)px/.exec(css)?.[1]);
    expect(gap).toBe(INTRO_GAP);
    for (const [vw, vh] of AUDIT_SIZES) {
      const { icon, grow, edge } = vw < 700 ? phone : desk;
      expect(icon, `${vw}x${vh} icon`).toBe(stackIconSize(vw));
      expect(grow, `${vw}x${vh} grow`).toBe(stackGrow(vw));
      const stackR = Math.min(Math.max(190, 0.24 * vh) + grow, 0.42 * vw, vw / 2 - edge);
      expect(stackR, `${vw}x${vh} stack`).toBeCloseTo(stackRadius(vw, vh), 6);
      expect(stackR - icon / 2 - gap, `${vw}x${vh} intro`).toBeCloseTo(introRadius(vw, vh), 6);
    }
  });

  it("keeps the first video ring a clearance from the stack ring's icons, as before", () => {
    for (const [vw, vh] of AUDIT_SIZES) {
      const [stack, first] = ringPlan(vw, vh, REAL).rings;
      if (!first || first.kind === "stack") continue;
      expect(first.radius - stack.radius, `${vw}x${vh}`).toBeGreaterThanOrEqual(clear(stack.size, first.size) - 1e-6);
    }
  });
});

/** The old content's 35 long and 35 short videos, so every ring that fits is full. */
const p35 = (vw: number, vh: number) => ringPlan(vw, vh, { stack: 8, long: 35, short: 35 });

describe("ringPlan: the worked numbers of spec 5 (R54.2)", () => {
  it("has L 200 and two video rings, 10 long form and 16 short form, at 1440 by 900", () => {
    const p = p35(1440, 900);
    const video = p.rings.filter((r) => r.kind !== "stack");
    expect(video.map((r) => r.id)).toEqual(["long-1", "short-1"]);
    expect(p.L).toBeGreaterThanOrEqual(180);
    expect(p.L).toBeLessThanOrEqual(200);
    expect(video.map((r) => r.count)).toEqual([10, 16]);
    expect(p.hidden).toEqual({ long: 25, short: 19 });
    // packed outward: each ring as near the one inside as the clearance allows
    expect(video[0].radius - p.rings[0].radius).toBeCloseTo(clear(p.rings[0].size, video[0].size), 6);
    expect(video[1].radius - video[0].radius).toBeCloseTo(clear(video[0].size, video[1].size), 6);
  });

  it("asks for 200 px at 1440 by 900 (the tile is then 200 by 112.5)", () => {
    expect(targetL(1440, 900)).toBe(200);
    expect(tileSize("long", p35(1440, 900).L).h).toBeCloseTo(p35(1440, 900).L * 0.5625);
  });

  it("grows with the screen: larger at 1920 by 1080 and 2560 by 1440, never above L_MAX", () => {
    expect(p35(1920, 1080).L).toBeGreaterThan(p35(1440, 900).L);
    expect(p35(2560, 1440).L).toBeGreaterThan(p35(1920, 1080).L);
    expect(p35(2560, 1440).L).toBeLessThanOrEqual(L_MAX);
  });

  it("has one ring of long form and L at least 1.3 times today's 104 at 390 by 844", () => {
    const p = p35(390, 844);
    expect(p.rings.filter((r) => r.kind !== "stack").map((r) => r.kind)).toEqual(["long"]);
    expect(p.L).toBeGreaterThanOrEqual(1.3 * 104);
    expect(p.hidden.short).toBe(35);
  });

  it("uses fewer rings of larger tiles where today's would not fit (820 by 1180, 1024 by 768)", () => {
    for (const [vw, vh] of [[820, 1180], [1024, 768]]) {
      const p = p35(vw, vh);
      expect(p.L).toBeGreaterThanOrEqual(130);
      expect(p.rings.filter((r) => r.kind !== "stack")).toHaveLength(2);
    }
  });
});

