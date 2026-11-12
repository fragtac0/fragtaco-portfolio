import type * as THREE from "three";
import type { SiteBook } from "~/types";
import type { ShelfLights } from "./shelf-light";
import type { SpineFace } from "./shelf-spines";

/** The shelf scene's types (built by shelf-scene.ts). */

type Three = typeof THREE;
/**
 * The numbers the springs animate. `open` is the open progress (0..1, steady: shelf-math
 * `stepOpen`); `show` is the opacity a book fades up with when motion is reduced (it restarts at 0
 * whenever `open`'s target changes, `openTo` remembers it).
 */
export type Bag = {
  hover: number;
  hoverV: number;
  open: number;
  show: number;
  showV: number;
  openTo: 0 | 1;
};

/** A book at rest: standing in the row, nothing animating. */
export const newBag = (): Bag => ({ hover: 0, hoverV: 0, open: 0, show: 1, showV: 0, openTo: 0 });
export type FlatMesh = THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;

export type Book = {
  d: SiteBook;
  g: THREE.Group;
  mesh: THREE.Mesh;
  /** The row's materials: unlit, so the colours are true. Their opacity fades the book. */
  mats: THREE.MeshBasicMaterial[];
  /** The same faces, lit softly; a lifted book uses these (`setLit`). */
  litMats: THREE.MeshStandardMaterial[];
  coverTex: THREE.CanvasTexture;
  /** The designed spine: its canvas is the spine's size on screen times the pixel ratio (shelf-spines.ts). */
  spine: SpineFace;
  wallSh: FlatMesh;
  H: number;
  W: number;
  T: number;
  base: THREE.Vector3;
  baseQ: THREE.Quaternion;
  openPos: THREE.Vector3;
  /** How large the open book is drawn against its size in the row (at most 1; less on a screen too small for it). */
  openScale: number;
  /** How far it rises before it turns (world units), and the highest its centre may be while open. */
  lift: number;
  yMax: number;
  /** The numbers the springs animate, kept apart from the three.js objects. */
  anim: Bag;
  order: number;
};

/** The scene record: everything the engine needs to draw, pick and animate. */
export type ShelfScene = {
  T: Three;
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.OrthographicCamera;
  books: Book[];
  /** The hairline the books stand on. */
  line: FlatMesh;
  /** The row's width in world units. */
  span: number;
  /** CSS pixels per world unit (set by the fit). */
  scale: number;
  maxX: number;
  /** The share (0..1) of the shelf's width on screen at once; 1 when it all fits. */
  visible: number;
  ray: THREE.Raycaster;
  ndc: THREE.Vector2;
  ndc2: THREE.Vector2;
  tmpV: THREE.Vector3;
  tmpQ: THREE.Quaternion;
  tmpQ2: THREE.Quaternion;
  yAxis: THREE.Vector3;
  qOpen: THREE.Quaternion;
  /** Swaps a book between its unlit row materials and its lit ones. */
  setLit(b: Book, lit: boolean): void;
  /** The lights that light a lifted book. */
  lights: ShelfLights;
  /**
   * The fit changed: repaints the spines at the new on-screen size (`scale` CSS pixels per world
   * unit, times the pixel ratio). Straight away when `immediate`, otherwise once the size has
   * stopped changing for a moment (a window being dragged); `done` is called when any spine changed.
   */
  fitSpines(scale: number, immediate: boolean, done: () => void): void;
  /** Frees the geometries, materials, textures and the GL context. */
  dispose(): void;
};
