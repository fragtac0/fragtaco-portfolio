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

/**
 * `inert` is not in React 18's types, and React 18 only passes it through as a string attribute.
 * An inert subtree is out of the tab order and the accessibility tree.
 */
export function inertIf(on: boolean): { inert?: string } {
  return on ? { inert: "" } : {};
}

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
