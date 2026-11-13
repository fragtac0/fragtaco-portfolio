import { describe, expect, it } from "vitest";
import {
  RECENT_KEY,
  RECENT_LIMIT,
  REVEAL_TRIES,
  nextRevealTry,
  makeOrder,
  nextDelayMs,
  paintingSrc,
  parseFocal,
  pickNext,
  firstPaintingSrc,
  preloadImage,
  CAPTION_IN_MS,
  CAPTION_OUT_MS,
  captionState,
  mayStartSwap,
  nextPhase,
  type CyclePhase,
} from "./painting-cycle";

describe("parseFocal", () => {
  it("reads percentages as fractions", () => {
    expect(parseFocal("50% 30%")).toEqual([0.5, 0.3]);
  });
  it("falls back to the centre", () => {
    expect(parseFocal("bogus")).toEqual([0.5, 0.5]);
  });
});

describe("makeOrder", () => {
  it("is a permutation starting with first", () => {
    let seed = 7;
    const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const o = makeOrder(5, 3, r);
    expect(o[0]).toBe(3);
    expect([...o].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4]);
  });
  it("handles a single item", () => {
    expect(makeOrder(1, 0, () => 0.5)).toEqual([0]);
  });
  it("shuffles the rest with the random it is given (Fisher-Yates from the end)", () => {
    // random 0 always swaps with the first slot: [1,2,3,4] -> [2,3,4,1]
    expect(makeOrder(5, 0, () => 0)).toEqual([0, 2, 3, 4, 1]);
    // random near 1 always picks the slot itself: the rest stay in order
    expect(makeOrder(5, 0, () => 0.999999)).toEqual([0, 1, 2, 3, 4]);
  });
  it("gives different orders for different random sequences", () => {
    const seeded = (seed: number) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const orders = new Set([1, 2, 3, 4, 5, 6].map((n) => makeOrder(10, 0, seeded(n)).join(",")));
    expect(orders.size).toBeGreaterThan(3);
  });
});

describe("nextDelayMs", () => {
  it("is exactly ten seconds", () => {
    expect(nextDelayMs()).toBe(10000);
  });
});

describe("pickNext", () => {
  const ids = ["0", "1", "2", "3"];
  it("takes the next position when it is not recent", () => {
    expect(pickNext([3, 1, 2, 0], 0, [], ids)).toBe(1);
  });
  it("skips a painting among the last three shown", () => {
    expect(pickNext([3, 1, 2, 0], 0, ["1"], ids)).toBe(2);
    expect(pickNext([3, 1, 2, 0], 0, ["1", "2"], ids)).toBe(3);
  });
  it("wraps round the end of the order", () => {
    expect(pickNext([3, 1, 2, 0], 3, [], ids)).toBe(0);
    expect(pickNext([3, 1, 2, 0], 2, ["0"], ids)).toBe(0);
    expect(pickNext([3, 1, 2, 0], 2, ["0", "3"], ids)).toBe(1);
  });
  it("falls back to the plain next one when every other painting is recent", () => {
    expect(pickNext([3, 1, 2, 0], 0, ["0", "1", "2", "3"], ids)).toBe(1);
  });
  it("stays put with a single painting", () => {
    expect(pickNext([0], 0, ["0"], ["0"])).toBe(0);
  });
});

describe("paintingSrc", () => {
  it("uses the 1600 copy on a small effective width", () => {
    expect(paintingSrc("a.jpg", 375, 3, false)).toBe("/paintings/1600/a.jpg");
  });
  it("uses the 2560 copy on a large effective width", () => {
    expect(paintingSrc("a.jpg", 1440, 2, false)).toBe("/paintings/2560/a.jpg");
  });
  it("asks for the WebP copy when the browser can show it", () => {
    expect(paintingSrc("a.jpg", 375, 3, true)).toBe("/paintings/1600/a.webp");
    expect(paintingSrc("a.jpg", 1440, 2, true)).toBe("/paintings/2560/a.webp");
  });
  it("keeps the 1400 rule at the edge", () => {
    expect(paintingSrc("a.jpg", 1400, 1, true)).toBe("/paintings/1600/a.webp");
    expect(paintingSrc("a.jpg", 1401, 1, true)).toBe("/paintings/2560/a.webp");
    expect(paintingSrc("a.jpg", 934, 1.5, false)).toBe("/paintings/2560/a.jpg");
  });
});

describe("constants", () => {
  it("matches the existing recent rule", () => {
    expect(RECENT_KEY).toBe("heroRecentPaintings");
    expect(RECENT_LIMIT).toBe(3);
  });
});

describe("nextRevealTry", () => {
  it("tries the first painting, then the next in the order, then gives up", () => {
    expect(REVEAL_TRIES).toBe(2);
    expect(nextRevealTry(0, 22)).toBe(0);
    expect(nextRevealTry(1, 22)).toBe(1);
    expect(nextRevealTry(2, 22)).toBeNull();
  });
  it("never tries more paintings than exist", () => {
    expect(nextRevealTry(0, 0)).toBeNull();
    expect(nextRevealTry(0, 1)).toBe(0);
    expect(nextRevealTry(1, 1)).toBeNull();
  });
  it("honours a larger limit (the skipped loader, which locks nothing)", () => {
    expect(nextRevealTry(5, 22, 22)).toBe(5);
    expect(nextRevealTry(22, 22, 22)).toBeNull();
  });
});

