import { describe, expect, it } from "vitest";
import { MILESTONE_SHARES } from "./trail";
import { ENTRANCE, TRACE_END_MS, aheadShare, beadDelay, entranceEnd, entranceVars, traceShare, wordTimes } from "./entrance";

describe("ENTRANCE", () => {
  it("is the spec's table", () => {
    expect(ENTRANCE).toEqual({
      titleAt: 0.7,
      letterMs: 300,
      titleGapMs: 28,
      labelGapMs: 22,
      descAfterMs: 120,
      labelAfterMs: 240,
      linesAfterMs: 360,
      lineMs: 400,
      lineGapMs: 60,
      traceMs: 2200,
      beadMs: 260,
      aheadAfterMs: 100,
      aheadMs: 600,
      reducedMs: 200,
    });
  });
});

describe("traceShare", () => {
  it("is 0 at 0 and before, and 1 at traceMs and after", () => {
    expect(traceShare(0)).toBe(0);
    expect(traceShare(-500)).toBe(0);
    expect(traceShare(ENTRANCE.traceMs)).toBe(1);
    expect(traceShare(ENTRANCE.traceMs * 3)).toBe(1);
  });

  it("only rises, and is eased in and out (slow at both ends, 0.5 half way)", () => {
    let last = -1;

    for (let ms = 0; ms <= ENTRANCE.traceMs; ms += 20) {
      const s = traceShare(ms);

      expect(s).toBeGreaterThanOrEqual(last);
      last = s;
    }
    expect(traceShare(ENTRANCE.traceMs / 2)).toBeCloseTo(0.5, 10);
    expect(traceShare(110)).toBeLessThan(0.05 * 0.2); // the first 5% of the time draws almost nothing
    expect(1 - traceShare(ENTRANCE.traceMs - 110)).toBeLessThan(0.05 * 0.2);
  });
});

describe("beadDelay", () => {
  it("is the inverse of traceShare within 1 ms from 0 to traceMs in steps of 100", () => {
    for (let ms = 0; ms <= ENTRANCE.traceMs; ms += 100) expect(Math.abs(beadDelay(traceShare(ms)) - ms)).toBeLessThan(1);
    expect(Math.abs(beadDelay(traceShare(ENTRANCE.traceMs)) - ENTRANCE.traceMs)).toBeLessThan(1);
  });

  it("is 0 for the first milestone and traceMs for the last, and only rises with the share", () => {
    const delays = MILESTONE_SHARES.map(beadDelay);

    expect(delays[0]).toBe(0);
    expect(delays[delays.length - 1]).toBeCloseTo(ENTRANCE.traceMs, 8);
    expect(beadDelay(1)).toBe(ENTRANCE.traceMs);
    delays.slice(1).forEach((d, i) => expect(d).toBeGreaterThan(delays[i]));
  });

  it("puts each bead where the tip is when it is there (the tip's share at a bead's delay is the bead's share)", () => {
    for (const u of MILESTONE_SHARES) expect(traceShare(beadDelay(u))).toBeCloseTo(u, 9);
  });

  it("clamps a share outside 0 to 1", () => {
    expect(beadDelay(-1)).toBe(0);
    expect(beadDelay(2)).toBe(ENTRANCE.traceMs);
  });
});

describe("aheadShare", () => {
  it("is 0 until 100 ms after the trail arrives, and 1 600 ms later", () => {
    expect(aheadShare(0)).toBe(0);
    expect(aheadShare(ENTRANCE.traceMs)).toBe(0);
    expect(aheadShare(ENTRANCE.traceMs + 100)).toBe(0);
    expect(aheadShare(ENTRANCE.traceMs + 100 + 300)).toBeCloseTo(0.5, 10);
    expect(aheadShare(ENTRANCE.traceMs + 100 + 600)).toBe(1);
    expect(aheadShare(TRACE_END_MS)).toBe(1);
  });
});

describe("the words' times", () => {
  it("count from the reveal's start: the title at 0.7 T, the description at +120, the label at +240, the lines at +360 and 60 apart", () => {
    const t = wordTimes(2250, 3);

    expect(t.title).toBeCloseTo(1575, 8);
    expect(t.desc).toBeCloseTo(1695, 8);
    expect(t.label).toBeCloseTo(1815, 8);
    expect(t.lines.map((l) => Math.round(l))).toEqual([1935, 1995, 2055]);
  });

  it("follow the reveal's length", () => {
    expect(wordTimes(1000, 0).title).toBe(700);
    expect(wordTimes(0, 0).title).toBe(0);
  });

  it("all finish before the trace is over, at 2.25 s", () => {
    const t = wordTimes(2250, 3);
    const end = t.lines[2] + ENTRANCE.lineMs; // the third line is the last thing to finish

    expect(end).toBeLessThan(entranceEnd(2250));
    expect(end).toBeCloseTo(1575 + 360 + 2 * 60 + 400, 8);
    expect(t.title + 12 * ENTRANCE.titleGapMs + ENTRANCE.letterMs).toBeLessThan(end); // the title's 13 letters
  });

  it("the entrance ends a reveal plus the trace after it began", () => {
    expect(entranceEnd(2250)).toBe(2250 + 2200 + 100 + 600);
  });
});

describe("entranceVars", () => {
  it("writes the spec's table as the CSS variables, for a reveal of 2250 ms", () => {
    const v = entranceVars(2250, 0);

    expect(v).toMatchObject({
      "--ent-T": "2250ms",
      "--ent-lag": "0ms",
      "--ent-title": "1575ms",
      "--ent-desc": "1695ms",
      "--ent-label": "1815ms",
      "--ent-lines": "1935ms",
      "--ent-letter-ms": "300ms",
      "--ent-title-gap": "28ms",
      "--ent-label-gap": "22ms",
      "--ent-line-ms": "400ms",
      "--ent-line-gap": "60ms",
      "--ent-letter-rise": "6px",
      "--ent-line-rise": "8px",
      "--ent-reduced-ms": "200ms",
    });
  });

  it("follows the reveal's length (the 120 ms fade of reduced motion) and the lag", () => {
    expect(entranceVars(120, 14.5)).toMatchObject({ "--ent-T": "120ms", "--ent-lag": "14.5ms", "--ent-title": "84ms" });
    expect(entranceVars(2250, -3)["--ent-lag"]).toBe("0ms");
  });
});
