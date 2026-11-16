import { describe, expect, it } from "vitest";
import { BEND_KEY, createGuard, createSession } from "./glass-guard";

describe("createGuard", () => {
  it("defaults to a 25 ms budget and four frames in a row", () => {
    const g = createGuard();
    expect([30, 30, 30].map((x) => g.frame(x))).toEqual(["ok", "ok", "ok"]);
    expect(g.tripped()).toBe(false);
    expect(g.frame(30)).toBe("drop");
    expect(g.tripped()).toBe(true);
  });

  it("three slow frames then a fast one is ok, and the count starts again", () => {
    const g = createGuard();
    for (const gap of [40, 40, 40, 16, 40, 40, 40, 16]) expect(g.frame(gap)).toBe("ok");
    expect(g.tripped()).toBe(false);
  });

  it("four slow frames in a row drop the bend", () => {
    const g = createGuard();
    expect([26, 50, 80, 26].map((x) => g.frame(x))).toEqual(["ok", "ok", "ok", "drop"]);
  });

  it("a frame of exactly the budget is not slow", () => {
    const g = createGuard();
    for (let i = 0; i < 10; i++) expect(g.frame(25)).toBe("ok");
  });

  it("after a drop every frame is a drop, fast or not", () => {
    const g = createGuard({ budgetMs: 25, strikes: 2 });
    g.frame(40);
    expect(g.frame(40)).toBe("drop");
    expect(g.frame(8)).toBe("drop");
    expect(g.frame(16)).toBe("drop");
    expect(g.tripped()).toBe(true);
  });

  it("takes its budget and strikes from the options", () => {
    const g = createGuard({ budgetMs: 10, strikes: 3 });
    expect([12, 12, 12].map((x) => g.frame(x))).toEqual(["ok", "ok", "drop"]);
  });
});

const fakeStorage = (initial: Record<string, string> = {}) => {
  const data = { ...initial };
  return {
    data,
    getItem: (k: string) => data[k] ?? null,
    setItem: (k: string, v: string) => void (data[k] = v),
    removeItem: (k: string) => void delete data[k],
  };
};

describe("createSession", () => {
  it("a tab whose guard tripped in one change keeps the bend", () => {
    const store = fakeStorage();
    const s = createSession(store);
    s.trip();
    expect(s.off()).toBe(false);
    expect(store.data[BEND_KEY]).toBeUndefined();
  });

  it("two changes that tripped switch the bend off for the tab", () => {
    const store = fakeStorage();
    const s = createSession(store);
    s.trip();
    s.trip();
    expect(s.off()).toBe(true);
    expect(store.data[BEND_KEY]).toBe("off");
  });

  it("reads an earlier `off`, and a reload of the tab clears it", () => {
    expect(createSession(fakeStorage({ [BEND_KEY]: "off" })).off()).toBe(true);
    const store = fakeStorage({ [BEND_KEY]: "off" });
    expect(createSession(store, { reloaded: true }).off()).toBe(false);
    expect(store.data[BEND_KEY]).toBeUndefined();
  });

  it("works without storage (a private window, blocked site data)", () => {
    const s = createSession(null);
    s.trip();
    s.trip();
    expect(s.off()).toBe(true);
    const throwing = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    };
    const t = createSession(throwing, { reloaded: true });
    expect(t.off()).toBe(false);
    t.trip();
    t.trip();
    expect(t.off()).toBe(true);
  });
});
