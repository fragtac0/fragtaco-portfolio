import { describe, expect, it } from "vitest";
import { FS } from "./wall-warp-pass";
import {
  BLUR_INNER,
  BLUR_MAX_PX,
  EDGE_DARK_INNER,
  EDGE_DARK_SIDE,
  FRINGE_INNER,
  FRINGE_MAX_PX,
  HEAD_BAND_PX,
  HEAD_DARK,
  WARP_INNER,
  WARP_MAX,
} from "./wall-warp";

/**
 * The second pass's formulas are written twice (GLSL here, JS in wall-warp.ts, which the tests run). This keeps the two from
 * drifting: the shader source must carry every shared constant, in the line that does the same job as its JS twin.
 */
const f = (n: number) => n.toFixed(6);
const src = FS.replace(/\s+/g, " ");

describe("the second pass's shader source", () => {
  it("carries the warp's constants (edgeWarp / warpShift)", () => {
    expect(src).toContain(`float shiftOf(float r){float u=clamp((r-${f(WARP_INNER)})/${f(1 - WARP_INNER)},0.,1.);return ${f(WARP_MAX)}*u*u*(3.-2.*u);}`);
  });

  it("carries the blur and the fringe (edgeBlur, edgeFringe): a smoothstep from the inner radius to the corner", () => {
    expect(src).toContain(`float bl=${f(BLUR_MAX_PX)}*smoothstep(${f(BLUR_INNER)},1.,R);`);
    expect(src).toContain(`float fg=${f(FRINGE_MAX_PX)}*smoothstep(${f(FRINGE_INNER)},1.,R);`);
  });

  it("carries the dark fade (edgeDark): each side from its inner share, and the heading's band", () => {
    expect(src).toContain(`float sx=${f(EDGE_DARK_SIDE)}*smoothstep(${f(EDGE_DARK_INNER)},1.,abs(vS.x-c.x)/c.x);`);
    expect(src).toContain(`float sy=${f(EDGE_DARK_SIDE)}*smoothstep(${f(EDGE_DARK_INNER)},1.,abs(vS.y-c.y)/c.y);`);
    expect(src).toContain(`float band=min(${f(HEAD_BAND_PX)},uRes.y*.25);`);
    expect(src).toContain(`float tp=${f(HEAD_DARK)}*(1.-smoothstep(band*.5,band,vS.y));`);
    expect(src).toContain("float dk=1.-(1.-sx)*(1.-sy)*(1.-tp);");
  });

  it("puts the diagonal taps at the blur's reach divided by root two, and the five weights add to one", () => {
    const o = /float o=bl\*(\.\d+);/.exec(src);
    expect(o).not.toBeNull();
    expect(Number(o![1])).toBeCloseTo(Math.SQRT1_2, 4);
    const w = /fr\(w,f\)\*(\.\d+)\+(\.\d+)\*\(/.exec(src);
    expect(w).not.toBeNull();
    expect(Number(w![1]) + 4 * Number(w![2])).toBeCloseTo(1, 9);
  });

  it("reads the fringe at the middle tap only: seven reads where the blur or the fringe is on, one elsewhere", () => {
    // `fr` (three reads) is called once, in the blur's branch; the four diagonals are plain `rd`
    expect(src.match(/fr\(w,f\)/g)).toHaveLength(1);
    const branch = /if\(bl\+fg>0\.\)\{(.*?)\}else col=rd\(w\);/.exec(src);
    expect(branch).not.toBeNull();
    expect(branch![1].match(/\brd\(/g)).toHaveLength(4);
    expect(branch![1].match(/\bfr\(/g)).toHaveLength(1);
    // the reads: rd is one texture2D, fr is three rd
    expect(src.match(/texture2D/g)).toHaveLength(1);
    expect(/vec4 fr\(vec2 p,vec2 f\)\{vec4 g=rd\(p\);return vec4\(rd\(p\+f\)\.r,g\.g,rd\(p-f\)\.b,g\.a\);\}/.test(src)).toBe(true);
  });
});
