import { createHash } from "node:crypto";
import { existsSync, statSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  ECLIPSE,
  FRAME_MS,
  MAX_STEP_S,
  START_CLOCK,
  WORK_PLACEMENTS,
  advanceClock,
  canvasSize,
  engineAllowed,
  frameDue,
  placementFor,
  runWanted,
  stillUrl,
  type Placement,
} from "./eclipse-look";
import { FRAGMENT_SRC } from "./eclipse-shader";

describe("ECLIPSE", () => {
  it("holds the settings chosen in preview 7", () => {
    expect(ECLIPSE).toEqual({ move: 2.2, noise: 1, grain: 0.1 });
  });
  it("draws about 30 frames a second and starts the clock at the preview's 0", () => {
    expect(FRAME_MS).toBe(30);
    expect(MAX_STEP_S).toBe(0.1);
    expect(START_CLOCK).toBe(0);
  });
});

describe("placementFor", () => {
  it("gives each page its placement (spec 5.1)", () => {
    expect(placementFor("/work")).toBe(0);
    expect(placementFor("/work/long-form")).toBe(1);
    expect(placementFor("/work/short-form")).toBe(3);
    expect(placementFor("/")).toBe(2);
  });
  it("ignores a trailing slash", () => {
    expect(placementFor("/work/")).toBe(0);
    expect(placementFor("/work/long-form/")).toBe(1);
  });
  it("gives no ground to the map or an unknown address", () => {
    expect(placementFor("/experience")).toBeNull();
    expect(placementFor("/work/other")).toBeNull();
    expect(placementFor("/timeline")).toBeNull();
  });
  it("keeps the home section's placement out of the work layer's set", () => {
    expect([...WORK_PLACEMENTS]).toEqual([0, 1, 3]);
    expect(WORK_PLACEMENTS).not.toContain(2);
  });
});

describe("advanceClock", () => {
  it("runs at the movement setting times real time", () => {
    expect(advanceClock(0, 30)).toBeCloseTo(0.03 * 2.2, 10);
    expect(advanceClock(5, 100)).toBeCloseTo(5 + 0.1 * 2.2, 10);
  });
  it("never jumps by more than 0.1 s of real time (a pause, a slow frame)", () => {
    expect(advanceClock(0, 5000)).toBeCloseTo(0.1 * 2.2, 10);
  });
  it("never runs backwards", () => {
    expect(advanceClock(3, -50)).toBe(3);
  });
});

describe("frameDue", () => {
  it("waits at least 30 ms between frames", () => {
    expect(frameDue(1029, 1000)).toBe(false);
    expect(frameDue(1030, 1000)).toBe(true);
    expect(frameDue(1033.3, 1000)).toBe(true);
  });
});

describe("canvasSize", () => {
  it("is one pixel per CSS pixel, rounded, at least 1", () => {
    expect(canvasSize(1440, 900)).toEqual([1440, 900]);
    expect(canvasSize(390.4, 844.6)).toEqual([390, 845]);
    expect(canvasSize(0, 0)).toEqual([1, 1]);
  });
});

describe("stillUrl", () => {
  it("names the landscape and the portrait picture of a placement", () => {
    expect(stillUrl(0, false)).toBe("/grounds/eclipse-0.webp");
    expect(stillUrl(3, true)).toBe("/grounds/eclipse-3-tall.webp");
  });
});

describe("runWanted", () => {
  const base = { tab: true, inView: true, covered: false, settled: true };
  it("runs when nothing hides the ground and no change runs", () => {
    expect(runWanted(base)).toBe(true);
  });
  it("stops for a hidden tab, an off screen ground, an open layer and a page change", () => {
    expect(runWanted({ ...base, tab: false })).toBe(false);
    expect(runWanted({ ...base, inView: false })).toBe(false);
    expect(runWanted({ ...base, covered: true })).toBe(false);
    expect(runWanted({ ...base, settled: false })).toBe(false);
  });
});

describe("engineAllowed", () => {
  it("needs WebGL and no request for less", () => {
    expect(engineAllowed({ reduced: false, saveData: false, webgl: true })).toBe(true);
    expect(engineAllowed({ reduced: false, saveData: false, webgl: false })).toBe(false);
    expect(engineAllowed({ reduced: true, saveData: false, webgl: true })).toBe(false);
    expect(engineAllowed({ reduced: false, saveData: true, webgl: true })).toBe(false);
  });
});

describe("the shader", () => {
  // The port of preview 7's fragment shader is exact: the hash is that of the preview's text (2276 characters), taken when
  // the port was made. The literals below say where to look if the hash ever fails; change the shader on purpose
  // only together with `node scripts/audit/make-eclipse-stills.mjs` (the stills are drawn from it) and a new hash.
  const SHA256 = "5292e589f7192a00c860d30bfe4d50d69e3a37fffaf57b36917c3e2ccc4cc5cf";
  it("is the preview's fragment shader, byte for byte", () => {
    expect(FRAGMENT_SRC).toHaveLength(2276);
    expect(createHash("sha256").update(FRAGMENT_SRC).digest("hex")).toBe(SHA256);
  });
  it("keeps the four placements, the three colour stops and the grain", () => {
    // the light and the shoulder of each placement
    expect(FRAGMENT_SRC).toContain("if(uPlace<.5){ c1=vec2(asp*.62,.08); c2=vec2(-asp*.18,-.95); }");
    expect(FRAGMENT_SRC).toContain("else if(uPlace<1.5){ c1=vec2(-asp*.6,.1); c2=vec2(asp*.2,-.95); }");
    expect(FRAGMENT_SRC).toContain("else if(uPlace<2.5){ c1=vec2(0.,-.8); c2=vec2(0.,.62); sIn=.6; sOut=1.2; reach=1.7; }");
    expect(FRAGMENT_SRC).toContain("else { c1=vec2(asp*.45,.8); c2=vec2(-asp*.12,-.62); }");
    // the colour stops
    expect(FRAGMENT_SRC).toContain("col=mix(col,vec3(.20,.068,.022),smoothstep(0.,.34,L));");
    expect(FRAGMENT_SRC).toContain("col=mix(col,vec3(.80,.33,.075),smoothstep(.22,.82,L));");
    expect(FRAGMENT_SRC).toContain("col=mix(col,vec3(.97,.50,.14),smoothstep(.78,1.,L)*.55);");
    // the still coarse grain
    expect(FRAGMENT_SRC).toContain("col+=vec3(1.,.82,.6)*gr*uGrain*(.13+.6*lum);");
  });
});

describe("the stills in public/grounds", () => {
  const placements: Placement[] = [0, 1, 2, 3];
  const KB = 1024;
  for (const placement of placements) {
    for (const portrait of [false, true]) {
      const url = stillUrl(placement, portrait);
      it(`${url} exists and is small`, () => {
        const file = new URL(`../../../public${url}`, import.meta.url);
        expect(existsSync(file)).toBe(true);
        expect(statSync(file).size).toBeLessThan(40 * KB);
      });
    }
  }
});
