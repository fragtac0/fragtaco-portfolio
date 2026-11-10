/**
 * Loader timings in ms, ported from the mockup's playLoader. The name's timings (grow,
 * lettersIn, letterStep, lettersOut, letterOutStep) are mirrored in loader.css, which runs them
 * from first paint; they are listed here so the two stay in step.
 */
export const LOADER = {
  grow: 60,
  lettersIn: 160,
  letterStep: 58,
  lettersOut: 1750,
  letterOutStep: 24,
  logo: 2120,
  logoFirstLetter: 200,
  logoLetterStep: 80,
  reveal: 2800,
  revealMs: 2000,
  nameSmall: 4050,
  roles: 4300,
  done: 4800,
  /** How long past its cue the reveal waits for the painting before it opens on the placeholder. */
  revealMaxWait: 1500,
} as const;

export type LoaderStep = { at: number; step: string; index?: number };

/**
 * Nominal timeline, in ms since the head script ran. CSS owns the name (grow, letters in and out),
 * so only the steps JavaScript performs are listed. The hero shifts the steps after "reveal" by
 * however long the reveal was held (see revealPlan); no wait is baked in here. The logo's
 * per-group delays (logoFirstLetter, logoLetterStep) are CSS transition delays, not steps.
 */
export function loaderSchedule(_name: string): LoaderStep[] {
  return [
    { at: LOADER.logo, step: "logo" },
    { at: LOADER.reveal, step: "reveal" },
    { at: LOADER.nameSmall, step: "nameSmall" },
    { at: LOADER.roles, step: "roles" },
    { at: LOADER.done, step: "done" },
  ];
}

export type RevealPlan = {
  /** sharp: open on the painting; placeholder: open on the blurred one; wait: not yet. */
  action: "sharp" | "placeholder" | "wait";
  /** When, on the loader's clock (ms since the head script ran). */
  at: number;
};

/**
 * What the reveal does at its cue. `paintingReadyAt` is when the sharp painting finished loading
 * (null while it has not), `now` the loader's clock, `revealAt` the nominal cue. Ready by the cue:
 * reveal it then. Ready within revealMaxWait after it: reveal the moment it is ready. Otherwise
 * wait until revealAt + revealMaxWait, then open on the placeholder (the sharp painting
 * crossfades in later). The steps after the reveal move by `at - revealAt`, so the loader is at
 * most revealMaxWait longer than nominal. `at` never lies before the cue.
 */
export function revealPlan(s: {
  paintingReadyAt: number | null;
  now: number;
  revealAt: number;
}): RevealPlan {
  const cutoff = s.revealAt + LOADER.revealMaxWait;
  if (s.paintingReadyAt !== null && s.paintingReadyAt <= cutoff) {
    return { action: "sharp", at: Math.max(s.paintingReadyAt, s.revealAt) };
  }
  if (s.now < cutoff) return { action: "wait", at: cutoff };
  return { action: "placeholder", at: Math.max(s.now, cutoff) };
}
