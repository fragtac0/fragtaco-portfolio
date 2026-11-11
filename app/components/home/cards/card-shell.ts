import type { Ref } from "react";
import type { NavState } from "./hero-nav";
import type { Mode, Side } from "./card-pose";

export type CardShellProps = {
  cardRef: Ref<HTMLElement>;
  /** hidden: off screen. rest: only the rail peeks in. open: full size. */
  mode: Mode;
  /** The pointer is over the card at rest (the card is nudged and glows). */
  hot: boolean;
};

export function cardClass(side: "left" | "right", { mode, hot }: Pick<CardShellProps, "mode" | "hot">) {
  return ["card", side, mode === "open" && "open", hot && mode === "rest" && "hot"]
    .filter(Boolean)
    .join(" ");
}

/** "the cut" -> ["the", "cut"]: the first word, then the rest, one per line in the display type. */
export function twoLines(text: string): [string, string] {
  const [first = "", ...rest] = text.trim().split(/\s+/);
  return [first, rest.join(" ")];
}

/** Where a card sits for a given navigation state. */
export function modeOf(nav: NavState, side: Side): Mode {
  if (nav === "hidden") return "hidden";
  if (nav === side) return "open";
  return nav === "hero" ? "rest" : "hidden";
}

/**
 * When the intro card's portrait (a 196 KB background) is requested. It stays out of the way of the
 * first painting: nothing while the loader runs (`hidden`), then a quiet moment once the cards have
 * risen, and at once when the card is open or the pointer is over it (it is about to open).
 */
export type PortraitPhase = "have" | "now" | "idle" | "wait";

export function portraitPhase(nav: NavState, hotRight: boolean, loaded: boolean): PortraitPhase {
  if (loaded) return "have";
  if (nav === "right" || hotRight) return "now";
  return nav === "hidden" ? "wait" : "idle";
}
