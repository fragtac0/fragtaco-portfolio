import { describe, expect, it } from "vitest";
import { hasArea, nearScreen, planFlip, REDUCED_MS, STAGGER_MS, TRAVEL_EASE, TRAVEL_MS } from "./flip-plan";

const screen = { vw: 1440, vh: 900 };
const base = { index: 0, reduced: false, ...screen };
const rect = (left: number, top: number, width: number, height: number) => ({ left, top, width, height });

describe("hasArea and nearScreen", () => {
  it("tells a measured box from a hidden one", () => {
    expect(hasArea(rect(0, 0, 10, 10))).toBe(true);
    expect(hasArea(rect(0, 0, 0, 0))).toBe(false);
    expect(hasArea(rect(5, 5, 10, 0))).toBe(false);
  });

  it("allows a margin round the screen", () => {
    expect(nearScreen(rect(100, 100, 50, 50), 1440, 900)).toBe(true);
    expect(nearScreen(rect(-100, 100, 50, 50), 1440, 900)).toBe(true);
    expect(nearScreen(rect(-400, 100, 50, 50), 1440, 900)).toBe(false);
    expect(nearScreen(rect(100, 2000, 50, 50), 1440, 900)).toBe(false);
    expect(nearScreen(rect(1600, 100, 50, 50), 1440, 900)).toBe(false);
  });
});

describe("planFlip travel", () => {
  it("starts shifted and scaled to look as it did, and ends at rest", () => {
    const plan = planFlip(rect(0, 0, 100, 100), rect(300, 200, 200, 200), base);
    expect(plan).not.toBeNull();
    const [first, last] = plan!.keyframes;
    // centres: from (50, 50), to (400, 300): shift (-350, -250); half the size
    expect(first.translate).toBe("-350.00px -250.00px");
    expect(first.scale).toBe("0.5000 0.5000");
    expect(last.translate).toBe("0px 0px");
    expect(last.scale).toBe("1 1");
  });

  it("uses 600 ms and the overshoot curve, and staggers 12 ms per item", () => {
    const a = planFlip(rect(0, 0, 100, 100), rect(300, 200, 100, 100), base)!;
    expect(a.duration).toBe(TRAVEL_MS);
    expect(TRAVEL_MS).toBe(600);
    expect(a.easing).toBe(TRAVEL_EASE);
    expect(a.delay).toBe(0);
    const b = planFlip(rect(0, 0, 100, 100), rect(300, 200, 100, 100), { ...base, index: 5 })!;
    expect(b.delay).toBe(5 * STAGGER_MS);
    expect(STAGGER_MS).toBe(12);
  });

  it("scales the two sides separately", () => {
    const plan = planFlip(rect(0, 0, 100, 50), rect(0, 0, 50, 100), base)!;
    expect(plan.keyframes[0].scale).toBe("2.0000 0.5000");
  });

  it("needs nothing when it has not moved", () => {
    expect(planFlip(rect(10, 10, 100, 100), rect(10.2, 10.2, 100, 100), base)).toBeNull();
  });

  it("skips an item off screen at both ends", () => {
    expect(planFlip(rect(0, 5000, 100, 100), rect(0, 6000, 100, 100), base)).toBeNull();
  });

  it("still travels when only one end is on screen", () => {
    expect(planFlip(rect(0, 5000, 100, 100), rect(300, 200, 100, 100), base)).not.toBeNull();
    expect(planFlip(rect(300, 200, 100, 100), rect(0, 5000, 100, 100), base)).not.toBeNull();
  });

  it("has nothing to travel from or to without a box", () => {
    expect(planFlip(rect(0, 0, 0, 0), rect(300, 200, 100, 100), base)).toBeNull();
    expect(planFlip(rect(300, 200, 100, 100), rect(0, 0, 0, 0), base)).toBeNull();
  });
});

describe("planFlip fades", () => {
  it("fades an item in at its place, however far it was", () => {
    const plan = planFlip(rect(0, 0, 0, 0), rect(300, 200, 100, 100), { ...base, fade: "in" })!;
    expect(plan.keyframes[0]).toMatchObject({ opacity: 0, translate: "0px 0px" });
    expect(plan.keyframes[1]).toMatchObject({ opacity: 1, translate: "0px 0px" });
    expect(plan.keyframes.some((k) => "scale" in k)).toBe(false);
  });

  it("fades an item out where it was, held at the shift it had", () => {
    const plan = planFlip(rect(300, 0, 100, 100), rect(300, 200, 100, 100), { ...base, fade: "out" })!;
    expect(plan.keyframes[0]).toMatchObject({ opacity: 1, translate: "0.00px -200.00px", visibility: "visible" });
    expect(plan.keyframes[1]).toMatchObject({ opacity: 0, translate: "0.00px -200.00px", visibility: "visible" });
  });

  it("staggers fades too", () => {
    const plan = planFlip(rect(0, 0, 0, 0), rect(300, 200, 100, 100), { ...base, index: 3, fade: "in" })!;
    expect(plan.delay).toBe(36);
  });
});

describe("planFlip reduced motion", () => {
  const reduced = { ...base, reduced: true };

  it("is a 150 ms opacity crossfade with no travel and no delay", () => {
    const plan = planFlip(rect(0, 0, 100, 100), rect(900, 600, 300, 300), { ...reduced, index: 9 })!;
    expect(plan.duration).toBe(REDUCED_MS);
    expect(REDUCED_MS).toBe(150);
    expect(plan.delay).toBe(0);
    expect(plan.keyframes).toEqual([{ opacity: 0 }, { opacity: 1 }]);
  });

  it("fades an item out the other way", () => {
    const plan = planFlip(rect(300, 200, 100, 100), rect(300, 200, 100, 100), { ...reduced, fade: "out" })!;
    expect(plan.keyframes).toEqual([{ opacity: 1 }, { opacity: 0 }]);
  });

  it("still skips an item that nobody sees", () => {
    expect(planFlip(rect(0, 5000, 10, 10), rect(0, 6000, 10, 10), reduced)).toBeNull();
  });
});
