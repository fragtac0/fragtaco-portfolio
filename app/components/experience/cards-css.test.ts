// Two things of the beads' sheet that a reader of the sheet can check (Task 18's re-review, carried into Task 19): the focus ring
// of a bead is scaled back by the bead's own scale so it is as thick on the screen in the overview as in My climb, and a bead's
// label never slides (only its opacity is transitioned), so it cannot sweep across its bead when the engine changes its side.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("./cards.css", import.meta.url), "utf8");
/** The bodies of every rule whose selector list ends with `selector`, joined. */
const rule = (selector: string) =>
  [...css.matchAll(new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\:]/g, "\\$&")}\\s*\\{([^}]*)\\}`, "g"))].map((m) => m[1]).join("\n");

describe("the focus ring of a bead", () => {
  const ring = rule(".map-pin:focus-visible .map-bead");

  it("is divided by the bead's scale (--bs, and the 1.14 the focus adds), width and offset both", () => {
    expect(ring).toContain("outline-width: calc(2px / (var(--bs, 1) * 1.14))");
    expect(ring).toContain("outline-offset: calc(3px / (var(--bs, 1) * 1.14))");
    expect(ring).toContain("outline-color: var(--cream)");
  });

  it("rounds the width to a whole pixel (a browser snaps a fractional ring width down: 1.75 px would be 1 px, a thin ring in My climb), after a plain declaration for a browser that cannot round", () => {
    expect(ring).toContain("outline-width: round(calc(2px / (var(--bs, 1) * 1.14)), 1px)");
    expect(ring.indexOf("outline-width: calc(")).toBeLessThan(ring.indexOf("outline-width: round("));
  });

  it("comes out near 2 px on the screen in both states, worked out from the numbers in the sheet itself: 4 px on the half-size bead, 2 px on the full-size one (2.28 px both)", () => {
    // outline-width: round(calc(<px>px / (var(--bs, 1) * <focus scale>)), 1px), read from the rule and evaluated for a scale
    const m = /outline-width:\s*round\(calc\((\d+(?:\.\d+)?)px \/ \(var\(--bs, 1\) \* (\d+(?:\.\d+)?)\)\), 1px\)/.exec(ring);

    expect(m).not.toBeNull();

    const [px, focus] = [Number(m?.[1]), Number(m?.[2])];
    const onScreen = (bs: number) => Math.max(1, Math.round(px / (bs * focus))) * (bs * focus);

    expect(onScreen(0.5)).toBeCloseTo(2.28, 2);
    expect(onScreen(1)).toBeCloseTo(2.28, 2);
    for (const bs of [0.5, 0.6, 0.7, 0.8, 0.9, 1]) expect(Math.abs(onScreen(bs) - 2)).toBeLessThan(0.75);
  });
});

describe("the label of a bead", () => {
  const tip = rule(".map-pin-tip");

  it("transitions its opacity only, so a change of side (--flip) while it is shown is at once, not a slide", () => {
    expect(tip).toMatch(/transition:\s*opacity 250ms;/);
    expect(tip).not.toMatch(/transition:[^;]*transform/);
    expect(rule(".map-pin:focus-visible .map-pin-tip")).not.toContain("transform"); // the hover and focus states do not move it either
  });

  it("takes its side from --flip alone: the same offset from the bead at rest and under the pointer", () => {
    expect(tip).toContain("transform: translate(calc(12px + var(--flip, 0) * (-100% - 24px)), -50%)");
  });
});

describe("the bead's touch area (R108)", () => {
  it("is taken by the hit span, clipped by the engine's --hit, and not by the button itself", () => {
    expect(rule(".map-pin")).toContain("pointer-events: none");
    expect(rule(".map-hit")).toContain("pointer-events: auto");
    expect(rule(".map-hit")).toContain("clip-path: var(--hit, none)");
    expect(rule(".map-pin:disabled .map-hit")).toContain("pointer-events: none");
  });

  it("takes a bead under the card out of the touch by data-under on its hit span, which sets its own pointer-events (an inline none on the button would not reach it)", () => {
    expect(rule(".map-pin[data-under] .map-hit")).toContain("pointer-events: none");
  });
});

describe("the picture's first look by CSS", () => {
  const map = readFileSync(new URL("./map.css", import.meta.url), "utf8");

  it("is the phone's under the same media query as the engine's (view.ts PHONE_LOOK_MEDIA)", () => {
    expect(map).toContain("@media (max-width: 700px)");
    expect(map).toMatch(/@media \(max-width: 700px\) \{\s*\.map-stage \{[^}]*--map-look-x: var\(--map-phone-x\)[^}]*--map-zoom: var\(--map-phone-zoom\)/);
    expect(map).toMatch(/\.map-stage \{\s*--map-look-x: var\(--map-desk-x\)/);
  });
});
