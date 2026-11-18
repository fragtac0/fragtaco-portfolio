// Stand-ins for the shelf's frame tests (shelf-frame.test.ts, shelf-frame-box.test.ts): a canvas-like and a shelf context.
import { createFrameBox } from "../layer/frame-box";
import type { Frame } from "../layer/frame-math";
import type { Row } from "./box-framing";
import { newShelfState, type ShelfCtx } from "./shelf-open";
import type { ShelfScene } from "./shelf-scene";

export const VW = 1440;
export const VH = 900;

/** A canvas-like with a style that records what is set and removed. */
export function fakeEl() {
  const props = new Map<string, string>();
  const camel = (p: string) => (p.startsWith("--") ? p : p.replace(/-([a-z])/g, (_m, c: string) => c.toUpperCase()));
  const own: Record<string, unknown> = {
    removeProperty: (p: string) => void props.delete(camel(p)),
    setProperty: (p: string, v: string) => void props.set(camel(p), v),
    getPropertyValue: (p: string) => props.get(camel(p)) ?? "",
    getPropertyPriority: () => "",
  };
  const style = new Proxy(own, {
    get: (t, k: string) => (k in t ? t[k] : props.get(k)),
    set: (_t, k: string, v: string) => (props.set(k, v), true),
  });
  return { el: { style } as unknown as HTMLCanvasElement, props };
}

export function setup(frame: Frame | null, opts?: { place?: boolean; coarse?: boolean }, ratio = 2) {
  const { el } = fakeEl();
  const box = createFrameBox(el);
  box.request(frame, opts);
  box.commit();
  const calls: Array<[string, ...Array<number | boolean>]> = [];
  const dom = { width: 0, height: 0 };
  const gl = {
    renderer: {
      domElement: dom,
      getPixelRatio: () => ratio,
      setSize: (w: number, h: number, ...a: boolean[]) => {
        calls.push(["setSize", w, h, ...a]);
        dom.width = Math.floor(w * ratio);
        dom.height = Math.floor(h * ratio);
      },
    },
    camera: {
      setViewOffset: (...a: number[]) => calls.push(["setViewOffset", ...a]),
      clearViewOffset: () => calls.push(["clearViewOffset"]),
      updateProjectionMatrix: () => calls.push(["update"]),
    },
  } as unknown as ShelfScene;
  const ctx = { box, st: newShelfState() } as unknown as ShelfCtx;
  return { ctx, gl, calls, box };
}

/** The open page's row at 1440 by 900 (the books' feet on the line at 810, the ledge 74 under it), and the world scale it was fitted at. */
export const ROW: Row = { left: 200, right: 1240, top: 142, bottom: 810, ledgeBottom: 884 };
export const SCALE = 357;
export const BOX: Frame = { left: 58, top: 402, width: 648, height: 300 };
export const WIN = { w: VW, h: VH };

/** A shelf context with the row of the last fit and the camera at world x `cam`. */
export function framed(frame: Frame | null, opts?: { place?: boolean; coarse?: boolean; move?: { box: { width: number; height: number }; t: number } }, cam = 0) {
  const s = setup(frame, opts);
  (s.ctx as { cam: { x: number; xV: number } }).cam = { x: cam, xV: 0 };
  s.ctx.st.row = ROW;
  s.ctx.st.ledgeTop = ROW.bottom;
  return s;
}
