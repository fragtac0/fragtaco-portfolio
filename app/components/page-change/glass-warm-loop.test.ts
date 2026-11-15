import { describe, expect, it } from "vitest";
import { warmLoop, type WarmEnv, type WarmSize } from "./glass-warm-loop";

/** A page that can be told what happens during a warm-up. */
function page(opts: { screen?: WarmSize; onWarm?: (call: number, state: ReturnType<typeof page>) => boolean | void } = {}) {
  const state = {
    vignette: { w: 1440, h: 900 } as WarmSize | null,
    screen: opts.screen ?? { w: 1440, h: 900 },
    warm: false,
    hidden: false,
    marks: 0,
    warmed: [] as WarmSize[],
    calls: 0,
    visibleWaits: 0,
    env: null as unknown as WarmEnv,
  };
  state.env = {
    calm: () => Promise.resolve(),
    hidden: () => state.hidden,
    untilVisible: () => {
      state.visibleWaits++;
      state.hidden = false;
      return Promise.resolve();
    },
    vignette: () => state.vignette,
    screen: () => state.screen,
    warmOnce: (size) => {
      state.calls++;
      state.warmed.push(size);
      return Promise.resolve(opts.onWarm?.(state.calls, state) ?? true);
    },
    isWarm: () => state.warm,
    markWarm: () => {
      state.warm = true;
      state.marks++;
    },
  };
  return state;
}

describe("warmLoop (R56)", () => {
  it("marks after one warm-up of the vignette in the filters", async () => {
    const p = page();
    expect(await warmLoop(p.env)).toBe(true);
    expect(p.marks).toBe(1);
    expect(p.calls).toBe(1);
  });

  it("does nothing when it is warm already", async () => {
    const p = page();
    p.warm = true;
    expect(await warmLoop(p.env)).toBe(false);
    expect(p.calls).toBe(0);
    expect(p.marks).toBe(0);
  });

  it("a vignette made again during the warm-up is not marked warm; the loop warms the new size and marks that", async () => {
    const p = page({
      onWarm: (call, s) => {
        if (call === 1) {
          // the resize's debounce ran during the first warm-up: a new vignette for the new screen, and warm put back to false
          s.screen = { w: 1100, h: 800 };
          s.vignette = { w: 1100, h: 800 };
          s.warm = false;
        }
        return true;
      },
    });
    expect(await warmLoop(p.env)).toBe(true);
    expect(p.calls).toBe(2);
    expect(p.warmed.map((s) => `${s.w}x${s.h}`)).toEqual(["1440x900", "1100x800"]);
    expect(p.marks).toBe(1); // once, and for the second size
  });

  it("the size is compared by object: a remake to the same numbers is a new vignette and is warmed again", async () => {
    const p = page({
      onWarm: (call, s) => {
        if (call === 1) s.vignette = { w: s.screen.w, h: s.screen.h };
        return true;
      },
    });
    expect(await warmLoop(p.env)).toBe(true);
    expect(p.calls).toBe(2);
    expect(p.marks).toBe(1);
  });

  it("a warm-up that a change cut short is tried again", async () => {
    const p = page({ onWarm: (call) => call >= 3 });
    expect(await warmLoop(p.env)).toBe(true);
    expect(p.calls).toBe(3);
    expect(p.marks).toBe(1);
  });

  it("a screen that was resized, with no new vignette yet, ends the loop without a mark (the remake warms)", async () => {
    const p = page({ screen: { w: 1100, h: 800 } });
    expect(await warmLoop(p.env)).toBe(false);
    expect(p.calls).toBe(0);
    expect(p.marks).toBe(0);
  });

  it("waits for a hidden tab to show, then warms", async () => {
    const p = page();
    p.hidden = true;
    expect(await warmLoop(p.env)).toBe(true);
    expect(p.visibleWaits).toBe(1);
    expect(p.marks).toBe(1);
  });

  it("gives up after its attempts when no warm-up ever completes", async () => {
    const p = page({ onWarm: () => false });
    expect(await warmLoop(p.env, 5)).toBe(false);
    expect(p.calls).toBe(5);
    expect(p.marks).toBe(0);
  });
});
