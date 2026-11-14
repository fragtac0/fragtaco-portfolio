import { describe, expect, it } from "vitest";
import { latitudeLabels, longitudeLabels, readout, scaleBar } from "./chart";
import { FRAME_FONT, GLYPH, INKS, MARK, READOUT, drawFrame, frameItems, itemsLeftOut, textBox, type Item } from "./frame-layer";
import { overlaps, reachBox, type KeepOut } from "./keep-out";
import { alphaOf, testCanvas } from "./test-canvas";
import { lowerTrail, sampleTrail, type Point } from "./trail";
import { OVERVIEW, viewOf, type Stage } from "./view";

const ROUTE: Point[] = [[639.5, 329.6], [619.2, 329.0], [604.8, 330.2], [589.7, 332.4], [579.2, 349.4], [565.5, 377.2], [542.1, 400.1], [511.4, 402.0], [487.3, 393.1], [468.9, 380.4], [458.1, 366.2]];
const trail = sampleTrail(lowerTrail(ROUTE, [500, 325]), 200);
const cam = { ...OVERVIEW, trail };
const SUMMIT: [number, number] = [500, 325];
const desk: Stage = { w: 1440, h: 900 };
const phone: Stage = { w: 390, h: 844 };
const view = (stage: Stage) => viewOf(cam, 0, 1, stage);
const ids = (items: Item[]) => items.map((i) => i.id);

describe("textBox", () => {
  it("is 6 px a character wide and 12 px tall, round the line's middle", () => {
    expect(GLYPH).toBe(6);
    expect(textBox("150 km", 100, 50, "left")).toEqual({ l: 100, t: 44, r: 136, b: 56 });
    expect(textBox("150 km", 100, 50, "right")).toEqual({ l: 64, t: 44, r: 100, b: 56 });
    expect(textBox("150 km", 100, 50, "center")).toEqual({ l: 82, t: 44, r: 118, b: 56 });
  });
});

describe("frameItems", () => {
  const items = frameItems(view(desk), desk, desk.h, SUMMIT, SUMMIT);

  it("lists everything that can be left out in order of importance: the readout, the scale bar, north, the ring labels, the latitude and the longitude labels", () => {
    const order = ids(items);

    expect(order.slice(0, 5)).toEqual(["readout", "scale", "north", "ring-150", "ring-300"]);
    expect(order.slice(5).every((id) => id.startsWith("lat-") || id.startsWith("lon-"))).toBe(true);
    expect(order.findIndex((id) => id.startsWith("lon-"))).toBeGreaterThan(order.findIndex((id) => id.startsWith("lat-")));
  });

  it("tells the summit in the readout, 24 px in from the right and 22 px above the foot, and that one is never left out", () => {
    const r = items[0];

    expect(r).toMatchObject({ type: "text", text: "18.37° N   226.79° E", x: 1416, y: 878, align: "right", overview: false, always: true });
    expect(READOUT).toEqual({ right: 24, above: 22 });
    expect(frameItems(view(desk), desk, 700, SUMMIT, [10, 10])[0]).toMatchObject({ text: readout(10, 10), y: 678 });
  });

  it("puts the scale bar and the degree labels where chart.ts puts them, for the frame's foot", () => {
    const eff = { w: 1440, h: 700 };
    const lifted = frameItems(view(desk), desk, 700, SUMMIT, SUMMIT);
    const bar = lifted.find((i) => i.id === "scale");

    expect(bar).toMatchObject({ bar: scaleBar(view(desk).S, eff) });
    expect(lifted.filter((i) => i.id.startsWith("lat-")).map((i) => (i as { text: string }).text)).toEqual(latitudeLabels(view(desk), eff).map((l) => l.text));
    expect(lifted.filter((i) => i.id.startsWith("lon-")).map((i) => (i as { y: number }).y)).toEqual(longitudeLabels(view(desk), eff).map((l) => l.y));
  });

  it("is overview only for everything but the readout", () => {
    expect(items.filter((i) => !i.overview).map((i) => i.id)).toEqual(["readout"]);
  });

  it("puts the ring labels up and right of the summit's rings, 6 px right and 4 px above the ring", () => {
    const [a, b] = [items.find((i) => i.id === "ring-150"), items.find((i) => i.id === "ring-300")];

    expect(a).toMatchObject({ type: "text", text: "150 km", align: "left" });
    expect(b).toMatchObject({ type: "text", text: "300 km", align: "left" });
    expect((b as { x: number }).x).toBeGreaterThan((a as { x: number }).x);
    expect((b as { y: number }).y).toBeLessThan((a as { y: number }).y);
  });
});

