import type * as THREE from "three";
import type { SiteBook } from "~/types";
import {
  backCanvas,
  bandCanvas,
  blobCanvas,
  coverCanvas,
  foreCanvas,
  softRectCanvas,
  spineCanvas,
  topCanvas,
  woodCanvas,
} from "./shelf-canvases";
import { FOV_DEG, FRONT, PLANK_H, SHELF_GAP, WALLZ, bookSize } from "./shelf-math";

/**
 * Builds the shelf's three.js scene: renderer, lights, one box per book with its contact and wall
 * shadows, the walnut plank and the band behind the shelf. Nothing here is drawn or animated;
 * the engine owns the frame loop and the state. three.js itself is passed in (the engine loads it
 * with `import("three")`), so this module never imports it as a value.
 */

type Three = typeof THREE;
export type Bag = { hover: number; hoverV: number; open: number; openV: number };
export type FlatMesh = THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;

export type Book = {
  d: SiteBook;
  g: THREE.Group;
  mesh: THREE.Mesh;
  mats: THREE.MeshStandardMaterial[];
  coverTex: THREE.CanvasTexture;
  contact: FlatMesh;
  wallSh: FlatMesh;
  H: number;
  W: number;
  T: number;
  base: THREE.Vector3;
  baseQ: THREE.Quaternion;
  openPos: THREE.Vector3;
  /** The numbers the springs animate, kept apart from the three.js objects. */
  anim: Bag;
  order: number;
};

/** The scene record: everything the engine needs to draw, pick and animate. */
export type ShelfScene = {
  T: Three;
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  books: Book[];
  plank: THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>;
  band: FlatMesh;
  span: number;
  dist: number;
  maxX: number;
  /** The share (0..1) of the shelf's width on screen at once; 1 when it all fits. */
  visible: number;
  ray: THREE.Raycaster;
  ndc: THREE.Vector2;
  ndc2: THREE.Vector2;
  fwd: THREE.Vector3;
  tmpV: THREE.Vector3;
  tmpQ: THREE.Quaternion;
  tmpQ2: THREE.Quaternion;
  yAxis: THREE.Vector3;
  qOpen: THREE.Quaternion;
  /** Frees the geometries, materials, textures and the GL context. */
  dispose(): void;
};

const fract = (v: number) => v - Math.floor(v);
const rnd = (i: number) => fract(Math.sin(i * 127.1 + 3.7) * 43758.5453);

/** Canvas text needs the faces loaded first. A failure only costs the fallback faces. */
export async function loadShelfFonts(): Promise<void> {
  if (!document.fonts) return;
  await Promise.all(
    ['500 40px Lora', '700 40px Tektur', '500 20px "IBM Plex Mono"'].map((f) =>
      document.fonts.load(f),
    ),
  ).catch((err: unknown) => {
    console.warn("The shelf fonts did not load; the fallback faces are used.", err);
  });
}

