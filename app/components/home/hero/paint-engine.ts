/**
 * PAINTING ENGINE: one fragment shader does the first reveal (from the centre,
 * out of black), every later change (a liquid-glass front sweeping across), the
 * blur behind the cards (a biased mip lookup), and the dot screen and grain on
 * top. Nothing else is layered over the canvas, so the compositor never has to
 * blend a full screen.
 *
 * Ported from `createPaint` in docs/redesign/mockups/home-v4.html. Framework
 * free: the only DOM it touches is the canvas it is given. Callers must give
 * each `createPaint` call a fresh canvas element: `dispose` loses the context
 * (and so does a failed start), and a canvas that has had one is not reused.
 */

import { kenBurnsZoom } from "./ken-burns";
import { takeBitmap } from "./paint-bitmaps";
import { openPaintGl } from "./paint-gl";

export interface PaintMeta {
  /** Focus point of the cover fit, each axis 0..1. */
  focal: [number, number];
  /** Scales the cover fit; 1 when omitted. */
  zoom?: number;
}

/** How a change takes place: the liquid-glass sweep (default), or a plain crossfade. */
export interface SwapOptions {
  plain?: boolean;
}

export interface PaintEngine {
  black(): void;
  reveal(img: HTMLImageElement, meta: PaintMeta, ms: number, done?: () => void): void;
  swap(img: HTMLImageElement, meta: PaintMeta, ms: number, done?: () => void, opts?: SwapOptions): void;
  setBlur(v: 0 | 1): void;
  busy(): boolean;
  moving(): boolean;
  pause(now: number): void;
  resume(now: number): void;
  draw(now: number): void;
  /** Deletes textures, buffer and program, and loses the WebGL context. Every method is a no-op afterwards. */
  dispose(): void;
}

type Mode = "black" | "reveal" | "sweep" | "idle";

interface TexMeta {
  asp: number;
  foc: [number, number];
  zoom: number;
  born: number;
}

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));

/** Reduced motion: the first reveal is a plain fade of this length, and a change a plain crossfade. */
export const REDUCED_REVEAL_MS = 400;
export const REDUCED_SWAP_MS = 800;

