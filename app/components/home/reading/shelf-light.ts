import type * as THREE from "three";

/**
 * The light on a lifted book (spec 8: lit softly from the upper left). The row is unlit, so its
 * spines are exactly their painted colours; a book that is open uses lit materials, and these two
 * lights are all that light them. At rest (`mix` 0) there is only an ambient light of strength
 * PI, which lights a face to exactly its painted colour, so the swap from the row's unlit
 * materials shows no jump; as the book rises (`mix` 1) some of the ambient gives way to a soft
 * key light from the upper left, front, which shades the book's sides and edges but leaves a face
 * turned to the viewer nearly as bright as it was painted.
 */

/** The share of the ambient light given up to the key light at full strength. */
const AMBIENT_GIVEN = 0.3;
/** The key light's strength at full, in the same units (PI is a face lit exactly to its colour). */
const KEY_FULL = 0.46;

/** The two light strengths for a lift of `mix` (0 at rest, 1 fully lifted). */
export function lightLevels(mix: number): { ambient: number; key: number } {
  const m = Math.min(1, Math.max(0, mix));
  return { ambient: Math.PI * (1 - AMBIENT_GIVEN * m), key: Math.PI * KEY_FULL * m };
}

export type ShelfLights = {
  /** Sets the strengths for a lift of `mix`; returns whether they changed. */
  set(mix: number): boolean;
};

/** Adds the ambient and key lights to `scene`, at rest strength. */
export function addShelfLights(T: typeof THREE, scene: THREE.Scene): ShelfLights {
  const ambient = new T.AmbientLight(0xffffff, Math.PI);
  const key = new T.DirectionalLight(0xfff6ea, 0);
  key.position.set(-3, 4, 6); // upper left, in front of the books
  scene.add(ambient, key);
  let last = 0;
  return {
    set(mix) {
      if (mix === last) return false;
      last = mix;
      const l = lightLevels(mix);
      ambient.intensity = l.ambient;
      key.intensity = l.key;
      return true;
    },
  };
}
