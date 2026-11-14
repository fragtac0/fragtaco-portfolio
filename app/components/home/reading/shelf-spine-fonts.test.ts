import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SiteBook } from "~/types";
import { OPEN_FONT_WAIT_MS, FONT_WAIT_MS, familyOfFace } from "./spine-fonts";
import { createFontCap, createSpineFonts } from "./shelf-spine-fonts";
import { createSpineFace, lateSpines, type SpineBook } from "./shelf-spines";
import { FakePath2D, recordingCtx } from "./spine-test-ctx";

const book = (id: string, title: string): SiteBook => ({
  id,
  title,
  author: "Some Author",
  pages: 300,
  isbn: "0",
  heightIn: 9,
  aspect: 0.66,
  color: "#151312",
  style: "band",
  note: "n",
});
const story = book("story", "Story"); // Bodoni Moda
const cat = book("save-the-cat", "Save the Cat!"); // Unbounded
const blink = book("in-the-blink-of-an-eye", "In the Blink of an Eye"); // Bodoni Moda

type Listener = (e: Event) => void;

/** A page whose font set says which families are still loading, and can announce a face. */
function page(missing: string[], opts: { media?: string; loads?: boolean } = {}) {
  const pending = new Set(missing);
  const listeners = new Set<Listener>();
  const link = { media: opts.media ?? "all" };
  vi.stubGlobal("document", {
    createElement: () => {
      const { ctx, marks } = recordingCtx();
      const c = { width: 0, height: 0, getContext: () => ctx, marks };
      return c;
    },
    querySelector: () => link,
    fonts: {
      load: () => (opts.loads ? Promise.resolve([]) : new Promise(() => undefined)), // else never: the tests decide when a face "arrives"
      check: (face: string) => !pending.has(familyOfFace(face)),
      addEventListener: (_: string, l: Listener) => listeners.add(l),
      removeEventListener: (_: string, l: Listener) => listeners.delete(l),
    },
  });
  vi.stubGlobal("window", { setTimeout: (f: () => void, ms: number) => setTimeout(f, ms), clearTimeout: (t: number) => clearTimeout(t) });
  vi.stubGlobal("Path2D", FakePath2D);
  vi.stubGlobal("MutationObserver", class { observe() {} disconnect() {} });
  return {
    /** The family has loaded: the font set says so and announces it. */
    arrive(...families: string[]) {
      for (const f of families) pending.delete(f);
      const e = { type: "loadingdone", fontfaces: families.map((family) => ({ family })) } as unknown as Event;
      for (const l of listeners) l(e);
    },
    listening: () => listeners.size,
  };
}

function spine(d: SiteBook): SpineBook & { uploads: number } {
  const state = { uploads: 0 };
  const tex = {
    dispose: () => undefined,
    set needsUpdate(_: boolean) {
      state.uploads++;
    },
  };
  const face = createSpineFace(d, { w: 90, h: 600 }, () => tex as never);
  return Object.assign(state, { d, spine: face, H: 1.6, T: 0.26 });
}

