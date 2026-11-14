import { describe, expect, it } from "vitest";
import {
  BOX_RADIUS,
  CHROME_FROM,
  OPEN_MS,
  REDUCED_FADE_MS,
  SINK,
  chromeAlpha,
  ease,
  linearAt,
  moveAt,
  radiusAt,
  retarget,
  sinkAt,
  turn,
  unsunkRect,
  type Move,
} from "./open-move";

const open: Move = { from: 0, to: 1, startedAt: 1000 };
const close: Move = { from: 1, to: 0, startedAt: 1000 };

describe("constants", () => {
  it("are the spec's", () => {
    expect(OPEN_MS).toBe(1000);
    expect(CHROME_FROM).toBe(0.72);
    expect(SINK).toEqual({ scale: 0.95, dim: 0.45 });
    expect(BOX_RADIUS).toBe(14);
    expect(REDUCED_FADE_MS).toBe(200);
  });
});

describe("ease", () => {
  it("is the site's cubic in and out", () => {
    expect(ease(0)).toBe(0);
    expect(ease(1)).toBe(1);
    expect(ease(0.5)).toBe(0.5);
    expect(ease(0.25)).toBeCloseTo(4 * 0.25 ** 3, 12);
    expect(ease(0.75)).toBeCloseTo(1 - 4 * 0.25 ** 3, 12);
  });
  it("clamps outside 0 to 1", () => {
    expect(ease(-1)).toBe(0);
    expect(ease(2)).toBe(1);
  });
});

describe("moveAt", () => {
  it("opening: 0 at the start, eased in the middle, done at the end", () => {
    expect(moveAt(1000, open)).toEqual({ e: 0, done: false });
    expect(moveAt(1000 + OPEN_MS / 2, open)).toEqual({ e: 0.5, done: false });
    expect(moveAt(1000 + OPEN_MS, open)).toEqual({ e: 1, done: true });
    expect(moveAt(1000 + 5 * OPEN_MS, open)).toEqual({ e: 1, done: true });
  });
  it("closing runs the same way backwards", () => {
    expect(moveAt(1000, close)).toEqual({ e: 1, done: false });
    expect(moveAt(1000 + OPEN_MS / 4, close).e).toBeCloseTo(ease(0.75), 12);
    expect(moveAt(1000 + OPEN_MS, close)).toEqual({ e: 0, done: true });
  });
  it("a clock that is behind the start stays at the start", () => {
    expect(moveAt(900, open).e).toBe(0);
  });
  it("a move that starts part way takes only the distance it has left", () => {
    const m: Move = { from: 0.4, to: 0, startedAt: 0 };
    expect(moveAt(0, m).e).toBeCloseTo(ease(0.4), 12);
    expect(moveAt(0.4 * OPEN_MS, m)).toEqual({ e: 0, done: true });
    expect(moveAt(0.2 * OPEN_MS, m).e).toBeCloseTo(ease(0.2), 12);
  });
  it("a move that is already where it is going is done", () => {
    expect(moveAt(0, { from: 1, to: 1, startedAt: 0 })).toEqual({ e: 1, done: true });
  });
  it("is monotonic over an opening", () => {
    let last = -1;
    for (let ms = 0; ms <= OPEN_MS; ms += 16) {
      const { e } = moveAt(1000 + ms, open);
      expect(e).toBeGreaterThanOrEqual(last);
      last = e;
    }
  });
});

describe("linearAt", () => {
  it("is the position before the ease, 0 to 1", () => {
    expect(linearAt(1000 + 250, open)).toBeCloseTo(0.25, 12);
    expect(linearAt(1000 + 250, close)).toBeCloseTo(0.75, 12);
    expect(linearAt(1000 + 3 * OPEN_MS, open)).toBe(1);
  });
});

