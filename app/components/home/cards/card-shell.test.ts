import { describe, expect, it } from "vitest";
import { cardClass, modeOf, twoLines } from "./card-shell";

describe("modeOf", () => {
  it("is hidden for both sides while the cards have not risen", () => {
    expect(modeOf("hidden", "left")).toBe("hidden");
    expect(modeOf("hidden", "right")).toBe("hidden");
  });
  it("shows both cards at rest while the hero is up", () => {
    expect(modeOf("hero", "left")).toBe("rest");
    expect(modeOf("hero", "right")).toBe("rest");
  });
  it("opens the card that is current and hides the other", () => {
    expect(modeOf("left", "left")).toBe("open");
    expect(modeOf("left", "right")).toBe("hidden");
    expect(modeOf("right", "right")).toBe("open");
    expect(modeOf("right", "left")).toBe("hidden");
  });
});

describe("cardClass", () => {
  it("is the card and its side at rest", () => {
    expect(cardClass("left", { mode: "rest", hot: false })).toBe("card left");
  });
  it("adds open when open, and hot only for a card at rest", () => {
    expect(cardClass("right", { mode: "open", hot: false })).toBe("card right open");
    expect(cardClass("right", { mode: "rest", hot: true })).toBe("card right hot");
    expect(cardClass("right", { mode: "open", hot: true })).toBe("card right open");
    expect(cardClass("left", { mode: "hidden", hot: true })).toBe("card left");
  });
});

describe("twoLines", () => {
  it("splits the first word from the rest", () => {
    expect(twoLines("the cut")).toEqual(["the", "cut"]);
    expect(twoLines("Ohshin Bhat Kumar")).toEqual(["Ohshin", "Bhat Kumar"]);
  });
  it("trims and collapses spaces, and copes with one word or none", () => {
    expect(twoLines("  the   cut ")).toEqual(["the", "cut"]);
    expect(twoLines("credits")).toEqual(["credits", ""]);
    expect(twoLines("")).toEqual(["", ""]);
  });
});
