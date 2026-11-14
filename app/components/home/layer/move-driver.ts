import { setSceneInBox } from "./box-scene";
import { windowSize, type DockOptions, type FrameOptions } from "./frame-box";
import { frameAt, type Frame } from "./frame-math";
import {
  BOX_RADIUS,
  OPEN_MS,
  REDUCED_FADE_MS,
  chromeAlpha,
  linearAt,
  moveAt,
  radiusAt,
  retarget,
  sinkAt,
  unsunkRect,
  type Move,
} from "./open-move";

/**
 * The opening and closing of a home box, as one move (spec 6.2 and 6.3; the maths is open-move.ts). The scene's own element
 * (the persistent `scene`: its canvas, its heading-free picture) is the frame: it is carried from the box to the layer when a
 * move starts, grows from the box's place now to the whole window with its corners going square, and is carried back into the box
 * when a closing ends. The engine draws its picture for the frame's size, glued to it (frame-math.ts `gluedScale`), and the
 * element's own place and size are written from inside the engine's frame (`onApplied`) so the two never differ by a frame. The
 * home page behind sinks and dims, the layer's chrome shows from `CHROME_FROM`. One driver serves one open layer: it is made
 * when the layer opens and goes with it when the closing ends.
 */

/** What the driver needs of a scene engine (both engines have it: `setFrame`, `setDocked`). */
export type FramedEngine = {
  setFrame(frame: Frame | null, opts?: FrameOptions): void;
  setDocked(docked: boolean, opts?: DockOptions): void;
};

export type DriverParts = {
  /** The scene's persistent element (box-scene.ts): in the box's slot while the layer is closed. */
  scene: HTMLElement;
  /** Where the scene stands while the layer shows it. */
  stage: HTMLElement;
  /** The box whose place the move starts from and ends in. */
  box: HTMLElement | null;
  /** The scene's home in the box. */
  slot: HTMLElement | null;
  /** The layer, the black laid over the home page, the layer's chrome, and the home page that sinks. */
  root: HTMLElement;
  shade: HTMLElement;
  head: HTMLElement | null;
  sink: HTMLElement | null;
  /** Null when the scene has no engine to draw (the plain grid). */
  engine: FramedEngine | null;
  /** Reduced motion: no growing frame; the open page fades in and out over `REDUCED_FADE_MS`. */
  reduced: boolean;
  /** An open video is put away as a closing begins. */
  closeDetail: () => void;
  /** A move has reached its end: `1` the layer is open, `0` the scene is back in its box. */
  done: (to: 0 | 1) => void;
};

export type MoveDriver = {
  /** Goes to the window (1) or back to the box (0): a fresh move, or the running one turned round from where it is. `instant`: no move. */
  go(to: 0 | 1, instant?: boolean): void;
  /** The window changed size: the box's place is read again. */
  resized(): void;
  /** Stops the animation loop (the layer goes away). */
  dispose(): void;
};

type At = "box" | "move" | "open";

const GEOMETRY = ["left", "top", "width", "height", "border-radius"] as const;