/** The engine's slicer, run at once (the steps are counted). */
function runner() {
  const batches: number[] = [];
  const run = (steps: Array<() => void>) => {
    batches.push(steps.length);
    for (const s of steps) s();
    return Promise.resolve();
  };
  return { run, batches };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("a spine remembers the faces it lacked", () => {
  it("is empty when every face had loaded, and names the missing family's faces when not", () => {
    page([]);
    expect(spine(story).spine.missing).toEqual([]);
    vi.unstubAllGlobals();
    page(["Bodoni Moda"]);
    const s = spine(story);
    expect(s.spine.missing.length).toBeGreaterThan(0);
    expect(s.spine.missing.every((f) => familyOfFace(f) === "Bodoni Moda")).toBe(true);
  });

  it("counts a stylesheet still held back (media print) as missing, though the font set knows no such family", () => {
    page([], { media: "print" });
    expect(spine(story).spine.missing.length).toBeGreaterThan(0);
  });
});

describe("lateSpines", () => {
  it("lists only the spines that lacked a face that can be drawn now", () => {
    const p = page(["Bodoni Moda", "Unbounded"]);
    const a = spine(story);
    const b = spine(cat);
    const c = spine(blink);
    expect(lateSpines([a, b, c])).toEqual([]); // nothing has arrived
    p.arrive("Bodoni Moda");
    expect(lateSpines([a, b, c])).toEqual([a, c]); // the Unbounded one still waits
  });
});

describe("createSpineFonts: a late face", () => {
  it("paints again only the books whose family came, a few at a time, and says so after each step", async () => {
    const p = page(["Bodoni Moda", "Unbounded"]);
    const books = [story, cat, blink, story, blink];
    const spines = books.map(spine);
    const { run, batches } = runner();
    const repainted = vi.fn();
    const fonts = createSpineFonts(books, { repainted, cap: new Promise(() => undefined) });
    fonts.scene(spines, run);
    expect(batches).toEqual([]); // nothing arrived yet: nothing owed
    const uploads = spines.map((s) => s.uploads);
    p.arrive("Bodoni Moda");
    await vi.advanceTimersByTimeAsync(100);
    expect(batches).toEqual([2]); // four Bodoni spines, three to a step
    expect(repainted).toHaveBeenCalledTimes(2);
    expect(spines.map((s, i) => s.uploads - uploads[i])).toEqual([1, 0, 1, 1, 1]); // the Unbounded spine untouched
    // a second arrival of the same family owes nothing: those spines are no longer missing it
    p.arrive("Bodoni Moda");
    await vi.advanceTimersByTimeAsync(100);
    expect(batches).toEqual([2]);
    fonts.stop();
  });

  it("repaints nothing on a normal build: the spines were painted with their faces already loaded", async () => {
    const p = page([]);
    const spines = [story, cat].map(spine);
    const { run, batches } = runner();
    const fonts = createSpineFonts([story, cat], { repainted: vi.fn(), cap: new Promise(() => undefined) });
    p.arrive("Bodoni Moda", "Unbounded"); // the build's own loads finishing
    await vi.advanceTimersByTimeAsync(100);
    fonts.scene(spines, run);
    expect(batches).toEqual([]);
    fonts.stop();
  });

  it("repaints, once the scene exists, a book painted before a face that arrived since", async () => {
    const p = page(["Bodoni Moda"]);
    const s = spine(story);
    const { run, batches } = runner();
    const fonts = createSpineFonts([story], { repainted: vi.fn(), cap: new Promise(() => undefined) });
    p.arrive("Bodoni Moda");
    await vi.advanceTimersByTimeAsync(100); // no scene yet: nothing happens
    expect(batches).toEqual([]);
    fonts.scene([s], run);
    expect(batches).toEqual([1]);
    fonts.stop();
  });

  it("stops listening", () => {
    const p = page([]);
    const fonts = createSpineFonts([story], { repainted: vi.fn(), cap: new Promise(() => undefined) });
    expect(p.listening()).toBe(1);
    fonts.stop();
    expect(p.listening()).toBe(0);
  });
});

describe("the wait for the faces (R89)", () => {
  it("is over when the faces are", async () => {
    page([], { loads: true });
    const fonts = createSpineFonts([story], { repainted: vi.fn(), cap: new Promise(() => undefined) });
    await expect(fonts.ready).resolves.toBeUndefined();
    fonts.stop();
  });

  it("holds the idle path for the whole 2.5 s, and the open path for about 1 s", async () => {
    page(["Bodoni Moda"]); // loads never finish
    // idle: no cap
    let idle = false;
    const a = createSpineFonts([story], { repainted: vi.fn(), cap: new Promise(() => undefined) });
    void a.ready.then(() => (idle = true));
    await vi.advanceTimersByTimeAsync(OPEN_FONT_WAIT_MS + 200);
    expect(idle).toBe(false);
    await vi.advanceTimersByTimeAsync(FONT_WAIT_MS - OPEN_FONT_WAIT_MS);
    expect(idle).toBe(true);
    a.stop();
    // open: the layer waits, so the cap runs
    const cap = createFontCap();
    let open = false;
    const b = createSpineFonts([story], { repainted: vi.fn(), cap: cap.reached });
    void b.ready.then(() => (open = true));
    cap.waiting(true);
    await vi.advanceTimersByTimeAsync(OPEN_FONT_WAIT_MS - 1);
    expect(open).toBe(false);
    await vi.advanceTimersByTimeAsync(2);
    expect(open).toBe(true);
    b.stop();
  });

  it("is cut by the cap even when the interface faces (`also`) never come, and paints their covers again when they do", async () => {
    page([]);
    let arrive: () => void = () => undefined;
    const also = new Promise<void>((r) => (arrive = r));
    const cap = createFontCap();
    const late = vi.fn();
    const fonts = createSpineFonts([story], { repainted: vi.fn(), cap: cap.reached, also, alsoLate: late });
    let ready = false;
    void fonts.ready.then(() => (ready = true));
    await vi.advanceTimersByTimeAsync(5000);
    expect(ready).toBe(false); // nothing waits for the shelf yet: `also` is unbounded on the idle path
    cap.waiting(true);
    await vi.advanceTimersByTimeAsync(OPEN_FONT_WAIT_MS + 10);
    expect(ready).toBe(true);
    fonts.scene([spine(story)], runner().run);
    expect(late).not.toHaveBeenCalled();
    arrive();
    await vi.advanceTimersByTimeAsync(0);
    expect(late).toHaveBeenCalledTimes(1);
    fonts.stop();
  });

  it("does not paint the covers again when `also` was there before the paint", async () => {
    page([], { loads: true });
    const late = vi.fn();
    const fonts = createSpineFonts([story], { repainted: vi.fn(), cap: new Promise(() => undefined), also: Promise.resolve(), alsoLate: late });
    await fonts.ready;
    fonts.scene([spine(story)], runner().run);
    await vi.advanceTimersByTimeAsync(0);
    expect(late).not.toHaveBeenCalled();
    fonts.stop();
  });
});

describe("createFontCap", () => {
  it("runs while the layer waits, starts over if it was left, and stays reached", async () => {
    page([]);
    const cap = createFontCap(1000);
    let reached = false;
    void cap.reached.then(() => (reached = true));
    cap.waiting(true);
    await vi.advanceTimersByTimeAsync(600);
    cap.waiting(false);
    await vi.advanceTimersByTimeAsync(2000);
    expect(reached).toBe(false);
    cap.waiting(true);
    await vi.advanceTimersByTimeAsync(999);
    expect(reached).toBe(false);
    await vi.advanceTimersByTimeAsync(2);
    expect(reached).toBe(true);
    cap.waiting(false);
    cap.waiting(true);
    cap.stop();
  });
});
