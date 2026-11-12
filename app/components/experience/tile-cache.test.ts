import { describe, expect, it, vi } from "vitest";
import { createTileCache, PINNED } from "./tile-cache";

type Job = { url: string; ok: () => void; fail: () => void };

function setup(o: { concurrency?: number; keep?: number } = {}) {
  const jobs: Job[] = [];
  const onLoad = vi.fn();
  const load = (url: string) =>
    new Promise<HTMLImageElement>((resolve, reject) => {
      jobs.push({ url, ok: () => resolve({ src: url } as unknown as HTMLImageElement), fail: () => reject(new Error("x")) });
    });
  const cache = createTileCache(onLoad, { ...o, load });
  const settle = () => new Promise((r) => setTimeout(r, 0));

  return { cache, jobs, onLoad, settle };
}

describe("tile cache", () => {
  it("fetches at most `concurrency` tiles at once, in the order asked", () => {
    const { cache, jobs } = setup({ concurrency: 2 });

    cache.want([
      { z: 1, x: 0, y: 0 },
      { z: 1, x: 1, y: 0 },
      { z: 1, x: 0, y: 1 },
    ]);
    expect(jobs.map((j) => j.url)).toEqual(["/mars/1/0_0.webp", "/mars/1/1_0.webp"]);
  });

  it("starts the next tile when one arrives, tells the map, and then holds the picture", async () => {
    const { cache, jobs, onLoad, settle } = setup({ concurrency: 1 });

    cache.want([
      { z: 0, x: 0, y: 0 },
      { z: 1, x: 0, y: 0 },
    ]);
    expect(cache.get(0, 0, 0)).toBeUndefined();
    jobs[0].ok();
    await settle();
    expect(onLoad).toHaveBeenCalledTimes(1);
    expect(cache.get(0, 0, 0)).toBeDefined();
    expect(jobs).toHaveLength(2);
  });

  it("does not ask twice for a tile that is here or on its way", async () => {
    const { cache, jobs, settle } = setup();

    cache.want([{ z: 1, x: 0, y: 0 }]);
    cache.want([{ z: 1, x: 0, y: 0 }]);
    expect(jobs).toHaveLength(1);
    jobs[0].ok();
    await settle();
    cache.want([{ z: 1, x: 0, y: 0 }]);
    expect(jobs).toHaveLength(1);
  });

  it("drops tiles no longer wanted from the queue when a new list arrives", async () => {
    const { cache, jobs } = setup({ concurrency: 1 });

    cache.want([
      { z: 3, x: 0, y: 0 },
      { z: 3, x: 1, y: 0 },
      { z: 3, x: 2, y: 0 },
    ]);
    cache.want([{ z: 3, x: 5, y: 5 }]);
    jobs[0].ok();
    await new Promise((r) => setTimeout(r, 0));
    expect(jobs.map((j) => j.url)).toEqual(["/mars/3/0_0.webp", "/mars/3/5_5.webp"]);
  });

  it("does not ask again for a tile that failed", async () => {
    const { cache, jobs, settle } = setup();

    cache.want([{ z: 1, x: 0, y: 0 }]);
    jobs[0].fail();
    await settle();
    cache.want([{ z: 1, x: 0, y: 0 }]);
    expect(jobs).toHaveLength(1);
    expect(cache.get(1, 0, 0)).toBeUndefined();
  });

  it("drops the least recently used finer tiles past `keep`, and never the coarse levels", async () => {
    const { cache, jobs, settle } = setup({ concurrency: 1000, keep: 3 });
    const fine = Array.from({ length: 6 }, (_, i) => ({ z: 4, x: i, y: 0 }));

    cache.want([...fine, { z: PINNED, x: 0, y: 0 }]);
    for (const j of jobs) {
      j.ok();
      await settle();
    }
    // 6 fine tiles loaded in order 0..5; with room for three (plus the 21 coarse ones' allowance) the oldest go
    // keep 3 means more than 3 + 21 = 24 are needed before anything is dropped, so load 20 more
    const more = Array.from({ length: 20 }, (_, i) => ({ z: 4, x: i, y: 1 }));

    cache.want(more);
    for (const j of jobs.slice(7)) {
      j.ok();
      await settle();
    }
    expect(cache.get(PINNED, 0, 0)).toBeDefined();
    expect(cache.get(4, 0, 0)).toBeUndefined(); // the oldest fine tile is gone
    expect(cache.get(4, 19, 1)).toBeDefined(); // the newest stays
  });

  it("stops everything on destroy", async () => {
    const { cache, jobs, onLoad, settle } = setup({ concurrency: 1 });

    cache.want([
      { z: 1, x: 0, y: 0 },
      { z: 1, x: 1, y: 0 },
    ]);
    cache.destroy();
    jobs[0].ok();
    await settle();
    expect(onLoad).not.toHaveBeenCalled();
    expect(jobs).toHaveLength(1);
    expect(cache.get(1, 0, 0)).toBeUndefined();
  });
});
