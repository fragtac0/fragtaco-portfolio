import { describe, expect, it } from "vitest";
import { LOADER, loaderSchedule, revealPlan } from "./loader-timeline";

describe("loaderSchedule", () => {
  const s = loaderSchedule("Aditya Bhoir");

  it("leaves the name to CSS: no grow, letterIn or letterOut steps", () => {
    for (const step of ["grow", "letterIn", "letterOut"]) {
      expect(s.filter((x) => x.step === step)).toHaveLength(0);
    }
    expect(s.map((x) => x.step)).toEqual(["logo", "reveal", "nameSmall", "roles", "done"]);
  });
  it("ends with done at 4800", () => {
    const last = s[s.length - 1];
    expect(last.step).toBe("done");
    expect(last.at).toBe(4800);
  });
  it("waits at most 1.5 s for a painting", () => {
    expect(LOADER.revealMaxWait).toBe(1500);
    expect("firstPaintingMaxWait" in LOADER).toBe(false);
  });
  it("is sorted by time", () => {
    for (let i = 1; i < s.length; i++) expect(s[i].at).toBeGreaterThanOrEqual(s[i - 1].at);
  });
  it("places steps at the mockup times", () => {
    const at = (step: string, index?: number) =>
      s.find((x) => x.step === step && x.index === index)?.at;
    expect(at("logo")).toBe(2120);
    expect(at("reveal")).toBe(2800);
    expect(at("nameSmall")).toBe(4050);
    expect(at("roles")).toBe(4300);
  });
  it("exposes the constants", () => {
    expect(LOADER.grow).toBe(60);
    expect(LOADER.lettersIn).toBe(160);
    expect(LOADER.letterStep).toBe(58);
    expect(LOADER.lettersOut).toBe(1750);
    expect(LOADER.letterOutStep).toBe(24);
    expect(LOADER.logoFirstLetter).toBe(200);
    expect(LOADER.logoLetterStep).toBe(80);
    expect(LOADER.revealMs).toBe(2000);
  });
});

describe("revealPlan", () => {
  const revealAt = 2800;

  it("reveals the sharp painting at the cue when it is ready by then", () => {
    expect(revealPlan({ paintingReadyAt: 2000, now: 2800, revealAt })).toEqual({
      action: "sharp",
      at: 2800,
    });
  });
  it("reveals as soon as the cue arrives, even if the painting was ready long before", () => {
    expect(revealPlan({ paintingReadyAt: 0, now: 2800, revealAt })).toEqual({
      action: "sharp",
      at: 2800,
    });
  });
  it("reveals the sharp painting the moment it is ready, up to 1.5 s after the cue", () => {
    expect(revealPlan({ paintingReadyAt: 3500, now: 3500, revealAt })).toEqual({
      action: "sharp",
      at: 3500,
    });
    expect(revealPlan({ paintingReadyAt: 3500, now: 2800, revealAt })).toEqual({
      action: "sharp",
      at: 3500,
    });
    expect(revealPlan({ paintingReadyAt: 4300, now: 4300, revealAt })).toEqual({
      action: "sharp",
      at: 4300,
    });
  });
  it("falls back to the placeholder 1.5 s after the cue when nothing arrived", () => {
    expect(revealPlan({ paintingReadyAt: null, now: 4300, revealAt })).toEqual({
      action: "placeholder",
      at: 4300,
    });
  });
  it("waits until that cut-off while the painting may still come", () => {
    expect(revealPlan({ paintingReadyAt: null, now: 3000, revealAt })).toEqual({
      action: "wait",
      at: 4300,
    });
    expect(revealPlan({ paintingReadyAt: null, now: 2800, revealAt })).toEqual({
      action: "wait",
      at: 4300,
    });
  });
  it("uses the placeholder when the painting is ready only after the cut-off", () => {
    expect(revealPlan({ paintingReadyAt: 4301, now: 4301, revealAt })).toEqual({
      action: "placeholder",
      at: 4301,
    });
  });
  it("never goes back in time when the script joins late", () => {
    expect(revealPlan({ paintingReadyAt: null, now: 7000, revealAt })).toEqual({
      action: "placeholder",
      at: 7000,
    });
  });
  it("the loader is at most 1.5 s longer than nominal", () => {
    const worst = revealPlan({ paintingReadyAt: null, now: revealAt + LOADER.revealMaxWait, revealAt });
    expect(worst.at - revealAt + LOADER.done).toBe(4800 + 1500);
  });
});