describe("itemsLeftOut", () => {
  it("leaves nothing out on a wide screen with the words in their corners", () => {
    const keep: KeepOut = { words: [{ l: 48, t: 28, r: 440, b: 230 }, { l: 48, t: 660, r: 470, b: 760 }, { l: 1190, t: 28, r: 1392, b: 70 }], dock: { l: 497, t: 765, r: 943, b: 876 } };
    const items = frameItems(view(desk), desk, desk.h, SUMMIT, SUMMIT);

    expect([...itemsLeftOut(items, keep, desk, [])]).toEqual([]);
  });

  it("thins the labels out on a phone: what is left clashes with nothing (the words, the dock, a bead, another label) and sits on the screen", () => {
    const keep: KeepOut = { words: [{ l: 16, t: 22, r: 290, b: 56 }, { l: 16, t: 64, r: 200, b: 104 }, { l: 16, t: 112, r: 340, b: 160 }, { l: 16, t: 560, r: 300, b: 640 }], dock: { l: 20, t: 740, r: 370, b: 830 } };
    const foot = 734;
    const items = frameItems(view(phone), phone, foot, SUMMIT, SUMMIT);
    const gone = itemsLeftOut(items, keep, phone, [reachBox(325, 545, 14)]);
    const kept = items.filter((i) => !gone.has(i.id));

    expect(gone.size).toBeGreaterThan(0);
    expect(gone.has("readout")).toBe(false);
    expect(kept.length).toBeGreaterThan(1);
    for (const i of kept) {
      expect(i.box.l).toBeGreaterThanOrEqual(0);
      expect(i.box.r).toBeLessThanOrEqual(phone.w);
      if (i.always) continue;
      for (const w of keep.words) expect(overlaps(i.box, w, 6)).toBe(false);
      expect(overlaps(i.box, keep.dock!)).toBe(false);
      expect(overlaps(i.box, reachBox(325, 545, 14))).toBe(false);
    }
    kept.forEach((a, i) => kept.slice(i + 1).forEach((b) => expect(overlaps(a.box, b.box, 3)).toBe(false)));
  });

  it("is decided from the items it is given, the same each time", () => {
    const keep: KeepOut = { words: [{ l: 0, t: 0, r: 390, b: 200 }], dock: null };
    const items = frameItems(view(phone), phone, 734, SUMMIT, SUMMIT);

    expect([...itemsLeftOut(items, keep, phone, [])]).toEqual([...itemsLeftOut(items, keep, phone, [])]);
    expect(itemsLeftOut(items, keep, phone, []).has("north")).toBe(true); // north is at the head of the frame, under the title block
  });
});

