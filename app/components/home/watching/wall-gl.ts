/**
 * The wall's GL context, shaders and quad draw. One program draws every tile as a quad; a tile is
 * a rounded rectangle sampling its cell of the thumbnail atlas (`kind` 0, at `alpha`), and the same
 * program draws the soft shadow and the orange glow (28 px, 18% at most: the site glow, tokens.css --glow) under the focused tile (`kind` 2 and 1) and the
 * hairline cream edge of a tile in the focused channel's echo (`kind` 3). The atlas texture is
 * wall-thumbs.ts's; it stays bound to unit 0.
 */

import { SURFACE_1, glslVec3 } from "../../../styles/tokens";

/** A tile before its picture loads: tokens.css --surface-1. */
const SURFACE_VEC3 = glslVec3(SURFACE_1);

const VS = `attribute vec2 p;uniform vec4 uRect;uniform vec2 uRes;uniform float uPad;varying vec2 vL;
  void main(){vec2 sz=uRect.zw+2.*uPad;vec2 pos=uRect.xy-uPad+p*sz;vL=pos-(uRect.xy+uRect.zw*.5);vec2 c=pos/uRes*2.-1.;gl_Position=vec4(c.x,-c.y,0.,1.);}`;
const FS = `precision highp float;varying vec2 vL;
  uniform sampler2D uAtlas;uniform vec4 uRect,uCell;uniform float uBias,uDim,uKind,uAlpha,uRad,uLoaded,uTime;
  float sdBox(vec2 p,vec2 b,float r){vec2 q=abs(p)-b+r;return length(max(q,0.))+min(max(q.x,q.y),0.)-r;}
  void main(){
    float sd=sdBox(vL,uRect.zw*.5,uRad);
    if(uKind>2.5){float o=1.-smoothstep(-.8,.8,sd);float n=1.-smoothstep(-.8,.8,sd+1.);float a=max(o-n,0.)*uAlpha;gl_FragColor=vec4(vec3(.992,.988,.902)*a,a);return;}
    if(uKind>1.5){float a=(1.-smoothstep(-26.,54.,sd))*uAlpha;gl_FragColor=vec4(0.,0.,0.,a);return;}
    if(uKind>.5){float a=1.-smoothstep(-8.,28.,sd);a=a*a*uAlpha;gl_FragColor=vec4(vec3(.988,.298,0.)*a,a);return;}
    float a=(1.-smoothstep(-.8,.8,sd))*uAlpha;
    vec2 st=clamp(vL/uRect.zw+.5,0.,1.);
    vec3 col=uLoaded>.5?texture2D(uAtlas,uCell.xy+st*uCell.zw,uBias).rgb:${SURFACE_VEC3}+.022*sin(vL.x*.02-uTime*2.4);
    gl_FragColor=vec4(col*uDim*a,a);
  }`;

const UNIFORMS = [
  "uRect",
  "uRes",
  "uPad",
  "uAtlas",
  "uCell",
  "uBias",
  "uDim",
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
  /** Draws one quad; `pad` grows it on every side (the shadow and glow reach past the tile). */
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
  const loc = g.getAttribLocation(prog, "p");
  g.enableVertexAttribArray(loc);
  g.vertexAttribPointer(loc, 2, g.FLOAT, false, 0, 0);
  const U = {} as WallUniforms;
  for (const k of UNIFORMS) U[k] = g.getUniformLocation(prog, k);
  g.uniform1i(U.uAtlas, 0);
  g.enable(g.BLEND);
  g.blendFunc(g.ONE, g.ONE_MINUS_SRC_ALPHA);

  return {
    gl: g,
    uniforms: U,
    quad(x, y, w, h, kind, alpha, pad, rad) {
      g.uniform4f(U.uRect, x, y, w, h);
      g.uniform1f(U.uKind, kind);
      g.uniform1f(U.uAlpha, alpha);
      g.uniform1f(U.uPad, pad);
      g.uniform1f(U.uRad, rad);
      g.drawArrays(g.TRIANGLE_STRIP, 0, 4);
    },
    dispose() {
      g.deleteBuffer(buffer);
      g.deleteProgram(prog);
      g.getExtension("WEBGL_lose_context")?.loseContext();
    },
  };
}