/** Runs the steps one after another, spread over time (`createSlicer().run`). */
export type RunSteps = (steps: Array<() => void>) => Promise<void>;

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
  const track = <D extends { dispose(): void }>(d: D): D => {
    disposables.push(d);
    return d;
  };

  const r = new T.WebGLRenderer({ canvas, antialias: true, alpha: true });
  const dispose = () => {
    for (const d of disposables) d.dispose();
    disposables.length = 0;
    r.dispose();
    r.forceContextLoss();
  };

  try {
    r.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    r.outputColorSpace = T.SRGBColorSpace;
    r.toneMapping = T.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.12;
    const scene = new T.Scene();
    const camera = new T.PerspectiveCamera(FOV_DEG, 1, 0.1, 80);
    scene.add(new T.HemisphereLight(0xfff2df, 0x121211, 0.75));
    const key = new T.DirectionalLight(0xfff3e4, 2.6);
    key.position.set(-2.4, 4.4, 4.6);
    scene.add(key);
    const fill = new T.DirectionalLight(0xc9d6ff, 0.35);
    fill.position.set(3.4, 1.4, 3);
    scene.add(fill);
    const rim = new T.DirectionalLight(0xfc4c00, 1.7);
    rim.position.set(2.6, 2.6, -3.6);
    scene.add(rim);

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
    const std = (map: THREE.Texture, roughness: number) =>
      track(new T.MeshStandardMaterial({ map, roughness, transparent: true }));

    const blobTex = track(new T.CanvasTexture(blobCanvas()));
    const wallTex = track(new T.CanvasTexture(softRectCanvas()));
    const bandTex = track(new T.CanvasTexture(bandCanvas()));
    const unit = track(new T.PlaneGeometry(1, 1));

    const list: Book[] = [];
    const makeBook = (i: number) => {
      const d = books[i];
      const { H, W, T: thick } = bookSize(d);
      const coverTex = toTex(coverCanvas(d, null));
      const topTex = toTex(topCanvas(d));
      const mats = [
        std(toTex(foreCanvas(d)), 0.92),
        std(toTex(spineCanvas(d, thick, H)), 0.6),
        std(topTex, 0.92),
        std(topTex, 0.92),
        std(coverTex, 0.4),
        std(toTex(backCanvas(d)), 0.55),
      ];
      const mesh = new T.Mesh(track(new T.BoxGeometry(W, H, thick)), mats);
      const g = new T.Group();
      g.add(mesh);
      scene.add(g);
      const contact = new T.Mesh(unit, flat(blobTex, 0));
      contact.rotation.x = -Math.PI / 2;
      scene.add(contact);
      const wallSh = new T.Mesh(unit, flat(wallTex, 0));
      wallSh.renderOrder = -1;
      scene.add(wallSh);
      onCover?.(coverTex, d);
      list.push({
        d,
        g,
        mesh,
        mats,
        coverTex,
        contact,
        wallSh,
        H,
        W,
        T: thick,
        base: new T.Vector3(),
        baseQ: new T.Quaternion(),
        openPos: new T.Vector3(),
        anim: { hover: 0, hoverV: 0, open: 0, openV: 0 },
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
    const qY = (a: number) => new T.Quaternion().setFromAxisAngle(yAxis, a);
    const gap = SHELF_GAP;
    const span = list.reduce((s, b) => s + b.T, 0) + gap * (list.length - 1);
    let x = -span / 2;
    list.forEach((b, i) => {
      b.base.set(x + b.T / 2, b.H / 2, FRONT - b.W / 2 + (rnd(i + 3) - 0.5) * 0.04);
      b.baseQ.copy(qUp).premultiply(qY((rnd(i + 9) - 0.5) * 0.05));
      x += b.T + gap;
    });
    const plank = new T.Mesh(
      track(new T.BoxGeometry(span + 1, PLANK_H, FRONT + 0.1 - WALLZ)),
      std(toTex(woodCanvas()), 0.68),
    );
    plank.position.set(0, -0.045, (FRONT + 0.1 + WALLZ) / 2);
    scene.add(plank);
    const band = new T.Mesh(unit, flat(bandTex, 0.7));
    band.scale.set(span + 2.2, 0.9, 1);
    band.position.set(0.12, -0.5, WALLZ);
    band.renderOrder = -1;
    scene.add(band);

    // compile and upload now, so opening the shelf does not stall on its first frame, but in
    // small slices: the shader compile on its own, then a few textures at a time
    await run([() => r.compile(scene, camera)]);
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
      plank,
      band,
      span,
      dist: 6,
      maxX: 0,
      visible: 1,
      ray: new T.Raycaster(),
      ndc: new T.Vector2(-9, -9),
      ndc2: new T.Vector2(),
      fwd: new T.Vector3(),
      tmpV: new T.Vector3(),
      tmpQ: new T.Quaternion(),
      tmpQ2: new T.Quaternion(),
      yAxis,
      qOpen: new T.Quaternion().setFromAxisAngle(yAxis, 0.3),
      dispose,
    };
  } catch (err) {
    dispose();
    throw err;
  }
}
