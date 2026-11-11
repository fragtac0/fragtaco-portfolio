import { describe, expect, it } from "vitest";
import { DRAG_PX, isDrag, pressIsStale, startsPress } from "./shelf-drag";

const mouse = (buttons: number) => ({ pointerId: 1, pointerType: "mouse", buttons });

describe("isDrag", () => {
  it("is a drag only over 6px, in either direction", () => {
    expect(DRAG_PX).toBe(6);
    expect(isDrag(6)).toBe(false);
    expect(isDrag(-6)).toBe(false);
    expect(isDrag(6.5)).toBe(true);
    expect(isDrag(-7)).toBe(true);
    expect(isDrag(0)).toBe(false);
  });
});

describe("pressIsStale", () => {
  it("drops a mouse press when the mouse moves with no button held", () => {
    expect(pressIsStale({ id: 1 }, mouse(0))).toBe(true);
  });
  it("keeps a live mouse press", () => {
    expect(pressIsStale({ id: 1 }, mouse(1))).toBe(false);
  });
  it("is never stale without a press, for touch, or for another pointer", () => {
    expect(pressIsStale(null, mouse(0))).toBe(false);
    expect(pressIsStale({ id: 5 }, { pointerId: 5, pointerType: "touch", buttons: 0 })).toBe(false);
    expect(pressIsStale({ id: 2 }, mouse(0))).toBe(false);
  });
});

describe("startsPress", () => {
  it("starts when nothing is down", () => {
    expect(startsPress(null, { pointerId: 1 })).toBe(true);
  });
  it("lets the same pointer replace a stale record", () => {
    expect(startsPress({ id: 1 }, { pointerId: 1 })).toBe(true);
  });
  it("ignores a second finger while a drag is live", () => {
    expect(startsPress({ id: 1 }, { pointerId: 2 })).toBe(false);
  });
});
