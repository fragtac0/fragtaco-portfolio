import type { SiteVideo } from "~/types";
import {
  DRIFT,
  atlasLayout,
  cellUv,
  columnOffset,
  focusWeight,
  hitTile,
  layoutTiles,
  thumbUrl,
  tileSize,
  tileTransform,
  type Atlas,
  type LayoutTile,
  type TileSize,
} from "./wall-math";

/**
 * The video wall: every thumbnail on one large, slowly drifting surface, drawn with raw WebGL1.
 * Ported from the `Wall` module of docs/redesign/mockups/home-v4.html. Each tile is its own quad,
 * so the focus effect moves and scales whole tiles instead of bending pixels: the focused video
 * grows a little, its neighbours make room, everything else softens a touch (a biased mipmap
 * lookup, so the faint blur is always on).
 *
 * The engine owns its canvas. `prepare()` creates the GL context, program and atlas texture and
 * starts loading thumbnails, so the wall is warm when the layer opens. `mount()` puts the canvas
 * into the layer and wires the pointer, wheel and keyboard, `unmount()` takes it out again but
 * keeps the GL objects for an instant re-open, and `dispose()` (when the home page goes away)
 * frees everything and loses the context.
 *
 * Thumbnails are never stored: `sddefault.jpg` (or `hqdefault.jpg` where the sync recorded that
 * sddefault does not exist, or if the first one is too small) is decoded off the main thread,
 * drawn into one cell canvas and uploaded into a power-of-two atlas, at most 2 cells a frame,
 * with a single mipmap rebuild on a frame that uploaded. A thumbnail that never loads keeps the
 * animated placeholder.
 *
 * Touch: a tap opens the video straight away. Fine pointers: hover focuses (with a chip under the
 * tile), a click opens. Keyboard (spec 8.10), while the wall runs: the arrow keys move a focus
 * highlight over the tiles (the same lens as hover, panning to keep it in view) and Enter on the
 * stage opens the focused video. Esc is HomePage's, through the hooks WatchingScene registers.
 */

export type WallEls = {
  /** The canvas goes in here. */
  host: HTMLElement;
  /** The chip under the focused tile: a `b` (title) and a `span` (channel). */
  chip: HTMLElement;
  hint: HTMLElement;
};

export type WallEngine = {
  prepare(): void;
  mount(els: WallEls): void;
  start(): void;
  stop(): void;
  unmount(): void;
  /** While a video is open the wall stops, keeps that tile in focus, and takes no input. */
  freeze(key?: string): void;
  thaw(): void;
  /** Stops drawing altogether, under the cover of the detail view. */
  hold(v: boolean): void;
  /** The tile's current rectangle in viewport coordinates, or null when it is not in view. */
  rectOf(key: string): DOMRect | null;
  /** Move the keyboard focus one tile: (1, 0) right, (0, 1) down. */
  focusNext(dx: number, dy: number): void;
  openFocused(): void;
  dispose(): void;
};

type Tile = LayoutTile & {
  /** Its own hover weight, 0 to 1. */
  f: number;
  /** Displaced centre, size and corner radius. */
  cx: number;
  cy: number;
  w: number;
  h: number;
  rad: number;
};

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

const HINT_FINE =
  "Drag or scroll to look around. Hover a video to bring it forward, click to open it.";
const HINT_TOUCH = "Drag to look around. Tap a video to open it.";
const HINT_NO_GL = "The wall could not start in this browser.";
const STAGE_LABEL = "Video wall. Use the arrow keys to move, Enter to open.";

const VS = `attribute vec2 p;uniform vec4 uRect;uniform vec2 uRes;uniform float uPad;varying vec2 vL;
  void main(){vec2 sz=uRect.zw+2.*uPad;vec2 pos=uRect.xy-uPad+p*sz;vL=pos-(uRect.xy+uRect.zw*.5);vec2 c=pos/uRes*2.-1.;gl_Position=vec4(c.x,-c.y,0.,1.);}`;
