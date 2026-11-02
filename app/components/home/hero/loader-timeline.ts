/** Loader timings in ms, ported from the mockup's playLoader. */
export const LOADER = {
  grow: 60,
  lettersIn: 160,
  letterStep: 58,
  lettersOut: 2000,
  letterOutStep: 24,
  logo: 2120,
  logoFirstLetter: 200,
  logoLetterStep: 80,
  reveal: 2800,
  revealMs: 2000,
  nameSmall: 4050,
  roles: 4300,
  done: 4800,
  /** How long the reveal waits for a painting before trying the next one in the order. */
  firstPaintingMaxWait: 8000,
} as const;

export type LoaderStep = { at: number; step: string; index?: number };

/**
 * Nominal timeline. The hero shifts the steps after "reveal" by however long it
 * waits for the first painting; no wait is baked in here. The logo's per-group
 * delays (logoFirstLetter, logoLetterStep) are CSS transition delays, not steps.
 */
export function loaderSchedule(name: string): LoaderStep[] {
  const steps: LoaderStep[] = [{ at: LOADER.grow, step: "grow" }];
  const n = Array.from(name).length;
  for (let i = 0; i < n; i++) {
    steps.push({ at: LOADER.lettersIn + i * LOADER.letterStep, step: "letterIn", index: i });
    steps.push({ at: LOADER.lettersOut + i * LOADER.letterOutStep, step: "letterOut", index: i });
  }
  steps.push(
    { at: LOADER.logo, step: "logo" },
    { at: LOADER.reveal, step: "reveal" },
    { at: LOADER.nameSmall, step: "nameSmall" },
    { at: LOADER.roles, step: "roles" },
    { at: LOADER.done, step: "done" },
  );
  return steps.sort((a, b) => a.at - b.at);
}
