/**
 * A stand-in 2D context for the spine tests (no canvas in the node test environment): it keeps the
 * transform (translate, scale, rotate, save, restore) and records every mark as a box in canvas
 * pixels, so a test can check that a painted spine stays inside its canvas. Text is measured at
 * 0.6 of the font size a letter and is 0.8 of the font size tall (the ink, not the em box). Used by tests only.
 */

export type Box = { l: number; t: number; r: number; b: number; kind: string; text?: string; size?: number };

type M = [number, number, number, number, number, number];
type State = { m: M; font: string; align: string; base: string };

const IDENTITY: M = [1, 0, 0, 1, 0, 0];

/** The font size in pixels of a CSS font string. */
export const sizeOf = (font: string): number => parseFloat(/([\d.]+)px/.exec(font)?.[1] ?? "10");

/** `Path2D` stand-in: keeps the path string. */
export class FakePath2D {
  constructor(public d = "") {}
}

export function recordingCtx() {
  const marks: Box[] = [];
  let s: State = { m: [...IDENTITY], font: "10px serif", align: "left", base: "alphabetic" };
  const stack: State[] = [];
  const state: Record<string, unknown> = {
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    lineCap: "",
    lineJoin: "",
    globalAlpha: 1,
    fontStretch: "normal",
  };

  const pt = (x: number, y: number): [number, number] => [s.m[0] * x + s.m[2] * y + s.m[4], s.m[1] * x + s.m[3] * y + s.m[5]];
  const box = (kind: string, x0: number, y0: number, x1: number, y1: number, extra: Partial<Box> = {}) => {
    const p = [pt(x0, y0), pt(x1, y0), pt(x1, y1), pt(x0, y1)];
    marks.push({
      kind,
      l: Math.min(...p.map((q) => q[0])),
      r: Math.max(...p.map((q) => q[0])),
      t: Math.min(...p.map((q) => q[1])),
      b: Math.max(...p.map((q) => q[1])),
      ...extra,
    });
  };

  const api: Record<string, unknown> = {
    save: () => void stack.push({ ...s, m: [...s.m] as M }),
    restore: () => void (s = stack.pop() ?? s),
    translate: (tx: number, ty: number) => {
      s.m[4] += s.m[0] * tx + s.m[2] * ty;
      s.m[5] += s.m[1] * tx + s.m[3] * ty;
    },
    scale: (sx: number, sy: number) => {
      s.m[0] *= sx;
      s.m[1] *= sx;
      s.m[2] *= sy;
      s.m[3] *= sy;
    },
    rotate: (a: number) => {
      const c = Math.cos(a);
      const n = Math.sin(a);
      const [a0, b0, c0, d0] = s.m;
      s.m[0] = a0 * c + c0 * n;
      s.m[1] = b0 * c + d0 * n;
      s.m[2] = -a0 * n + c0 * c;
      s.m[3] = -b0 * n + d0 * c;
    },
    measureText: (t: string) => ({ width: [...t].length * 0.6 * sizeOf(s.font) }),
    fillText: (t: string, x: number, y: number) => {
      const size = sizeOf(s.font);
      const w = [...t].length * 0.6 * size;
      const x0 = s.align === "center" ? x - w / 2 : x;
      // the ink of a line of letters (capitals, or lower case with its stems and tails) is about 0.8 of the font size tall
      const [y0, y1] = s.base === "middle" ? [y - size * 0.4, y + size * 0.4] : [y - size * 0.75, y + size * 0.2];
      box("text", x0, y0, x0 + w, y1, { text: t, size: size * Math.hypot(s.m[0], s.m[1]) });
    },
    fillRect: (x: number, y: number, w: number, h: number) => box("rect", x, y, x + w, y + h),
    strokeRect: (x: number, y: number, w: number, h: number) => box("rect", x, y, x + w, y + h),
    arc: (x: number, y: number, r: number) => box("arc", x - r, y - r, x + r, y + r),
    fill: (p?: unknown) => {
      if (p instanceof FakePath2D) box("path", 0, 0, 24, 24);
    },
    stroke: (p?: unknown) => {
      if (p instanceof FakePath2D) box("path", 0, 0, 24, 24);
    },
    createLinearGradient: () => ({ addColorStop: () => undefined }),
    createPattern: () => ({}),
    createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }),
    putImageData: () => undefined,
    beginPath: () => undefined,
    drawImage: () => undefined,
  };

  const ctx = new Proxy(api, {
    get(_t, k: string) {
      if (k === "font") return s.font;
      if (k === "textAlign") return s.align;
      if (k === "textBaseline") return s.base;
      if (k in api) return api[k];
      return state[k];
    },
    set(_t, k: string, v) {
      if (k === "font") s.font = String(v);
      else if (k === "textAlign") s.align = String(v);
      else if (k === "textBaseline") s.base = String(v);
      else state[k] = v;
      return true;
    },
    has(_t, k: string) {
      return k in api || k in state;
    },
  }) as unknown as CanvasRenderingContext2D;

  return { ctx, marks };
}
