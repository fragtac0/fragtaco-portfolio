import { describe, expect, it } from "vitest";
import { LOADER, loaderSchedule } from "./loader-timeline";

describe("loaderSchedule", () => {
  const s = loaderSchedule("Aditya Bhoir");

  it("has one letterIn and one letterOut per character", () => {
    expect(s.filter((x) => x.step === "letterIn")).toHaveLength(12);
    expect(s.filter((x) => x.step === "letterOut")).toHaveLength(12);
  });
  it("ends with done at 4800", () => {
    const last = s[s.length - 1];
    expect(last.step).toBe("done");
    expect(last.at).toBe(4800);
  });
  it("is sorted by time", () => {
    for (let i = 1; i < s.length; i++) expect(s[i].at).toBeGreaterThanOrEqual(s[i - 1].at);
  });
  it("places steps at the mockup times", () => {
    const at = (step: string, index?: number) =>
      s.find((x) => x.step === step && x.index === index)?.at;
    expect(at("grow")).toBe(60);
    expect(at("letterIn", 0)).toBe(160);
    expect(at("letterIn", 11)).toBe(160 + 11 * 58);
    expect(at("letterOut", 0)).toBe(2000);
    expect(at("letterOut", 11)).toBe(2000 + 11 * 24);
    expect(at("logo")).toBe(2120);
    expect(at("reveal")).toBe(2800);
    expect(at("nameSmall")).toBe(4050);
    expect(at("roles")).toBe(4300);
  });
  it("exposes the constants", () => {
    expect(LOADER.logoFirstLetter).toBe(200);
    expect(LOADER.logoLetterStep).toBe(80);
    expect(LOADER.revealMs).toBe(2000);
  });
});