const FS = `precision highp float;varying vec2 vL;
  uniform sampler2D uAtlas;uniform vec4 uRect,uCell;uniform float uBias,uDim,uKind,uAlpha,uRad,uLoaded,uTime;
  float sdBox(vec2 p,vec2 b,float r){vec2 q=abs(p)-b+r;return length(max(q,0.))+min(max(q.x,q.y),0.)-r;}
  void main(){
    float sd=sdBox(vL,uRect.zw*.5,uRad);
    if(uKind>1.5){float a=(1.-smoothstep(-26.,54.,sd))*uAlpha;gl_FragColor=vec4(0.,0.,0.,a);return;}
    if(uKind>.5){float a=1.-smoothstep(-8.,60.,sd);a=a*a*uAlpha;gl_FragColor=vec4(vec3(.988,.298,0.)*a,a);return;}
    float a=1.-smoothstep(-.8,.8,sd);
    vec2 st=clamp(vL/uRect.zw+.5,0.,1.);
    vec3 col=uLoaded>.5?texture2D(uAtlas,uCell.xy+st*uCell.zw,uBias).rgb:vec3(.075,.06,.05)+.022*sin(vL.x*.02-uTime*2.4);
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

/** Client only: creates a canvas. The GL context is made later, by `prepare()`. */
export function createWall(
  videos: SiteVideo[],
  opts: {
    fine: boolean;
    reducedMotion: boolean;
    onPick: (index: number, rect: DOMRect, key: string) => void;
  },
): WallEngine {
  const FINE = opts.fine;
  const REDUCE = opts.reducedMotion;
  const canvas = document.createElement("canvas");
  canvas.className = "wall-canvas";
  canvas.tabIndex = 0;
  canvas.setAttribute("role", "group");
  canvas.setAttribute("aria-label", STAGE_LABEL);

  let gl: WebGLRenderingContext | null = null;
  let program: WebGLProgram | null = null;
  let buffer: WebGLBuffer | null = null;
  let tex: WebGLTexture | null = null;
  const U = {} as Record<UniformName, WebGLUniformLocation | null>;
  let atlas: Atlas | null = null;
  let uvs: Array<[number, number, number, number]> = [];
  let cell: HTMLCanvasElement | null = null;
  let cellCtx: CanvasRenderingContext2D | null = null;
  let loaded = new Float32Array(0);
  const queue: Array<[number, HTMLImageElement]> = [];
  const images = new Set<HTMLImageElement>();

  let prepared = false;
  let failed = false;
  let disposed = false;
  let els: WallEls | null = null;
  let listeners: AbortController | null = null;
  let running = false;
  let held = false;
  let frozen = false;
  let raf = 0;
  let pumpRaf = 0;
  let last = 0;
  let t = 0;

  let size: TileSize = tileSize(1280);
  let vw = 0;
  let vh = 0;
  let ox = 0;
  let oy = 0;
  let dpr = 1;
  const pan = { x: 0, y: 0 };
  const vel = { x: 0, y: 0 };
  const mouse = { x: 0, y: 0, inside: false };
  const focus = { x: 0, y: 0 };
  let lens = 0;
  let speedMul = 1;
  let hoverKey: string | null = null;
  /** The tile the keyboard highlight is on, as its column and row indices. */
  let kbd: { cx: number; cy: number } | null = null;
  let tiles: Tile[] = [];
  let down: { x: number; y: number; lx: number; ly: number; ts: number } | null = null;
  let dragging = false;
  let chipIdx = -1;
  let chipW = 0;
  let chipH = 0;
  let cursor = "";
  const fstate = new Map<string, number>();
  const seen = new Set<string>();

  const kbdKey = () => (kbd ? `${kbd.cx},${kbd.cy}` : null);

  // ---- thumbnails

  const loadImage = (src: string) =>
    new Promise<HTMLImageElement | null>((resolve) => {
      if (disposed) return resolve(null);
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      images.add(img);
      img.src = src;
    });
  const drop = (img: HTMLImageElement) => {
    img.onload = null;
    img.onerror = null;
    images.delete(img);
  };

  /** sddefault, or hqdefault when that fails or is tiny; decoded before it is queued. */
  async function loadThumb(i: number) {
    const v = videos[i];
    const first = thumbUrl(v, "sd");
    let img = await loadImage(first);
    if (!img || img.naturalWidth <= 200) {
      const hq = `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`;
      if (img) drop(img);
      img = hq === first ? null : await loadImage(hq);
    }
    if (!img || disposed) return;
    try {
      await img.decode();
    } catch {
      drop(img);
      return;
    }
    if (disposed) return;
    queue.push([i, img]);
    schedulePump();
  }

  /** Up to 2 cells, then one mipmap rebuild for the batch. Returns whether anything went up. */
  function uploadBatch(): boolean {
    const g = gl;
    if (!g || !tex || !atlas || !cell || !cellCtx || !queue.length) return false;
    g.bindTexture(g.TEXTURE_2D, tex);
    for (let n = 0; n < 2 && queue.length; n++) {
      const [i, img] = queue.shift() as [number, HTMLImageElement];
      const c = atlas.cells[i];
      const ih = img.naturalHeight * 0.75; // keep the 16:9 middle of the 4:3 thumbnail
      cellCtx.drawImage(
        img,
        0,
        (img.naturalHeight - ih) / 2,
        img.naturalWidth,
        ih,
        0,
        0,
        atlas.cw,
        atlas.ch,
      );
      g.texSubImage2D(g.TEXTURE_2D, 0, c.x, c.y, g.RGBA, g.UNSIGNED_BYTE, cell);
      loaded[i] = 1;
      drop(img);
    }
    g.generateMipmap(g.TEXTURE_2D);
    return true;
  }

  /** While the wall is not running its frame loop does not exist, so uploads get their own. */
  function schedulePump() {
    if (pumpRaf || running || disposed || !queue.length) return;
    pumpRaf = requestAnimationFrame(() => {
      pumpRaf = 0;
      if (disposed || running) return;
      uploadBatch();
      schedulePump();
    });
  }

  // ---- building

  function prepare() {
    if (prepared || disposed) return;
    prepared = true;
    const g = canvas.getContext("webgl", {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
    });
    if (!g) {
      failed = true;
      return;
    }
    const sh = (type: number, src: string) => {
      const s = g.createShader(type) as WebGLShader;
      g.shaderSource(s, src);
      g.compileShader(s);
      if (!g.getShaderParameter(s, g.COMPILE_STATUS)) console.error(g.getShaderInfoLog(s));
      return s;
    };
    const prog = g.createProgram();
    g.attachShader(prog, sh(g.VERTEX_SHADER, VS));
    g.attachShader(prog, sh(g.FRAGMENT_SHADER, FS));
    g.linkProgram(prog);
    if (!g.getProgramParameter(prog, g.LINK_STATUS)) {
      console.error(g.getProgramInfoLog(prog));
      failed = true;
      return;
    }
    g.useProgram(prog);
    buffer = g.createBuffer();
    g.bindBuffer(g.ARRAY_BUFFER, buffer);
    g.bufferData(g.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), g.STATIC_DRAW);
    const loc = g.getAttribLocation(prog, "p");
    g.enableVertexAttribArray(loc);
    g.vertexAttribPointer(loc, 2, g.FLOAT, false, 0, 0);
    for (const k of UNIFORMS) U[k] = g.getUniformLocation(prog, k);
    g.uniform1i(U.uAtlas, 0);

    const a = atlasLayout(videos.length, window.innerWidth < 700);
    atlas = a;
    if (videos.length > a.cells.length) {
      console.warn(
        `The wall shows ${a.cells.length} of ${videos.length} videos: the thumbnail atlas is full.`,
      );
    }
    uvs = a.cells.map((_, i) => cellUv(i, a));
    loaded = new Float32Array(a.cells.length);
    cell = document.createElement("canvas");
    cell.width = a.cw;
    cell.height = a.ch;
    cellCtx = cell.getContext("2d");

    // a power-of-two atlas, so it can carry mipmaps: the soft focus is just a biased lookup
    tex = g.createTexture();
    g.bindTexture(g.TEXTURE_2D, tex);
    g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, a.aw, a.ah, 0, g.RGBA, g.UNSIGNED_BYTE, null);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR_MIPMAP_LINEAR);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.LINEAR);
    g.generateMipmap(g.TEXTURE_2D);
    g.enable(g.BLEND);
    g.blendFunc(g.ONE, g.ONE_MINUS_SRC_ALPHA);
    program = prog;
    gl = g;
    for (let i = 0; i < a.cells.length; i++) void loadThumb(i);
  }

  function sizes() {
    vw = canvas.clientWidth;
    vh = canvas.clientHeight;
    const r = canvas.getBoundingClientRect();
    ox = r.left;
    oy = r.top;
    size = tileSize(vw);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = Math.round(vw * dpr);
    const H = Math.round(vh * dpr);
    if (canvas.width !== W || canvas.height !== H) {
      canvas.width = W;
      canvas.height = H;
    }
  }

  // ---- drawing

  function quad(
    g: WebGLRenderingContext,
    x: number,
    y: number,
    w: number,
    h: number,
    kind: number,
    alpha: number,
    pad: number,
    rad: number,
  ) {
    g.uniform4f(U.uRect, x, y, w, h);
    g.uniform1f(U.uKind, kind);
    g.uniform1f(U.uAlpha, alpha);
    g.uniform1f(U.uPad, pad);
    g.uniform1f(U.uRad, rad);
    g.drawArrays(g.TRIANGLE_STRIP, 0, 4);
  }

  function frame(now: number) {
    if (!running || !gl || !atlas) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (held) return;
    const g = gl;
    const { cw, ch, pitchX, pitchY } = size;
    const hovering = FINE && mouse.inside && !dragging;
    // the wall settles while you look at something, then drifts on again
    speedMul +=
      ((hovering || kbd !== null || frozen ? 0 : 1) - speedMul) * Math.min(1, dt * 2.5);
    if (!REDUCE) t += dt * speedMul;
    if (!dragging && !frozen) {
      pan.x += vel.x * dt;
      pan.y += vel.y * dt;
      const k = Math.pow(0.05, dt);
      vel.x *= k;
      vel.y *= k;
    }
    if (!REDUCE) pan.x += DRIFT * dt * speedMul;
    if (kbd && !frozen) {
      // the keyboard focus pans the wall just far enough to keep its tile in view
      const k = Math.min(1, dt * 6);
      const xc = kbd.cx * pitchX - pan.x + cw / 2;
      const yc = kbd.cy * pitchY - pan.y - columnOffset(t, kbd.cx) + ch / 2;
      const mx = Math.min(pitchX * 0.75, vw / 2);
      const my = Math.min(Math.max(pitchY * 0.75, 120), vh / 2);
      pan.x += (xc < mx ? xc - mx : xc > vw - mx ? xc - (vw - mx) : 0) * k;
      pan.y += (yc < my ? yc - my : yc > vh - my ? yc - (vh - my) : 0) * k;
    }
    const list = layoutTiles({
      panX: pan.x,
      panY: pan.y,
      vw,
      vh,
      pitchX,
      pitchY,
      t,
      count: atlas.cells.length,
    }) as Tile[];
    if (!frozen) {
      // nearest tile, gaps included, so the focus never drops between two videos
      hoverKey = hovering ? hitTile(list, mouse.x, mouse.y, size) : null;
      if (hoverKey === null && kbd && !dragging) hoverKey = kbdKey();
    }
    let ft: Tile | null = null;
    if (hoverKey !== null) {
      for (const tl of list) {
        if (tl.key === hoverKey) {
          ft = tl;
          break;
        }
      }
    }
    lens += ((ft ? 1 : 0) - lens) * Math.min(1, dt * 7);
    if (ft) {
      const fx = ft.x + cw / 2;
      const fy = ft.y + ch / 2;
      if (lens < 0.08) {
        focus.x = fx;
        focus.y = fy;
      } else {
        const k = Math.min(1, dt * 12);
        focus.x += (fx - focus.x) * k;
        focus.y += (fy - focus.y) * k;
      }
    }
    seen.clear();
    for (const tl of list) {
      let f = fstate.get(tl.key) || 0;
      f += ((tl.key === hoverKey ? 1 : 0) - f) * Math.min(1, dt * 9);
      if (f > 0.002) {
        fstate.set(tl.key, f);
        seen.add(tl.key);
      } else f = 0;
      const cx = tl.x + cw / 2;
      const cy = tl.y + ch / 2;
      const dx = cx - focus.x;
      const dy = cy - focus.y;
      const w = lens * focusWeight(dx, dy, pitchX);
      const tr = tileTransform({ cx, cy, dx, dy, f, w, cw, ch });
      tl.f = f;
      tl.cx = tr.cx;
      tl.cy = tr.cy;
      tl.w = tr.w;
      tl.h = tr.h;
      tl.rad = tr.rad;
    }
    for (const k of fstate.keys()) if (!seen.has(k)) fstate.delete(k);
    list.sort((a, b) => a.f - b.f);

    if (queue.length && !frozen) uploadBatch();

    g.viewport(0, 0, canvas.width, canvas.height);
    g.clearColor(0, 0, 0, 0);
    g.clear(g.COLOR_BUFFER_BIT);
    g.uniform2f(U.uRes, vw, vh);
    g.uniform1f(U.uTime, REDUCE ? 0 : now / 1000);
    for (const tl of list) {
      const L = tl.cx - tl.w / 2;
      const T = tl.cy - tl.h / 2;
      if (tl.f > 0.01) {
        quad(g, L, T + 18 * tl.f, tl.w, tl.h, 2, 0.5 * tl.f, 70, tl.rad); // a soft shadow lifts it off the wall
        quad(g, L, T, tl.w, tl.h, 1, 0.5 * tl.f, 70, tl.rad); // and a faint orange glow
      }
      const i = tl.idx;
      const uv = uvs[i];
      g.uniform4f(U.uCell, uv[0], uv[1], uv[2], uv[3]);
      g.uniform1f(U.uBias, 1.35 * lens * (1 - tl.f));
      g.uniform1f(U.uDim, 1 - 0.16 * lens * (1 - tl.f));
      g.uniform1f(U.uLoaded, loaded[i]);
      quad(g, L, T, tl.w, tl.h, 0, 1, 0, tl.rad);
    }
    tiles = list;

    const chip = els?.chip;
    const top = list[list.length - 1];
    if (chip && !frozen && top && top.key === hoverKey && top.f > 0.5) {
      // title and channel sit right under the video
      if (chipIdx !== top.idx) {
        const b = chip.querySelector("b");
        const s = chip.querySelector("span");
        if (b) b.textContent = videos[top.idx].title;
        if (s) s.textContent = videos[top.idx].channel;
        chipIdx = top.idx;
        chipW = chip.offsetWidth;
        chipH = chip.offsetHeight;
      }
      const x = clamp(top.cx - chipW / 2, 12, Math.max(12, vw - chipW - 12));
      let y = top.cy + top.h / 2 + 14;
      if (y + chipH > vh - 12) y = top.cy - top.h / 2 - 14 - chipH;
      chip.style.transform = `translate3d(${Math.round(x)}px,${Math.round(y)}px,0)`;
      chip.classList.add("on");
    } else chip?.classList.remove("on");
    const cur = dragging ? "grabbing" : hoverKey ? "pointer" : "grab";
    if (cur !== cursor) canvas.style.cursor = cursor = cur;
  }

  // ---- picking

  /** The topmost displaced tile under a point (the list is sorted, hovered last). */
  const hitAt = (x: number, y: number): Tile | null => {
    for (let k = tiles.length - 1; k >= 0; k--) {
      const tl = tiles[k];
      if (Math.abs(x - tl.cx) <= tl.w / 2 && Math.abs(y - tl.cy) <= tl.h / 2) return tl;
    }
    return null;
  };
  const rectOfTile = (tl: Tile) =>
    new DOMRect(ox + tl.cx - tl.w / 2, oy + tl.cy - tl.h / 2, tl.w, tl.h);

  /** Freezes right here, so a second click cannot land while the detail view is opening. */
  function pick(tl: Tile) {
    frozen = true;
    hoverKey = tl.key;
    opts.onPick(tl.idx, rectOfTile(tl), tl.key);
  }

  function focusNext(dx: number, dy: number) {
    if (!running || frozen || held || !tiles.length) return;
    if (!kbd) {
      // start from the tile nearest the middle of the view
      let best: Tile | null = null;
      let bd = Infinity;
      for (const tl of tiles) {
        const d = Math.hypot(
          tl.x + size.cw / 2 - vw / 2,
          tl.y + size.ch / 2 - vh / 2,
        );
        if (d < bd) {
          bd = d;
          best = tl;
        }
      }
      if (!best) return;
      const [cx, cy] = best.key.split(",").map(Number);
      kbd = { cx, cy };
    } else if (dx) {
      // the next column drifts on its own: take the tile nearest this one's height
      const ncx = kbd.cx + Math.sign(dx);
      const y = kbd.cy * size.pitchY - columnOffset(t, kbd.cx);
      kbd = { cx: ncx, cy: Math.round((y + columnOffset(t, ncx)) / size.pitchY) };
    } else if (dy) {
      kbd = { cx: kbd.cx, cy: kbd.cy + Math.sign(dy) };
    }
    mouse.inside = false; // the keyboard leads until the pointer moves again
  }

  function openFocused() {
    if (!running || frozen || held) return;
    const key = kbd ? kbdKey() : hoverKey;
    if (key === null) return;
    const tl = tiles.find((x) => x.key === key);
    if (tl) pick(tl);
  }

  function stop() {
    running = false;
    cancelAnimationFrame(raf);
    els?.chip.classList.remove("on");
    canvas.style.cursor = "";
    cursor = "";
    mouse.inside = false;
    frozen = held = false;
    dragging = false;
    down = null;
    kbd = null;
    schedulePump(); // thumbnails that arrive while the layer is closed still go up
  }

  function unmount() {
    stop();
    listeners?.abort();
    listeners = null;
    canvas.remove();
    els = null;
  }

  return {
    prepare,

    mount(next) {
      if (els) unmount();
      els = next;
      next.host.appendChild(canvas);
      next.hint.textContent = FINE ? HINT_FINE : HINT_TOUCH;
      chipIdx = -1;
      const ac = new AbortController();
      const on = { signal: ac.signal };
      listeners = ac;

      canvas.addEventListener(
        "pointermove",
        (e) => {
          mouse.x = e.clientX - ox;
          mouse.y = e.clientY - oy;
          mouse.inside = e.pointerType === "mouse";
          if (mouse.inside) kbd = null; // the pointer takes the focus back
          if (down) {
            const dx = e.clientX - down.lx;
            const dy = e.clientY - down.ly;
            down.lx = e.clientX;
            down.ly = e.clientY;
            if (!dragging && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) {
              dragging = true;
            }
            if (dragging) {
              pan.x -= dx;
              pan.y -= dy;
              const dts = Math.max(1, e.timeStamp - down.ts) / 1000;
              vel.x = -dx / dts;
              vel.y = -dy / dts;
              down.ts = e.timeStamp;
            }
          }
        },
        on,
      );
      canvas.addEventListener(
        "pointerdown",
        (e) => {
          if (frozen) return;
          canvas.setPointerCapture(e.pointerId);
          down = {
            x: e.clientX,
            y: e.clientY,
            lx: e.clientX,
            ly: e.clientY,
            ts: e.timeStamp,
          };
          vel.x = vel.y = 0;
        },
        on,
      );
      canvas.addEventListener(
        "pointerup",
        (e) => {
          const wasDrag = dragging;
          dragging = false;
          down = null;
          if (wasDrag || frozen || held) return;
          vel.x = vel.y = 0;
          const tl = hitAt(e.clientX - ox, e.clientY - oy);
          if (tl) pick(tl);
        },
        on,
      );
      canvas.addEventListener(
        "pointercancel",
        () => {
          dragging = false;
          down = null;
        },
        on,
      );
      canvas.addEventListener("pointerleave", () => (mouse.inside = false), on);
      canvas.addEventListener(
        "wheel",
        (e) => {
          e.preventDefault();
          if (frozen) return;
          const m = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? vh : 1;
          pan.x += e.deltaX * m;
          pan.y += e.deltaY * m;
        },
        { passive: false, signal: ac.signal },
      );
      canvas.addEventListener(
        "blur",
        () => {
          // the highlight lives only while the stage has focus (opening a video moves focus on)
          if (frozen) return;
          kbd = null;
        },
        on,
      );
      window.addEventListener(
        "keydown",
        (e) => {
          if (!running || frozen || held || e.altKey || e.ctrlKey || e.metaKey) return;
          const arrow: Record<string, [number, number]> = {
            ArrowLeft: [-1, 0],
            ArrowRight: [1, 0],
            ArrowUp: [0, -1],
            ArrowDown: [0, 1],
          };
          const move = arrow[e.key];
          if (move) {
            e.preventDefault();
            if (document.activeElement !== canvas) canvas.focus({ preventScroll: true });
            focusNext(move[0], move[1]);
          } else if (e.key === "Enter" && document.activeElement === canvas) {
            e.preventDefault();
            openFocused();
          }
        },
        on,
      );
      window.addEventListener("resize", () => running && sizes(), on);
    },

    start() {
      prepare();
      if (!gl || !els) {
        if (failed && els) els.hint.textContent = HINT_NO_GL;
        return;
      }
      lens = 0;
      hoverKey = null;
      kbd = null;
      fstate.clear();
      frozen = held = false;
      sizes();
      running = true;
      last = performance.now();
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(frame);
    },

    stop,

    unmount,

    freeze(key) {
      frozen = true;
      if (key) hoverKey = key;
    },
    thaw() {
      frozen = false;
    },
    hold(v) {
      held = v;
    },
    rectOf(key) {
      const tl = tiles.find((x) => x.key === key);
      return tl ? rectOfTile(tl) : null;
    },

    focusNext,
    openFocused,

    dispose() {
      if (disposed) return;
      unmount();
      disposed = true;
      cancelAnimationFrame(pumpRaf);
      queue.length = 0;
      for (const img of images) {
        img.onload = null;
        img.onerror = null;
        img.src = "";
      }
      images.clear();
      const g = gl;
      if (g) {
        g.deleteTexture(tex);
        g.deleteBuffer(buffer);
        g.deleteProgram(program);
        g.getExtension("WEBGL_lose_context")?.loseContext();
      }
      gl = null;
      tex = program = buffer = null;
      cell = null;
      cellCtx = null;
      tiles = [];
    },
  };
}
