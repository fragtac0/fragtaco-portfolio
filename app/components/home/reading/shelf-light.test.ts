import { describe, expect, it } from "vitest";
import { addShelfLights, lightLevels } from "./shelf-light";

describe("lightLevels", () => {
  it("at rest is an ambient light of PI only, which lights a face to exactly its painted colour", () => {
    expect(lightLevels(0)).toEqual({ ambient: Math.PI, key: 0 });
  });
  it("gives some of the ambient light to a soft key light as the book lifts", () => {
    const full = lightLevels(1);
    expect(full.ambient).toBeLessThan(Math.PI);
    expect(full.ambient).toBeGreaterThan(0.6 * Math.PI);
    expect(full.key).toBeGreaterThan(0);
    expect(full.key).toBeLessThan(0.6 * Math.PI);
  });
  it("moves smoothly and in one direction, and clamps", () => {
    let last = lightLevels(0);
    for (let i = 1; i <= 100; i++) {
      const cur = lightLevels(i / 100);
      expect(cur.ambient).toBeLessThanOrEqual(last.ambient);
      expect(cur.key).toBeGreaterThanOrEqual(last.key);
      expect(last.ambient - cur.ambient).toBeLessThan(0.02 * Math.PI);
      last = cur;
    }
    expect(lightLevels(-1)).toEqual(lightLevels(0));
    expect(lightLevels(2)).toEqual(lightLevels(1));
  });
  it("keeps a face turned to the viewer within 8% of its painted brightness at every lift", () => {
    // the key light comes from the upper left in front: (-3, 4, 6); a face turned to the viewer has normal (0, 0, 1)
    const l = Math.hypot(-3, 4, 6);
    const facing = 6 / l;
    for (let i = 0; i <= 20; i++) {
      const { ambient, key } = lightLevels(i / 20);
      const bright = (ambient + key * facing) / Math.PI;
      expect(bright).toBeGreaterThan(0.92);
      expect(bright).toBeLessThan(1.08);
    }
  });
  it("shades a face turned away from the key light darker than one turned towards it", () => {
    const { ambient, key } = lightLevels(1);
    const l = Math.hypot(-3, 4, 6);
    const left = (ambient + key * Math.max(0, -1 * (-3 / l))) / Math.PI; // normal (-1, 0, 0)
    const right = (ambient + key * Math.max(0, 1 * (-3 / l))) / Math.PI; // normal (1, 0, 0)
    expect(left).toBeGreaterThan(right);
  });
});

describe("addShelfLights", () => {
  class Light {
    intensity: number;
    position = { x: 0, y: 0, z: 0, set: (x: number, y: number, z: number) => Object.assign(this.position, { x, y, z }) };
    constructor(
      public color: number,
      intensity: number,
    ) {
      this.intensity = intensity;
    }
  }
  const T = { AmbientLight: class extends Light {}, DirectionalLight: class extends Light {} };
  const make = () => {
    const added: Light[] = [];
    const scene = { add: (...l: Light[]) => added.push(...l) };
    const lights = addShelfLights(T as never, scene as never);
    return { lights, added };
  };

  it("adds an ambient light at PI and a key light at 0, up and to the left in front", () => {
    const { added } = make();
    expect(added).toHaveLength(2);
    expect(added[0].intensity).toBe(Math.PI);
    expect(added[1].intensity).toBe(0);
    expect(added[1].position.x).toBeLessThan(0);
    expect(added[1].position.y).toBeGreaterThan(0);
    expect(added[1].position.z).toBeGreaterThan(0);
  });
  it("sets both strengths and says whether anything changed", () => {
    const { lights, added } = make();
    expect(lights.set(0)).toBe(false);
    expect(lights.set(1)).toBe(true);
    expect(added[0].intensity).toBeCloseTo(lightLevels(1).ambient, 12);
    expect(added[1].intensity).toBeCloseTo(lightLevels(1).key, 12);
    expect(lights.set(1)).toBe(false);
    expect(lights.set(0)).toBe(true);
    expect(added[0].intensity).toBe(Math.PI);
    expect(added[1].intensity).toBe(0);
  });
});
