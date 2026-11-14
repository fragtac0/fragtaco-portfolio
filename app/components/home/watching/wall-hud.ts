import type { SiteVideo } from "~/types";
import type { Tile, WallState } from "./wall-types";
import { edgeWarp } from "./wall-warp";

/**
 * The wall's small DOM outputs: the chip under the focused tile (title, then channel and how many
 * more videos the channel has on the wall) and a few `data-` attributes on the canvas that say what
 * the wall is doing, for tests and for anyone inspecting it (written only when a value changes).
 */

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/** The chip's second line: the channel, and how many other videos from it are on the wall. */
export function chipSub(channel: string, more: number): string {
  return more >= 1 ? `${channel}, ${more} more from this channel` : channel;
}

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
      if (!chip || st.choice || !top || top.key !== st.hoverKey || top.f <= 0.5) {
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
      // title and channel sit right under the video, where the fish-eye shows it
      const below = edgeWarp(top.cx, top.cy + top.h / 2 + 14, st.vw, st.vh);
      const x = clamp(below[0] - w / 2, 12, Math.max(12, st.vw - w - 12));
      let y = below[1];
      if (y + h > st.vh - 12) y = edgeWarp(top.cx, top.cy - top.h / 2 - 14, st.vw, st.vh)[1] - h;
      chip.style.transform = `translate3d(${Math.round(x)}px,${Math.round(y)}px,0)`;
      chip.classList.add("on");
    },
  };
}

/**
 * `data-echo`: how many other videos the focused channel has on the wall. `data-chosen`: the key of
 * the chosen video (empty when none). `data-under`: how many visible tiles stand in the chosen
 * video's text block, and `data-overlaps` how many pairs of visible tiles overlap (both must be 0
 * once the wall is open). `data-block`: the block's grid and size (`10x11:1484x967` at 1440 by 900, set when the screen's size
 * gives it a new shape). `data-view`: the block-space position the screen shows (`x,y`, rounded), written
 * only while `data-watch-view` is set on the canvas (the audit sets it), since it changes every frame.
 * `data-kbd`: the video the keyboard's tile holds (its index in the wall's order; empty when none).
 */
export function createProbe(canvas: HTMLElement) {
  const last: Record<string, string> = {};
  return (name: "echo" | "chosen" | "under" | "overlaps" | "block" | "view" | "kbd", value: string) => {
    if (last[name] === value) return;
    last[name] = value;
    canvas.dataset[name] = value;
  };
}
