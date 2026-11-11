import type { SiteBook } from "~/types";
import { miniSpine } from "../blocks/mini-previews";
import {
  bookSize,
  cameraAt,
  CAMERA,
  fitCamera,
  FOV_DEG,
  FRONT,
  INCH,
  PLANK_H,
  SHELF_GAP,
  WALLZ,
} from "./shelf-math";

export type PlaceholderLayout = {
  /** One flat bar per book: left edge and size in px, relative to the stage. */
  bars: { left: number; width: number; height: number }[];
  /** The line the bars stand on, in px from the stage's top. */
  floor: number;
  /** The plank in px, relative to the stage. */
  plank: { left: number; top: number; width: number; height: number };
};

/**
 * Where the flat placeholder stands, so the 3D shelf can replace it without anything jumping. The
 * shelf is projected through the camera it ends up with (`fitCamera`, then `cameraAt` after the
 * dolly): the row spans what the 3D books span, the bars stand on the front of the plank, and the
 * plank covers its top and front face. Widths are the block preview's (`miniSpine`: from the page
 * count), scaled so the row fits that span; heights are the 3D books' (trim height times INCH), so
 * the tops line up with the shelf that replaces them. Null until the stage has a size.
 */
export function placeholderLayout(
  books: readonly SiteBook[],
  stage: { w: number; h: number },
): PlaceholderLayout | null {
  if (books.length === 0 || stage.w <= 0 || stage.h <= 0) return null;
  const tanHalf = Math.tan((FOV_DEG / 2) * (Math.PI / 180));
  const aspect = stage.w / stage.h;
  const gapCount = books.length - 1;
  const span = books.reduce((sum, b) => sum + bookSize(b).T, 0) + SHELF_GAP * gapCount;
  const { dist } = fitCamera({ fovDeg: FOV_DEG, aspect, span });
  const pose = cameraAt(CAMERA.dollyS, dist);

  // the camera looks from (pose.y, pose.distance) at (lookY, 0) in the y-z plane
  const fy = pose.lookY - pose.y;
  const fz = -pose.distance;
  const norm = Math.hypot(fy, fz);
  const [forwardY, forwardZ] = [fy / norm, fz / norm];
  /** Screen row (px from the top) and the pixels per world unit at that depth, for a point at height y and depth z. */
  const project = (y: number, z: number) => {
    const vy = y - pose.y;
    const vz = z - pose.distance;
    const depth = vy * forwardY + vz * forwardZ;
    const up = vy * -forwardZ + vz * forwardY;
    const pxPerUnit = stage.h / 2 / (depth * tanHalf);
    return { row: stage.h / 2 - up * pxPerUnit, pxPerUnit };
  };

  const stand = project(0, FRONT);
  const ppu = stand.pxPerUnit;
  const gap = SHELF_GAP * ppu;
  const spines = books.map(miniSpine);
  const rawWidth = spines.reduce((sum, s) => sum + s.width, 0);
  const scale = (span * ppu - gap * gapCount) / rawWidth;
  let left = stage.w / 2 - (span * ppu) / 2;
  const bars = spines.map((s, i) => {
    const bar = { left, width: s.width * scale, height: books[i].heightIn * INCH * ppu };
    left += bar.width + gap;
    return bar;
  });

  const top = project(0, WALLZ).row;
  const bottom = project(-PLANK_H, FRONT + 0.1).row;
  const plankW = (span + 1) * ppu;
  return {
    bars,
    floor: stand.row,
    plank: { left: stage.w / 2 - plankW / 2, top, width: plankW, height: bottom - top },
  };
}
