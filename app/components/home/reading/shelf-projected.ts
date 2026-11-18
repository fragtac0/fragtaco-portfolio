import type * as THREE from "three";
import type { Box, Size } from "./box-framing";
import type { ShelfScene } from "./shelf-scene";

/**
 * Where the books and the ledge are in the canvas as drawn, in the frame's own CSS pixels, read from the scene itself: each mesh's bounding
 * box taken through the camera as it is now (with the view offset the framing sets). The check of spec 6 (every book and the ledge inside the
 * box) reads this, so it tests the picture the engine makes and not the maths that was meant to make it (scripts/audit/box-open-framing.mjs).
 */
export type Projected = { frame: Size; books: Box[]; ledge: Box };

function boxOf(T: typeof THREE, camera: THREE.Camera, obj: THREE.Object3D, frame: Size): Box {
  const bb = new T.Box3().setFromObject(obj);
  const out: Box = { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity };
  const corner = new T.Vector3();
  for (const x of [bb.min.x, bb.max.x]) {
    for (const y of [bb.min.y, bb.max.y]) {
      for (const z of [bb.min.z, bb.max.z]) {
        corner.set(x, y, z).project(camera);
        const px = ((corner.x + 1) / 2) * frame.w;
        const py = ((1 - corner.y) / 2) * frame.h;
        out.left = Math.min(out.left, px);
        out.right = Math.max(out.right, px);
        out.top = Math.min(out.top, py);
        out.bottom = Math.max(out.bottom, py);
      }
    }
  }
  return out;
}

export function projectScene(
  T: typeof THREE,
  gl: Pick<ShelfScene, "camera" | "books" | "ledge"> & { T?: typeof THREE },
  frame: Size,
): Projected {
  gl.camera.updateMatrixWorld(true);
  return {
    frame,
    books: gl.books.map((b) => boxOf(T, gl.camera, b.mesh, frame)),
    ledge: boxOf(T, gl.camera, gl.ledge, frame),
  };
}