/** Returns null without WebGL, or when the shaders fail to compile or link. */
export function createPaint(
  canvas: HTMLCanvasElement,
  opts: { reducedMotion: boolean },
): PaintEngine | null {
  const reduce = opts.reducedMotion;
  const setup = openPaintGl(canvas);
  if (!setup) return null;
  const { gl, gl2, U, tex } = setup;

  const meta: TexMeta[] = [
    { asp: 1.5, foc: [0.5, 0.5], zoom: 1, born: 0 },
    { asp: 1.5, foc: [0.5, 0.5], zoom: 1, born: 0 },
  ];
  let cur = 0;
  let mode: Mode = "black";
  let t0 = 0;
  let dur = 1;
  let dir: [number, number] = [1, 0];
  let plain = false;
  let done: (() => void) | undefined;
  let blur = 0;
  let blurTo = 0;
  let lastNow = 0;
  let pausedAt = 0;
  let disposed = false;

  const put = (i: number, img: HTMLImageElement, m: PaintMeta) => {
    gl.bindTexture(gl.TEXTURE_2D, tex[i]);
    // a bitmap prepared off the main thread uploads in a fraction of the time (see paint-bitmaps)
    const bitmap = takeBitmap(img);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, bitmap ?? img);
    bitmap?.close();
    if (gl2) gl.generateMipmap(gl.TEXTURE_2D);
    meta[i] = {
      asp: img.naturalWidth / img.naturalHeight,
      foc: m.focal,
      zoom: m.zoom || 1,
      born: performance.now(),
    };
  };

  const zoomOf = (i: number, now: number) => kenBurnsZoom(meta[i].zoom, now - meta[i].born, reduce);

  return {
    black() {
      if (disposed) return;
      mode = "black";
    },
    reveal(img, m, ms, cb) {
      if (disposed) return;
      put(cur, img, m);
      mode = "reveal";
      t0 = performance.now();
      dur = reduce ? REDUCED_REVEAL_MS : ms;
      done = cb;
    },
    swap(img, m, ms, cb, opts) {
      if (disposed) return;
      put(1 - cur, img, m);
      mode = "sweep";
      plain = !!opts?.plain;
      t0 = performance.now();
      dur = reduce && !plain ? REDUCED_SWAP_MS : ms;
      done = cb;
      const a = Math.random() * Math.PI * 2;
      dir = [Math.cos(a), Math.sin(a)];
    },
    busy: () => !disposed && (mode === "reveal" || mode === "sweep"),
    setBlur(v) {
      if (disposed) return;
      blurTo = v;
      if (reduce) blur = v;
    },
    moving: () => !disposed && blur !== blurTo,
    // parked frames do not count toward the slow zoom, so it never jumps on return
    pause(now) {
      if (disposed) return;
      if (!pausedAt) pausedAt = now;
    },
    resume(now) {
      if (disposed) return;
      if (pausedAt) {
        const d = now - pausedAt;
        meta.forEach((m) => {
          m.born += d;
        });
        t0 += d;
        pausedAt = 0;
      }
    },
    draw(now) {
      if (disposed) return;
      const dt = Math.min(0.1, (now - (lastNow || now)) / 1000);
      lastNow = now;
      blur += (blurTo - blur) * (1 - Math.exp(-dt * 6));
      if (Math.abs(blurTo - blur) < 0.003) blur = blurTo;
      const dpr = Math.min(globalThis.devicePixelRatio || 1, 1.5);
      const W = Math.round(canvas.clientWidth * dpr);
      const H = Math.round(canvas.clientHeight * dpr);
      if (canvas.width !== W || canvas.height !== H) {
        canvas.width = W;
        canvas.height = H;
      }
      gl.viewport(0, 0, W, H);
      let a = cur;
      let b = cur;
      let pr = 1;
      let md = 1;
      let hasA = 1;
      if (mode === "black") {
        pr = 0;
        md = 0;
        hasA = 0;
      } else if (mode === "reveal") {
        const k = clamp((now - t0) / dur);
        pr = reduce ? k : 1 - Math.pow(1 - k, 2.2);
        md = reduce ? 2 : 0; // 2: plain crossfade
        hasA = 0;
        if (k >= 1) {
          mode = "idle";
          pr = 1;
          done?.();
        }
      } else if (mode === "sweep") {
        const k = clamp((now - t0) / dur);
        pr = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
        if (reduce || plain) {
          pr = k * k * (3 - 2 * k);
          md = 2;
        }
        a = cur;
        b = 1 - cur;
        if (k >= 1) {
          cur = 1 - cur;
          a = b = cur;
          pr = 1;
          mode = "idle";
          done?.();
        }
      }
      // done() may have disposed the engine
      if (disposed) return;
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex[a]);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, tex[b]);
      gl.uniform2f(U.uRes, W, H);
      gl.uniform2f(U.uDir, dir[0], dir[1]);
      gl.uniform1f(U.uDpr, dpr);
      gl.uniform2f(U.uFocA, meta[a].foc[0], meta[a].foc[1]);
      gl.uniform2f(U.uFocB, meta[b].foc[0], meta[b].foc[1]);
      gl.uniform1f(U.uAspA, meta[a].asp);
      gl.uniform1f(U.uAspB, meta[b].asp);
      gl.uniform1f(U.uZoomA, zoomOf(a, now));
      gl.uniform1f(U.uZoomB, zoomOf(b, now));
      gl.uniform1f(U.uP, pr);
      gl.uniform1f(U.uT, now / 1000);
      gl.uniform1f(U.uMode, md);
      gl.uniform1f(U.uHasA, hasA);
      gl.uniform1f(U.uBlur, blur);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      done = undefined;
      setup.dispose();
    },
  };
}
