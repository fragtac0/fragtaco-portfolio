import { describe, expect, it } from "vitest";
import { BOX, queue, settle, setup, step, installDriverEnv } from "./move-driver-fake";
import { REDUCED_FADE_MS } from "./open-move";

installDriverEnv();

describe("the move driver: reduced motion", () => {
  it("never grows a frame: the black rises over the page with the scene in its box, then the open page fades in", () => {
    const t = setup({ reduced: true });
    t.driver.go(1);
    expect(t.scene.parentElement).toBe(t.slot);
    // first quarter: the shade is rising, the scene is still in its box
    step(16);
    step(REDUCED_FADE_MS / 4);
    expect(Number(t.shade.props.get("opacity"))).toBeGreaterThan(0.3);
    expect(Number(t.shade.props.get("opacity"))).toBeLessThan(0.9);
    expect(t.scene.parentElement).toBe(t.slot);
    expect(t.scene.dataset.at).toBeUndefined();
    // the second half: carried to the layer under the black, fading in
    step(REDUCED_FADE_MS * 0.4);
    expect(t.scene.dataset.at).toBe("open");
    expect(Number(t.shade.props.get("opacity"))).toBe(1);
    expect(Number(t.scene.props.get("opacity"))).toBeLessThan(1);
    settle();
    expect(t.done).toHaveBeenCalledExactlyOnceWith(1);
    // no frame of it was a growing frame
    expect(t.calls.every((c) => c.frame === null || c.frame.width === 1440 || c.frame.width === BOX.width)).toBe(true);
    expect(t.scene.props.has("width")).toBe(false);
  });

  it("the scene is never in the layer while the page is lit (an empty box beside a lit page)", () => {
    const t = setup({ reduced: true });
    t.driver.go(1);
    let seenCarriedLit = false;
    for (let i = 0; i < 20 && queue.length; i++) {
      step(10);
      if (t.scene.dataset.at && Number(t.shade.props.get("opacity") ?? 0) < 1) seenCarriedLit = true;
    }
    expect(seenCarriedLit).toBe(false);
  });

  it("closing is the dip backwards and ends with the scene back in its box", () => {
    const t = setup({ reduced: true });
    t.driver.go(1);
    settle();
    t.done.mockClear();
    t.driver.go(0);
    step(16);
    expect(t.scene.dataset.at).toBe("open"); // still the open page, fading out
    step(REDUCED_FADE_MS * 0.75);
    expect(t.scene.parentElement).toBe(t.slot); // back in the box under the black while it lifts
    expect(Number(t.shade.props.get("opacity"))).toBeGreaterThan(0);
    settle();
    expect(t.done).toHaveBeenCalledExactlyOnceWith(0);
    expect(t.scene.dataset.at).toBeUndefined();
    expect(t.shade.props.get("opacity")).toBe("0");
    expect(t.docked.at(-1)).toBe(true);
  });

  it("an instant open is the open page at once", () => {
    const t = setup({ reduced: true });
    t.driver.go(1, true);
    expect(t.scene.dataset.at).toBe("open");
    expect(t.done).toHaveBeenCalledExactlyOnceWith(1);
    expect(queue.length).toBe(0);
  });
});
