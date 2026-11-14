import { describe, expect, it } from "vitest";
import type { Camera } from "./wall-camera";
import { createChoiceHold, thawWaits } from "./wall-choice";
import type { Pose } from "./wall-pose";
import { createWallState, type Tile } from "./wall-types";

describe("thawWaits (when the close lets go of the choice only once the camera has arrived)", () => {
  const base = { running: true, chosen: true, settled: false };

  it("waits while the loop runs, a video is chosen and the camera has distance to go", () => {
    expect(thawWaits(base)).toBe(true);
    expect(thawWaits({ ...base, instant: false })).toBe(true);
  });

  it("lets go at once for an instant close, whatever the camera is doing (a resize)", () => {
    expect(thawWaits({ ...base, instant: true })).toBe(false);
  });

  it("lets go at once when the camera has arrived, nothing is chosen or the loop is not running", () => {
    expect(thawWaits({ ...base, settled: true })).toBe(false);
    expect(thawWaits({ ...base, chosen: false })).toBe(false);
    expect(thawWaits({ ...base, running: false })).toBe(false);
  });
});

describe("the choice hold (freeze, release, thaw)", () => {
  function hold(running: boolean, settled: boolean) {
    const st = createWallState();
    st.tiles = [{ key: "1,1", idx: 5 } as unknown as Tile];
    let resets = 0;
    const cam = { arrived: settled };
    const h = createChoiceHold(st, { reset: () => resets++ } as unknown as Pose, { settled: () => cam.arrived } as unknown as Camera, () => running);
    return { st, h, cam, resets: () => resets };
  }

  it("freeze chooses the tile and thaw lets go of it at once when the camera has arrived", () => {
    const { st, h, resets } = hold(true, true);
    h.freeze("1,1");
    expect(st.choice).toEqual({ key: "1,1", idx: 5, live: true });
    expect(st.hoverKey).toBe("1,1");
    h.thaw();
    expect(st.choice).toBeNull();
    expect(resets()).toBe(1);
  });

  it("thaw waits for the camera while the loop runs, and the loop's tick lets go when it arrives", () => {
    const { st, h, cam } = hold(true, false);
    h.freeze("1,1");
    h.thaw();
    expect(st.choice).not.toBeNull();
    h.tick();
    expect(st.choice).not.toBeNull();
    cam.arrived = true;
    h.tick();
    expect(st.choice).toBeNull();
  });

  it("an instant thaw, or a thaw with the loop stopped, lets go at once; stopping drops a wait", () => {
    const a = hold(true, false);
    a.h.freeze("1,1");
    a.h.thaw(true);
    expect(a.st.choice).toBeNull();
    const b = hold(false, false);
    b.h.freeze("1,1");
    b.h.thaw();
    expect(b.st.choice).toBeNull();
    const c = hold(true, false);
    c.h.freeze("1,1");
    c.h.thaw();
    c.h.cancel();
    c.cam.arrived = true;
    c.h.tick();
    expect(c.st.choice).not.toBeNull();
  });

  it("the same video again while it closes opens again, and release marks the choice not live", () => {
    const { st, h } = hold(true, false);
    h.freeze("1,1");
    h.release();
    expect(st.choice?.live).toBe(false);
    h.freeze("1,1");
    expect(st.choice?.live).toBe(true);
  });
});
