import { describe, expect, it } from "vitest";
import { heroNav, type NavInput, type NavState } from "./hero-nav";

const ok = { heroVisible: true, layerOpen: false };
const key = (k: "ArrowLeft" | "ArrowRight" | "Escape"): NavInput => ({ kind: "key", key: k });

describe("heroNav keys", () => {
  it("ArrowRight: left -> hero -> right -> right", () => {
    expect(heroNav("left", key("ArrowRight"), ok)).toBe("hero");
    expect(heroNav("hero", key("ArrowRight"), ok)).toBe("right");
    expect(heroNav("right", key("ArrowRight"), ok)).toBe("right");
  });
  it("ArrowLeft: right -> hero -> left -> left", () => {
    expect(heroNav("right", key("ArrowLeft"), ok)).toBe("hero");
    expect(heroNav("hero", key("ArrowLeft"), ok)).toBe("left");
    expect(heroNav("left", key("ArrowLeft"), ok)).toBe("left");
  });
  it("Escape goes to hero from either side and is ignored at hero", () => {
    expect(heroNav("right", key("Escape"), ok)).toBe("hero");
    expect(heroNav("left", key("Escape"), ok)).toBe("hero");
    expect(heroNav("hero", key("Escape"), ok)).toBe("hero");
  });
});

describe("heroNav swipes", () => {
  it("swipe left acts like ArrowRight, swipe right like ArrowLeft", () => {
    expect(heroNav("hero", { kind: "swipe", dir: "left" }, ok)).toBe("right");
    expect(heroNav("left", { kind: "swipe", dir: "left" }, ok)).toBe("hero");
    expect(heroNav("hero", { kind: "swipe", dir: "right" }, ok)).toBe("left");
    expect(heroNav("right", { kind: "swipe", dir: "right" }, ok)).toBe("hero");
  });
});

describe("heroNav gating", () => {
  const inputs: NavInput[] = [key("ArrowLeft"), key("ArrowRight"), key("Escape"), { kind: "swipe", dir: "left" }, { kind: "swipe", dir: "right" }];
  const states: NavState[] = ["hero", "left", "right"];
  it("ignores keys and swipes while a layer is open", () => {
    for (const s of states) for (const i of inputs) expect(heroNav(s, i, { heroVisible: true, layerOpen: true })).toBe(s);
  });
  it("ignores keys and swipes when the hero is not visible", () => {
    for (const s of states) for (const i of inputs) expect(heroNav(s, i, { heroVisible: false, layerOpen: false })).toBe(s);
  });
  it("does not gate go, toggle, show or hide", () => {
    const shut = { heroVisible: false, layerOpen: true };
    expect(heroNav("hero", { kind: "go", to: "left" }, shut)).toBe("left");
    expect(heroNav("hero", { kind: "toggle", side: "right" }, shut)).toBe("right");
    expect(heroNav("hidden", { kind: "show" }, shut)).toBe("hero");
    expect(heroNav("right", { kind: "hide" }, shut)).toBe("hidden");
  });
});

describe("heroNav hidden", () => {
  it("ignores everything except show", () => {
    const ignored: NavInput[] = [
      key("ArrowLeft"), key("ArrowRight"), key("Escape"),
      { kind: "swipe", dir: "left" }, { kind: "swipe", dir: "right" },
      { kind: "go", to: "hero" }, { kind: "go", to: "left" }, { kind: "go", to: "right" },
      { kind: "toggle", side: "left" }, { kind: "toggle", side: "right" },
      { kind: "hide" },
    ];
    for (const i of ignored) expect(heroNav("hidden", i, ok)).toBe("hidden");
  });
  it("show moves hidden to hero and leaves other states alone", () => {
    expect(heroNav("hidden", { kind: "show" }, ok)).toBe("hero");
    expect(heroNav("right", { kind: "show" }, ok)).toBe("right");
  });
  it("hide moves anything to hidden", () => {
    for (const s of ["hero", "left", "right", "hidden"] as NavState[]) expect(heroNav(s, { kind: "hide" }, ok)).toBe("hidden");
  });
});

describe("heroNav go and toggle", () => {
  it("go sets the state directly", () => {
    expect(heroNav("left", { kind: "go", to: "right" }, ok)).toBe("right");
    expect(heroNav("right", { kind: "go", to: "hero" }, ok)).toBe("hero");
  });
  it("toggle opens a side from hero, closes it when open, switches from the other side", () => {
    expect(heroNav("hero", { kind: "toggle", side: "right" }, ok)).toBe("right");
    expect(heroNav("right", { kind: "toggle", side: "right" }, ok)).toBe("hero");
    expect(heroNav("left", { kind: "toggle", side: "right" }, ok)).toBe("right");
    expect(heroNav("hero", { kind: "toggle", side: "left" }, ok)).toBe("left");
    expect(heroNav("left", { kind: "toggle", side: "left" }, ok)).toBe("hero");
  });
});
