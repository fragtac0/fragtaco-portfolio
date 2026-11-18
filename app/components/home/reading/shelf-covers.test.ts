import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SiteBook } from "~/types";

// the canvas work and the idle scheduler are stood in for: this is about which covers are painted
const painted: Array<{ id: string; real: boolean }> = [];
vi.mock("./shelf-canvases", () => ({
  coverCanvas: (d: SiteBook, img: unknown) => {
    painted.push({ id: d.id, real: !!img });
    return {} as HTMLCanvasElement;
  },
}));
vi.mock("./cover-colours", () => ({ coloursOfImage: () => null }));
vi.mock("../../../utils/idle", () => ({ idleSlice: (cb: () => void) => cb() }));

import { createCoverQueue } from "./shelf-covers";

const book = (id: string): SiteBook => ({
  id,
  title: id,
  author: "A",
  pages: 1,
  isbn: id,
  heightIn: 9,
  aspect: 0.66,
  color: "#222",
  style: "band",
  note: "n",
});
const tex = () => ({} as never);

function queue() {
  return createCoverQueue({
    disposed: () => false,
    ready: () => true,
    running: () => false,
    calm: () => true,
    upload: vi.fn(),
    colours: vi.fn(),
    pixels: () => 640,
  });
}

beforeEach(() => {
  painted.length = 0;
  vi.stubGlobal("window", {
    clearTimeout: () => undefined,
    setTimeout: (cb: () => void) => (cb(), 0),
  });
});
afterEach(() => vi.unstubAllGlobals());

describe("repaintGenerated", () => {
  it("paints a book that has no real cover, and leaves one whose real cover is painted", () => {
    const q = queue();
    const a = book("a");
    const b = book("b");
    const ta = tex();
    const tb = tex();
    q.add(ta, a, { naturalWidth: 300, src: "" } as HTMLImageElement); // a's real cover arrives and is painted
    expect(painted).toEqual([{ id: "a", real: true }]);
    painted.length = 0;
    q.repaintGenerated(ta, a);
    q.repaintGenerated(tb, b);
    expect(painted).toEqual([{ id: "b", real: false }]); // only the generated one
  });

  it("a plain repaint still paints a real cover again", () => {
    const q = queue();
    const a = book("a");
    const ta = tex();
    q.add(ta, a, { naturalWidth: 300, src: "" } as HTMLImageElement);
    painted.length = 0;
    q.repaint(ta, a);
    expect(painted).toEqual([{ id: "a", real: true }]);
  });
});
