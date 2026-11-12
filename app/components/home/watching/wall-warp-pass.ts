import { WARP_INNER, WARP_MAX, warpMargin } from "./wall-warp";

/**
 * The second pass of the wall (spec 7). The tiles are drawn flat into a texture a little larger
 * than the screen (`warpMargin` CSS pixels on every side, so the screen's corners can be filled
 * after the pull), and this pass draws that texture to the canvas through the barrel warp. For
 * each screen pixel the shader finds the flat wall point that shows there (the same fixed-point
 * inverse as `edgeUnwarp` in wall-warp.ts, from the same constants) and reads it.
 *
 * The texture lives on unit 1 only while this pass runs, so the atlas on unit 0 (wall-thumbs.ts)
 * is never disturbed.
 *
 * Sharpness: the margin is snapped up to whole device pixels (`ceil(m * dpr) / dpr`) and the
 * target is the drawing buffer plus twice that margin, in device pixels, so at any pixel ratio
 * (1.25, 1.5, 2.625 ...) a pixel of the wall's middle lands exactly on a texel of the target and
 * the copy is not sampled between texels. If the GPU cannot render to the texture
 * (`checkFramebufferStatus`), the pass does not start (`createWarpPass` returns null, and `begin`
 * returns null for a size it cannot hold), and the wall takes its "could not start" path.
 */

const f = (n: number) => n.toFixed(6);

const VS = `attribute vec2 p;uniform vec2 uRes;varying vec2 vS;
  void main(){vS=p*uRes;gl_Position=vec4(p.x*2.-1.,1.-p.y*2.,0.,1.);}`;
const FS = `precision highp float;varying vec2 vS;
  uniform sampler2D uTex;uniform vec2 uRes;uniform float uMargin;
  float shiftOf(float r){float u=clamp((r-${f(WARP_INNER)})/${f(1 - WARP_INNER)},0.,1.);return ${f(WARP_MAX)}*u*u*(3.-2.*u);}
  void main(){
    vec2 c=uRes*.5;float hd=length(c);vec2 d=vS-c;float R=length(d)/hd;
    vec2 w=vS;
    if(R>.00001){float r=R;for(int i=0;i<6;i++)r=R+shiftOf(r);w=c+d*(r/R);}
    vec2 t=(w+uMargin)/(uRes+2.*uMargin);
    gl_FragColor=texture2D(uTex,vec2(t.x,1.-t.y));
  }`;

/** What the first pass needs to know about its target. */
export type WarpTarget = {
  /** Flat wall pixels (CSS) drawn beyond each screen edge. */
  margin: number;
  /** The target's size in CSS pixels. */
  width: number;
  height: number;
};

export type WarpPass = {
  /**
   * Sizes the target for a `vw` by `vh` screen (reallocating only when it changes), binds it and
   * sets its viewport. Null when the GPU cannot render to a target of that size.
   */
  begin(vw: number, vh: number): WarpTarget | null;
  /** Draws the target to the canvas through the warp. Leaves the canvas bound and unit 0 active. */
  present(vw: number, vh: number): void;
  dispose(): void;
};

/** Draws after `main`, the tile program, which it makes current again. Null when the warp program does not link. */
export function createWarpPass(g: WebGLRenderingContext, main: WebGLProgram): WarpPass | null {
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
  g.bindAttribLocation(prog, 0, "p");
  g.linkProgram(prog);
  g.deleteShader(vs);
  g.deleteShader(fs);
  if (!g.getProgramParameter(prog, g.LINK_STATUS)) {
    console.error(g.getProgramInfoLog(prog));
    g.deleteProgram(prog);
    return null;
  }
  const uTex = g.getUniformLocation(prog, "uTex");
  const uRes = g.getUniformLocation(prog, "uRes");
  const uMargin = g.getUniformLocation(prog, "uMargin");
  const fbo = g.createFramebuffer();
  const tex = g.createTexture();
  let tw = 0;
  let th = 0;
  /** The margin in CSS px the target was last sized with (snapped to whole device pixels). */
  let margin = 0;

  /** (Re)allocates the target at `pw` by `ph` texels and attaches it; false when the GPU says it is incomplete. */
  const allocate = (pw: number, ph: number): boolean => {
    g.activeTexture(g.TEXTURE1);
    g.bindTexture(g.TEXTURE_2D, tex);
    g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, pw, ph, 0, g.RGBA, g.UNSIGNED_BYTE, null);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.LINEAR);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE);
    g.bindFramebuffer(g.FRAMEBUFFER, fbo);
    g.framebufferTexture2D(g.FRAMEBUFFER, g.COLOR_ATTACHMENT0, g.TEXTURE_2D, tex, 0);
    const ok = g.checkFramebufferStatus(g.FRAMEBUFFER) === g.FRAMEBUFFER_COMPLETE;
    g.bindTexture(g.TEXTURE_2D, null);
    g.activeTexture(g.TEXTURE0);
    return ok;
  };
  const release = () => {
    g.bindFramebuffer(g.FRAMEBUFFER, null);
    g.deleteFramebuffer(fbo);
    g.deleteTexture(tex);
    g.deleteProgram(prog);
  };
  // can this GPU render to a texture at all? (a one texel target, before anything depends on it)
  const ready = allocate(1, 1);
  g.bindFramebuffer(g.FRAMEBUFFER, null);
  if (!ready) {
    console.error("The wall's render target is incomplete.");
    release();
    return null;
  }

  return {
    begin(vw, vh) {
      // the target has the canvas's density: the drawing buffer plus the margin in device pixels
      const dprX = vw > 0 ? g.drawingBufferWidth / vw : 1;
      const dprY = vh > 0 ? g.drawingBufferHeight / vh : 1;
      const dm = Math.ceil(warpMargin(vw, vh) * dprX);
      margin = dm / dprX;
      const width = vw + 2 * margin;
      const height = vh + 2 * margin * (dprX / dprY);
      let pw = g.drawingBufferWidth + 2 * dm;
      let ph = g.drawingBufferHeight + 2 * dm;
      // never more than the GPU can hold (then the copy is resampled, as it was before)
      const cap = g.getParameter(g.MAX_TEXTURE_SIZE) as number;
      if (Math.max(pw, ph) > cap) {
        const k = cap / Math.max(pw, ph);
        pw = Math.max(1, Math.floor(pw * k));
        ph = Math.max(1, Math.floor(ph * k));
      }
      if (pw !== tw || ph !== th) {
        const ok = allocate(pw, ph);
        // a target that failed is not kept: the next frame allocates it again
        tw = ok ? pw : 0;
        th = ok ? ph : 0;
        if (!ok) return null;
      }
      g.bindFramebuffer(g.FRAMEBUFFER, fbo);
      g.viewport(0, 0, pw, ph);
      return { margin, width, height };
    },
    present(vw, vh) {
      g.bindFramebuffer(g.FRAMEBUFFER, null);
      g.viewport(0, 0, g.drawingBufferWidth, g.drawingBufferHeight);
      g.disable(g.BLEND); // a straight copy: every pixel is written
      g.useProgram(prog);
      g.activeTexture(g.TEXTURE1);
      g.bindTexture(g.TEXTURE_2D, tex);
      g.uniform1i(uTex, 1);
      g.uniform2f(uRes, vw, vh);
      g.uniform1f(uMargin, margin);
      g.drawArrays(g.TRIANGLE_STRIP, 0, 4);
      g.bindTexture(g.TEXTURE_2D, null);
      g.activeTexture(g.TEXTURE0);
      g.useProgram(main);
      g.enable(g.BLEND);
    },
    dispose: release,
  };
}
