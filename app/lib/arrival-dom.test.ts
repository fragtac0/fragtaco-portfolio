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
    const veil = { pause: vi.fn(), play: vi.fn(), cancel: vi.fn(), onfinish: null as null | (() => void) };
    const animate = vi.fn((..._args: unknown[]) => veil);
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
    return { img: img as unknown as HTMLImageElement, animate, veil, land };
  }

  it("a picture still on its way is veiled at opacity 0 from the moment it is held (paused, fill both), so it is never painted whole before its fade", () => {
    resetArrival();
    const p = picture();
    holdImages("map", [p.img]);
    expect(p.animate).toHaveBeenCalledTimes(1);
    expect(p.animate).toHaveBeenCalledWith([{ opacity: 0 }, { opacity: 1 }], { duration: LATE_FADE_MS, easing: "ease-out", fill: "both" });
    expect(p.veil.pause).toHaveBeenCalledTimes(1);
    expect(p.veil.play).not.toHaveBeenCalled();
  });

  it("a picture that settles after the change has ended plays its veil: a fade over LATE_FADE_MS, once, and its own CSS fade is switched off", async () => {
    resetArrival();
    const p = picture();
    holdImages("map", [p.img]);
    const waited = whenArrivalReady(500);
    await adv(500);
    expect((await waited).late).toEqual(["map"]);
    endArrival(); // the change is over, the picture has still not come
    await adv(2500);
    expect(p.veil.play).not.toHaveBeenCalled();
    expect(p.veil.cancel).not.toHaveBeenCalled(); // still held at 0
    p.land();
    await adv(0);
    expect(p.veil.play).toHaveBeenCalledTimes(1);
    expect(p.animate).toHaveBeenCalledTimes(1); // the veil is the one animation
    expect(p.img.dataset.late).toBe("");
    p.veil.onfinish?.(); // when it ends the picture is at its own opacity again
    expect(p.veil.cancel).toHaveBeenCalledTimes(1);
  });

  it("a picture that came before the reveal is not faded: its veil is taken off and it is simply there", async () => {
    resetArrival();
    const p = picture();
    holdImages("ground", [p.img]);
    const waited = whenArrivalReady(500);
    p.land();
    await waited;
    await adv(0);
    expect(p.veil.play).not.toHaveBeenCalled();
    expect(p.veil.cancel).toHaveBeenCalledTimes(1);
    expect(p.img.dataset.late).toBeUndefined();
  });

  it("a picture that is already in is not veiled or faded", async () => {
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
    expect(quick.veil.play).not.toHaveBeenCalled();
    expect(quick.veil.cancel).toHaveBeenCalledTimes(1);
    expect(slow.veil.play).toHaveBeenCalledTimes(1);
    expect(slow.veil.cancel).not.toHaveBeenCalled();
  });

  it("does nothing when no change is waiting for the page", () => {
    const p = picture();
    expect(holdImages("map", [p.img])).toBeNull();
    p.land();
    expect(p.animate).not.toHaveBeenCalled();
  });

  it("fadeLate without a veil (an element made after the reveal, like the hero's sharp painting) animates opacity only, once", () => {
    const p = picture();
    fadeLate(p.img);
    expect(p.animate).toHaveBeenCalledTimes(1);
    expect(p.animate).toHaveBeenCalledWith([{ opacity: 0 }, { opacity: 1 }], { duration: LATE_FADE_MS, easing: "ease-out" });
    expect(p.img.dataset.late).toBe("");
  });
});
