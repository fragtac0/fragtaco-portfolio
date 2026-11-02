import { describe, expect, it } from "vitest";
import {
  escTarget,
  GROW_MS,
  layerFromHash,
  layerReducer,
  SCENE_DELAY_MS,
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

describe("timings", () => {
  it("matches the mockup", () => {
    expect(GROW_MS).toBe(660);
    expect(SCENE_DELAY_MS).toBe(680);
  });
});

describe("layerReducer", () => {
  it("opens from closed, into growing", () => {
    expect(layerReducer(closed, { type: "open", kind: "watching" })).toEqual({
      kind: "watching",
      phase: "growing",
    });
  });
  it("ignores open unless closed", () => {
    for (const s of [growing, open, shrinking]) {
      expect(layerReducer(s, { type: "open", kind: "watching" })).toBe(s);
    }
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
