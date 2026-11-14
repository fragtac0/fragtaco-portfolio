import { countOverlaps, countUnderText } from "./wall-choice";
import type { createProbe } from "./wall-hud";
import type { PoseChoice } from "./wall-pose";
import type { Tile, WallState } from "./wall-types";

/** What the engine writes to the canvas's data attributes after a frame, for the audit scripts (the names are wall-hud.ts's `createProbe`). */
export function reportFrame(
  probe: ReturnType<typeof createProbe>,
  canvas: HTMLElement,
  st: WallState,
  list: readonly Tile[],
  choice: PoseChoice | null,
  echoSize: number,
) {
  probe("echo", String(echoSize));
  probe("chosen", st.choice?.key ?? "");
  probe("kbd", st.kbd ? String(st.kbd.cy * st.plan.cols + st.kbd.cx) : "");
  if (canvas.dataset.watchView) {
    probe("view", `${Math.round(st.view.x)},${Math.round(st.view.y)}`);
    const at = st.choice ? list.find((tl) => tl.key === st.choice?.key) : undefined;
    probe("chosenAt", at ? `${Math.round(at.cx)},${Math.round(at.cy)},${Math.round(at.w)}` : "");
  }
  probe("under", choice ? String(countUnderText(list, choice)) : "0");
  probe("overlaps", choice ? String(countOverlaps(list, choice)) : "0");
}
