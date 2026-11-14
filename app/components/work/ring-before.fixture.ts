// What the page drew at 19ca81b (round 7, before R54.2), for the real content (8 tools, 21 long form, 35 short form): the plan of
// ringPlan(vw, vh, REAL) as that commit made it, per audit size, so R54.2b can be held to "no size shows less tile area or smaller tiles" (R118).
// `rings` are the video rings only: [kind, radius, count]; `L` is the tile's long side. `visible` is the share of the screen under tiles
// that show: tiles behind the dock's glass box (448 by 113, ring-keep-out.ts nominalDock) are not counted; no mask was drawn then.
export interface Before {
  L: number;
  visible: number;
  rings: [kind: "long" | "short", radius: number, count: number][];
}

export const BEFORE: Record<string, Before> = {
  "1440x900": { L: 112, visible: 0.1417, rings: [["long", 357.28, 8], ["short", 498.57, 14], ["long", 639.85, 13], ["short", 781.13, 21]] },
  "1920x1080": { L: 155, visible: 0.1591, rings: [["long", 447.73, 7], ["short", 636.27, 13], ["long", 824.8, 14], ["short", 1013.34, 22]] },
  "820x1180": { L: 98, visible: 0.1105, rings: [["long", 409.13, 8], ["short", 535.06, 26], ["long", 660.99, 13]] },
  "390x844": { L: 104, visible: 0.1454, rings: [["long", 295.74, 13], ["short", 427.69, 19]] },
  "375x667": { L: 220, visible: 0.1011, rings: [["long", 351.99, 8]] },
  "568x320": { L: 99, visible: 0.0767, rings: [["long", 299.89, 14]] },
  "320x568": { L: 204, visible: 0.1043, rings: [["long", 299.89, 7]] },
  "1024x768": { L: 104, visible: 0.1596, rings: [["long", 322.93, 7], ["short", 455.87, 21], ["long", 588.8, 14]] },
  "2560x1440": { L: 212, visible: 0.1711, rings: [["long", 596.98, 7], ["short", 848.36, 13], ["long", 1099.74, 14], ["short", 1351.12, 22]] },
};
