// What the dock's contrast and foot checks measure (R56.4, R56.4b): the labels and icons with their inks, the three sizes, the rules.
export const TABS = ["/work/long-form", "/work/short-form", "/experience"];
const FOG = [245, 239, 230];
const NAV = "[data-dock-glass] nav[aria-label=\"Primary\"]";
// every label and icon of the dock, with the ink it is drawn in (checked against the page by `__inks`): tabs and the idle nav link at 0.85, the open one at 1, social icons white at 0.68
export const TARGETS = [
  ...TABS.map((to, i) => ({ name: ["Long form", "Short form", "My experience"][i], sel: `[data-dock-glass] a[data-work-tab="${to}"]`, ink: [...FOG, 0.85], key: `tab ${to}`, text: true })),
  { name: "home label", sel: `${NAV} a[href="/"] span`, ink: [...FOG, 0.85], key: "home label", text: true },
  { name: "home icon", sel: `${NAV} a[href="/"] svg`, ink: [...FOG, 0.85], key: "home icon" },
  { name: "work label", sel: `${NAV} a[href^="/work"] span`, ink: [...FOG, 1], key: "work label", text: true },
  { name: "work icon", sel: `${NAV} a[href^="/work"] svg`, ink: [...FOG, 1], key: "work icon" },
  ...["YouTube", "Instagram", "X", "Mail"].map((n) => ({ name: `${n} icon`, sel: `${NAV} a[aria-label="${n}"] svg`, ink: [255, 255, 255, 0.68], key: `${n} icon` })),
];
export const SIZES = [
  { name: "1440x900", size: [1440, 900], dpr: 1 },
  { name: "390x844", size: [390, 844], dpr: 2, mobile: true, touch: true },
  { name: "320x568", size: [320, 568], dpr: 2, mobile: true, touch: true },
];
export const SIDES = ["left", "right", "top", "bottom"];
export const WHERE = ["centre", ...SIDES];
export const MIN_CONTRAST = 4.5;
export const MAX_DARKER = 2; // levels of 255: a lossless picture of an unchanged page is identical, so this is rounding only
export const TOP = 3; // thumbnails tried: the brightest by window
export const GRID_CANDS = 1; // the grid round the brightest window is for the brightest thumbnail
export const OFFSETS = [-0.25, 0, 0.25]; // the tile moved under the label by this share of its width / height, round its brightest window
// the labels with the least contrast in the first run (the tabs, whose ink is the faintest, and the social icons at 0.68): they get the whole grid; the others get the brightest window
export const GRID_TARGETS = ["Long form", "Short form", "My experience", "YouTube icon", "Mail icon"];
export const RING_TARGETS = GRID_TARGETS;
export const RING_CANDS = 2;
export const NEAR_PX = 30; // a ring tile further than this from the point it was asked to be at cannot be put there: the case is "not reachable"

const fmt = (n) => String(n);
/** The step label of a contrast case: `c|<size>|<mode>|<target>|<candidate>|<fu>|<fv>` (+ `|t<tint>` in a sweep). */
export const caseLabel = (size, c, tint) => ["c", size, c.mode, c.target, c.ci ?? "-", fmt(c.fu ?? 0), fmt(c.fv ?? 0), ...(tint != null ? [`t${tint}`] : [])].join("|");
export const parseLabel = (label) => {
  const [, size, mode, target, ci, fu, fv, t] = label.split("|");
  return { size, mode, target, ci: ci === "-" ? null : Number(ci), fu: Number(fu), fv: Number(fv), tint: t ? Number(t.slice(1)) : null };
};

/** Every contrast case of one run: nothing under the label, a white tile, the top thumbnails at their brightest window and with their blurred peak under the label, the grid round the window for the worst labels, real ring tiles (peak first), and the bound. */
export function allCases() {
  const out = [];
  for (const t of TARGETS) {
    out.push({ mode: "none", target: t.name }, { mode: "white", target: t.name });
    for (let ci = 0; ci < TOP; ci++) out.push({ mode: "stand", target: t.name, ci, fu: 0, fv: 0 });
  }
  for (const t of TARGETS) for (let ci = 0; ci < TOP; ci++) out.push({ mode: "peak", target: t.name, ci, fu: 0, fv: 0 }); // the blurred peak of each under the label's middle: the worst place for that tile
  for (const target of GRID_TARGETS) for (let ci = 0; ci < GRID_CANDS; ci++) for (const fu of OFFSETS) for (const fv of OFFSETS) if (fu !== 0 || fv !== 0) out.push({ mode: "stand", target, ci, fu, fv });
  for (const target of RING_TARGETS) for (let ci = 0; ci < RING_CANDS; ci++) for (const fu of OFFSETS) out.push({ mode: "ring", target, ci, fu, fv: 0 });
  for (const target of RING_TARGETS) for (const fu of OFFSETS) out.push({ mode: "ringAll", target, ci: 0, fu, fv: 0 });
  return out;
}
