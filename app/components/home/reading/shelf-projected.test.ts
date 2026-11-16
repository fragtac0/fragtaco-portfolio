import { describe, expect, it } from "vitest";
import { containFraming, framingRect, projectRow, type Row } from "./box-framing";
import { projectScene } from "./shelf-projected";
import type { ShelfScene } from "./shelf-scene";

/**
 * The engine's own projection (three's camera, with the view offset the box framing sets) against the pure model's (`projectRow`): the
 * same boxes in the frame's pixels. A small row in a 1000 by 600 window, books standing on a line at y 480, the ledge 40 under it.
 */
const VW = 1000;
const VH = 600;
const SCALE = 100; // pixels per world unit
const BASE = 480;
const FOOT = 40;
const BOOKS = [
  { x: -2, w: 0.5, h: 3 },
  { x: -1.2, w: 0.4, h: 2.4 },
  { x: 0.5, w: 0.6, h: 3.4 },
  { x: 1.6, w: 0.3, h: 2 },
];

async function scene() {
  const T = await import("three");
  const camera = new T.OrthographicCamera(-VW / 2 / SCALE, VW / 2 / SCALE, VH / 2 / SCALE, -VH / 2 / SCALE, -10, 10);
  camera.position.set(0, (BASE - VH / 2) / SCALE, 5);
  const books = BOOKS.map((b) => {
    const mesh = new T.Mesh(new T.BoxGeometry(b.w, b.h, 1));
    mesh.position.set(b.x, b.h / 2, 0);
    mesh.updateMatrixWorld(true);
    return { mesh };
  });
  const ledge = new T.Mesh(new T.PlaneGeometry(1, 1));
  ledge.scale.set(8, FOOT / SCALE, 1);
  ledge.position.set(0, -FOOT / SCALE / 2, -1);
  ledge.updateMatrixWorld(true);
  return { T, camera, books, ledge, gl: { T, camera, books, ledge } as unknown as Pick<ShelfScene, "T" | "camera" | "books" | "ledge"> };
}

describe("the engine's projected boxes", () => {
  it("are the pure model's, in the frame's own pixels, with the box framing's view offset", async () => {
    const { T, camera, gl } = await scene();
    const row: Row = {
      left: VW / 2 - 4 * SCALE,
      right: VW / 2 + 4 * SCALE,
      top: BASE - 3.4 * SCALE,
      bottom: BASE,
      ledgeBottom: BASE + FOOT,
    };
    const frame = { w: 360, h: 220 };
    const fr = containFraming(frame, row);
    const sub = framingRect(fr, frame);
    camera.setViewOffset(VW, VH, sub.x, sub.y, sub.w, sub.h);
    camera.updateProjectionMatrix();
    const got = projectScene(T, gl, frame);
    const want = projectRow(
      row,
      BOOKS.map((b) => ({ left: VW / 2 + (b.x - b.w / 2) * SCALE, right: VW / 2 + (b.x + b.w / 2) * SCALE, top: BASE - b.h * SCALE, bottom: BASE })),
      fr,
      frame,
    );
    expect(got.books).toHaveLength(4);
    got.books.forEach((b, i) => {
      for (const k of ["left", "right", "top", "bottom"] as const) expect(b[k]).toBeCloseTo(want.books[i][k], 4);
    });
    for (const k of ["left", "right", "top", "bottom"] as const) expect(got.ledge[k]).toBeCloseTo(want.ledge[k], 4);
  });
});
