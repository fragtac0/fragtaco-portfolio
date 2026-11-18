// The card's order of events (spec 9.5): the old card leaves completely before anything else; only then are the new words
// set, the place chosen and the card shown. So words never change inside a visible card, and the card never jumps while it can
// be seen. While it is shown it follows its milestone's head, and the beads it covers step back. No DOM here: the card's
// element is handed in as a `CardView`, the timers as `CardTimers` (card-controller.test.ts uses stand-ins).
import { coveredIndices, cardRect, pickSlot, type Size, type XY } from "./card-slot";
import type { Stage } from "./view";

/** What the controller asks of the card's element. */
export type CardView = {
  /** Set the words of milestone `index` and give the card's size. */
  setWords(index: number): Size;
  /** The card's size now (the stage changed). */
  size(): Size;
  /** Fade the card in (its words arrive a breath apart) or out. */
  show(on: boolean): void;
  /** Put the card's top left at x, y. */
  place(x: number, y: number): void;
  /** The beads at these indices step back (the others are at full strength). */
  cover(indices: readonly number[]): void;
};

export type CardTimers = { set(fn: () => void, ms: number): number; clear(id: number): void };

/** The old card's fade is 220 ms: no words change before this has passed. */
export const HIDE_MS = 260;

export type CardController = {
  /** Show the card for a milestone after `delay` ms (never less than `HIDE_MS`: the old card leaves first); null only hides it. */
  request(index: number | null, delay: number): void;
  /** The heads moved, or the stage did: the card follows its head and the beads under it step back. */
  update(heads: readonly XY[], stage: Stage): void;
  /** Whether the card is fading in or shown. */
  shown(): boolean;
  destroy(): void;
};

export function createCardController(view: CardView, timers: CardTimers, reduced: () => boolean = () => false): CardController {
  let timer = 0;
  let index: number | null = null;
  let slot = 0;
  let size: Size = { w: 0, h: 0 };
  let shown = false;
  let heads: readonly XY[] = [];
  let stage: Stage = { w: 0, h: 0 };
  let covered: number[] = [];

  const setCover = (next: number[]) => {
    if (next.length === covered.length && next.every((n, i) => n === covered[i])) return;
    covered = next;
    view.cover(next);
  };

  function place() {
    if (index === null || heads[index] === undefined) return;

    const [x, y] = cardRect(slot, heads[index], size, stage);

    view.place(x, y);
    setCover(shown ? coveredIndices(x, y, size, heads, index) : []);
  }

  function reveal(next: number) {
    index = next;
    size = view.setWords(next);
    if (heads[next] !== undefined) slot = pickSlot(heads[next], size, heads, next, stage);
    shown = true;
    place();
    view.show(true);
  }

  return {
    request(next, delay) {
      if (timer) timers.clear(timer);
      timer = 0;
      if (shown) view.show(false);
      shown = false;
      setCover([]);
      index = null;
      if (next === null) return;
      timer = timers.set(() => {
        timer = 0;
        reveal(next);
      }, reduced() ? HIDE_MS : Math.max(delay, HIDE_MS));
    },
    update(nextHeads, nextStage) {
      const resized = nextStage.w !== stage.w || nextStage.h !== stage.h;

      heads = nextHeads;
      stage = nextStage;
      if (resized && index !== null) size = view.size();
      if (shown) place();
    },
    shown: () => shown,
    destroy() {
      if (timer) timers.clear(timer);
      timer = 0;
    },
  };
}
