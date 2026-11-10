/**
 * PAINTING ENGINE: one fragment shader does the first reveal (from the centre,
 * out of black), every later change (a liquid-glass front sweeping across), the
 * blur behind the cards (a biased mip lookup), and the dot screen and grain on
 * top. Nothing else is layered over the canvas, so the compositor never has to
 * blend a full screen.
 *
 * Ported from `createPaint` in docs/redesign/mockups/home-v4.html. Framework
 * free: the only DOM it touches is the canvas it is given. Callers must give
 * each `createPaint` call a fresh canvas element, because `dispose` loses the
 * context for good.
 */

import { kenBurnsZoom } from "./ken-burns";

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

const UNIFORMS = [
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
type UniformName = (typeof UNIFORMS)[number];

const VERTEX_SRC =
  "attribute vec2 p;varying vec2 v;void main(){v=p*.5+.5;gl_Position=vec4(p,0.,1.);}";

const FRAGMENT_SRC = `precision highp float;varying vec2 v;
  uniform sampler2D uA,uB;uniform vec2 uRes,uFocA,uFocB,uDir;uniform float uAspA,uAspB,uZoomA,uZoomB,uP,uT,uMode,uHasA,uBlur,uDpr;
  float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
  float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1.,0.)),f.x),mix(h(i+vec2(0.,1.)),h(i+vec2(1.,1.)),f.x),f.y);}
  float fbm(vec2 p){return n(p)*.55+n(p*2.03+7.1)*.3+n(p*4.07-3.7)*.15;}
  vec2 cover(vec2 uv,float ia,vec2 foc,float z){float ca=uRes.x/uRes.y;vec2 s=ca>ia?vec2(1.,ia/ca):vec2(ca/ia,1.);s/=z;return foc*(1.-s)+uv*s;}
  vec3 soft(sampler2D t,vec2 uv){
    float b=uBlur*4.6;vec2 o=uBlur*vec2(.0055,.0095);
    vec3 c=texture2D(t,uv,b).rgb*2.+texture2D(t,uv+o,b).rgb+texture2D(t,uv-o,b).rgb+texture2D(t,uv+vec2(o.x,-o.y),b).rgb+texture2D(t,uv+vec2(-o.x,o.y),b).rgb;
    return c/6.*(1.-.36*uBlur);
  }
  vec3 finish(vec3 c){
    vec2 fc=gl_FragCoord.xy/uDpr;
    float d=length(fract(fc*.25)-.5)*4.;
    c=mix(c,vec3(.96,.937,.9),.065*(1.-smoothstep(.35,1.05,d)));
    return c+(h(floor(fc))-.5)*.04;
  }
  void main(){
    vec2 uv=vec2(v.x,1.-v.y);
    vec2 ub=cover(uv,uAspB,uFocB,uZoomB);
    if(uP>=1.){gl_FragColor=vec4(finish(uBlur>.002?soft(uB,ub):texture2D(uB,ub).rgb),1.);return;}
    if(uP<=0.&&uHasA<.5){gl_FragColor=vec4(finish(vec3(.02,.016,.012)),1.);return;}
    if(uMode>1.5){
      vec3 Bc=uBlur>.002?soft(uB,ub):texture2D(uB,ub).rgb;
      vec2 uc=cover(uv,uAspA,uFocA,uZoomA);
      vec3 Ac=uHasA<.5?vec3(.02,.016,.012):(uBlur>.002?soft(uA,uc):texture2D(uA,uc).rgb);
      gl_FragColor=vec4(finish(mix(Ac,Bc,uP)),1.);return;
    }
    float ca=uRes.x/uRes.y;vec2 pa=(uv-.5)*vec2(ca,1.);
    float d=uMode<.5?length(pa)/(.5*length(vec2(ca,1.))):dot(pa,uDir)/(.5*(abs(uDir.x)*ca+abs(uDir.y)))*.5+.5;
    d+=(fbm(pa*2.4+uT*.06)-.5)*.34;
    float f=mix(-.25,1.32,uP),w=.07;
    float mB=1.-smoothstep(f-w,f+w,d);
    float band=1.-abs(mB*2.-1.);
    float wake=smoothstep(f-.55,f,d)*mB;
    float s=(band+wake*.6+.1*sin(3.14159*uP))*(1.-smoothstep(.8,1.,uP));
    vec2 q=pa*3.1+vec2(uT*.07,-uT*.04);
    float e=.02,c=fbm(q);
    vec2 nrm=vec2(fbm(q+vec2(e,0.))-c,fbm(q+vec2(0.,e))-c)/e;
    vec2 off=nrm*.05*s;float k=1.+.4*s;
    vec2 ua=cover(uv,uAspA,uFocA,uZoomA);
    vec3 A=vec3(texture2D(uA,ua+off*k).r,texture2D(uA,ua+off).g,texture2D(uA,ua+off/k).b);
    if(uHasA<.5)A=vec3(.02,.016,.012);
    vec3 B=vec3(texture2D(uB,ub-off*k).r,texture2D(uB,ub-off).g,texture2D(uB,ub-off/k).b);
    vec3 col=mix(A,B,mB);
    vec3 N=normalize(vec3(-nrm*s*1.3,1.));
    col+=pow(max(dot(N,normalize(vec3(-.4,.5,1.))),0.),70.)*s*.55*vec3(1.,.97,.9);
    col+=band*.045*vec3(1.,.62,.38);
    gl_FragColor=vec4(finish(col),1.);
  }`;

/** Reduced motion: the first reveal is a plain fade of this length, and a change a plain crossfade. */
export const REDUCED_REVEAL_MS = 400;
export const REDUCED_SWAP_MS = 800;

/** Returns null without WebGL, or when the shaders fail to compile or link. */
export function createPaint(
  canvas: HTMLCanvasElement,
  opts: { reducedMotion: boolean },
): PaintEngine | null {
  const reduce = opts.reducedMotion;
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

  const vsh = compile(gl.VERTEX_SHADER, VERTEX_SRC);
  const fsh = compile(gl.FRAGMENT_SHADER, FRAGMENT_SRC);
  const prog = gl.createProgram();
  if (!vsh || !fsh || !prog) {
    if (vsh) gl.deleteShader(vsh);
    if (fsh) gl.deleteShader(fsh);
    if (prog) gl.deleteProgram(prog);
    return null;
  }
  gl.attachShader(prog, vsh);
  gl.attachShader(prog, fsh);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(prog));
    gl.deleteProgram(prog);
    gl.deleteShader(vsh);
    gl.deleteShader(fsh);
    return null;
  }
  gl.useProgram(prog);

  const buffer = gl.createBuffer();
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

  const tex = [0, 1].map(() => {
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
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
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
      tex.forEach((t) => gl.deleteTexture(t));
      gl.deleteBuffer(buffer);
      gl.deleteProgram(prog);
      gl.deleteShader(vsh);
      gl.deleteShader(fsh);
      if (!gl.isContextLost()) gl.getExtension("WEBGL_lose_context")?.loseContext();
    },
  };
}
