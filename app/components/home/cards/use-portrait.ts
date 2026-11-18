import { useEffect, useState } from "react";
import { whenIdle } from "../../../utils/idle";
import { portraitPhase } from "./card-shell";
import type { NavState } from "./hero-nav";

/** An idle moment is waited for at most this long once the cards are up (then the portrait loads anyway). */
const IDLE_TIMEOUT_MS = 1500;

/**
 * Whether the intro card's portrait may be requested yet (see `portraitPhase`). It turns true once
 * and stays true, so the picture is requested once, after the loader, instead of at 490 ms
 * next to the first painting.
 */
export function usePortraitWanted(nav: NavState, hotRight: boolean): boolean {
  const [loaded, setLoaded] = useState(false);
  const phase = portraitPhase(nav, hotRight, loaded);
  // latched while rendering (the documented way to derive state from props), so the card's first
  // open frame already has the picture in its style
  if (phase === "now") setLoaded(true);
  useEffect(() => {
    if (phase === "idle") return whenIdle(() => setLoaded(true), IDLE_TIMEOUT_MS);
  }, [phase]);
  return loaded || phase === "now";
}
