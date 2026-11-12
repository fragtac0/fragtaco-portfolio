// The map's tile pictures: fetched a few at a time, kept decoded as ImageBitmaps (`fetch` then `createImageBitmap`
// on the blob: the decode runs off the main thread, and the first `drawImage` of a new tile has nothing to decode or
// convert; with an `<img>` and `decode()` the frames just after a batch of tiles arrived ran 33 to 67 ms at 4 times
// slower CPU), the least recently drawn finer ones dropped when there are too many (a level 4 tile decodes to about 1 MiB). The
// coarse levels (0 to `PINNED`) stay for good: they are what a missing finer tile is drawn from, so there is
// never an empty frame (spec 9.2).
import { tilePath, type Tile } from "./tiles";

type Address = Pick<Tile, "z" | "x" | "y">;

/** What the canvas draws a tile from: an ImageBitmap where the browser can make one, else the decoded `<img>`. */
export type TileImage = ImageBitmap | HTMLImageElement;

export type TileCache = {
  /** The decoded picture, if it has arrived. Marks the tile as just used. */
  get(z: number, x: number, y: number): TileImage | undefined;
  /** The tiles to fetch now, most wanted first. Replaces the previous list; what is already here or on its way is skipped. */
  want(list: readonly Address[]): void;
  destroy(): void;
};

type Options = {
  /** Fetches at once. */
  concurrency?: number;
  /** Decoded tiles above the pinned levels to keep. */
  keep?: number;
  /** Loads one tile's picture (replaced in tests). */
  load?: (url: string) => Promise<TileImage>;
};

/** Levels up to this one are never dropped. */
export const PINNED = 2;

const keyOf = (t: Address) => `${t.z}/${t.x}_${t.y}`;

/** Fetches a tile and has the browser decode it into an ImageBitmap off the main thread (no `<img>` element, no `decode()` round trip). */
async function loadBitmap(url: string): Promise<ImageBitmap> {
  const res = await fetch(url);

  if (!res.ok) throw new Error(`tile ${url}: ${res.status}`);

  return createImageBitmap(await res.blob());
}

/** Fetches and decodes a tile into an `<img>`, for a browser without `createImageBitmap`. */
function loadImage(url: string): Promise<HTMLImageElement> {
  const img = new Image();

  img.decoding = "async";
  img.src = url;

  return img.decode().then(() => img);
}

const defaultLoad: (url: string) => Promise<TileImage> = (url) =>
  typeof createImageBitmap === "function" && typeof fetch === "function" ? loadBitmap(url) : loadImage(url);

/** Gives a dropped bitmap's memory back (an `<img>` has nothing to free). */
function release(img: TileImage) {
  if ("close" in img) img.close();
}

/** `onLoad` runs after each tile arrives (the map draws again). */
export function createTileCache(onLoad: () => void, o: Options = {}): TileCache {
  const limit = o.concurrency ?? 6;
  const keep = o.keep ?? 110;
  const load = o.load ?? defaultLoad;
  const done = new Map<string, { img: TileImage; z: number; used: number }>();
  const flying = new Set<string>();
  const failed = new Set<string>();
  let queue: Address[] = [];
  let clock = 0;
  let dead = false;

  const drop = () => {
    if (done.size <= keep + 21) return; // 21 tiles are levels 0 to 2, never dropped
    const loose = [...done.entries()].filter(([, e]) => e.z > PINNED).sort((a, b) => a[1].used - b[1].used);

    for (let i = 0; i < loose.length - keep; i++) {
      release(loose[i][1].img);
      done.delete(loose[i][0]);
    }
  };

  const pump = () => {
    while (!dead && flying.size < limit && queue.length > 0) {
      const t = queue.shift() as Address;
      const k = keyOf(t);

      if (done.has(k) || flying.has(k) || failed.has(k)) continue;
      flying.add(k);
      load(tilePath(t)).then(
        (img) => {
          flying.delete(k);
          if (dead) {
            release(img);
            return;
          }
          done.set(k, { img, z: t.z, used: ++clock });
          drop();
          onLoad();
          pump();
        },
        () => {
          flying.delete(k);
          failed.add(k); // a missing tile is not asked for again; the coarser one stays
          if (!dead) pump();
        },
      );
    }
  };

  return {
    get(z, x, y) {
      const e = done.get(keyOf({ z, x, y }));

      if (!e) return undefined;
      e.used = ++clock;

      return e.img;
    },
    want(list) {
      queue = list.filter((t) => {
        const k = keyOf(t);

        return !done.has(k) && !flying.has(k) && !failed.has(k);
      });
      pump();
    },
    destroy() {
      dead = true;
      queue = [];
      for (const e of done.values()) release(e.img);
      done.clear();
    },
  };
}
