import type * as THREE from "three";
import type { SiteBook } from "~/types";
import { CREAM, LINE_ALPHA } from "../../../styles/tokens";
import {
  backCanvas,
  coverCanvas,
  foreCanvas,
  softRectCanvas,
  topCanvas,
} from "./shelf-canvases";
import { addShelfLights } from "./shelf-light";
import { FRONT, SHELF_GAP, WALLZ, bookSize, flatFrame, headGuess } from "./shelf-math";
import { newBag, type Book, type ShelfScene } from "./shelf-scene-types";
import { createSpineFace, resizeSpines, spinePixels, MAX_DPR } from "./shelf-spines";

export { newBag };
export type { Bag, Book, FlatMesh, ShelfScene } from "./shelf-scene-types";

type Three = typeof THREE;

/**
 * Builds the shelf's three.js scene: renderer, an orthographic camera that looks straight at the
 * spines, one box per book, a soft wall shadow for a lifted book, and the hairline the books
 * stand on. The row is unlit (`MeshBasicMaterial`, no tone mapping), so a spine is exactly the
 * colour it was painted; each book also has a lit material set (`litMats`) that a lifted book is
 * swapped to by `setLit`, lit by `lights` (shelf-light.ts). Nothing here is drawn or animated; the
 * engine owns the frame loop and the state. three.js itself is passed in (the engine loads it
 * with `import("three")`), so this module never imports it as a value.
 */

/** Canvas text needs the faces loaded first. A failure only costs the fallback faces. */
export async function loadShelfFonts(): Promise<void> {
  if (!document.fonts) return;
  await Promise.all(
    ['500 40px Lora', '500 20px "IBM Plex Mono"'].map((f) =>
      document.fonts.load(f),
    ),
  ).catch((err: unknown) => {
    console.warn("The shelf fonts did not load; the fallback faces are used.", err);
  });
}

/** Runs the steps one after another, spread over time (`createSlicer().run`). */
export type RunSteps = (steps: Array<() => void>) => Promise<void>;

/** A resize is repainted when it has held still this long. */
const SPINE_RESIZE_MS = 140;

/** Books painted per step, and textures uploaded per step. */
const BOOKS_PER_STEP = 3;
const UPLOADS_PER_STEP = 3;

/**
 * The work is cut into small steps handed to `run`, which decides when each one happens (idle time,
 * or back to back when the shelf is waited for); if `run` rejects (the engine was disposed),
 * everything built so far is freed and the rejection is passed on. `onCover` is told about each
 * book as it is built, so its real cover can start downloading right away.
 */
