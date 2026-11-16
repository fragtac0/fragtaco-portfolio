import { describe, expect, it } from "vitest";
import { prefitShelf, staleTextures } from "./shelf-prefit";
import type { ShelfScene } from "./shelf-scene";

type Tex = { id: string; version: number };

/** A scene with `n` spines and a ledge: `uploaded` holds each texture's last uploaded version (missing: never uploaded). */
function fakeScene(n: number, uploaded: Record<string, number>, calls: string[]) {
  const mk = (id: string): Tex => ({ id, version: 1 });
  const ledgeTex = mk("ledge");
  const spines = Array.from({ length: n }, (_, i) => mk(`s${i}`));
  const gl = {
    ledge: { material: { map: ledgeTex } },
    books: spines.map((tex) => ({ spine: { tex } })),
    renderer: {
      properties: { get: (t: Tex) => ({ __version: uploaded[t.id] }) },
      initTexture: (t: Tex) => {
        calls.push(`upload ${t.id}`);
        uploaded[t.id] = t.version;
      },
      clear: () => calls.push("clear"),
    },
  } as unknown as ShelfScene;
  return { gl, ledgeTex, spines };
}

/** The slicer's run, back to back: one step after the other. */
const run = (steps: Array<() => void>) => {
  for (const step of steps) step();
  return Promise.resolve();
};

describe("staleTextures", () => {
  it("lists the ledge and the spines whose upload is not their current version, and not a texture that is up to date", () => {
    const calls: string[] = [];
    const { gl } = fakeScene(3, { s0: 1, s1: 0 }, calls);
    // ledge: never uploaded, s0: current, s1: an old version, s2: never uploaded
    expect(staleTextures(gl).map((t) => (t as unknown as Tex).id)).toEqual(["ledge", "s1", "s2"]);
  });

  it("is empty when everything is uploaded at its version", () => {
    const { gl } = fakeScene(2, { ledge: 1, s0: 1, s1: 1 }, []);
    expect(staleTextures(gl)).toEqual([]);
  });
});

describe("prefitShelf", () => {
  it("fits and reframes first, then sends the changed textures three at a time, then clears the buffer; draws nothing", async () => {
    const calls: string[] = [];
    const { gl } = fakeScene(7, { s0: 1, s1: 1 }, calls);
    await prefitShelf({
      run,
      scene: () => gl,
      ready: () => true,
      fit: () => calls.push("fit"),
      reframe: (redraw) => calls.push(`reframe ${redraw}`),
    });
    expect(calls).toEqual([
      "fit",
      "reframe true",
      "upload ledge",
      "upload s2",
      "upload s3",
      "upload s4",
      "upload s5",
      "upload s6",
      "clear",
    ]);
  });

  it("puts each group of uploads in a step of its own (the slicer decides when each one happens)", async () => {
    const { gl } = fakeScene(7, {}, []);
    const sizes: number[] = [];
    await prefitShelf({
      run: (steps) => {
        sizes.push(steps.length);
        for (const step of steps) step();
        return Promise.resolve();
      },
      scene: () => gl,
      ready: () => true,
      fit: () => {},
      reframe: () => {},
    });
    // the fit, then 8 stale textures in 3 steps plus the clear
    expect(sizes).toEqual([1, 4]);
  });

  it("does nothing when the shelf is not ready (running, not docked, not mounted) or has no scene", async () => {
    const calls: string[] = [];
    const { gl } = fakeScene(3, {}, calls);
    const deps = { run, fit: () => calls.push("fit"), reframe: () => calls.push("reframe") };
    await prefitShelf({ ...deps, scene: () => gl, ready: () => false });
    await prefitShelf({ ...deps, scene: () => null, ready: () => true });
    expect(calls).toEqual([]);
  });

  it("stops at the first step that finds the shelf running: a started shelf did the work itself", async () => {
    const calls: string[] = [];
    const { gl } = fakeScene(7, {}, calls);
    let readyNow = true;
    await prefitShelf({
      run,
      scene: () => gl,
      ready: () => readyNow,
      fit: () => {
        calls.push("fit");
        readyNow = false; // the box came on screen and the shelf started
      },
      reframe: () => calls.push("reframe"),
    });
    expect(calls).toEqual(["fit", "reframe"]); // no upload, no clear after it
  });
});
