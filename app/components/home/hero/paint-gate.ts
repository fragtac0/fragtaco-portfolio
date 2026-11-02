/**
 * Decides what the hero's draw loop does this frame.
 * park: stop drawing entirely. wait: skip this frame (the slow zoom alone runs at ~30 fps).
 * draw: redraw now. `active` means a reveal, sweep or blur easing is in progress.
 */
export function paintStep(s: {
  pageVisible: boolean;
  heroOn: boolean;
  layerOpen: boolean;
  cardOpen: boolean;
  active: boolean;
  sinceLastDraw: number;
}): "park" | "wait" | "draw" {
  if (!s.pageVisible || !s.heroOn || s.layerOpen || (s.cardOpen && !s.active)) return "park";
  if (!s.active && s.sinceLastDraw < 32) return "wait";
  return "draw";
}
