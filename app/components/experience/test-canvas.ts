// A 2D context for the chart's tests: it keeps the paths that were stroked (their points, the style, the width and the dash at the
// time), the lettering that was drawn (text, place, alignment, colour) and the filled rectangles and shapes.
export type Stroked = { style: string; width: number; dash: number[]; points: [number, number][] };
export type Lettering = { text: string; x: number; y: number; align: string; style: string };

export function testCanvas() {
  const strokes: Stroked[] = [];
  const words: Lettering[] = [];
  const rects: { x: number; y: number; w: number; h: number; style: string }[] = [];
  const clears: number[][] = [];
  const dashes: number[][] = [];
  const state = { strokeStyle: "", fillStyle: "", lineWidth: 1, dash: [] as number[], textAlign: "left", font: "" };
  let path: [number, number][] = [];
  let fills = 0;
  const c = {
    setTransform: () => {},
    clearRect: (...a: number[]) => void clears.push(a),
    beginPath: () => void (path = []),
    moveTo: (x: number, y: number) => void path.push([x, y]),
    lineTo: (x: number, y: number) => void path.push([x, y]),
    closePath: () => {},
    setLineDash: (d: number[]) => {
      state.dash = d;
      dashes.push(d);
    },
    stroke: () => void strokes.push({ style: state.strokeStyle, width: state.lineWidth, dash: state.dash, points: [...path] }),
    fill: () => void fills++,
    fillRect: (x: number, y: number, w: number, h: number) => void rects.push({ x, y, w, h, style: state.fillStyle }),
    fillText: (text: string, x: number, y: number) => void words.push({ text, x, y, align: state.textAlign, style: state.fillStyle }),
    set strokeStyle(v: string) { state.strokeStyle = v; },
    set fillStyle(v: string) { state.fillStyle = v; },
    set lineWidth(v: number) { state.lineWidth = v; },
    set lineJoin(_v: string) {},
    set textAlign(v: string) { state.textAlign = v; },
    set textBaseline(_v: string) {},
    set font(v: string) { state.font = v; },
    get font() { return state.font; },
  } as unknown as CanvasRenderingContext2D;

  return { c, strokes, words, rects, clears, dashes, fills: () => fills, font: () => state.font };
}

/** The alpha of an `rgba(r,g,b,a)` colour string. */
export const alphaOf = (style: string): number => Number(/,([\d.]+)\)$/.exec(style)?.[1] ?? NaN);
