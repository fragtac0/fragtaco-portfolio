/** A stalled request must not hang the painting cycle forever. */
export const LOAD_TIMEOUT_MS = 12000;

/**
 * Loads and decodes an image; resolves null on a failed load or when `timeoutMs` pass first,
 * never rejects. A timed-out request is cancelled (the source is cleared).
 */
export function loadImage(
  src: string,
  timeoutMs: number = LOAD_TIMEOUT_MS,
): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    let settled = false;
    const finish = (value: HTMLImageElement | null) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      resolve(value);
    };
    const timer = window.setTimeout(() => {
      img.onload = null;
      img.onerror = null;
      img.src = "";
      finish(null);
    }, timeoutMs);
    img.decoding = "async";
    img.onload = () => {
      // decode() moves the texture-sized decode off the moment the reveal starts
      img.decode().then(
        () => finish(img),
        () => finish(img),
      );
    };
    img.onerror = () => finish(null);
    img.src = src;
  });
}
