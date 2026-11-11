import type { SiteVideo } from "~/types";
import { chipSub } from "./wall-planes";
import type { Tile, WallState } from "./wall-types";

/**
 * The wall's small DOM outputs: the chip under the focused tile (title, then channel and how many
 * more videos the channel has on the wall) and a few `data-` attributes on the canvas that say what
 * the wall is doing, for tests and for anyone inspecting it (written only when a value changes).
 */

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

export type Chip = {
  /** Moves the chip under the focused tile, or hides it. `more` is the focused channel's other videos. */
  place(chip: HTMLElement | undefined, list: Tile[], more: number): void;
  /** Forget what the chip shows (the wall was mounted again). */
  reset(): void;
};

export function createChip(videos: readonly SiteVideo[], st: WallState): Chip {
  let idx = -1;
  let w = 0;
  let h = 0;
  return {
    reset: () => (idx = -1),
    place(chip, list, more) {
      const top = list[list.length - 1];
      if (!chip || st.frozen || !top || top.key !== st.hoverKey || top.f <= 0.5) {
        chip?.classList.remove("on");
        return;
      }
      if (idx !== top.idx) {
        const b = chip.querySelector("b");
        const s = chip.querySelector("span");
        if (b) b.textContent = videos[top.idx].title;
        if (s) s.textContent = chipSub(videos[top.idx].channel, more);
        idx = top.idx;
        w = chip.offsetWidth;
        h = chip.offsetHeight;
      }
      // title and channel sit right under the video
      const x = clamp(top.cx - w / 2, 12, Math.max(12, st.vw - w - 12));
      let y = top.cy + top.h / 2 + 14;
      if (y + h > st.vh - 12) y = top.cy - top.h / 2 - 14 - h;
      chip.style.transform = `translate3d(${Math.round(x)}px,${Math.round(y)}px,0)`;
      chip.classList.add("on");
    },
  };
}

/** `data-lean` ("x,y" in px, the near plane's lean) and `data-echo` (other videos in the focused channel). */
export function createProbe(canvas: HTMLElement) {
  const last: Record<string, string> = {};
  return (name: "lean" | "echo", value: string) => {
    if (last[name] === value) return;
    last[name] = value;
    canvas.dataset[name] = value;
  };
}
