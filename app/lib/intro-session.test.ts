import { describe, expect, it } from "vitest";
import { DEEP_LINKS, INTRO_HEAD_SCRIPT, INTRO_KEY, introMode, joinLoader } from "./intro-session";
import { INTRO_LOCK_MS } from "../components/home/hero/loader-timeline";

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
  const present = new Set<string>();
  const document = {
    documentElement: {
      classList: {
        add: (c: string) => {
          added.push(c);
          present.add(c);
        },
        remove: (c: string) => {
          removed.push(c);
          present.delete(c);
        },
        contains: (c: string) => present.has(c),
      },
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
  return { added, removed, keysRead, timers, win, present };
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
  it("schedules a failsafe at 6.3 s (done + the longest reveal wait) that removes the class again", () => {
    const { timers, removed, added } = run({});
    expect(INTRO_LOCK_MS).toBe(6300);
    expect(timers.map((t) => t.ms)).toEqual([INTRO_LOCK_MS]);
    expect(removed).toEqual([]);
    timers[0].fn();
    expect(removed).toEqual(["intro"]);
    expect(added).toEqual(["intro", "intro-timeout"]);
  });
  it("the failsafe does nothing once the hero has already removed the class", () => {
    const { timers, removed, added, present } = run({});
    present.delete("intro"); // the hero's `done` took the class off before the timer fired
    timers[0].fn();
    expect(removed).toEqual([]);
    expect(added).toEqual(["intro"]);
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

describe("joinLoader", () => {
  const base = { mode: "play" as const, t0: 100, now: 2500, locked: true };

  it("joins the timeline in progress when the head script ran and the page is still locked", () => {
    expect(joinLoader(base)).toBe("join");
    expect(joinLoader({ ...base, now: 100 + INTRO_LOCK_MS - 1 })).toBe("join");
  });
  it("skips when the intro is skipped", () => {
    expect(joinLoader({ ...base, mode: "skip" })).toBe("skip");
    expect(joinLoader({ ...base, mode: "skip", t0: undefined, locked: false })).toBe("skip");
  });
  it("is a client navigation when the head script never ran (no start time)", () => {
    expect(joinLoader({ ...base, t0: undefined, locked: false })).toBe("client");
    expect(joinLoader({ ...base, t0: undefined })).toBe("client");
  });
  it("is late once the lock bound has passed: the final state, never a locked replay", () => {
    expect(joinLoader({ ...base, now: 100 + INTRO_LOCK_MS })).toBe("late");
    expect(joinLoader({ ...base, now: 16000 })).toBe("late");
  });
  it("is late when the failsafe already removed the class, whatever the clock says", () => {
    expect(joinLoader({ ...base, locked: false })).toBe("late");
  });
});
