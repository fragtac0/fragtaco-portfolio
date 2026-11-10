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

/** A 1 px lossy WebP, used only to ask the browser whether it can decode the format. */
const WEBP_PROBE =
  "data:image/webp;base64,UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA";

let webp: boolean | null = null;
let probe: Promise<boolean> | null = null;

/** How long a first painting waits for the decode probe before it settles for JPEG. */
export const WEBP_PROBE_WAIT_MS = 500;

/**
 * Whether this browser can show WebP. Client only: on the server (no `document`) it returns false
 * and caches nothing. Never blocks: the first call answers from a synchronous canvas check
 * (`toDataURL("image/webp")` returns a WebP only where the canvas can encode it) and caches a yes.
 * Where that says no (Safari decodes WebP but cannot encode it) a one-off 1 px image decode runs in
 * the background; until it settles the answer is false (JPEG), after it the cached true or false.
 */
export function supportsWebp(): boolean {
  if (webp !== null) return webp;
  if (typeof document === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    if (canvas.toDataURL("image/webp").startsWith("data:image/webp")) return (webp = true);
  } catch {
    // fall through to the decode probe
  }
  probe ??= new Promise<boolean>((resolve) => {
    const img = new Image();
    img.onload = () => resolve((webp = img.width > 0 && img.height > 0));
    img.onerror = () => resolve((webp = false));
    img.src = WEBP_PROBE;
  });
  return false;
}

/**
 * Resolves with the final answer of `supportsWebp`: at once where the canvas check decides it, else
 * when the decode probe settles (a few ms), or false after WEBP_PROBE_WAIT_MS. The first painting
 * awaits this so that Safari, which the head preload serves WebP, asks for the same WebP file.
 */
export function whenWebpKnown(): Promise<boolean> {
  if (supportsWebp()) return Promise.resolve(true);
  if (!probe) return Promise.resolve(false);
  return new Promise((resolve) => {
    const id = window.setTimeout(() => resolve(false), WEBP_PROBE_WAIT_MS);
    void probe!.then((v) => {
      window.clearTimeout(id);
      resolve(v);
    });
  });
}
