/**
 * The WebGL set-up of the painting engine (split out of paint-engine.ts in R46.1, no change in
 * behaviour): the context, the program, the quad, the uniform locations and the two textures.
 * Framework free; the only DOM it touches is the canvas it is given.
 */
import { FRAGMENT_SRC, VERTEX_SRC } from "./paint-shaders";

export const UNIFORMS = [
  "uA",
  "uB",
  "uRes",
  "uFocA",
  "uFocB",
  "uDir",
  "uAspA",
  "uAspB",
  "uZoomA",
  "uZoomB",
  "uP",
  "uT",
  "uMode",
  "uHasA",
  "uBlur",
  "uDpr",
] as const;
export type UniformName = (typeof UNIFORMS)[number];

export interface PaintGl {
  gl: WebGLRenderingContext;
  /** True for a WebGL2 context (mipmaps on). */
  gl2: boolean;
  U: Record<UniformName, WebGLUniformLocation | null>;
  tex: WebGLTexture[];
  /** Deletes textures, buffer, program and shaders, and loses the context unless it is lost already. */
  dispose(): void;
}

/** Returns null without WebGL, or when the shaders fail to compile or link; a failure gives the context back. */
export function openPaintGl(canvas: HTMLCanvasElement): PaintGl | null {
  const ctxOpts: WebGLContextAttributes = {
    antialias: false,
    alpha: false,
    depth: false,
    stencil: false,
    premultipliedAlpha: false,
  };
  // WebGL2 first; the two contexts share every call used here, so one type covers both.
  let glOrNull = canvas.getContext("webgl2", ctxOpts) as WebGLRenderingContext | null;
  const gl2 = !!glOrNull;
  if (!glOrNull) glOrNull = canvas.getContext("webgl", ctxOpts);
  if (!glOrNull) return null;
  const gl: WebGLRenderingContext = glOrNull;
  if (gl.isContextLost()) {
    console.error("paint: WebGL context already lost");
    return null;
  }

  const compile = (type: number, src: string): WebGLShader | null => {
    const s = gl.createShader(type);
    if (!s) return null;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(s));
      gl.deleteShader(s);
      return null;
    }
    return s;
  };

  // Every failure after getContext gives the context back, so a canvas that failed to start does
  // not keep a live one (the caller drops the canvas and shows the image fallback).
  const fail = (): null => {
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return null;
  };

  const vsh = compile(gl.VERTEX_SHADER, VERTEX_SRC);
  const fsh = compile(gl.FRAGMENT_SHADER, FRAGMENT_SRC);
  const prog = gl.createProgram();
  if (!vsh || !fsh || !prog) {
    if (vsh) gl.deleteShader(vsh);
    if (fsh) gl.deleteShader(fsh);
    if (prog) gl.deleteProgram(prog);
    return fail();
  }
  gl.attachShader(prog, vsh);
  gl.attachShader(prog, fsh);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(prog));
    gl.deleteProgram(prog);
    gl.deleteShader(vsh);
    gl.deleteShader(fsh);
    return fail();
  }
  gl.useProgram(prog);

  // createBuffer and createTexture return null only when the context was lost during setup
  const buffer = gl.createBuffer();
  if (!buffer) {
    gl.deleteProgram(prog);
    gl.deleteShader(vsh);
    gl.deleteShader(fsh);
    return fail();
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "p");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const U = {} as Record<UniformName, WebGLUniformLocation | null>;
  UNIFORMS.forEach((k) => {
    U[k] = gl.getUniformLocation(prog, k);
  });
  gl.uniform1i(U.uA, 0);
  gl.uniform1i(U.uB, 1);

  const made = [0, 1].map(() => {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(
      gl.TEXTURE_2D,
      gl.TEXTURE_MIN_FILTER,
      gl2 ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR,
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGB,
      1,
      1,
      0,
      gl.RGB,
      gl.UNSIGNED_BYTE,
      new Uint8Array([5, 4, 3]),
    );
    return t;
  });
  const tex = made.filter((t): t is WebGLTexture => t !== null);
  if (tex.length !== made.length) {
    for (const t of tex) gl.deleteTexture(t);
    gl.deleteBuffer(buffer);
    gl.deleteProgram(prog);
    gl.deleteShader(vsh);
    gl.deleteShader(fsh);
    return fail();
  }

  return {
    gl,
    gl2,
    U,
    tex,
    dispose() {
      tex.forEach((t) => gl.deleteTexture(t));
      gl.deleteBuffer(buffer);
      gl.deleteProgram(prog);
      gl.deleteShader(vsh);
      gl.deleteShader(fsh);
      if (!gl.isContextLost()) gl.getExtension("WEBGL_lose_context")?.loseContext();
    },
  };
}
