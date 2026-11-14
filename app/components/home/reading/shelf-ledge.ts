import type * as THREE from "three";
import { drawLedge } from "./ledge";
import type { FlatMesh } from "./shelf-scene-types";

type Three = typeof THREE;

/** The widest the ledge's picture is made, in device pixels (a long shelf on a phone is wider than this on screen). */
const MAX_TEX_W = 4096;

export type ShelfLedge = {
  mesh: FlatMesh;
  /**
   * Sizes the ledge to `reachPx` by `heightPx` CSS pixels at `scale` CSS pixels per world unit, hung
   * from world y 0 (the books' feet), and draws it again when its picture needs another size.
   */
  fit(reachPx: number, heightPx: number, scale: number, dpr: number): void;
};

/**
 * The rock ledge under the row, in 3D: one plane behind the books carrying `drawLedge`'s picture (a
 * canvas texture, drawn at the size it has on screen so the lines stay fine and are not stretched).
 * `track` is told about every texture and geometry so the scene can free them.
 */
export function createLedge(
  T: Three,
  z: number,
  unit: THREE.PlaneGeometry,
  track: <D extends { dispose(): void }>(d: D) => D,
): ShelfLedge {
  const material = track(
    new T.MeshBasicMaterial({ transparent: true, depthWrite: false, toneMapped: false }),
  );
  const mesh: FlatMesh = new T.Mesh(unit, material);
  mesh.position.z = z;
  mesh.visible = false; // until the first fit has drawn it
  let w = 0;
  let h = 0;
  return {
    mesh,
    fit(reachPx, heightPx, scale, dpr) {
      mesh.visible = heightPx > 0 && reachPx > 0;
      if (!mesh.visible) return;
      mesh.scale.set(reachPx / scale, heightPx / scale, 1);
      mesh.position.set(0, -heightPx / scale / 2, z);
      const cw = Math.max(2, Math.min(MAX_TEX_W, Math.round(reachPx * dpr)));
      const ch = Math.max(2, Math.round(heightPx * dpr));
      if (cw === w && ch === h) return;
      w = cw;
      h = ch;
      const c = document.createElement("canvas");
      c.width = cw;
      c.height = ch;
      const x = c.getContext("2d");
      if (!x) return;
      drawLedge(x, reachPx, heightPx, cw / reachPx, ch / heightPx);
      // a texture cannot change size once it is uploaded: a new one replaces it
      const old = material.map;
      const tex = track(new T.CanvasTexture(c));
      tex.colorSpace = T.SRGBColorSpace;
      tex.generateMipmaps = false;
      tex.minFilter = T.LinearFilter;
      material.map = tex;
      material.needsUpdate = true;
      old?.dispose();
    },
  };
}
