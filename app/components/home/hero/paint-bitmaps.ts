/**
 * Uploading a big painting with `texImage2D(image)` converts it on the main thread: about 110 ms for
 * a 2560 px painting with the CPU slowed 4 times, one frame that long in the middle of an arrival. An
 * ImageBitmap made beforehand is prepared off the main thread, and its upload takes about 17 ms. The
 * cycle prepares each painting as soon as it has loaded; the engine takes the bitmap when it uploads
 * and closes it. Without `createImageBitmap`, or when it fails, the engine uploads the image itself.
 */
const prepared = new WeakMap<HTMLImageElement, ImageBitmap>();

/**
 * Prepares the bitmap for `img` (once). Never rejects. It is made from the file's bytes (the browser
 * already has them: a cache hit), not from the element: from the element the browser decodes the
 * picture on the main thread first (about 85 ms at 4 times CPU slowdown) when it is not decoded
 * right now, as with the painting remembered from the last visit; from a blob it all happens on a worker.
 */
export async function prepareBitmap(img: HTMLImageElement): Promise<void> {
  const src = img.currentSrc || img.src;
  if (prepared.has(img) || !src || typeof createImageBitmap !== "function") return;
  try {
    const blob = await (await fetch(src)).blob();
    prepared.set(img, await createImageBitmap(blob, { premultiplyAlpha: "none", colorSpaceConversion: "default" }));
  } catch {
    /* the engine uploads the image itself */
  }
}

/** The prepared bitmap for `img`, handed over for one upload (the caller closes it); undefined when there is none. */
export function takeBitmap(img: HTMLImageElement): ImageBitmap | undefined {
  const bitmap = prepared.get(img);
  prepared.delete(img);
  return bitmap;
}
