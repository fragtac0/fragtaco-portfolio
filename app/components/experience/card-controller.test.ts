import { describe, expect, it } from "vitest";
import { HIDE_MS, createCardController, type CardView } from "./card-controller";
import type { XY } from "./card-slot";

/** A card element and a clock the test turns by hand: every call is logged with the time, and the card's own opacity is followed. */
function setup(reduced = false) {
  let now = 0;
  let nextId = 0;
  const timers = new Map<number, { at: number; fn: () => void }>();
  const log: string[] = [];
  const shown: boolean[] = [];
  const words: number[] = [];
  const covers: number[][] = [];
  const places: XY[] = [];
  /** The card's strength: 1 while shown, falling to 0 over 220 ms after it is hidden. */
  let hiddenAt: number | null = null;
  let visible = false;
  let sizeCalls = 0;
  const view: CardView = {
    setWords(i) {
      // the audit's rule: no words change while any of the card can be seen
      const seen = visible || (hiddenAt !== null && now - hiddenAt < 220);

      log.push(`words ${i} (card ${seen ? "VISIBLE" : "gone"})`);
      words.push(i);

      return { w: 252, h: 150 };
    },
    size() {
      sizeCalls++;

      return { w: 252, h: 150 };
    },
    show(on) {
      log.push(on ? "show" : "hide");
      shown.push(on);
      visible = on;
      hiddenAt = on ? null : now;
    },
    place: (x, y) => void places.push([x, y]),
    cover: (ix) => void covers.push([...ix]),
  };
  const controller = createCardController(
    view,
    {
      set(fn, ms) {
        timers.set(++nextId, { at: now + ms, fn });

        return nextId;
      },
      clear: (id) => void timers.delete(id),
    },
    () => reduced,
  );
  const advance = (ms: number) => {
    const end = now + ms;

    for (;;) {
      const due = [...timers.entries()].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0];

      if (!due) break;
      now = due[1].at;
      timers.delete(due[0]);
      due[1].fn();
    }
    now = end;
  };

  return { controller, advance, log, shown, words, covers, places, pending: () => timers.size, sizeCalls: () => sizeCalls };
}

/** Nine heads along a line, 120 px apart. */
const HEADS: XY[] = Array.from({ length: 9 }, (_, i) => [200 + i * 120, 400]);
const STAGE = { w: 1440, h: 800 };

describe("the card's order of events", () => {
  it("shows the words after the delay, never before the old card has left", () => {
    const { controller, advance, log } = setup();

    controller.update(HEADS, STAGE);
    controller.request(2, 3150);
    advance(3000);
    expect(log).toEqual([]);
    advance(200);
    expect(log).toEqual(["words 2 (card gone)", "show"]);
  });

  it("hides the old card at once and sets the new words only after HIDE_MS, even for a short delay", () => {
    const { controller, advance, log } = setup();

    controller.update(HEADS, STAGE);
    controller.request(2, 250);
    advance(1000);
    log.length = 0;
    controller.request(5, 250); // asked for 250 ms: HIDE_MS (260) is the least
    expect(log).toEqual(["hide"]);
    advance(HIDE_MS - 1);
    expect(log).toEqual(["hide"]);
    advance(2);
    expect(log).toEqual(["hide", "words 5 (card gone)", "show"]);
  });

  it("never changes the words while any of the card is visible, across many quick presses", () => {
    const { controller, advance, log } = setup();

    controller.update(HEADS, STAGE);
    controller.request(0, 250);
    advance(400);
    for (const i of [1, 2, 3, 4, 5, 6, 7, 8, 0, 4]) {
      controller.request(i, 250);
      advance(100 + (i % 3) * 120);
    }
    advance(3000);
    expect(log.filter((l) => l.startsWith("words"))).not.toHaveLength(0);
    expect(log.filter((l) => l.includes("VISIBLE"))).toEqual([]);
  });

  it("a press while a request waits replaces it (the first one's words never appear)", () => {
    const { controller, advance, words } = setup();

    controller.update(HEADS, STAGE);
    controller.request(3, 3150);
    advance(1000);
    controller.request(6, 250);
    advance(5000);
    expect(words).toEqual([6]);
  });

  it("null only hides the card", () => {
    const { controller, advance, log, pending } = setup();

    controller.update(HEADS, STAGE);
    controller.request(1, 250);
    advance(500);
    controller.request(null, 0);
    expect(log[log.length - 1]).toBe("hide");
    expect(pending()).toBe(0);
    expect(controller.shown()).toBe(false);
  });

  it("under reduced motion waits only for the old card to leave", () => {
    const { controller, advance, words } = setup(true);

    controller.update(HEADS, STAGE);
    controller.request(1, 3150);
    advance(HIDE_MS - 1);
    expect(words).toEqual([]);
    advance(2);
    expect(words).toEqual([1]);
  });
});

describe("while it is shown", () => {
  it("follows its head and puts the beads under it a step back", () => {
    const { controller, advance, places } = setup();

    controller.update(HEADS, STAGE);
    controller.request(4, 250);
    advance(400);
    expect(controller.shown()).toBe(true);

    const before = places.length;

    controller.update(HEADS.map(([x, y]) => [x + 40, y] as XY), STAGE);
    expect(places.length).toBe(before + 1);
    expect(places[places.length - 1][0]).toBeGreaterThan(places[before - 1][0]);
  });

  it("covers the beads under the card, never its own", () => {
    const { controller, advance, covers } = setup();
    const packed: XY[] = Array.from({ length: 9 }, (_, i) => [700 + (i % 3) * 30, 420 + Math.floor(i / 3) * 20]);

    controller.update(packed, STAGE);
    controller.request(4, 250);
    advance(400);
    // every slot covers the others: whichever is chosen, the card never hides its own bead and covers the rest
    const last = covers[covers.length - 1] ?? [];

    expect(last).not.toContain(4);
  });

  it("clears the covered beads when the card leaves", () => {
    const { controller, advance, covers } = setup();
    const packed: XY[] = Array.from({ length: 9 }, (_, i) => [700 + (i % 3) * 30, 420 + Math.floor(i / 3) * 20]);

    controller.update(packed, STAGE);
    controller.request(4, 250);
    advance(400);
    expect(covers.some((c) => c.length > 0)).toBe(true);
    controller.request(null, 0);
    expect(covers[covers.length - 1]).toEqual([]);
  });

  it("measures the card again when the stage changes size", () => {
    const { controller, advance, sizeCalls } = setup();

    controller.update(HEADS, STAGE);
    controller.request(1, 250);
    advance(400);
    controller.update(HEADS, STAGE);
    expect(sizeCalls()).toBe(0);
    controller.update(HEADS, { w: 900, h: 700 });
    expect(sizeCalls()).toBe(1);
  });
});