export async function buildShelfScene(
  T: Three,
  canvas: HTMLCanvasElement,
  books: SiteBook[],
  run: RunSteps,
  onCover?: (tex: THREE.CanvasTexture, d: SiteBook) => void,
): Promise<ShelfScene> {
  const disposables: { dispose(): void }[] = [];
  let spineTimer = 0;
  const track = <D extends { dispose(): void }>(d: D): D => {
    disposables.push(d);
    return d;
  };

  const r = new T.WebGLRenderer({ canvas, antialias: true, alpha: true });
  const dispose = () => {
    window.clearTimeout(spineTimer);
    for (const d of disposables) d.dispose();
    disposables.length = 0;
    r.dispose();
    r.forceContextLoss();
  };

  try {
    r.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    r.outputColorSpace = T.SRGBColorSpace;
    r.toneMapping = T.NoToneMapping;
    const scene = new T.Scene();
    // looks straight down -z; the fit sets the frustum (world units) and the height of the line
    const camera = new T.OrthographicCamera(-1, 1, 1, -1, 0.1, 40);
    camera.position.z = 10;
    // the lit set is for a lifted book only: at rest these light a face to exactly its colour
    const lights = addShelfLights(T, scene);

    const toTex = (c: HTMLCanvasElement) => {
      const t = track(new T.CanvasTexture(c));
      t.colorSpace = T.SRGBColorSpace;
      t.anisotropy = 8;
      return t;
    };
    const flat = (map: THREE.Texture, opacity: number) =>
      track(
        new T.MeshBasicMaterial({
          map,
          transparent: true,
          depthWrite: false,
          opacity,
          toneMapped: false,
        }),
      );
    const unlit = (map: THREE.Texture) =>
      track(new T.MeshBasicMaterial({ map, transparent: true, toneMapped: false }));
    const lit = (map: THREE.Texture, roughness: number) =>
      track(new T.MeshStandardMaterial({ map, roughness, transparent: true, toneMapped: false }));

    const wallTex = track(new T.CanvasTexture(softRectCanvas()));
    const unit = track(new T.PlaneGeometry(1, 1));

    // the spines are first painted for the size the stage is most likely to be (the window); the fit repaints them if it is not
    const sizes = books.map(bookSize);
    const guess = flatFrame({
      vw: window.innerWidth,
      vh: window.innerHeight,
      top: headGuess(window.innerWidth),
      span: sizes.reduce((n, b) => n + b.T, 0) + SHELF_GAP * (books.length - 1),
      tallest: Math.max(...sizes.map((b) => b.H)),
    });
    const dpr = () => Math.min(window.devicePixelRatio || 1, MAX_DPR);

    const list: Book[] = [];
    const makeBook = (i: number) => {
      const d = books[i];
      const { H, W, T: thick } = bookSize(d);
      const coverTex = toTex(coverCanvas(d, null));
      const spine = createSpineFace(d, spinePixels(thick, H, guess.scale, dpr()), toTex, dpr());
      const topTex = toTex(topCanvas(d));
      const faces = [
        toTex(foreCanvas(d)),
        spine.tex,
        topTex,
        topTex,
        coverTex,
        toTex(backCanvas(d)),
      ];
      // matt: a lifted book is lit softly, and a shine would wash its colours (a hardback's cover keeps a little)
      const rough = [0.92, 0.85, 0.92, 0.92, 0.6, 0.7];
      const mats = faces.map(unlit);
      const litMats = faces.map((f, k) => lit(f, rough[k]));
      const mesh = new T.Mesh(track(new T.BoxGeometry(W, H, thick)), mats);
      const g = new T.Group();
      g.add(mesh);
      scene.add(g);
      const wallSh = new T.Mesh(unit, flat(wallTex, 0));
      wallSh.renderOrder = -1;
      scene.add(wallSh);
      onCover?.(coverTex, d);
      list.push({
        d,
        g,
        mesh,
        mats,
        litMats,
        coverTex,
        spine,
        wallSh,
        H,
        W,
        T: thick,
        base: new T.Vector3(),
        baseQ: new T.Quaternion(),
        openPos: new T.Vector3(),
        openScale: 1,
        lift: 0,
        yMax: Infinity,
        anim: newBag(),
        order: i,
      });
    };
    // texture painting is spread over time, a few books at a time
    const bookSteps: Array<() => void> = [];
    for (let from = 0; from < books.length; from += BOOKS_PER_STEP) {
      bookSteps.push(() => {
        for (let i = from; i < Math.min(from + BOOKS_PER_STEP, books.length); i++) makeBook(i);
      });
    }
    await run(bookSteps);

    const qUp = new T.Quaternion().setFromRotationMatrix(
      new T.Matrix4().makeBasis(
        new T.Vector3(0, 0, -1),
        new T.Vector3(0, 1, 0),
        new T.Vector3(1, 0, 0),
      ),
    );
    const yAxis = new T.Vector3(0, 1, 0);
    const gap = SHELF_GAP;
    const span = list.reduce((s, b) => s + b.T, 0) + gap * (list.length - 1);
    let x = -span / 2;
    list.forEach((b) => {
      // one straight row: no yaw, so no side of any book shows (z is only for the open book to clear its neighbours)
      b.base.set(x + b.T / 2, b.H / 2, FRONT - b.W / 2);
      b.baseQ.copy(qUp);
      x += b.T + gap;
    });
    const line = new T.Mesh(
      unit,
      track(
        new T.MeshBasicMaterial({
          color: CREAM,
          transparent: true,
          opacity: LINE_ALPHA,
          depthWrite: false,
          toneMapped: false,
        }),
      ),
    );
    line.position.z = WALLZ;
    scene.add(line);

    // compile and upload now, so opening the shelf does not stall on its first frame, but in
    // small slices: the shader compile on its own, then a few textures at a time
    // the row's shaders, then (a step of their own, so no frame carries both) the lit ones a lifted book uses
    await run([
      () => r.compile(scene, camera),
      () => {
        const first = list[0];
        first.mesh.material = first.litMats;
        r.compile(scene, camera);
        first.mesh.material = first.mats;
      },
    ]);
    const maps = new Set<THREE.Texture>();
    scene.traverse((o) => {
      if (!(o instanceof T.Mesh)) return;
      const ms = (Array.isArray(o.material) ? o.material : [o.material]) as THREE.Material[];
      for (const m of ms) {
        const map = (m as THREE.MeshBasicMaterial).map;
        if (map) maps.add(map);
      }
    });
    const todo = [...maps];
    const uploadSteps: Array<() => void> = [];
    for (let i = 0; i < todo.length; i += UPLOADS_PER_STEP) {
      uploadSteps.push(() => {
        for (const map of todo.slice(i, i + UPLOADS_PER_STEP)) r.initTexture(map);
      });
    }
    await run(uploadSteps);

    return {
      T,
      renderer: r,
      scene,
      camera,
      books: list,
      line,
      span,
      scale: 1,
      maxX: 0,
      visible: 1,
      ray: new T.Raycaster(),
      ndc: new T.Vector2(-9, -9),
      ndc2: new T.Vector2(),
      tmpV: new T.Vector3(),
      tmpQ: new T.Quaternion(),
      tmpQ2: new T.Quaternion(),
      yAxis,
      qOpen: new T.Quaternion().setFromAxisAngle(yAxis, 0.3),
      lights,
      setLit(b, on) {
        const set = on ? b.litMats : b.mats;
        if (b.mesh.material === set) return;
        for (let k = 0; k < set.length; k++) set[k].opacity = b.mats[k].opacity;
        b.mesh.material = set;
      },
      fitSpines(scale, immediate, done) {
        window.clearTimeout(spineTimer);
        const go = () => {
          if (resizeSpines(list, scale, dpr())) done();
        };
        if (immediate) go();
        else spineTimer = window.setTimeout(go, SPINE_RESIZE_MS);
      },
      dispose,
    };
  } catch (err) {
    dispose();
    throw err;
  }
}
