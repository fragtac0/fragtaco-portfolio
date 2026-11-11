import { describe, expect, it } from "vitest";
import { PLANE } from "./wall-math";
import { createParallax, easeToward, touchTarget } from "./wall-parallax";

describe("easeToward", () => {
  it("moves by 1 - exp(-dt * 6) of the gap", () => {
    expect(easeToward(0, 100, 0.1)).toBeCloseTo(100 * (1 - Math.exp(-0.6)));
    expect(easeToward(50, 0, 0.2)).toBeCloseTo(50 * Math.exp(-1.2));
  });

  it("is frame rate independent: two half steps are one whole step", () => {
    const once = easeToward(0, 100, 0.1);
    const twice = easeToward(easeToward(0, 100, 0.05), 100, 0.05);
    expect(twice).toBeCloseTo(once, 10);
  });

  it("stays where it is for a bad step or target", () => {
    expect(easeToward(5, 10, 0)).toBe(5);
    expect(easeToward(5, 10, -1)).toBe(5);
    expect(easeToward(5, 10, Number.NaN)).toBe(5);
    expect(easeToward(5, Number.NaN, 0.1)).toBe(5);
  });
});

describe("touchTarget", () => {
  it("is the middle of the screen for a still wall", () => {
    expect(touchTarget({ x: 0, y: 0 }, 390, 844)).toEqual({ x: 195, y: 422 });
  });

  it("is on the side the finger moves toward (the pan runs the other way)", () => {
    // finger right: the wall pans left (negative velocity): the stand-in pointer is on the right
    expect(touchTarget({ x: -600, y: 0 }, 400, 800).x).toBeGreaterThan(200);
    expect(touchTarget({ x: 600, y: 0 }, 400, 800).x).toBeLessThan(200);
    expect(touchTarget({ x: 0, y: 600 }, 400, 800).y).toBeLessThan(400);
  });

  it("stops at the screen edge, however fast the drag", () => {
    expect(touchTarget({ x: -99999, y: 99999 }, 400, 800)).toEqual({ x: 400, y: 0 });
    expect(touchTarget({ x: 99999, y: -99999 }, 400, 800)).toEqual({ x: 0, y: 800 });
  });

  it("ignores a velocity that is not a number", () => {
    expect(touchTarget({ x: Number.NaN, y: Infinity }, 400, 800)).toEqual({ x: 200, y: 400 });
  });
});

describe("createParallax", () => {
  it("has no lean before it has seen a pointer", () => {
    const p = createParallax(false);
    expect(p.shift("near")).toEqual({ x: 0, y: 0 });
  });

  it("leans against the pointer, the far plane by half as much", () => {
    const p = createParallax(false);
    // settle on a pointer at the top left corner of a 1000 by 800 stage
    for (let i = 0; i < 200; i++) p.update(0.05, { x: 0, y: 0 }, 1000, 800);
    const near = p.shift("near");
    const far = p.shift("far");
    expect(near.x).toBeCloseTo(14, 1);
    expect(near.y).toBeCloseTo(10, 1);
    expect(far.x).toBeCloseTo(near.x * PLANE.far.parallax, 5);
    expect(far.y).toBeCloseTo(near.y * PLANE.far.parallax, 5);
  });

  it("eases: one short step does not reach the target", () => {
    const p = createParallax(false);
    p.update(0.016, null, 1000, 800);
    p.update(0.016, { x: 0, y: 400 }, 1000, 800);
    const x = p.shift("near").x;
    expect(x).toBeGreaterThan(0);
    expect(x).toBeLessThan(14 * 0.2);
  });

  it("returns to the middle when the pointer goes away", () => {
    const p = createParallax(false);
    for (let i = 0; i < 100; i++) p.update(0.05, { x: 0, y: 0 }, 1000, 800);
    for (let i = 0; i < 200; i++) p.update(0.05, null, 1000, 800);
    const s = p.shift("near");
    expect(Math.abs(s.x)).toBeLessThan(0.01);
    expect(Math.abs(s.y)).toBeLessThan(0.01);
  });

  it("does not lean at all with reduced motion", () => {
    const p = createParallax(true);
    for (let i = 0; i < 100; i++) p.update(0.05, { x: 0, y: 0 }, 1000, 800);
    expect(p.shift("near")).toEqual({ x: 0, y: 0 });
    const tiles = [{ key: "0,0", x: 10, y: 20 }];
    p.lean(tiles);
    expect(tiles[0]).toMatchObject({ x: 10, y: 20, plane: "near" });
  });

  it("moves each tile by the lean of its own plane and records the plane", () => {
    const p = createParallax(false);
    for (let i = 0; i < 200; i++) p.update(0.05, { x: 0, y: 0 }, 1000, 800);
    const tiles: Array<{ key: string; x: number; y: number; plane?: "near" | "far" }> = [
      { key: "0,0", x: 100, y: 100 },
      { key: "1,0", x: 100, y: 100 },
      { key: "-1,2", x: 0, y: 0 },
    ];
    p.lean(tiles);
    expect(tiles[0].plane).toBe("near");
    expect(tiles[0].x).toBeCloseTo(114, 1);
    expect(tiles[1].plane).toBe("far");
    expect(tiles[1].x).toBeCloseTo(107, 1);
    expect(tiles[2].plane).toBe("far");
  });
});
