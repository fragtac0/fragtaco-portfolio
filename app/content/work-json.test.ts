import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { WorkSchema } from "./schemas";
import { youtubeId } from "./work-media";

const readWorkJson = (): unknown =>
  JSON.parse(readFileSync(path.join(process.cwd(), "content", "site", "work.json"), "utf8"));

const collectStrings = (value: unknown): string[] => {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(collectStrings);
  if (value && typeof value === "object") return Object.values(value).flatMap(collectStrings);
  return [];
};

describe("work.json", () => {
  const work = WorkSchema.parse(readWorkJson());

  it("parses and holds the real long form list and the placeholders", () => {
    expect(work.stack).toHaveLength(8);
    expect(work.longForm).toHaveLength(21);
    expect(work.shortForm).toHaveLength(35);
    expect(work.clients).toHaveLength(10);
  });

  it("numbers the short form placeholders short-01..short-35", () => {
    const ids = Array.from({ length: 35 }, (_, i) => `short-${String(i + 1).padStart(2, "0")}`);

    expect(work.shortForm.map((v) => v.id)).toEqual(ids);
  });

  it("makes every long form item a YouTube video with its own 11-character id, none twice", () => {
    for (const v of work.longForm) {
      expect(v.source).toBe("youtube");
      expect(youtubeId(v.url)).not.toBeNull();
      expect(v.id).toBe(`yt-${youtubeId(v.url)}`);
    }
    expect(new Set(work.longForm.map((v) => v.url)).size).toBe(work.longForm.length);
  });

  it("starts the long form list with the twelve listed videos, in order", () => {
    const first = [
      "9hkHhSmcA9s", "FKc_IY2oQK4", "yTF_aczKJzg", "o321t-rfScA", "-_ovL8w1TMM", "pjMlXwicWMw",
      "dU1E51HJ688", "JIkttg_SUg8", "5_d7HivYULE", "ZDk9QKOLoLA", "67tM7Vb_-HU", "wit1TTy0UWY",
    ];

    expect(work.longForm.slice(0, 12).map((v) => youtubeId(v.url))).toEqual(first);
  });

  it("points every stack icon at a file that exists under public/stack", () => {
    for (const item of work.stack) {
      if (item.icon === undefined) continue;

      expect(existsSync(path.join(process.cwd(), "public", item.icon))).toBe(true);
    }
  });

  it("points every client avatar at a file that exists under public", () => {
    for (const client of work.clients) {
      expect(client.avatar.startsWith("/")).toBe(true);
      expect(existsSync(path.join(process.cwd(), "public", client.avatar))).toBe(true);
    }
  });

  it("keeps the tools in the old tech stack's order", () => {
    expect(work.stack.map((item) => item.mark)).toEqual([
      "Pr", "Ae", "Fc", "Bl", "Ps", "Ai", "Fg", "Lr",
    ]);
  });

  it("has an intro of at most 20 words", () => {
    expect(work.intro.text.trim().split(/\s+/).length).toBeLessThanOrEqual(20);
  });

  it("has no em or en dash in any string", () => {
    const dashes = collectStrings(readWorkJson()).filter((s) => /[\u2013\u2014]/.test(s));

    expect(dashes).toEqual([]);
  });
});
