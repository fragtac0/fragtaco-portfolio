import { describe, expect, it } from "vitest";
import {
  escTarget,
  layerFromHash,
  layerReducer,
  type LayerAction,
  type LayerState,
} from "./layer-state";

const closed: LayerState = { kind: null, phase: "closed" };
const growing: LayerState = { kind: "reading", phase: "growing" };
const open: LayerState = { kind: "reading", phase: "open" };
const shrinking: LayerState = { kind: "reading", phase: "shrinking" };

describe("layerFromHash", () => {
  it("reads #reading and #watching", () => {
    expect(layerFromHash("#reading")).toBe("reading");
    expect(layerFromHash("#watching")).toBe("watching");
  });
  it("returns null for anything else", () => {
    expect(layerFromHash("#x")).toBeNull();
    expect(layerFromHash("")).toBeNull();
    expect(layerFromHash("#about")).toBeNull();
    expect(layerFromHash("reading")).toBeNull();
  });
});

describe("layerReducer", () => {
  it("opens from closed, into growing", () => {
    expect(layerReducer(closed, { type: "open", kind: "watching" })).toEqual({
      kind: "watching",
      phase: "growing",
    });
  });
  it("ignores open while growing or open", () => {
    for (const s of [growing, open]) {
      expect(layerReducer(s, { type: "open", kind: "watching" })).toBe(s);
      expect(layerReducer(s, { type: "open", kind: "reading" })).toBe(s);
    }
  });
  it("a click on the block that is closing turns the move round into growing", () => {
    expect(layerReducer(shrinking, { type: "open", kind: "reading" })).toEqual({
      kind: "reading",
      phase: "growing",
    });
  });
  it("a click on the other block while one is closing does nothing", () => {
    expect(layerReducer(shrinking, { type: "open", kind: "watching" })).toBe(shrinking);
  });
  it("grown moves growing to open, and nothing else", () => {
    expect(layerReducer(growing, { type: "grown" })).toEqual({
      kind: "reading",
      phase: "open",
    });
    for (const s of [closed, open, shrinking]) {
      expect(layerReducer(s, { type: "grown" })).toBe(s);
    }
  });
  it("close from growing or open keeps the kind and shrinks", () => {
    expect(layerReducer(growing, { type: "close" })).toEqual({
      kind: "reading",
      phase: "shrinking",
    });
    expect(layerReducer(open, { type: "close" })).toEqual({
      kind: "reading",
      phase: "shrinking",
    });
  });
  it("ignores close while closed or shrinking", () => {
    expect(layerReducer(closed, { type: "close" })).toBe(closed);
    expect(layerReducer(shrinking, { type: "close" })).toBe(shrinking);
  });
  it("shrunk closes only from shrinking", () => {
    expect(layerReducer(shrinking, { type: "shrunk" })).toEqual(closed);
    for (const s of [closed, growing, open]) {
      expect(layerReducer(s, { type: "shrunk" })).toBe(s);
    }
  });
});

describe("escTarget", () => {
  it("closes an open book first, then a video, then the layer", () => {
    expect(escTarget({ bookOpen: true, videoOpen: false, layer: open })).toBe("book");
    expect(escTarget({ bookOpen: false, videoOpen: true, layer: open })).toBe("video");
    expect(escTarget({ bookOpen: false, videoOpen: false, layer: open })).toBe("layer");
  });
  it("closes the video before the book when both are somehow open", () => {
    expect(escTarget({ bookOpen: true, videoOpen: true, layer: open })).toBe("video");
  });
  it("closes the layer while it is growing too", () => {
    expect(escTarget({ bookOpen: false, videoOpen: false, layer: growing })).toBe("layer");
  });
  it("is null when the layer is closed or already shrinking", () => {
    expect(escTarget({ bookOpen: true, videoOpen: true, layer: closed })).toBeNull();
    expect(escTarget({ bookOpen: false, videoOpen: false, layer: shrinking })).toBeNull();
  });
});

describe("every order of open, close and turn", () => {
  const actions: LayerAction[] = [
    { type: "open", kind: "reading" },
    { type: "open", kind: "watching" },
    { type: "grown" },
    { type: "close" },
    { type: "shrunk" },
  ];
  const valid = (s: LayerState) =>
    (s.phase === "closed") === (s.kind === null) &&
    ["closed", "growing", "open", "shrinking"].includes(s.phase);

  it("never leaves a state that is not a state, for every sequence of up to six actions", () => {
    let seen = 0;
    const walk = (s: LayerState, depth: number) => {
      expect(valid(s)).toBe(true);
      seen++;
      if (depth === 0) return;
      for (const a of actions) {
        const next = layerReducer(s, a);
        // a no-op is the same object, so React skips the render
        if (next !== s) expect(next).not.toEqual(s);
        walk(next, depth - 1);
      }
    };
    walk(closed, 6);
    expect(seen).toBeGreaterThan(10000);
  });

  it("opens, turns round and closes again in any interleaving, keeping the kind", () => {
    let s = layerReducer(closed, { type: "open", kind: "watching" });
    s = layerReducer(s, { type: "close" }); // Close during the opening
    expect(s).toEqual({ kind: "watching", phase: "shrinking" });
    s = layerReducer(s, { type: "open", kind: "watching" }); // a click during the closing
    expect(s).toEqual({ kind: "watching", phase: "growing" });
    s = layerReducer(s, { type: "close" });
    s = layerReducer(s, { type: "open", kind: "watching" });
    s = layerReducer(s, { type: "grown" });
    expect(s).toEqual({ kind: "watching", phase: "open" });
    s = layerReducer(s, { type: "close" });
    s = layerReducer(s, { type: "shrunk" });
    expect(s).toEqual(closed);
  });

  it("a late grown or shrunk after a turn changes nothing", () => {
    const turned = layerReducer(shrinking, { type: "open", kind: "reading" });
    expect(layerReducer(turned, { type: "shrunk" })).toBe(turned);
    const back = layerReducer(growing, { type: "close" });
    expect(layerReducer(back, { type: "grown" })).toBe(back);
  });
});
