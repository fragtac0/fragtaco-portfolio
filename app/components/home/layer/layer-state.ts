export type LayerKind = "reading" | "watching";

/** The layer's own URL: /#reading and /#watching. */
export function layerFromHash(hash: string): LayerKind | null {
  if (hash === "#reading") return "reading";
  if (hash === "#watching") return "watching";
  return null;
}

export type LayerPhase = "closed" | "growing" | "open" | "shrinking";
export type LayerState = { kind: LayerKind | null; phase: LayerPhase };

export type LayerAction =
  | { type: "open"; kind: LayerKind }
  | { type: "grown" }
  | { type: "close" }
  | { type: "shrunk" };

/** The clip-path transition, in ms (the mockup's .66s). */
export const GROW_MS = 660;
/** The scene starts, and the shrink is considered done, this long after the layer moves. */
export const SCENE_DELAY_MS = 680;

/** Out-of-order actions return the same state object, so React skips the render. */
export function layerReducer(s: LayerState, a: LayerAction): LayerState {
  switch (a.type) {
    case "open":
      return s.phase === "closed" ? { kind: a.kind, phase: "growing" } : s;
    case "grown":
      return s.phase === "growing" ? { kind: s.kind, phase: "open" } : s;
    case "close":
      // the kind is kept so the layer can shrink back into its own block
      return s.phase === "growing" || s.phase === "open" ? { kind: s.kind, phase: "shrinking" } : s;
    case "shrunk":
      return s.phase === "shrinking" ? { kind: null, phase: "closed" } : s;
  }
}

/** What Esc closes: an open video, then an open book, then the layer itself. */
export function escTarget(s: {
  bookOpen: boolean;
  videoOpen: boolean;
  layer: LayerState;
}): "book" | "video" | "layer" | null {
  if (s.layer.phase !== "growing" && s.layer.phase !== "open") return null;
  if (s.videoOpen) return "video";
  if (s.bookOpen) return "book";
  return "layer";
}
