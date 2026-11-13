import { describe, expect, it } from "vitest";
import { posterPose, posterTransform } from "./layer-poster";

describe("posterPose", () => {
  it("scales a block to the smallest size that covers the screen, about the screen's middle", () => {
    const block = { left: 58, top: 90, width: 648, height: 615 };
    const pose = posterPose(block, 1440, 900);
    expect(pose.scale).toBeCloseTo(1440 / 648, 6); // the width decides (2.22 against 1.46)
    expect(pose.dx).toBeCloseTo(720 - (58 + 324), 6);
    expect(pose.dy).toBeCloseTo(450 - (90 + 307.5), 6);
  });

  it("lets the height decide on a tall screen", () => {
    expect(posterPose({ left: 0, top: 0, width: 300, height: 300 }, 390, 844).scale).toBeCloseTo(844 / 300, 6);
  });

  it("covers the screen at the end: every edge of the scaled block is outside the screen", () => {
    for (const [block, vw, vh] of [
      [{ left: 58, top: 90, width: 648, height: 615 }, 1440, 900],
      [{ left: 20, top: 700, width: 350, height: 580 }, 390, 844],
      [{ left: 500, top: -300, width: 640, height: 640 }, 1024, 768],
    ] as const) {
      const p = posterPose(block, vw, vh);
      const w = block.width * p.scale;
      const h = block.height * p.scale;
      const cx = block.left + block.width / 2 + p.dx;
      const cy = block.top + block.height / 2 + p.dy;
      expect(cx - w / 2).toBeLessThanOrEqual(1e-6);
      expect(cy - h / 2).toBeLessThanOrEqual(1e-6);
      expect(cx + w / 2).toBeGreaterThanOrEqual(vw - 1e-6);
      expect(cy + h / 2).toBeGreaterThanOrEqual(vh - 1e-6);
    }
  });

  it("does not move or scale a block with no size", () => {
    expect(posterPose({ left: 5, top: 5, width: 0, height: 0 }, 1440, 900)).toEqual({ dx: 0, dy: 0, scale: 1 });
  });
});

describe("posterTransform", () => {
  it("is none without a pose, and a translate then a scale with one", () => {
    expect(posterTransform(null)).toBe("none");
    expect(posterTransform({ dx: 10, dy: -4, scale: 2 })).toBe("translate(10px, -4px) scale(2)");
  });
});
