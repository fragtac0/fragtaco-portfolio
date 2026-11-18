import { describe, expect, it } from "vitest";
import { nextHistoryState } from "./use-layer-history";

describe("nextHistoryState", () => {
  it("keeps Remix's key, idx and usr, sets xp and bumps idx", () => {
    expect(nextHistoryState({ key: "k", idx: 2, usr: null }, "reading")).toEqual({
      key: "k",
      idx: 3,
      usr: null,
      xp: "reading",
    });
  });

  it("starts from idx 1 when there is no state", () => {
    expect(nextHistoryState(null, "reading")).toEqual({ xp: "reading", idx: 1 });
  });

  it("treats a non-object state as no state", () => {
    expect(nextHistoryState("x", "watching")).toEqual({ xp: "watching", idx: 1 });
  });

  it("does not mutate the state it was given", () => {
    const current = { key: "k", idx: 0 };
    nextHistoryState(current, "watching");
    expect(current).toEqual({ key: "k", idx: 0 });
  });
});
