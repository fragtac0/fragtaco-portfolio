import { describe, expect, it } from "vitest";
import { DEEP_LINKS, INTRO_HEAD_SCRIPT, INTRO_KEY, introMode } from "./intro-session";

const base = { seen: false, hash: "", reducedMotion: false };

describe("introMode", () => {
  it("plays on a first visit", () => {
    expect(introMode(base)).toBe("play");
  });
  it("skips when already seen this session", () => {
    expect(introMode({ ...base, seen: true })).toBe("skip");
  });
  it("skips under reduced motion", () => {
    expect(introMode({ ...base, reducedMotion: true })).toBe("skip");
  });
  it.each(["#about", "#reading", "#watching"])("skips for deep link %s", (hash) => {
    expect(introMode({ ...base, hash })).toBe("skip");
  });
  it("plays for an unrelated hash", () => {
    expect(introMode({ ...base, hash: "#other" })).toBe("play");
  });
  it("exposes the storage key and deep links", () => {
    expect(INTRO_KEY).toBe("ft:intro-seen");
    expect(DEEP_LINKS).toEqual(["#about", "#reading", "#watching"]);
  });
});

function run(opts: {
  stored?: string | null;
  hash?: string;
  reduced?: boolean;
  throwStorage?: boolean;
}) {
  const added: string[] = [];
  const removed: string[] = [];
  const keysRead: string[] = [];
  const timers: { fn: () => void; ms: number }[] = [];
  const win: { __introT0?: number } = {};
  const performance = { now: () => 123.5 };
  const document = {
    documentElement: {
      classList: { add: (c: string) => added.push(c), remove: (c: string) => removed.push(c) },
    },
  };
  const setTimeout = (fn: () => void, ms: number) => timers.push({ fn, ms });
  const sessionStorage = {
    getItem: (k: string) => {
      keysRead.push(k);
      if (opts.throwStorage) throw new Error("blocked");
      return opts.stored ?? null;
    },
  };
  const location = { hash: opts.hash ?? "" };
  const matchMedia = () => ({ matches: !!opts.reduced });
  // The head script is a string that runs with these seven injected globals, so it must be evaluated.
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, @typescript-eslint/no-unsafe-call
  new Function(
    "document",
    "sessionStorage",
    "location",
    "matchMedia",
    "setTimeout",
    "performance",
    "window",
    INTRO_HEAD_SCRIPT,
  )(document, sessionStorage, location, matchMedia, setTimeout, performance, win);
  return { added, removed, keysRead, timers, win };
}

describe("INTRO_HEAD_SCRIPT", () => {
  it("adds the intro class when the loader will play", () => {
    const { added, keysRead } = run({});
    expect(added).toEqual(["intro"]);
    expect(keysRead).toEqual(["ft:intro-seen"]);
  });
  it("does not add it once seen", () => {
    expect(run({ stored: "1" }).added).toEqual([]);
  });
  it("does not add it under reduced motion", () => {
    expect(run({ reduced: true }).added).toEqual([]);
  });
  it.each(["#about", "#reading", "#watching"])("does not add it for %s", (hash) => {
    expect(run({ hash }).added).toEqual([]);
  });
  it("adds it for an unrelated hash", () => {
    expect(run({ hash: "#other" }).added).toEqual(["intro"]);
  });
  it("records the start time for the loader when it will play", () => {
    expect(run({}).win.__introT0).toBe(123.5);
    expect(run({ hash: "#other" }).win.__introT0).toBe(123.5);
    expect(run({ throwStorage: true }).win.__introT0).toBe(123.5);
  });
  it.each([
    ["seen", { stored: "1" }],
    ["reduced motion", { reduced: true }],
    ["a deep link", { hash: "#reading" }],
  ])("records no start time when %s", (_name, opts) => {
    expect(run(opts).win.__introT0).toBeUndefined();
  });
  it("schedules a 15 s failsafe that removes the class again", () => {
    const { timers, removed } = run({});
    expect(timers.map((t) => t.ms)).toEqual([15000]);
    expect(removed).toEqual([]);
    timers[0].fn();
    expect(removed).toEqual(["intro"]);
  });
  it.each([
    ["seen", { stored: "1" }],
    ["reduced motion", { reduced: true }],
    ["a deep link", { hash: "#reading" }],
  ])("schedules no failsafe when %s", (_name, opts) => {
    expect(run(opts).timers).toEqual([]);
  });
  it("adds it when storage throws", () => {
    expect(run({ throwStorage: true }).added).toEqual(["intro"]);
  });
});
