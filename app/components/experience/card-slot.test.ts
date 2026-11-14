import { describe, expect, it } from "vitest";
import { EDGE, FOOT, SLOTS, TOP, cardRect, coveredIndices, covered, pickSlot, type XY } from "./card-slot";

const STAGE = { w: 1440, h: 900 };
const CARD = { w: 252, h: 150 };

describe("SLOTS", () => {
  it("are five places: above right, above left, above, below right, below left", () => {
    expect(SLOTS).toHaveLength(5);
    expect(SLOTS.map((s) => s(252, 150))).toEqual([[26, -162], [-278, -162], [-126, -190], [30, 22], [-282, 22]]);
  });
});

describe("cardRect", () => {
  it("is the anchor plus the slot's offset when there is room", () => {
    expect(cardRect(0, [700, 450], CARD, STAGE)).toEqual([726, 288]);
    expect(cardRect(3, [700, 450], CARD, STAGE)).toEqual([730, 472]);
  });

  it("keeps the card inside the stage: 16 from the sides, 72 from the top, 24 from the foot", () => {
    expect(cardRect(1, [30, 100], CARD, STAGE)).toEqual([EDGE, TOP]);
    expect(cardRect(3, [1430, 880], CARD, STAGE)).toEqual([STAGE.w - CARD.w - EDGE, STAGE.h - CARD.h - FOOT]);
  });
});

describe("covered", () => {
  it("is true for a head inside the card or within 22 px of it", () => {
    expect(covered(100, 100, 252, 150, [200, 200])).toBe(true);
    expect(covered(100, 100, 252, 150, [80, 100])).toBe(true);
    expect(covered(100, 100, 252, 150, [77, 100])).toBe(false);
    expect(covered(100, 100, 252, 150, [200, 273])).toBe(false);
  });
});

describe("pickSlot", () => {
  const anchor: XY = [700, 450];

  it("takes the first place when nothing is under it", () => {
    expect(pickSlot(anchor, CARD, [anchor, [100, 100], [1300, 800]], 0, STAGE)).toBe(0);
  });

  it("avoids a place with another milestone's head under it", () => {
    const under: XY = [800, 350]; // inside slot 0's card (726, 288 to 978, 438)

    expect(covered(726, 288, 252, 150, under)).toBe(true);

    const slot = pickSlot(anchor, CARD, [anchor, under], 0, STAGE);
    const [x, y] = cardRect(slot, anchor, CARD, STAGE);

    expect(slot).not.toBe(0);
    expect(covered(x, y, CARD.w, CARD.h, under)).toBe(false);
  });

  it("takes the place with the fewest heads under it when every place has some", () => {
    const heads: XY[] = [
      anchor,
      [800, 350], // under slot 0 and slot 2
      [600, 350], // under slot 1 and slot 2
      [800, 520], // under slot 3
      [600, 520], // under slot 4
      [800, 535], // under slot 3 again
    ];
    const slot = pickSlot(anchor, CARD, heads, 0, STAGE);
    const counts = [0, 1, 2, 3, 4].map((k) => {
      const [x, y] = cardRect(k, anchor, CARD, STAGE);

      return heads.slice(1).filter((h) => covered(x, y, CARD.w, CARD.h, h)).length;
    });

    expect(counts[slot]).toBe(Math.min(...counts));
  });

  it("weighs the chosen milestone's own head four times: a card never sits on its own bead if another place is clear", () => {
    // Near the right edge, slot 0 is pushed left until it covers the anchor itself.
    const edge: XY = [1400, 450];
    const [x, y] = cardRect(0, edge, CARD, STAGE);

    expect(covered(x, y, CARD.w, CARD.h, edge)).toBe(true);

    const slot = pickSlot(edge, CARD, [edge], 0, STAGE);
    const [sx, sy] = cardRect(slot, edge, CARD, STAGE);

    expect(slot).not.toBe(0);
    expect(covered(sx, sy, CARD.w, CARD.h, edge)).toBe(false);
  });

  it("prefers the earlier place when two are as good", () => {
    // A head under slot 1 only: slots 0, 2, 3, 4 are clear and score 0, 0.2, 0.3, 0.4 plus nothing.
    expect(pickSlot(anchor, CARD, [anchor, [500, 330]], 0, STAGE)).toBe(0);
    // A head under slot 0 only: slot 1 is the next clear place.
    expect(pickSlot(anchor, CARD, [anchor, [830, 300]], 0, STAGE)).toBe(1);
  });

  it("tells the chosen milestone apart by its index, not its place", () => {
    const heads: XY[] = [[100, 100], anchor];
    const [x, y] = cardRect(0, anchor, CARD, STAGE);

    expect(covered(x, y, CARD.w, CARD.h, anchor)).toBe(false);
    expect(pickSlot(anchor, CARD, heads, 1, STAGE)).toBe(0);
  });
});

describe("coveredIndices", () => {
  it("lists the other milestones the card still covers, with 14 px to spare all round", () => {
    const heads: XY[] = [[500, 300], [520, 320], [900, 800], [420, 300]];

    expect(coveredIndices(450, 280, { w: 252, h: 150 }, heads, 0)).toEqual([1, 3]);
    expect(coveredIndices(450, 280, { w: 252, h: 150 }, heads, 1)).toEqual([0, 3]);
  });
});
