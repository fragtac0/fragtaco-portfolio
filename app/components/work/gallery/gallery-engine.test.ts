import { describe, expect, it, vi } from "vitest";
import { createGallery } from "./gallery-engine";

/** A canvas that has no WebGL: getContext answers null for everything. */
function noGlCanvas(): HTMLCanvasElement {
  const target = new EventTarget();
  return Object.assign(target, {
    getContext: () => null,
    clientWidth: 800,
    clientHeight: 600,
    width: 800,
    height: 600,
    style: {},
  }) as unknown as HTMLCanvasElement;
}

describe("createGallery without WebGL", () => {
  it("resolves to null instead of throwing, so the page keeps its plain grid", async () => {
    const error = vi.spyOn(console, "warn").mockImplementation(() => {});
    const out = await createGallery(noGlCanvas(), {
      items: [{ src: "data:,", art: "data:," }, { src: "data:,", art: "data:," }],
      aspect: 16 / 9,
      reduced: false,
      onHover: () => {},
    });
    error.mockRestore();
    expect(out).toBeNull();
  });
});

describe("the tile state", () => {
  it("fades a lone late picture in even when its upload stamp is later than the frame's own time", async () => {
    const T = await import("three");
    const { createTileState } = await import("./gallery-state");
    const state = createTileState(T, 3, false);
    const data = state.texture.image.data as Uint8Array;
    const loadedAt = new Float64Array(3);
    // the picture went up at 1005 ms inside a frame whose rAF time was 1000 ms: the raw reveal is negative
    loadedAt[2] = 1005;
    expect(state.step(1 / 60, 1000, loadedAt)).toBe(true); // still easing: the loop must go on
    expect(data[2 * 4]).toBe(0); // not wrapped to 254 or 255
    expect(state.step(1 / 60, 1100, loadedAt)).toBe(true);
    expect(data[2 * 4]).toBeGreaterThan(0);
    expect(data[2 * 4]).toBeLessThan(255);
    expect(state.step(1 / 60, 1400, loadedAt)).toBe(false); // done
    expect(data[2 * 4]).toBe(255);
    expect(data[0]).toBe(0); // the tiles that never loaded stay flat
  });
});

describe("the tile state's arrival", () => {
  const G = (data: Uint8Array, i: number) => data[i * 4 + 1];
  const A = (data: Uint8Array, i: number) => data[i * 4 + 3];

  it("shows nothing before the first frame, then brings the tiles in from the middle outward and stops asking for frames", async () => {
    const T = await import("three");
    const { createTileState } = await import("./gallery-state");
    const state = createTileState(T, 7, false);
    state.setLayout(7, 1, 0); // one row of seven: tile 3 is the middle
    const data = state.texture.image.data as Uint8Array;
    const loadedAt = new Float64Array(7);
    expect(state.step(1 / 60, 500, loadedAt)).toBe(false); // not started: nothing arrives, nothing to ask a frame for
    for (let i = 0; i < 7; i++) expect(G(data, i)).toBe(0);
    state.start(1000);
    expect(state.step(1 / 60, 1100, loadedAt)).toBe(true);
    const mid = G(data, 3);
    expect(mid).toBeGreaterThan(0);
    expect(G(data, 2)).toBeLessThan(mid); // a ring out, 45 ms behind
    expect(G(data, 0)).toBe(0); // three rings out: not yet started (135 ms)
    expect(A(data, 3)).toBeGreaterThan(0); // growing from 0.86
    expect(state.step(1 / 60, 1100 + 600, loadedAt)).toBe(false); // 600 ms in: the whole row is done (555 at most)
    for (let i = 0; i < 7; i++) {
      expect(G(data, i)).toBe(255);
      expect(A(data, i)).toBe(255);
    }
  });

  it("with reduced motion fades all together at full size", async () => {
    const T = await import("three");
    const { createTileState } = await import("./gallery-state");
    const state = createTileState(T, 4, true);
    state.setLayout(2, 2, 0);
    const data = state.texture.image.data as Uint8Array;
    state.start(0);
    state.step(1 / 60, 80, new Float64Array(4));
    for (let i = 0; i < 4; i++) {
      expect(G(data, i)).toBe(128);
      expect(A(data, i)).toBe(255); // full size
    }
  });

  it("instant: nothing before the first frame, then every tile whole at once with no arrival and no further frames asked for", async () => {
    const T = await import("three");
    const { createTileState } = await import("./gallery-state");
    const state = createTileState(T, 7, false);
    state.setLayout(7, 1, 0);
    const data = state.texture.image.data as Uint8Array;
    const loadedAt = new Float64Array(7);
    expect(state.step(1 / 60, 500, loadedAt)).toBe(false);
    for (let i = 0; i < 7; i++) expect(G(data, i)).toBe(0);
    state.start(1000, true);
    expect(state.step(1 / 60, 1016, loadedAt)).toBe(false); // the first frame after the start: all whole, nothing left to ease
    for (let i = 0; i < 7; i++) {
      expect(G(data, i)).toBe(255);
      expect(A(data, i)).toBe(255);
    }
  });

  it("shows a picture that was in before the first frame whole, and fades in one that comes after", async () => {
    const T = await import("three");
    const { createTileState } = await import("./gallery-state");
    const state = createTileState(T, 2, false);
    state.setLayout(2, 1, 0);
    const data = state.texture.image.data as Uint8Array;
    const loadedAt = new Float64Array(2);
    loadedAt[0] = 900; // up before the first frame at 1000
    state.start(1000);
    loadedAt[1] = 1200; // up during the arrival
    state.step(1 / 60, 1210, loadedAt);
    expect(data[0]).toBe(255);
    expect(data[4]).toBeGreaterThan(0);
    expect(data[4]).toBeLessThan(255);
    state.step(1 / 60, 1700, loadedAt);
    expect(data[4]).toBe(255);
  });
});

describe("revealOf and pickGrown", () => {
  it("clamps the reveal to 0 to 1 and never reveals a picture that has not loaded", async () => {
    const { revealOf } = await import("./gallery-state");
    expect(revealOf(0, 500, false)).toBe(0);
    expect(revealOf(1005, 1000, false)).toBe(0);
    expect(revealOf(1000, 1175, false)).toBeCloseTo(0.5, 6);
    expect(revealOf(1000, 9000, false)).toBe(1);
    expect(revealOf(1000, 1000, true)).toBe(1);
  });
  it("keeps the hovered tile in the last slot, whatever the other amounts, and never drops it", async () => {
    const { pickGrown } = await import("./gallery-state");
    const out = pickGrown(
      [
        [1, 0.9],
        [2, 0.5],
        [3, 0.4],
        [4, 0.3],
        [5, 0.01],
      ],
      5,
      4,
    );
    expect(out[out.length - 1][0]).toBe(5);
    expect(out).toHaveLength(4);
    expect(out.map((e) => e[0])).toEqual([3, 2, 1, 5]); // the rest smallest first
    // no hover target: strongest last, the weakest dropped
    expect(pickGrown([[1, 0.2], [2, 0.8], [3, 0.5]], null, 2).map((e) => e[0])).toEqual([3, 2]);
    // a target that is not grown yet changes nothing
    expect(pickGrown([[1, 0.2]], 7, 4).map((e) => e[0])).toEqual([1]);
  });
});