describe("turn", () => {
  it("at 0.4 gives a move whose first value equals the value it was turned at", () => {
    const now = 1000 + 0.4 * OPEN_MS;
    const was = moveAt(now, open).e;
    const back = turn(now, open);
    expect(back.to).toBe(0);
    expect(back.from).toBeCloseTo(0.4, 12);
    expect(moveAt(now, back).e).toBeCloseTo(was, 12);
    expect(moveAt(now, back).done).toBe(false);
  });
  it("turning a closing gives an opening from where it is", () => {
    const now = 1000 + 0.3 * OPEN_MS;
    const was = moveAt(now, close).e;
    const again = turn(now, close);
    expect(again.to).toBe(1);
    expect(moveAt(now, again).e).toBeCloseTo(was, 12);
  });
  it("has no jump at any instant of the move, either way round", () => {
    for (const m of [open, close]) {
      for (let ms = 0; ms <= OPEN_MS; ms += 25) {
        const now = 1000 + ms;
        const t = turn(now, m);
        expect(moveAt(now, t).e).toBeCloseTo(moveAt(now, m).e, 9);
      }
    }
  });
  it("turned twice in a row is the same move, from the same place", () => {
    const now = 1000 + 0.6 * OPEN_MS;
    const twice = turn(now, turn(now, open));
    expect(twice.to).toBe(1);
    expect(twice.from).toBeCloseTo(0.6, 12);
    expect(moveAt(now, twice).e).toBeCloseTo(moveAt(now, open).e, 12);
  });
  it("after the end it is a move the other way from the end", () => {
    const back = turn(1000 + 2 * OPEN_MS, open);
    expect(back).toEqual({ from: 1, to: 0, startedAt: 1000 + 2 * OPEN_MS });
  });
  it("the turned move reaches its end after only the way it has gone", () => {
    const now = 1000 + 0.25 * OPEN_MS;
    const back = turn(now, open);
    expect(moveAt(now + 0.25 * OPEN_MS, back)).toEqual({ e: 0, done: true });
  });
});

describe("retarget", () => {
  it("starts a fresh move when none is running", () => {
    expect(retarget(500, null, 1)).toEqual({ from: 0, to: 1, startedAt: 500 });
    expect(retarget(500, null, 0)).toEqual({ from: 1, to: 0, startedAt: 500 });
  });
  it("starts a fresh move from the end when the last one is done", () => {
    expect(retarget(5000, open, 0)).toEqual({ from: 1, to: 0, startedAt: 5000 });
  });
  it("turns a running move that goes the other way", () => {
    const now = 1000 + 0.5 * OPEN_MS;
    expect(retarget(now, open, 0)).toEqual(turn(now, open));
  });
  it("keeps a running move that already goes that way", () => {
    expect(retarget(1200, open, 1)).toBe(open);
  });
});

describe("chromeAlpha", () => {
  it("is 0 until CHROME_FROM and 1 at the end, in a straight line between", () => {
    expect(chromeAlpha(0)).toBe(0);
    expect(chromeAlpha(0.5)).toBe(0);
    expect(chromeAlpha(CHROME_FROM)).toBe(0);
    expect(chromeAlpha(1)).toBe(1);
    expect(chromeAlpha(CHROME_FROM + (1 - CHROME_FROM) / 2)).toBeCloseTo(0.5, 12);
    expect(chromeAlpha(0.86)).toBeCloseTo((0.86 - 0.72) / 0.28, 12);
  });
  it("clamps", () => {
    expect(chromeAlpha(-1)).toBe(0);
    expect(chromeAlpha(3)).toBe(1);
  });
});

describe("radiusAt and sinkAt", () => {
  it("corners go from the box's radius to square", () => {
    expect(radiusAt(0)).toBe(BOX_RADIUS);
    expect(radiusAt(1)).toBe(0);
    expect(radiusAt(0.5)).toBe(BOX_RADIUS / 2);
  });
  it("the home page sinks to the scale and dims to 45%", () => {
    expect(sinkAt(0)).toEqual({ scale: 1, shade: 0 });
    const end = sinkAt(1);
    expect(end.scale).toBeCloseTo(SINK.scale, 12);
    expect(end.shade).toBeCloseTo(1 - SINK.dim, 12);
    const mid = sinkAt(0.5);
    expect(mid.scale).toBeCloseTo(1 - 0.05 * 0.5, 12);
    expect(mid.shade).toBeCloseTo(0.55 * 0.5, 12);
  });
});

describe("unsunkRect", () => {
  it("gives the rect back when the page is not sunk", () => {
    const r = { left: 100, top: 200, width: 300, height: 150 };
    expect(unsunkRect(r, 1, 720, 450)).toEqual(r);
  });
  it("undoes a scale about a point", () => {
    // a box at (100, 200) 300 by 150, seen through a 0.95 scale about (720, 450)
    const s = 0.95;
    const ox = 720;
    const oy = 450;
    const real = { left: 100, top: 200, width: 300, height: 150 };
    const seen = {
      left: ox + (real.left - ox) * s,
      top: oy + (real.top - oy) * s,
      width: real.width * s,
      height: real.height * s,
    };
    const back = unsunkRect(seen, s, ox, oy);
    expect(back.left).toBeCloseTo(real.left, 9);
    expect(back.top).toBeCloseTo(real.top, 9);
    expect(back.width).toBeCloseTo(real.width, 9);
    expect(back.height).toBeCloseTo(real.height, 9);
  });
});