export function createMoveDriver(parts: DriverParts): MoveDriver {
  const { scene, stage, sink, shade, root, head, engine, reduced } = parts;
  const ms = reduced ? REDUCED_FADE_MS : OPEN_MS;
  let at: At = "box";
  let move: Move | null = null;
  let raf = 0;
  /** The box's place in the window with the home page at rest. */
  let box: Frame = guessBox();
  /** The scale the home page is sunk to now (it stays sunk while the layer is open), and where the document's top is. */
  let sunk = 1;
  let docTop = 0;

  function guessBox(): Frame {
    const [vw, vh] = windowSize();
    return { left: vw / 2 - 160, top: vh / 2 - 100, width: 320, height: 200 };
  }

  /** The box's place now, whatever the home page is doing (it may be sunk behind the layer). */
  function measure(): Frame {
    const el = parts.box;
    if (!el) return guessBox();
    const [vw, vh] = windowSize();
    const r = el.getBoundingClientRect();
    return unsunkRect(
      { left: r.left, top: r.top, width: r.width, height: r.height },
      sunk,
      vw / 2,
      vh / 2,
    );
  }

  /** The sink's origin is the middle of the window, in the sink's own space. */
  function setOrigin() {
    if (!sink) return;
    const [, vh] = windowSize();
    sink.style.transformOrigin = `50% ${window.scrollY + vh / 2 - docTop}px`;
  }

  function writeScene(f: Frame, radius: number) {
    const s = scene.style;
    s.left = `${f.left}px`;
    s.top = `${f.top}px`;
    s.width = `${f.width}px`;
    s.height = `${f.height}px`;
    s.borderRadius = `${radius}px`;
  }
  function clearScene() {
    for (const p of GEOMETRY) scene.style.removeProperty(p);
    scene.style.removeProperty("--vw");
    scene.style.removeProperty("--vh");
    scene.style.removeProperty("--inner-alpha");
  }

  /** Puts the scene on the stage as a growing frame (`at` is the data the stylesheet reads: the box, a move, the open page). */
  function carry(to: At, f?: Frame, radius = 0) {
    setSceneInBox(scene, to === "box");
    if (to === "box") {
      scene.removeAttribute("data-at");
      clearScene();
      parts.slot?.appendChild(scene);
      return;
    }
    const [vw, vh] = windowSize();
    scene.dataset.at = to;
    if (f) writeScene(f, radius);
    scene.style.setProperty("--vw", `${vw}px`);
    scene.style.setProperty("--vh", `${vh}px`);
    if (scene.parentElement !== stage) stage.appendChild(scene);
  }

  /** What shows at `e` (0 the box, 1 the window) besides the frame itself. `t` is the move's position before the ease. */
  function showAt(e: number, t: number) {
    if (reduced) {
      root.style.opacity = String(t);
      if (head) {
        head.style.opacity = String(t);
        head.style.visibility = t > 0 ? "" : "hidden";
      }
      return;
    }
    const { scale, shade: dim } = sinkAt(e);
    sunk = scale;
    if (sink) sink.style.transform = scale === 1 ? "" : `scale(${scale})`;
    shade.style.opacity = String(dim);
    const a = chromeAlpha(e);
    if (head) {
      head.style.opacity = String(a);
      head.style.visibility = a > 0 ? "" : "hidden";
    }
    scene.style.setProperty("--inner-alpha", String(a));
  }

  /** Draws the frame at `e`: the engine is asked for its size, and the scene's element follows in the frame the engine draws. */
  function frame(e: number, t: number) {
    showAt(e, t);
    if (reduced) return;
    const [vw, vh] = windowSize();
    const f = frameAt(box, vw, vh, e);
    const r = radiusAt(e);
    if (engine) {
      engine.setFrame(
        { left: 0, top: 0, width: f.width, height: f.height },
        { place: false, onApplied: () => writeScene(f, r) },
      );
    } else {
      writeScene(f, r);
    }
  }

  /** The scene is in its box, still: a move can start. */
  function begin() {
    at = "move";
    sunk = 1;
    if (sink) {
      docTop = sink.getBoundingClientRect().top + window.scrollY;
      setOrigin();
      sink.style.willChange = "transform";
    }
    shade.style.opacity = "0";
    if (reduced) {
      // no growing frame: the open page is where it will stay, and the layer fades in over the home page
      root.style.opacity = "0";
      carry("open");
      engine?.setFrame(null);
      engine?.setDocked(false);
      return;
    }
    box = measure();
    if (head) head.style.visibility = "hidden";
    carry("move", box, BOX_RADIUS);
  }

  /** The layer is open and still: a closing can start. */
  function beginClose() {
    const [vw, vh] = windowSize();
    at = "move";
    engine?.setDocked(true); // no input; an open book is put away
    parts.closeDetail();
    if (reduced) return;
    setOrigin();
    box = measure();
    const whole: Frame = { left: 0, top: 0, width: vw, height: vh };
    carry("move", whole, 0);
    engine?.setFrame({ left: 0, top: 0, width: vw, height: vh }, { place: false });
  }

  function finishOpen() {
    at = "open";
    move = null;
    const settle = () => {
      scene.dataset.at = "open";
      clearScene();
    };
    if (engine) engine.setFrame(null, { onApplied: settle });
    else settle();
    engine?.setDocked(false);
    if (sink) sink.style.willChange = "";
    // the chrome and the layer are whole: their own styles (a hidden header while a video is open) take over again
    head?.style.removeProperty("opacity");
    head?.style.removeProperty("visibility");
    root.style.removeProperty("opacity");
    root.classList.add("ready");
    parts.done(1);
  }

  function finishClose() {
    at = "box";
    move = null;
    root.classList.remove("ready");
    if (sink) {
      sink.style.transform = "";
      sink.style.transformOrigin = "";
      sink.style.willChange = "";
    }
    sunk = 1;
    shade.style.opacity = "0";
    root.style.opacity = "";
    if (head) {
      head.style.opacity = "0";
      head.style.visibility = "hidden";
    }
    const back = reduced ? measure() : box;
    carry("box");
    engine?.setFrame({ left: 0, top: 0, width: back.width, height: back.height }, { place: false });
    engine?.setDocked(true);
    parts.done(0);
  }

  function tick(now: number) {
    raf = 0;
    const m = move;
    if (!m) return;
    const { e, done } = moveAt(now, m, ms);
    frame(e, linearAt(now, m, ms));
    if (done) {
      if (m.to === 1) finishOpen();
      else finishClose();
      return;
    }
    raf = requestAnimationFrame(tick);
  }

  return {
    go(to, instant = false) {
      if (to === 1) {
        if (at === "open") return;
        if (at === "box") {
          if (instant) {
            at = "open";
            if (sink) {
              docTop = sink.getBoundingClientRect().top + window.scrollY;
              setOrigin();
            }
            carry("open");
            showAt(1, 1);
            engine?.setFrame(null);
            engine?.setDocked(false);
            head?.style.removeProperty("opacity");
            head?.style.removeProperty("visibility");
            root.style.removeProperty("opacity");
            root.classList.add("ready");
            parts.done(1);
            return;
          }
          begin();
        }
      } else {
        if (at === "box") return;
        if (at === "open") beginClose();
      }
      move = retarget(performance.now(), move, to, ms);
      if (!raf) raf = requestAnimationFrame(tick);
    },
    resized() {
      if (at !== "move" || reduced) return;
      setOrigin();
      box = measure();
    },
    dispose() {
      cancelAnimationFrame(raf);
      raf = 0;
    },
  };
}
