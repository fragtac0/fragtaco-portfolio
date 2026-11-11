import { describe, expect, it } from "vitest";
import {
  BLOCK,
  BLOCKS,
  CENTRE,
  LEVELS,
  LON_SCALE,
  LON_SPAN_DEG,
  SIZE,
  SPAN_DEG,
  TILE,
  blockBox,
  frameBounds,
} from "./mars-frame.mjs";

describe("frame size", () => {
  it("is 8192 px across in 512 px tiles over 5 levels, served in 4096 px blocks", () => {
    expect(TILE).toBe(512);
    expect(LEVELS).toBe(5);
    expect(SIZE).toBe(8192);
    expect(BLOCK).toBe(4096);
    expect(BLOCKS).toBe(2);
  });
});

describe("frame geometry", () => {
  it("is centred on the summit and 14 degrees of latitude tall", () => {
    const b = frameBounds();
    expect((b.west + b.east) / 2).toBeCloseTo(CENTRE.lon, 10);
    expect((b.south + b.north) / 2).toBeCloseTo(CENTRE.lat, 10);
    expect(b.north - b.south).toBeCloseTo(SPAN_DEG, 10);
  });

  it("is square on the ground: longitude span times cos(latitude) equals the latitude span", () => {
    expect(LON_SCALE).toBeCloseTo(Math.cos((CENTRE.lat * Math.PI) / 180), 12);
    expect(LON_SCALE).toBeGreaterThan(0.94);
    expect(LON_SCALE).toBeLessThan(0.96);
    const b = frameBounds();
    expect(b.east - b.west).toBeCloseTo(LON_SPAN_DEG, 10);
    expect(LON_SPAN_DEG * LON_SCALE).toBeCloseTo(SPAN_DEG, 10);
  });
});

describe("blockBox", () => {
  it("block 0,0 starts at the north west corner and 1,1 ends at the south east corner", () => {
    const b = frameBounds();
    const [w, , , n] = blockBox(0, 0);
    expect(w).toBeCloseTo(b.west, 10);
    expect(n).toBeCloseTo(b.north, 10);
    const [, s, e] = blockBox(1, 1);
    expect(s).toBeCloseTo(b.south, 10);
    expect(e).toBeCloseTo(b.east, 10);
  });

  it("the four blocks meet exactly, with no gap or overlap", () => {
    const [w0, s0, e0, n0] = blockBox(0, 0);
    const [w1, , e1, n1] = blockBox(1, 0);
    const [, s2, , n2] = blockBox(0, 1);
    expect(e0).toBeCloseTo(w1, 10);
    expect(s0).toBeCloseTo(n2, 10);
    expect(n0).toBeCloseTo(n1, 10);
    expect(w0).toBeLessThan(e0);
    expect(s2).toBeLessThan(n2);
    expect(e1 - w1).toBeCloseTo(e0 - w0, 10);
  });

  it("each block is half the frame each way, a square on the ground", () => {
    const [w, s, e, n] = blockBox(1, 0);
    expect(e - w).toBeCloseTo(LON_SPAN_DEG / 2, 10);
    expect(n - s).toBeCloseTo(SPAN_DEG / 2, 10);
  });
});
