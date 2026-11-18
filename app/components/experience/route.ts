// Where the route must stop (spec 9.3): the schema checks the content's route against it (app/content/experience-schema.ts). Pure maths.

/** The route ends this share of the way from the cliff to the summit crater's rim, at most (spec 9.3). */
export const ROUTE_STOP_SHARE = 0.6;

/**
 * How close to the summit the route's last point may be: the rim's radius plus the rest of the way, in
 * whatever unit the two radii are in (the cliff's mean radius and the rim's radius).
 */
export function routeStopRadius(cliffRadius: number, rimRadius: number): number {
  return rimRadius + (1 - ROUTE_STOP_SHARE) * (cliffRadius - rimRadius);
}
