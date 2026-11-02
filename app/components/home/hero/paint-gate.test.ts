import { describe, expect, it } from "vitest";
import { paintStep } from "./paint-gate";

const idle = {
  pageVisible: true,
  heroOn: true,
  layerOpen: false,
  cardOpen: false,
  active: false,
  sinceLastDraw: 0,
};

describe("paintStep", () => {
  it("parks when the tab is hidden", () => {
    expect(paintStep({ ...idle, pageVisible: false, active: true })).toBe("park");
  });
  it("parks when the hero is off screen", () => {
    expect(paintStep({ ...idle, heroOn: false })).toBe("park");
  });
  it("parks when a layer is open", () => {
    expect(paintStep({ ...idle, layerOpen: true, active: true })).toBe("park");
  });
  it("parks behind an open card once settled", () => {
    expect(paintStep({ ...idle, cardOpen: true })).toBe("park");
  });
  it("draws behind an open card while the blur moves", () => {
    expect(paintStep({ ...idle, cardOpen: true, active: true })).toBe("draw");
  });
  it("waits when idle and drawn recently", () => {
    expect(paintStep({ ...idle, sinceLastDraw: 20 })).toBe("wait");
  });
  it("draws when idle and 32 ms have passed", () => {
    expect(paintStep({ ...idle, sinceLastDraw: 40 })).toBe("draw");
  });
  it("draws every frame while active", () => {
    expect(paintStep({ ...idle, active: true, sinceLastDraw: 5 })).toBe("draw");
  });
});
