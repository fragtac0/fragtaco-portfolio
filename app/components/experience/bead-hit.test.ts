import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BEAD_HIT_HALF, hitClip, hitCorners, writeHits } from "./bead-hit";
import type { XY } from "./card-slot";

/** Whether a point (from the bead's centre) is inside a convex polygon given in order. */
function inside(poly: readonly XY[], p: XY): boolean {
  let sign = 0;

  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const cross = (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);

    if (Math.abs(cross) < 1e-9) continue;
    if (sign === 0) sign = Math.sign(cross);
    else if (Math.sign(cross) !== sign) return false;
  }

  return true;
}

/** Which bead a touch at `at` (screen pixels) reaches, as the page does it: the button squares, each cut to its area. */
function owner(heads: readonly XY[], at: XY): number[] {
  return heads.flatMap((h, i) => (inside(hitCorners(heads, i), [at[0] - h[0], at[1] - h[1]]) ? [i] : []));
}

describe("bead hit areas (R108)", () => {
  it("is the button's whole square for a bead with no neighbour near", () => {
    expect(hitCorners([[100, 100], [400, 300]], 0)).toEqual([[-22, -22], [22, -22], [22, 22], [-22, 22]]);
    expect(hitClip([[100, 100], [400, 300]], 0)).toBeNull();
  });

  it("is the same 44 px as the button", () => {
    const tokens = readFileSync(new URL("../../styles/tokens.css", import.meta.url), "utf8");

    expect(/--pill-h-touch:\s*44px/.test(tokens)).toBe(true);
    expect(BEAD_HIT_HALF * 2).toBe(44);
  });

  it("gives a touch on a bead's centre to that bead, whatever lies near (the 1440 by 900 corner case: 29 px apart, one on the corner of the other's square)", () => {
    const heads: XY[] = [[675, 541], [694, 563]];

    heads.forEach((h, i) => expect(owner(heads, h)).toEqual([i]));
  });

  it("gives every bead its centre on a crowded stage (beads 20 to 36 px apart, in a line and in a cluster)", () => {
    const stages: XY[][] = [
      [[100, 100], [118, 112], [140, 105], [125, 130], [105, 135], [150, 140], [170, 120], [160, 160], [135, 160]],
      Array.from({ length: 9 }, (_, i): XY => [50 + i * 20, 200 + (i % 2) * 4]),
    ];

    for (const heads of stages) heads.forEach((h, i) => expect(owner(heads, h)).toEqual([i]));
  });

  it("splits the overlap at the middle: a point goes to the nearer centre, and no point goes to two beads", () => {
    const heads: XY[] = [[100, 100], [124, 100]]; // 24 apart: the squares overlap from 102 to 122

    expect(owner(heads, [110, 100])).toEqual([0]);
    expect(owner(heads, [114, 100])).toEqual([1]);
    for (let x = 80; x <= 146; x += 0.5) for (let y = 78; y <= 122; y += 0.5) expect(owner(heads, [x, y]).length).toBeLessThanOrEqual(x === 112 ? 2 : 1);
  });

  it("gives a point to the nearest centre among all the beads whose squares reach it", () => {
    const heads: XY[] = [[100, 100], [118, 112], [140, 105], [125, 130]];

    for (let x = 70; x <= 170; x += 1.3) {
      for (let y = 70; y <= 160; y += 1.3) {
        const reach = heads.map((h, i) => [i, h] as const).filter(([, h]) => Math.abs(h[0] - x) <= BEAD_HIT_HALF && Math.abs(h[1] - y) <= BEAD_HIT_HALF);
        const nearest = [...reach].sort((a, b) => Math.hypot(a[1][0] - x, a[1][1] - y) - Math.hypot(b[1][0] - x, b[1][1] - y))[0];
        const got = owner(heads, [x, y]);

        // the nearest bead among all of them owns it only when its own square reaches it; a nearer bead that does not reach it leaves it to nobody
        const nearestOfAll = heads.map((h, i) => [i, Math.hypot(h[0] - x, h[1] - y)] as const).sort((a, b) => a[1] - b[1])[0][0];

        if (reach.some(([i]) => i === nearestOfAll)) expect(got).toEqual([nearestOfAll]);
        else if (nearest) expect(got.length).toBeLessThanOrEqual(1);
      }
    }
  });

  it("leaves beads at one place whole (nothing tells them apart)", () => {
    expect(hitClip([[100, 100], [100, 100]], 0)).toBeNull();
  });

  it("writes a clip-path in the button's own pixels (the origin is its top left corner)", () => {
    const clip = hitClip([[100, 100], [124, 100]], 0)!;

    expect(clip).toBe("polygon(0px 0px, 34px 0px, 34px 44px, 0px 44px)"); // the line is 12 px to the right of the centre
  });

  it("writes the property only where it changed, and removes it where nothing cuts the square any more", () => {
    const log: string[] = [];
    const style = (n: string) => ({ setProperty: (k: string, v: string) => log.push(`${n} set ${k} ${v}`), removeProperty: (k: string) => log.push(`${n} remove ${k}`) });
    const styles = [style("a"), style("b")];
    const was: (string | null)[] = [null, null];

    writeHits(styles, [[100, 100], [124, 100]], was);
    expect(log).toHaveLength(2);
    writeHits(styles, [[100, 100], [124, 100]], was);
    expect(log).toHaveLength(2); // unchanged: nothing written
    writeHits(styles, [[100, 100], [300, 100]], was);
    expect(log.slice(2)).toEqual(["a remove --hit", "b remove --hit"]);
  });
  it("leaves covered beads out: a visible bead keeps its whole square against a covered neighbour, which takes no clip itself", () => {
    const heads: XY[] = [[100, 100], [124, 100], [300, 300]];

    expect(hitClip(heads, 0)).not.toBeNull();
    expect(hitClip(heads, 0, BEAD_HIT_HALF, [false, true, false])).toBeNull();
    expect(hitCorners(heads, 0, BEAD_HIT_HALF, [false, true, false])).toEqual([[-22, -22], [22, -22], [22, 22], [-22, 22]]);
    // still cut by the neighbours that are not covered
    expect(hitClip(heads, 0, BEAD_HIT_HALF, [false, false, true])).not.toBeNull();
  });

  it("writes nothing for a covered bead and the whole square for its visible neighbour", () => {
    const log: string[] = [];
    const style = (n: string) => ({ setProperty: (k: string) => log.push(`${n} set ${k}`), removeProperty: (k: string) => log.push(`${n} remove ${k}`) });
    const was: (string | null)[] = [null, null];

    writeHits([style("a"), style("b")], [[100, 100], [124, 100]], was, [false, true]);
    expect(was).toEqual([null, null]);
    expect(log).toEqual([]); // nothing to remove, nothing to write: both squares whole
    writeHits([style("a"), style("b")], [[100, 100], [124, 100]], was, [false, false]); // the card goes: both cut again
    expect(was.every((w) => w !== null)).toBe(true);
  });
});
