import { windowSize } from "./frame-box";
import type { Frame } from "./frame-math";
import type { Carrier, FramedEngine } from "./scene-carry";

/** What the reduced-motion dip needs of the move driver. */
export type DipParts = {
  scene: HTMLElement;
  shade: HTMLElement;
  head: HTMLElement | null;
  carrier: Carrier;
  /** The scene's engine as it is now (null: the plain grid). */
  engine: () => FramedEngine | null;
  /** The box's place now. */
  measure: () => Frame;
  /** Records the box's place the closing will end in. */
  setBox: (f: Frame) => void;
};

/** Whether the scene is in the layer (the open page's place) rather than in its box; shared with the driver, which reads it at the ends of a move. */
export type DipState = { carried: boolean };

/**
 * Reduced motion, a dip through dark at `t` (the move's position, 0 the box, 1 the open page): over the first half the black rises
 * over the home page while the scene stays in its box (it never shows an empty box beside a lit page); at the half the scene is
 * carried to the layer, under the black, and the open page fades in over the second half. Closing is the same backwards.
 */
export function createDip({ scene, shade, head, carrier, engine, measure, setBox }: DipParts, state: DipState) {
  return function dip(t: number) {
    shade.style.opacity = String(Math.min(1, 2 * t));
    const inner = Math.max(0, 2 * t - 1);
    const want = t >= 0.5;
    if (want !== state.carried) {
      state.carried = want;
      const eng = engine();
      const [vw, vh] = windowSize();
      if (want) {
        const there = () => carrier.carry("open");
        if (eng) eng.setFrame({ left: 0, top: 0, width: vw, height: vh }, { place: false, onApplied: there });
        else there();
      } else {
        const box = measure();
        setBox(box);
        const here = () => carrier.carry("box");
        if (eng) eng.setFrame({ left: 0, top: 0, width: box.width, height: box.height }, { place: false, onApplied: here });
        else here();
      }
    }
    if (state.carried) scene.style.opacity = inner >= 1 ? "" : String(inner);
    if (head) {
      head.style.opacity = String(inner);
      head.style.visibility = inner > 0 ? "visible" : "hidden";
    }
  };
}