describe("drawFrame", () => {
  const items = frameItems(view(desk), desk, desk.h, SUMMIT, SUMMIT);

  it("clears the canvas, sets the lettering and draws four corner marks 10 px in, with arms of 12 px", () => {
    const { c, strokes, clears, font } = testCanvas();

    drawFrame(c, items, new Set(), desk, desk.h, 2, 1);
    expect(clears[0]).toEqual([0, 0, 1440, 900]);
    expect(font()).toBe(FRAME_FONT);
    expect(FRAME_FONT).toContain("IBM Plex Mono");
    expect(strokes.slice(0, 4).map((s) => s.points)).toEqual([
      [[22, 10], [10, 10], [10, 22]],
      [[1418, 10], [1430, 10], [1430, 22]],
      [[22, 890], [10, 890], [10, 878]],
      [[1418, 890], [1430, 890], [1430, 878]],
    ]);
    expect(MARK).toEqual({ inset: 10, arm: 12, square: 3 });
    expect(alphaOf(strokes[0].style)).toBe(INKS.marks);
  });

  it("draws two small squares on the edges, half way down the frame", () => {
    const { c, rects } = testCanvas();

    drawFrame(c, items, new Set(), desk, desk.h, 1, 1);
    expect(rects).toHaveLength(2);
    expect(rects[0]).toMatchObject({ x: 8.5, y: 448.5, w: 3, h: 3 });
    expect(rects[1]).toMatchObject({ x: 1428.5, y: 448.5 });
  });

  it("puts the frame's foot where it is told: the corners and the squares follow it", () => {
    const { c, strokes, rects } = testCanvas();

    drawFrame(c, frameItems(view(desk), desk, 700, SUMMIT, SUMMIT), new Set(), desk, 700, 1, 1);
    expect(strokes[2].points[1]).toEqual([10, 690]);
    expect(rects[0].y).toBe(348.5);
  });

  it("writes the readout and, in the overview, north, the scale bar, the rings' and the degrees' lettering", () => {
    const { c, words } = testCanvas();

    drawFrame(c, items, new Set(), desk, desk.h, 1, 1);

    const texts = words.map((w) => w.text);

    expect(texts).toContain("18.37° N   226.79° E");
    expect(texts).toContain("N");
    expect(texts).toContain("200 km");
    expect(texts).toContain("0");
    expect(texts).toContain("150 km");
    expect(texts.filter((t) => /° N$/.test(t) && !t.includes("  ")).length).toBeGreaterThan(2);
    expect(alphaOf(words.find((w) => w.text === "150 km")!.style)).toBeCloseTo(INKS.ring, 9);
  });

  it("draws the overview's lettering at the picture's strength, and leaves it out under 1% of it", () => {
    const half = testCanvas();
    const gone = testCanvas();

    drawFrame(half.c, items, new Set(), desk, desk.h, 1, 0.5);
    drawFrame(gone.c, items, new Set(), desk, desk.h, 1, 0.01);
    expect(alphaOf(half.words.find((w) => w.text === "150 km")!.style)).toBeCloseTo(INKS.ring * 0.5, 9);
    expect(alphaOf(half.words.find((w) => w.text === "18.37° N   226.79° E")!.style)).toBeCloseTo(INKS.readout, 9); // the readout does not fade
    expect(gone.words.map((w) => w.text)).toEqual(["18.37° N   226.79° E"]);
    expect(gone.strokes).toHaveLength(4); // the corner marks only: no scale bar
  });

  it("draws no label that was left out", () => {
    const { c, words } = testCanvas();

    drawFrame(c, items, new Set(["north", "ring-150", "scale"]), desk, desk.h, 1, 1);
    expect(words.map((w) => w.text)).not.toContain("N");
    expect(words.map((w) => w.text)).not.toContain("150 km");
    expect(words.map((w) => w.text)).not.toContain("200 km");
    expect(words.map((w) => w.text)).toContain("300 km");
  });

  it("draws the scale bar with three ticks, a line and its two figures", () => {
    const { c, strokes, words } = testCanvas();

    drawFrame(c, items, new Set(), desk, desk.h, 1, 1);

    const bar = scaleBar(view(desk).S, desk);
    const line = strokes.find((s) => s.points.length === 8)!;

    expect(line.points[0]).toEqual([bar.x0, bar.y]);
    expect(line.points[1]).toEqual([bar.x1, bar.y]);
    expect(words.find((w) => w.text === "200 km")).toMatchObject({ x: bar.endLabel.x, y: bar.endLabel.y, align: "right" });
    expect(words.find((w) => w.text === "0")).toMatchObject({ x: bar.zeroLabel.x, align: "left" });
  });
});
