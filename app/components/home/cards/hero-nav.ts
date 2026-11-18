import type { Side } from "./card-pose";

export type NavState = "hidden" | "hero" | Side;

export type NavInput =
  | { kind: "show" }
  | { kind: "hide" }
  | { kind: "key"; key: "ArrowLeft" | "ArrowRight" | "Escape" }
  | { kind: "swipe"; dir: "left" | "right" }
  | { kind: "go"; to: "hero" | "left" | "right" }
  | { kind: "toggle"; side: "left" | "right" };

export type NavContext = { heroVisible: boolean; layerOpen: boolean };

/** Move one panel along the left - hero - right line (ArrowRight / swipe left). */
function step(state: NavState, forward: boolean): NavState {
  if (forward) return state === "left" ? "hero" : "right";
  return state === "right" ? "hero" : "left";
}

export function heroNav(state: NavState, input: NavInput, ctx: NavContext): NavState {
  if (input.kind === "hide") return "hidden";
  if (state === "hidden") return input.kind === "show" ? "hero" : "hidden";

  switch (input.kind) {
    case "show":
      return state;
    case "go":
      return input.to;
    case "toggle":
      return state === input.side ? "hero" : input.side;
    case "key":
      if (!ctx.heroVisible || ctx.layerOpen) return state;
      if (input.key === "Escape") return "hero";
      return step(state, input.key === "ArrowRight");
    case "swipe":
      if (!ctx.heroVisible || ctx.layerOpen) return state;
      return step(state, input.dir === "left");
  }
}
