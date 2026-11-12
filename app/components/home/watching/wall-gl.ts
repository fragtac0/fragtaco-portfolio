/**
 * The wall's GL context, shaders and quad draw. One program draws every tile as a quad; a tile is
 * a rounded rectangle sampling its cell of the thumbnail atlas (`kind` 0, at `alpha`), and the same
 * program draws the orange glow under the focused tile (`kind` 1: 28 px, 16%, spec 7) and the
 * hairline cream edge of a tile in the focused channel's echo (`kind` 3). The atlas texture is
 * wall-thumbs.ts's; it stays bound to unit 0. A frame draws flat into a texture a little larger
 * than the screen (`beginFrame`) and `endFrame` shows it through the border fish-eye
 * (wall-warp-pass.ts).
 */

import { SURFACE_1, glslVec3 } from "../../../styles/tokens";
import { createWarpPass, type WarpPass } from "./wall-warp-pass";

/** A tile before its picture loads: tokens.css --surface-1. */
const SURFACE_VEC3 = glslVec3(SURFACE_1);

const VS = `attribute vec2 p;uniform vec4 uRect;uniform vec2 uRes;uniform float uPad;uniform vec2 uOff;varying vec2 vL;
  void main(){vec2 sz=uRect.zw+2.*uPad;vec2 pos=uRect.xy-uPad+p*sz+uOff;vL=pos-uOff-(uRect.xy+uRect.zw*.5);vec2 c=pos/uRes*2.-1.;gl_Position=vec4(c.x,-c.y,0.,1.);}`;
const FS = `precision highp float;varying vec2 vL;
  uniform sampler2D uAtlas;uniform vec4 uRect,uCell;uniform float uKind,uAlpha,uRad,uLoaded,uTime;
  float sdBox(vec2 p,vec2 b,float r){vec2 q=abs(p)-b+r;return length(max(q,0.))+min(max(q.x,q.y),0.)-r;}
  void main(){
    float sd=sdBox(vL,uRect.zw*.5,uRad);
    if(uKind>2.5){float o=1.-smoothstep(-.8,.8,sd);float n=1.-smoothstep(-.8,.8,sd+1.);float a=max(o-n,0.)*uAlpha;gl_FragColor=vec4(vec3(.992,.988,.902)*a,a);return;}
    if(uKind>.5){float a=1.-smoothstep(-8.,28.,sd);a=a*a*uAlpha;gl_FragColor=vec4(vec3(.988,.298,0.)*a,a);return;}
    float a=(1.-smoothstep(-.8,.8,sd))*uAlpha;
    vec2 st=clamp(vL/uRect.zw+.5,0.,1.);
    vec3 col=uLoaded>.5?texture2D(uAtlas,uCell.xy+st*uCell.zw).rgb:${SURFACE_VEC3}+.022*sin(vL.x*.02-uTime*2.4);
    gl_FragColor=vec4(col*a,a);
  }`;

const UNIFORMS = [
  "uRect",
  "uRes",
  "uPad",
  "uOff",
  "uAtlas",
  "uCell",
  "uKind",
  "uAlpha",
  "uRad",
  "uLoaded",
  "uTime",
] as const;
type UniformName = (typeof UNIFORMS)[number];
export type WallUniforms = Record<UniformName, WebGLUniformLocation | null>;

export type WallGl = {
  gl: WebGLRenderingContext;
  uniforms: WallUniforms;
  /**
   * Starts a frame: binds the flat target (the screen plus the warp's margin), clears it and sets
   * the coordinates so tiles are placed in screen pixels, as if the target were the screen.
   */
  beginFrame(vw: number, vh: number, time: number): void;
  /** Shows the frame on the canvas through the border fish-eye. */
  endFrame(vw: number, vh: number): void;
  /** Draws one quad; `pad` grows it on every side (the glow reaches past the tile). */
  quad(
    x: number,
    y: number,
    w: number,
    h: number,
    kind: number,
    alpha: number,
    pad: number,
    rad: number,
  ): void;
  /** Frees the program and buffer and loses the context. */
  dispose(): void;
};

/** Null when there is no WebGL or the program does not link. */
export function createWallGl(canvas: HTMLCanvasElement): WallGl | null {
  const g = canvas.getContext("webgl", {
    alpha: true,
    premultipliedAlpha: true,
    antialias: false,
  });
  if (!g) return null;
  const sh = (type: number, src: string) => {
    const s = g.createShader(type) as WebGLShader;
    g.shaderSource(s, src);
    g.compileShader(s);
    if (!g.getShaderParameter(s, g.COMPILE_STATUS)) console.error(g.getShaderInfoLog(s));
    return s;
  };
  const vs = sh(g.VERTEX_SHADER, VS);
  const fs = sh(g.FRAGMENT_SHADER, FS);
  const prog = g.createProgram();
  g.attachShader(prog, vs);
  g.attachShader(prog, fs);
  g.bindAttribLocation(prog, 0, "p"); // the warp program shares this buffer and attribute
  g.linkProgram(prog);
  // linked (or not), the shader objects are no longer needed; the program keeps what it uses
  g.deleteShader(vs);
  g.deleteShader(fs);
  if (!g.getProgramParameter(prog, g.LINK_STATUS)) {
    console.error(g.getProgramInfoLog(prog));
    g.deleteProgram(prog);
    return null;
  }
  g.useProgram(prog);
  const buffer = g.createBuffer();
  g.bindBuffer(g.ARRAY_BUFFER, buffer);
  g.bufferData(g.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), g.STATIC_DRAW);
  g.enableVertexAttribArray(0);
  g.vertexAttribPointer(0, 2, g.FLOAT, false, 0, 0);
  const U = {} as WallUniforms;
  for (const k of UNIFORMS) U[k] = g.getUniformLocation(prog, k);
  g.uniform1i(U.uAtlas, 0);
  g.enable(g.BLEND);
  g.blendFunc(g.ONE, g.ONE_MINUS_SRC_ALPHA);
  const warp: WarpPass | null = createWarpPass(g, prog);
  if (!warp) {
    g.deleteBuffer(buffer);
    g.deleteProgram(prog);
    return null;
  }

  return {
    gl: g,
    uniforms: U,
    beginFrame(vw, vh, time) {
      const t = warp.begin(vw, vh);
      g.clearColor(0, 0, 0, 0);
      g.clear(g.COLOR_BUFFER_BIT);
      g.uniform2f(U.uRes, t.width, t.height);
      g.uniform2f(U.uOff, t.margin, t.margin);
      g.uniform1f(U.uTime, time);
    },
    endFrame(vw, vh) {
      warp.present(vw, vh);
    },
    quad(x, y, w, h, kind, alpha, pad, rad) {
      g.uniform4f(U.uRect, x, y, w, h);
      g.uniform1f(U.uKind, kind);
      g.uniform1f(U.uAlpha, alpha);
      g.uniform1f(U.uPad, pad);
      g.uniform1f(U.uRad, rad);
      g.drawArrays(g.TRIANGLE_STRIP, 0, 4);
    },
    dispose() {
      warp.dispose();
      g.deleteBuffer(buffer);
      g.deleteProgram(prog);
      g.getExtension("WEBGL_lose_context")?.loseContext();
    },
  };
}
