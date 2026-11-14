import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FONT_WAIT_MS, facesOf, familyOfFace, spineFontsReady, stylesheetApplied, watchSpineFonts } from "./spine-fonts";
import { SERIES } from "./spine-series";

type Listener = (e: Event) => void;

/** A page with a font set, and the spine faces' stylesheet link in the state given. */
function page(media: string | null) {
  const loads: { face: string; text: string; resolve: () => void }[] = [];
  const listeners = new Map<string, Set<Listener>>();
  const link = { media: media ?? "all" };
  let observer: (() => void) | null = null;
  const fonts = {
    load: (face: string, text: string) => new Promise<void>((resolve) => loads.push({ face, text, resolve })),
    addEventListener: (t: string, l: Listener) => void (listeners.get(t) ?? listeners.set(t, new Set()).get(t)!).add(l),
    removeEventListener: (t: string, l: Listener) => void listeners.get(t)?.delete(l),
  };
  vi.stubGlobal("document", { fonts, querySelector: () => (media === null ? null : link) });
  vi.stubGlobal("window", { setTimeout: (f: () => void, ms: number) => setTimeout(f, ms) });
  vi.stubGlobal(
    "MutationObserver",
    class {
      constructor(cb: () => void) {
        observer = cb;
      }
      observe() {}
      disconnect() {
        observer = null;
      }
    },
  );
  return {
    loads,
    link,
    apply() {
      link.media = "all";
      observer?.();
    },
    done(...families: string[]) {
      const e = { type: "loadingdone", fontfaces: families.map((family) => ({ family })) } as unknown as Event;
      for (const l of listeners.get("loadingdone") ?? []) l(e);
    },
    listening: () => listeners.get("loadingdone")?.size ?? 0,
  };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const designs = Object.values(SERIES);

describe("facesOf", () => {
  it("lists each face once, with the author's and the emblem's", () => {
    const faces = facesOf(designs);
    expect(new Set(faces).size).toBe(faces.length);
    expect(faces).toContain('italic 500 19px "Bodoni Moda"');
    expect(faces).toContain('500 10px "IBM Plex Mono"');
    expect(faces).toContain('600 17px "Bodoni Moda"');
    expect(faces.map(familyOfFace).every(Boolean)).toBe(true);
  });
  it("names the family of a face", () => {
    expect(familyOfFace('800 46px "Bodoni Moda"')).toBe("Bodoni Moda");
    expect(familyOfFace("bold 10px serif")).toBe("");
  });
});

describe("spineFontsReady", () => {
  it("waits for every face, loading each for the text on the spines", async () => {
    const p = page("all");
    let done = false;
    void spineFontsReady(designs, "Müller").then(() => (done = true));
    await vi.advanceTimersByTimeAsync(0);
    expect(p.loads.map((l) => l.face).sort()).toEqual(facesOf(designs).sort());
    expect(p.loads.every((l) => l.text === "Müller")).toBe(true);
    expect(done).toBe(false);
    p.loads.slice(1).forEach((l) => l.resolve());
    await vi.advanceTimersByTimeAsync(0);
    expect(done).toBe(false);
    p.loads[0].resolve();
    await vi.advanceTimersByTimeAsync(0);
    expect(done).toBe(true);
  });

  it("waits for the stylesheet to be switched on before it asks for any face", async () => {
    const p = page("print");
    expect(stylesheetApplied()).toBe(false);
    let done = false;
    void spineFontsReady(designs).then(() => (done = true));
    await vi.advanceTimersByTimeAsync(100);
    expect(p.loads).toHaveLength(0);
    p.apply();
    expect(stylesheetApplied()).toBe(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(p.loads.length).toBeGreaterThan(0);
    p.loads.forEach((l) => l.resolve());
    await vi.advanceTimersByTimeAsync(0);
    expect(done).toBe(true);
  });

  it("gives up after 2.5 s when a face never arrives, and never rejects", async () => {
    const p = page("all");
    let done = false;
    void spineFontsReady(designs).then(() => (done = true));
    await vi.advanceTimersByTimeAsync(FONT_WAIT_MS - 1);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(2);
    expect(done).toBe(true);
    expect(p.loads.length).toBeGreaterThan(0);
  });

  it("gives up after 2.5 s when the stylesheet is never switched on", async () => {
    page("print");
    let done = false;
    void spineFontsReady(designs).then(() => (done = true));
    await vi.advanceTimersByTimeAsync(FONT_WAIT_MS + 1);
    expect(done).toBe(true);
  });

  it("is ready at once on a page with no spine stylesheet, and does not wait for a font set that is missing", async () => {
    page(null);
    let done = false;
    void spineFontsReady(designs).then(() => (done = true));
    await vi.advanceTimersByTimeAsync(0);
    expect(done).toBe(false); // it still asks for the faces (the main stylesheet may declare them)
    vi.unstubAllGlobals();
    await expect(spineFontsReady(designs)).resolves.toBeUndefined();
  });
});

describe("watchSpineFonts", () => {
  it("calls back once, a moment later, when one of the spine faces arrives, and ignores the others", async () => {
    const p = page("all");
    const late = vi.fn();
    const stop = watchSpineFonts(designs, "x", late);
    p.done("Lora");
    await vi.advanceTimersByTimeAsync(200);
    expect(late).not.toHaveBeenCalled();
    p.done("Archivo");
    p.done("Bodoni Moda");
    await vi.advanceTimersByTimeAsync(200);
    expect(late).toHaveBeenCalledTimes(1);
    stop();
    expect(p.listening()).toBe(0);
    p.done("Archivo");
    await vi.advanceTimersByTimeAsync(200);
    expect(late).toHaveBeenCalledTimes(1);
  });

  it("starts the faces loading itself once a late stylesheet is switched on, so they do arrive", () => {
    const p = page("print");
    watchSpineFonts(designs, "x", () => undefined);
    expect(p.loads).toHaveLength(0);
    p.apply();
    expect(p.loads.length).toBe(facesOf(designs).length);
  });

  it("reads the family as the font set names it, quotes or not", async () => {
    const p = page("all");
    const late = vi.fn();
    watchSpineFonts(designs, "x", late);
    p.done('"Space Grotesk"');
    await vi.advanceTimersByTimeAsync(200);
    expect(late).toHaveBeenCalledTimes(1);
  });
});
