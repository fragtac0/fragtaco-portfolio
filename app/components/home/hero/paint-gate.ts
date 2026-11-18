/**
 * Decides what the hero's draw loop does this frame.
 * park: stop drawing entirely. wait: skip this frame (the slow zoom alone runs at ~30 fps).
 * draw: redraw now. `active` means a reveal, sweep or blur easing is in progress.
 * `holdForPicture`: a still frame of the painting is on screen and the engine has no picture yet, so a
 * draw now would put the bare black ground over the still (the black frame on return, R49.1): skip it.
 */
export function paintStep(s: {
  pageVisible: boolean;
  heroOn: boolean;
  layerOpen: boolean;
  cardOpen: boolean;
  active: boolean;
  sinceLastDraw: number;
  holdForPicture?: boolean;
}): "park" | "wait" | "draw" {
  if (!s.pageVisible || !s.heroOn || s.layerOpen || (s.cardOpen && !s.active)) return "park";
  if (s.holdForPicture) return "wait";
  if (!s.active && s.sinceLastDraw < 32) return "wait";
  return "draw";
}
