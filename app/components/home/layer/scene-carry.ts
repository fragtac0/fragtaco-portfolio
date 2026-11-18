import { setSceneInBox } from "./box-scene";
import { windowSize, type DockOptions, type FrameOptions } from "./frame-box";
import { gluedScale, type Frame } from "./frame-math";

/** What the move driver needs of a scene engine (both engines have it: `setFrame`, `setDocked`). */
export type FramedEngine = {
  setFrame(frame: Frame | null, opts?: FrameOptions): void;
  setDocked(docked: boolean, opts?: DockOptions): void;
};

/**
 * Where a scene's element stands during a move (the move driver, move-driver.ts): in the box's slot, on the layer's stage as a frame
 * that grows (`move`), or on the stage as the open page (`open`). `data-at` is what the stylesheet reads.
 */
export type At = "box" | "move" | "open";

const GEOMETRY = ["left", "top", "width", "height", "border-radius"] as const;

/** The parts of the driver's parts the carrier needs. */
export type CarryParts = {
  scene: HTMLElement;
  stage: HTMLElement;
  slot: HTMLElement | null;
  /** Whether the scene has an engine to draw it: without one it is the plain grid, which is glued to the frame by the stylesheet. */
  hasEngine: () => boolean;
};

export type Carrier = {
  /** Writes a frame, a radius and (the plain grid) the glue scale onto the scene's element. */
  writeScene(f: Frame, radius: number, plain?: boolean): void;
  /** Puts the scene in its box's slot, or on the stage as a growing frame (`f`, `radius`) or as the open page. */
  carry(to: At, f?: Frame, radius?: number): void;
  /** Takes back what a move wrote on the scene's element: the stylesheet decides again. */
  clearScene(): void;
};

export function createCarrier({ scene, stage, slot, hasEngine }: CarryParts): Carrier {
  function writeScene(f: Frame, radius: number, plain = false) {
    const s = scene.style;
    s.left = `${f.left}px`;
    s.top = `${f.top}px`;
    s.width = `${f.width}px`;
    s.height = `${f.height}px`;
    s.borderRadius = `${radius}px`;
    // the plain grid is laid out for the whole window and glued to the frame like a picture: scaled evenly until it covers it (layer.css)
    if (plain) {
      const [vw, vh] = windowSize();
      s.setProperty("--glue", String(gluedScale(f, vw, vh)));
    }
  }

  function clearScene() {
    for (const p of GEOMETRY) scene.style.removeProperty(p);
    for (const p of ["--vw", "--vh", "--glue", "opacity"]) scene.style.removeProperty(p);
  }

  function carry(to: At, f?: Frame, radius = 0) {
    setSceneInBox(scene, to === "box");
    if (to === "box") {
      scene.removeAttribute("data-at");
      clearScene();
      slot?.appendChild(scene);
      return;
    }
    scene.dataset.at = to;
    if (f) writeScene(f, radius, !hasEngine());
    if (to === "move") {
      // the plain grid is laid out for the whole window while the frame grows round it (layer.css)
      const [vw, vh] = windowSize();
      scene.style.setProperty("--vw", `${vw}px`);
      scene.style.setProperty("--vh", `${vh}px`);
    }
    if (scene.parentElement !== stage) stage.appendChild(scene);
  }

  return { writeScene, carry, clearScene };
}
