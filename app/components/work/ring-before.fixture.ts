// What the page drew at 4621443 (round 7, before R56.4, the last commit with the dock's cut-out), for the real content (8 tools, 21 long form,
// 35 short form): the plan of ringPlan(vw, vh, REAL) as that commit made it, per audit size, so R56.4 can be held to "no audit size gets smaller tiles
// or fewer tiles" (spec 4). `rings` are the video rings only: [kind, radius, count]; `L` is the tile's long side; `tiles` is their count;
// `full` is the share of the screen under tiles counted in full (the number `coverage` gives with no mask).
export interface Before {
  L: number;
  tiles: number;
  full: number;
  rings: [kind: "long" | "short", radius: number, count: number][];
}

export const BEFORE: Record<string, Before> = {
  "1440x900": { L: 200, tiles: 26, full: 0.308961, rings: [["long", 407.82, 10], ["short", 645.76, 16]] },
  "1920x1080": { L: 233, tiles: 26, full: 0.270521, rings: [["long", 469.86, 10], ["short", 744.26, 16]] },
  "820x1180": { L: 168, tiles: 32, full: 0.209879, rings: [["long", 456.77, 13], ["short", 659.36, 19]] },
  "390x844": { L: 220, tiles: 7, full: 0.230922, rings: [["long", 342.35, 7]] },
  "375x667": { L: 220, tiles: 7, full: 0.201577, rings: [["long", 336.05, 7]] },
  "568x320": { L: 99, tiles: 14, full: 0.077492, rings: [["long", 299.51, 14]] },
  "320x568": { L: 204, tiles: 7, full: 0.189805, rings: [["long", 299.4, 7]] },
  "1024x768": { L: 162, tiles: 28, full: 0.279105, rings: [["long", 360.15, 11], ["short", 556.11, 17]] },
  "2560x1440": { L: 284, tiles: 37, full: 0.257215, rings: [["long", 585.4, 7], ["short", 916.15, 16], ["long", 1246.9, 14]] },
};
