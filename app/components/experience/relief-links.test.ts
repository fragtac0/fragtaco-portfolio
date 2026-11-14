// The map's pictures as the page asks for them (Ruling R105): the route preloads the picture for the screen only (a phone's smaller one by the
// same media query as the picture's own <source>, the large one on the other side of it), and never the heights, which are read at idle.
import { describe, expect, it } from "vitest";
import { links } from "../../routes/experience";
import { HEIGHTS_IDLE_MS, HEIGHTS_SRC, PHONE_MEDIA, RELIEF_PHONE_SRC, RELIEF_SRC, ROOMY_MEDIA } from "./experience-map";

type Link = { rel: string; href: string; media?: string };
const preloads = (links as unknown as () => Link[])();

describe("the route's preloads", () => {
  it("are the picture for a phone (under its media query) and the large one (under the other side of it), and nothing else", () => {
    expect(preloads).toHaveLength(2);
    expect(preloads.find((l) => l.href === RELIEF_PHONE_SRC)?.media).toBe(PHONE_MEDIA);
    expect(preloads.find((l) => l.href === RELIEF_SRC)?.media).toBe(ROOMY_MEDIA);
    expect(preloads.every((l) => l.rel === "preload")).toBe(true);
  });

  it("do not preload the heights (they are fetched at idle once the engine is up, within a second at most)", () => {
    expect(preloads.some((l) => l.href === HEIGHTS_SRC)).toBe(false);
    expect(HEIGHTS_IDLE_MS).toBeLessThanOrEqual(1000);
  });
});
