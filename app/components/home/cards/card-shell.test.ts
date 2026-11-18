import { describe, expect, it } from "vitest";
import { cardClass, modeOf, portraitPhase, twoLines } from "./card-shell";

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

describe("portraitPhase", () => {
  it("waits while the loader runs and the card is not being reached", () => {
    expect(portraitPhase("hidden", false, false)).toBe("wait");
  });
  it("takes an idle moment once the cards are up", () => {
    expect(portraitPhase("hero", false, false)).toBe("idle");
    expect(portraitPhase("left", false, false)).toBe("idle");
  });
  it("loads at once when the card is open or the pointer is over it", () => {
    expect(portraitPhase("right", false, false)).toBe("now");
    expect(portraitPhase("hero", true, false)).toBe("now");
  });
  it("is done once loaded, whatever follows", () => {
    expect(portraitPhase("hidden", false, true)).toBe("have");
    expect(portraitPhase("right", true, true)).toBe("have");
  });
});
