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
  const keysRead: string[] = [];
  const document = {
    documentElement: { classList: { add: (c: string) => added.push(c) } },
  };
  const sessionStorage = {
    getItem: (k: string) => {
      keysRead.push(k);
      if (opts.throwStorage) throw new Error("blocked");
      return opts.stored ?? null;
    },
  };
  const location = { hash: opts.hash ?? "" };
  const matchMedia = () => ({ matches: !!opts.reduced });
  // The head script is a string that runs with these four injected globals, so it must be evaluated.
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, @typescript-eslint/no-unsafe-call
  new Function("document", "sessionStorage", "location", "matchMedia", INTRO_HEAD_SCRIPT)(
    document,
    sessionStorage,
    location,
    matchMedia,
  );
  return { added, keysRead };
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
  it("adds it when storage throws", () => {
    expect(run({ throwStorage: true }).added).toEqual(["intro"]);
  });
});
