// The dip of a reduced-motion step (spec 9.7: "fades only"). A step in My climb that has to move the camera does not travel:
// the map's layers fade out, the camera jumps while they are dark, and they fade back in. No DOM here: `hop` is the time the dip
// began (null: none), and these give how much of the map shows and where a dip that is asked for again carries on from.

/** How long the whole dip lasts (milliseconds): out in the first half, the jump in the middle, back in in the second. */
export const HOP_MS = 300;

/** How much of the map shows at `now` in a dip that began at `hop`: 1 before and after, 0 at the middle. */
export function dipAt(hop: number | null, now: number): { shown: number; done: boolean } {
  if (hop === null) return { shown: 1, done: true };

  const t = (now - hop) / HOP_MS;

  return t >= 1 ? { shown: 1, done: true } : { shown: Math.abs(1 - 2 * Math.max(0, t)), done: false };
}

/** The start time for a dip asked for at `now`: a new one begins at `now`; one under way carries on from where its strength is, so the layers never jump. */
export function hopStart(hop: number | null, now: number): number {
  const t = hop === null ? 0 : Math.min(1, Math.max(0, (now - hop) / HOP_MS));

  return now - (t <= 0.5 ? t : 1 - t) * HOP_MS;
}

/** Whether the camera may jump now: at the middle of the dip, or at once when there is none. */
export const jumpNow = (hop: number | null, now: number): boolean => hop === null || now - hop >= HOP_MS / 2;
