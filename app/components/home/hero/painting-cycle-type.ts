/** The painting cycle's public shape: what the loader (use-loader) drives. */

export type FoundPainting = { img: HTMLImageElement; k: number };

/** The hero is showing the blurred placeholder; `arrived` is a sharp painting waiting for its reveal to end. */
export type OpenPlaceholder = { over: boolean; arrived: FoundPainting | null };

/** What the loader drives: the first painting, and the cycle that carries on from it. */
export type PaintingCycle = {
  /** How many paintings there are. */
  count: number;
  /** The painting remembered from the last visit to the home route (position 0), or null. */
  recalled: () => FoundPainting | null;
  /** Prepares a painting for a cheap upload (the remembered one, which comes back without a load). */
  prepare: (img: HTMLImageElement) => Promise<void>;
  /**
   * The first painting in the order: the one the head preload fetched (same URL, when the browser
   * can show WebP), or the remembered image. Resolves null when there is none or it fails.
   */
  firstLoad: () => Promise<HTMLImageElement | null>;
  /**
   * The first painting that loads, trying the next in the order when one fails or is too slow,
   * and giving up after `maxTries` (see nextRevealTry).
   */
  firstLoaded: (
    firstLoad: Promise<HTMLImageElement | null>,
    maxWait: number,
    maxTries?: number,
  ) => Promise<FoundPainting | null>;
  /** Reveals a loaded painting, sets its caption, remembers it and preloads the next. */
  present: (found: FoundPainting, ms: number) => void;
  /**
   * The skipped loader's first painting when nothing is remembered: the blurred placeholder
   * (when the response carries one) as soon as it decodes, then a 400 ms crossfade to the sharp
   * painting when it arrives. Resolves true once something is on screen.
   */
  presentFirst: () => Promise<boolean>;
  /**
   * The loader's reveal when the sharp painting is late: the liquid-glass reveal (`ms`) opens on
   * the first painting's blurred placeholder instead. Resolves true once it is on screen, false
   * when there is no placeholder or it fails to load. Does not preload the next painting: the
   * network is busy with the sharp one.
   */
  revealPlaceholder: (ms: number) => Promise<boolean>;
  /**
   * After `revealPlaceholder`: when the sharp painting arrives (and the reveal has finished) it
   * crossfades in over 400 ms. Ignored once the cycle has moved on to another painting.
   */
  upgradeWhenLoaded: (pending: Promise<FoundPainting | null>) => void;
  /**
   * The reveal for a painting that arrives late with no placeholder to open on: reveals it when it
   * arrives, unless the cycle has already moved on to another painting by then.
   */
  presentLate: (pending: Promise<FoundPainting | null>, ms: number) => void;
  /** Starts the timer for the next swap (ten seconds unless `ms` is given). */
  scheduleNext: (ms?: number) => void;
};
