import { describe, expect, it } from "vitest";
import { SETTLE_AT, cardMargin, cardPose, dragProgress, restScale } from "./card-pose";

const desktop = { vw: 1440, width: 778, rail: 100, hot: false };
const phone = { vw: 375, width: 315, rail: 80, hot: false };

describe("restScale", () => {
  it("is 0.5 under 700 and 0.56 from 700 up", () => {
    expect(restScale(375)).toBe(0.5);
    expect(restScale(699)).toBe(0.5);
    expect(restScale(700)).toBe(0.56);
    expect(restScale(1440)).toBe(0.56);
  });
});

describe("cardMargin", () => {
  it("centres the card under 700", () => {
    expect(cardMargin(375, 315)).toBe(30);
  });
  it("is 4.5% of the viewport from 700 up", () => {
    expect(cardMargin(1440, 778)).toBeCloseTo(64.8);
  });
  it("never goes below 24 from 700 up", () => {
    expect(Math.max(24, 700 * 0.045)).toBe(31.5);
    expect(cardMargin(700, 400)).toBe(31.5);
    expect(cardMargin(700, 400)).toBeGreaterThanOrEqual(24);
  });
});

describe("cardPose", () => {
  it("right/rest peeks the scaled rail", () => {
    expect(cardPose({ ...desktop, side: "right", mode: "rest" })).toEqual({ x: 1440 - 56, s: 0.56 });
  });
  it("hot nudges a resting card 14px further in, on both sides", () => {
    expect(cardPose({ ...desktop, side: "right", mode: "rest", hot: true })).toEqual({ x: 1440 - 56 - 14, s: 0.56 });
    expect(cardPose({ ...desktop, side: "left", mode: "rest", hot: true })).toEqual({ x: -778 + 56 + 14, s: 0.56 });
  });
  it("left/rest peeks the scaled rail from the left", () => {
    expect(cardPose({ ...desktop, side: "left", mode: "rest" })).toEqual({ x: -778 + 56, s: 0.56 });
  });
  it("uses the phone rest scale under 700", () => {
    expect(cardPose({ ...phone, side: "right", mode: "rest" })).toEqual({ x: 375 - 40, s: 0.5 });
  });
  it("right/open sits at the margin on scale 1", () => {
    const p = cardPose({ ...desktop, side: "right", mode: "open" });
    expect(p.s).toBe(1);
    expect(p.x).toBeCloseTo(1440 - 778 - 64.8);
  });
  it("left/open sits at the margin on scale 1", () => {
    const p = cardPose({ ...desktop, side: "left", mode: "open" });
    expect(p.s).toBe(1);
    expect(p.x).toBeCloseTo(64.8);
  });
  it("left/open on a phone is centred", () => {
    expect(cardPose({ ...phone, side: "left", mode: "open" })).toEqual({ x: 30, s: 1 });
    expect(cardPose({ ...phone, side: "right", mode: "open" })).toEqual({ x: 30, s: 1 });
  });
  it("open ignores hot", () => {
    expect(cardPose({ ...desktop, hot: true, side: "left", mode: "open" })).toEqual(
      cardPose({ ...desktop, side: "left", mode: "open" }),
    );
  });
  it("hidden is off screen on both sides, at the rest scale", () => {
    expect(cardPose({ ...desktop, side: "right", mode: "hidden" })).toEqual({ x: 1440 + 40, s: 0.56 });
    expect(cardPose({ ...desktop, side: "left", mode: "hidden" })).toEqual({ x: -778 - 40, s: 0.56 });
    expect(cardPose({ ...phone, side: "left", mode: "hidden" }).s).toBe(0.5);
    expect(cardPose({ ...desktop, side: "left", mode: "hidden" }).x + 778).toBeLessThan(0);
  });
});

describe("dragProgress", () => {
  it("is sign * dx over 80% of the card width", () => {
    expect(dragProgress(-311.2, 778, 1)).toBe(0);
    expect(dragProgress(-311.2, 778, -1)).toBeCloseTo(0.5);
    expect(dragProgress(311.2, 778, 1)).toBeCloseTo(0.5);
  });
  it("clamps to 0..1", () => {
    expect(dragProgress(5000, 778, 1)).toBe(1);
    expect(dragProgress(-5000, 778, 1)).toBe(0);
    expect(dragProgress(0, 778, -1)).toBe(0);
  });
});

describe("SETTLE_AT", () => {
  it("is 0.3", () => {
    expect(SETTLE_AT).toBe(0.3);
  });
});