/** The HTML spec's source selection for `srcset` (width descriptors) with `sizes="100vw"`. */
function srcsetPick(srcset: string, viewportWidth: number, dpr: number): string {
  const candidates = srcset.split(",").map((c) => {
    const [url, w] = c.trim().split(/\s+/);
    return { url, density: parseInt(w, 10) / viewportWidth };
  });
  const enough = candidates.filter((c) => c.density >= dpr).sort((a, b) => a.density - b.density);
  if (enough.length > 0) return enough[0].url;
  return candidates.sort((a, b) => b.density - a.density)[0].url;
}

describe("the head preload and the first painting's request", () => {
  const widths = [320, 375, 390, 412, 430, 600, 768, 820, 1024, 1120, 1280, 1366, 1400, 1401, 1440, 1536, 1920, 2560, 3840];
  const dprs = [1, 1.25, 1.5, 2, 2.625, 3, 3.5];

  it("preloads the WebP copies, 1600 at 1400w and 2560 at 2560w, as a high priority image", () => {
    expect(preloadImage("school-of-athens.jpg")).toEqual({
      rel: "preload",
      as: "image",
      type: "image/webp",
      href: "/paintings/1600/school-of-athens.webp",
      imageSrcSet: "/paintings/1600/school-of-athens.webp 1400w, /paintings/2560/school-of-athens.webp 2560w",
      imageSizes: "100vw",
      fetchpriority: "high",
    });
  });

  it("asks for the very file the preload's srcset resolves to, at every width and density", () => {
    const { imageSrcSet } = preloadImage("a.jpg");
    for (const w of widths) {
      for (const dpr of dprs) {
        expect(firstPaintingSrc("a.jpg", w, dpr, true), `${w}px at ${dpr}x`).toBe(srcsetPick(imageSrcSet, w, dpr));
      }
    }
  });

  it("falls back to the JPEG by the same size rule", () => {
    expect(firstPaintingSrc("a.jpg", 390, 3, false)).toBe("/paintings/1600/a.jpg");
    expect(firstPaintingSrc("a.jpg", 1440, 1, false)).toBe("/paintings/2560/a.jpg");
  });

  it("differs from the later paintings' rule only where the density cap applies", () => {
    // a 412 px phone at 3.5x: the preload resolves to 2560, the later paintings stay on 1600
    expect(firstPaintingSrc("a.jpg", 412, 3.5, true)).toBe("/paintings/2560/a.webp");
    expect(paintingSrc("a.jpg", 412, 3.5, true)).toBe("/paintings/1600/a.webp");
  });
});

describe("the words under a painting change", () => {
  it("fades out, then the painting changes, then fades in only after the swap is done", () => {
    let phase: CyclePhase = "resting";
    const seen: Array<{ phase: CyclePhase; visible: boolean; swap: boolean }> = [];
    const note = () => seen.push({ phase, visible: captionState(phase).visible, swap: mayStartSwap(phase) });
    note();
    for (const e of ["start", "faded", "done"] as const) {
      phase = nextPhase(phase, e);
      note();
    }
    expect(seen).toEqual([
      { phase: "resting", visible: true, swap: false },
      { phase: "caption-out", visible: false, swap: false },
      { phase: "swapping", visible: false, swap: true },
      { phase: "swapped", visible: true, swap: false },
    ]);
  });
  it("keeps the words hidden from the start of the fade-out until the swap is done", () => {
    for (const phase of ["caption-out", "swapping"] as const) expect(captionState(phase).visible).toBe(false);
    for (const phase of ["resting", "swapped"] as const) expect(captionState(phase).visible).toBe(true);
  });
  it("fades out in about 400 ms and in over the existing 0.9 s", () => {
    expect(captionState("caption-out").fadeMs).toBe(CAPTION_OUT_MS);
    expect(CAPTION_OUT_MS).toBe(400);
    expect(captionState("swapped").fadeMs).toBe(CAPTION_IN_MS);
  });
  it("does not show the words again if the swap is not done, whatever else arrives", () => {
    expect(nextPhase("caption-out", "done")).toBe("caption-out");
    expect(nextPhase("caption-out", "start")).toBe("caption-out");
    expect(nextPhase("swapping", "faded")).toBe("swapping");
    expect(nextPhase("swapping", "start")).toBe("swapping");
    expect(nextPhase("resting", "done")).toBe("resting");
    expect(nextPhase("resting", "faded")).toBe("resting");
  });
  it("starts the next change from a rest or from a finished swap", () => {
    expect(nextPhase("resting", "start")).toBe("caption-out");
    expect(nextPhase("swapped", "start")).toBe("caption-out");
  });
});
