/**
 * WebGL capability checks for the home page's no-WebGL fallbacks (spec 8.10). Client only: on the
 * server both functions return false and touch nothing. Each answer is cached after the first
 * call on the client, and the probe context is released straight away.
 *
 * Dev override: `?nogl=1` in the URL makes both return false, so the fallbacks can be checked in a
 * browser that does have WebGL. It is read once, with the first probe.
 */

type Support = { gl1: boolean; gl2: boolean };

let cached: Support | null = null;

function forced(): boolean {
  try {
    return new URLSearchParams(window.location.search).get("nogl") === "1";
  } catch {
    return false;
  }
}

function release(gl: WebGLRenderingContext | WebGL2RenderingContext) {
  try {
    gl.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    /* the probe is thrown away either way */
  }
}

function probe(): Support {
  if (forced()) return { gl1: false, gl2: false };
  try {
    const canvas = document.createElement("canvas");
    const two = canvas.getContext("webgl2");
    if (two) {
      release(two);
      return { gl1: true, gl2: true };
    }
    // a canvas that has handed out one context type will not hand out another: use a fresh one
    const one = document.createElement("canvas").getContext("webgl");
    if (one) {
      release(one);
      return { gl1: true, gl2: false };
    }
  } catch {
    /* a throwing getContext counts as no WebGL */
  }
  return { gl1: false, gl2: false };
}

function support(): Support | null {
  if (typeof window === "undefined" || typeof document === "undefined") return null;
  cached ??= probe();
  return cached;
}

/** True when a WebGL1 or WebGL2 context can be created. */
export function hasWebGL(): boolean {
  return support()?.gl1 ?? false;
}

/** True when a WebGL2 context can be created (three.js 0.169 needs it). */
export function hasWebGL2(): boolean {
  return support()?.gl2 ?? false;
}
