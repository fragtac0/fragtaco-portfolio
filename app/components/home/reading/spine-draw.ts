/**
 * A real picture of a spine (a book whose `spine` path is set), painted over the whole canvas. The
 * designed spines are spine-paint.ts. Client only for `drawSpinePhoto`; `coverCrop` is pure and tested.
 */

export type SpineSize = { w: number; h: number };

/** The source rectangle that fills a `dw` by `dh` canvas from an `sw` by `sh` picture, cropping the overflow evenly. */
export function coverCrop(
  sw: number,
  sh: number,
  dw: number,
  dh: number,
): { sx: number; sy: number; cw: number; ch: number } {
  const want = dw / dh;
  if (sw / sh > want) {
    const cw = sh * want;
    return { sx: (sw - cw) / 2, sy: 0, cw, ch: sh };
  }
  const ch = sw / want;
  return { sx: 0, sy: (sh - ch) / 2, cw: sw, ch };
}

/** Paints a real picture of the spine over the whole canvas (a book whose `spine` is set). */
export function drawSpinePhoto(
  ctx: CanvasRenderingContext2D,
  size: SpineSize,
  img: HTMLImageElement,
): void {
  const { sx, sy, cw, ch } = coverCrop(img.naturalWidth, img.naturalHeight, size.w, size.h);
  ctx.drawImage(img, sx, sy, cw, ch, 0, 0, size.w, size.h);
}
