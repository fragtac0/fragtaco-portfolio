import { describe, expect, it } from "vitest";
import { BEAD_REACH, DOCK_GAP, DOCK_SPANS, DOCK_SELECTOR, WORDS_SELECTOR, frameFoot, inside, leftOut, overlaps, readKeepOut, reachBox, type Box, type KeepOut, type Reader } from "./keep-out";

const box = (l: number, t: number, r: number, b: number): Box => ({ l, t, r, b });
const NONE: KeepOut = { words: [], dock: null };
const SCREEN = box(0, 0, 400, 800);

describe("overlaps", () => {
  it("is true when two boxes share any area, false when they only touch or are apart", () => {
    expect(overlaps(box(0, 0, 10, 10), box(5, 5, 15, 15))).toBe(true);
    expect(overlaps(box(0, 0, 10, 10), box(10, 0, 20, 10))).toBe(false);
    expect(overlaps(box(0, 0, 10, 10), box(11, 0, 20, 10))).toBe(false);
    expect(overlaps(box(0, 0, 10, 10), box(0, 12, 10, 20))).toBe(false);
  });

  it("counts a gap round the boxes", () => {
    expect(overlaps(box(0, 0, 10, 10), box(14, 0, 24, 10), 6)).toBe(true);
    expect(overlaps(box(0, 0, 10, 10), box(16, 0, 26, 10), 6)).toBe(false);
  });
});

describe("frameFoot", () => {
  const stage = { w: 400, h: 800 };

  it("is the stage's bottom when there is no dock, or it covers a small share of the width (a wide screen)", () => {
    expect(frameFoot(stage, NONE)).toBe(800);
    expect(frameFoot({ w: 1440, h: 900 }, { words: [], dock: box(497, 765, 943, 876) })).toBe(900);
  });

  it("sits just above the dock where the dock spans the stage (a phone, a narrow window)", () => {
    expect(frameFoot(stage, { words: [], dock: box(20, 700, 380, 780) })).toBe(700 - DOCK_GAP);
    expect(frameFoot(stage, { words: [], dock: box(0, 700, DOCK_SPANS * 400, 780) })).toBe(700 - DOCK_GAP);
    expect(frameFoot(stage, { words: [], dock: box(0, 700, DOCK_SPANS * 400 - 1, 780) })).toBe(800);
  });

  it("never goes below the stage", () => {
    expect(frameFoot(stage, { words: [], dock: box(0, 900, 400, 990) })).toBe(800);
  });
});

describe("leftOut", () => {
  const wanted = (id: string, b: Box, always = false) => ({ id, box: b, always });

  it("keeps what is clear of everything", () => {
    expect([...leftOut([wanted("a", box(10, 10, 50, 22))], NONE, SCREEN)]).toEqual([]);
  });

  it("leaves out a box that overlaps the page's words, with a margin round the words", () => {
    const keep: KeepOut = { words: [box(100, 100, 200, 140)], dock: null };

    expect([...leftOut([wanted("on", box(150, 120, 190, 132)), wanted("near", box(204, 100, 240, 112)), wanted("far", box(230, 100, 270, 112))], keep, SCREEN)]).toEqual(["on", "near"]);
  });

  it("leaves out a box that overlaps the dock, and one that is not wholly on the screen", () => {
    const keep: KeepOut = { words: [], dock: box(20, 700, 380, 780) };

    expect([...leftOut([wanted("dock", box(100, 740, 140, 752)), wanted("off", box(380, 100, 420, 112)), wanted("above", box(100, 680, 140, 692))], keep, SCREEN)]).toEqual(["dock", "off"]);
  });

  it("leaves a gap to the dock: a box less than DOCK_GAP above it is left out, one that far is kept", () => {
    const keep: KeepOut = { words: [], dock: box(20, 700, 380, 780) };

    expect([...leftOut([wanted("near", box(100, 683, 140, 695)), wanted("clear", box(100, 680, 140, 700 - DOCK_GAP))], keep, SCREEN)]).toEqual(["near"]);
  });

  it("leaves out a box that overlaps a bead or a point of the trail", () => {
    const avoid = [reachBox(100, 100, BEAD_REACH)];

    expect([...leftOut([wanted("a", box(95, 95, 135, 107)), wanted("b", box(160, 95, 200, 107))], NONE, SCREEN, avoid)]).toEqual(["a"]);
  });

  it("leaves out the later of two that overlap each other, in the order given", () => {
    expect([...leftOut([wanted("first", box(10, 10, 60, 22)), wanted("second", box(40, 14, 90, 26)), wanted("third", box(100, 10, 140, 22))], NONE, SCREEN)]).toEqual(["second"]);
  });

  it("never leaves out one that is always there, but the others keep clear of it", () => {
    const keep: KeepOut = { words: [box(0, 0, 400, 800)], dock: null };

    expect([...leftOut([wanted("readout", box(100, 100, 200, 112), true), wanted("label", box(150, 100, 190, 112))], NONE, SCREEN)]).toEqual(["label"]);
    expect([...leftOut([wanted("readout", box(100, 100, 200, 112), true)], keep, SCREEN)]).toEqual([]);
  });

  it("tells inside from not", () => {
    expect(inside(box(0, 0, 400, 800), SCREEN)).toBe(true);
    expect(inside(box(-1, 0, 400, 800), SCREEN)).toBe(false);
    expect(inside(box(0, 0, 401, 800), SCREEN)).toBe(false);
  });

  it("makes a box of a given reach round a point", () => {
    expect(reachBox(10, 20, 14)).toEqual(box(-4, 6, 24, 34));
  });
});

describe("readKeepOut", () => {
  const rect = (l: number, t: number, r: number, b: number) => ({ left: l, top: t, right: r, bottom: b, width: r - l, height: b - t });
  const reader = (found: Record<string, ReturnType<typeof rect>[]>): Reader => ({
    querySelectorAll: (sel) => (found[sel] ?? []).map((r) => ({ getBoundingClientRect: () => r })),
    querySelector: (sel) => (found[sel]?.[0] ? { getBoundingClientRect: () => found[sel][0] } : null),
  });

  it("gives the words' boxes and the dock's in the stage's pixels", () => {
    const page = reader({ [WORDS_SELECTOR]: [rect(148, 128, 400, 300), rect(148, 700, 500, 760)] });
    const doc = reader({ [DOCK_SELECTOR]: [rect(120, 900, 460, 1000)] });
    const keep = readKeepOut(page, doc, { left: 100, top: 100 });

    expect(keep.words).toEqual([box(48, 28, 300, 200), box(48, 600, 400, 660)]);
    expect(keep.dock).toEqual(box(20, 800, 360, 900));
  });

  it("leaves out an element that has no box (hidden) and gives no dock when there is none", () => {
    const keep = readKeepOut(reader({ [WORDS_SELECTOR]: [rect(0, 0, 0, 0), rect(10, 10, 50, 30)] }), reader({}), { left: 0, top: 0 });

    expect(keep.words).toEqual([box(10, 10, 50, 30)]);
    expect(keep.dock).toBeNull();
  });
});
