import { clampPan, floatWithin, panRange, restFloat } from "./wall-block";
import { choiceLayout } from "./wall-choice";
import { cameraPan, CLOSE_MS, easeInOut, OPEN_MS, stepToward } from "./wall-spread";
import type { WallState } from "./wall-types";

/**
 * The camera of the wall (spec 8.1, "the click"). While a video is chosen the wall slides, the way a
 * camera would, so that the chosen tile's centre comes to the chosen place (`cameraPan`, which keeps
 * to the block's range); it eases there in the time the wall takes to open (420 ms) and, when the
 * video is closed, back to the pan it had before (320 ms). When the choice moves (the arrow keys) it
 * eases from where it is to the new tile. The rest float, which the view carries at rest, fades out
 * over the opening so the tile lands exactly where the picture and the text are placed, and returns
 * with the close. The pulled pan (`st.pan`) is not touched: it is the pan the wall goes home to.
 *
 * It writes `st.view` while a video is chosen (the wall's motion leaves the view alone then) and does
 * nothing under reduced motion (no travel: the chosen tile fades in over the wall instead).
 */

type Point = { x: number; y: number };

export type Camera = {
  /** Advances the camera by `dt` seconds and sets `st.view`; does nothing with no video chosen. */
  step(dt: number): void;
  /**
   * Writes into `out` how far every tile still has to move on the screen to its resting place, once the
   * camera has arrived at the chosen tile (the view now, less the view then): zero with no camera.
   */
  shiftInto(out: Point): void;
  /** The views the wall will be seen from while the camera works (home and the chosen tile's), so the tiles in both are laid out; empty otherwise. */
  views(): readonly Point[];
  /** True when the camera has nothing left to travel: no video chosen, or the close has brought it home (the wall may let go of the choice without a jump). */
  settled(): boolean;
};

export function createCamera(st: WallState, reduced: boolean): Camera {
  let on = false;
  let key = "";
  let wasLive = true;
  /** The camera's centre now, where it set out from, how far along that leg it is (0 to 1), how far open (0 to 1). */
  const cur: Point = { x: 0, y: 0 };
  const from: Point = { x: 0, y: 0 };
  const end: Point = { x: 0, y: 0 };
  const home: Point = { x: 0, y: 0 };
  let leg = 1;
  let open = 0;
  const list: Point[] = [home, end];

  const off = () => {
    on = false;
    key = "";
    wasLive = true;
    leg = 1;
    open = 0;
  };

  return {
    step(dt) {
      const c = st.choice;
      if (!c || reduced) {
        off();
        return;
      }
      const { vw, vh, plan } = st;
      const place = choiceLayout(vw, vh).rect;
      const to = cameraPan({
        idx: c.idx,
        plan,
        place: { x: place.x + place.w / 2, y: place.y + place.h / 2 },
        vw,
        vh,
      });
      end.x = to.x;
      end.y = to.y;
      [home.x, home.y] = clampPan(st.pan.x, st.pan.y, plan, vw, vh);
      if (!on) {
        on = true;
        key = c.key;
        wasLive = true;
        cur.x = from.x = home.x;
        cur.y = from.y = home.y;
        leg = 0;
        open = 0;
      } else if (key !== c.key || wasLive !== c.live) {
        // the choice moved, or the close began: a new leg from where the camera is
        key = c.key;
        wasLive = c.live;
        from.x = cur.x;
        from.y = cur.y;
        leg = 0;
      }
      const secs = (c.live ? OPEN_MS : CLOSE_MS) / 1000;
      leg = stepToward(leg, 1, dt, secs);
      open = stepToward(open, c.live ? 1 : 0, dt, secs);
      const target = c.live ? end : home;
      const e = easeInOut(leg);
      cur.x = from.x + (target.x - from.x) * e;
      cur.y = from.y + (target.y - from.y) * e;
      // the float's last offset (the clock stands still while a video is chosen) fades out as the wall opens
      const [fx, fy] = restFloat(st.t);
      const f = 1 - easeInOut(open);
      const [x0, x1] = panRange(plan.width, vw);
      const [y0, y1] = panRange(plan.height, vh);
      st.view.x = floatWithin(cur.x, fx * f, x0, x1);
      st.view.y = floatWithin(cur.y, fy * f, y0, y1);
    },

    shiftInto(out) {
      if (!on) {
        out.x = out.y = 0;
        return;
      }
      out.x = st.view.x - end.x;
      out.y = st.view.y - end.y;
    },

    views: () => (on ? list : []),

    settled: () => !on || (leg >= 1 && open <= 0),
  };
}
