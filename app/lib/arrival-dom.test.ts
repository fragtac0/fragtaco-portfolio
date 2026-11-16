import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { endArrival, resetArrival, whenArrivalReady, LATE_FADE_MS } from "./arrival";
import { fadeLate, holdImages } from "./arrival-dom";

describe("holdImages", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    endArrival();
    vi.useRealTimers();
  });
  const adv = (ms: number) => vi.advanceTimersByTimeAsync(ms);

  /** A picture that has not loaded (a plain object: the test environment has no DOM); `land` loads it (complete, decodable) and fires its load event. */
  function picture() {
    const listeners: Record<string, Array<() => void>> = {};
    const animate = vi.fn();
    const img = {
      complete: false,
      naturalWidth: 100,
      dataset: {} as Record<string, string>,
      animate,
      decode: () => Promise.resolve(),
      addEventListener: (type: string, fn: () => void) => void (listeners[type] ??= []).push(fn),
    };
    const land = () => {
      img.complete = true;
      listeners.load?.forEach((fn) => fn());
    };
    return { img: img as unknown as HTMLImageElement, animate, land };
  }

  it("a picture that settles after the change has ended is faded over LATE_FADE_MS, once, and its own CSS fade is switched off", async () => {
    resetArrival();
    const p = picture();
    holdImages("map", [p.img]);
    const waited = whenArrivalReady(500);
    await adv(500);
    expect((await waited).late).toEqual(["map"]);
    endArrival(); // the change is over, the picture has still not come
    await adv(2500);
    expect(p.animate).not.toHaveBeenCalled();
    p.land();
    await adv(0);
    expect(p.animate).toHaveBeenCalledTimes(1);
    expect(p.animate).toHaveBeenCalledWith([{ opacity: 0 }, { opacity: 1 }], { duration: LATE_FADE_MS, easing: "ease-out" });
    expect(p.img.dataset.late).toBe("");
  });

  it("a picture that came before the reveal is not faded", async () => {
    resetArrival();
    const p = picture();
    p.land();
    holdImages("ground", [p.img]);
    await whenArrivalReady(500);
    await adv(0);
    expect(p.animate).not.toHaveBeenCalled();
    expect(p.img.dataset.late).toBeUndefined();
  });

  it("only the pictures that were pending at the reveal fade, when some are in and some are not", async () => {
    resetArrival();
    const quick = picture();
    const slow = picture();
    holdImages("wall", [quick.img, slow.img]);
    const waited = whenArrivalReady(500);
    quick.land();
    await adv(500);
    await waited;
    slow.land();
    await adv(0);
    expect(quick.animate).not.toHaveBeenCalled();
    expect(slow.animate).toHaveBeenCalledTimes(1);
  });

  it("does nothing when no change is waiting for the page", () => {
    const p = picture();
    expect(holdImages("map", [p.img])).toBeNull();
    p.land();
    expect(p.animate).not.toHaveBeenCalled();
  });

  it("fadeLate marks the element and animates opacity only", () => {
    const p = picture();
    fadeLate(p.img);
    expect(p.animate).toHaveBeenCalledWith([{ opacity: 0 }, { opacity: 1 }], expect.objectContaining({ duration: 200 }));
  });
});
