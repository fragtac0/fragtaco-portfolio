import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readPrevious, writeFileAtomic } from "./sync-helpers";

let dir = "";
beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "sync-helpers-"));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

const valid = {
  playlistId: "PLx",
  syncedAt: "2026-01-01T00:00:00.000Z",
  items: [
    {
      id: "aaaaaaaaaaa",
      title: "t",
      channel: "c",
      channelUrl: "https://www.youtube.com/@c",
      subscribers: "1K",
      thumb: "sd",
    },
  ],
};

describe("readPrevious", () => {
  it("returns the items of a valid file", () => {
    const file = path.join(dir, "videos.json");
    writeFileSync(file, JSON.stringify(valid));
    const warn = vi.fn();
    expect(readPrevious(file, warn)).toHaveLength(1);
    expect(warn).not.toHaveBeenCalled();
  });

  it("returns [] without a warning when the file is missing", () => {
    const warn = vi.fn();
    expect(readPrevious(path.join(dir, "none.json"), warn)).toEqual([]);
    expect(warn).not.toHaveBeenCalled();
  });

  it("returns [] and warns on invalid JSON", () => {
    const file = path.join(dir, "videos.json");
    writeFileSync(file, "{ not json");
    const warn = vi.fn();
    expect(readPrevious(file, warn)).toEqual([]);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("returns [] and warns when the file fails the schema", () => {
    const file = path.join(dir, "videos.json");
    writeFileSync(file, JSON.stringify({ playlistId: 1 }));
    const warn = vi.fn();
    expect(readPrevious(file, warn)).toEqual([]);
    expect(warn).toHaveBeenCalledTimes(1);
  });
});

describe("writeFileAtomic", () => {
  it("writes the content and leaves no temp file behind", () => {
    const file = path.join(dir, "videos.json");
    writeFileAtomic(file, "hello\n");
    expect(readFileSync(file, "utf8")).toBe("hello\n");
    expect(readdirSync(dir)).toEqual(["videos.json"]);
  });

  it("replaces an existing file", () => {
    const file = path.join(dir, "videos.json");
    writeFileSync(file, "old");
    writeFileAtomic(file, "new");
    expect(readFileSync(file, "utf8")).toBe("new");
  });

  it("removes the temp file and rethrows when the rename fails", () => {
    const file = path.join(dir, "videos.json");
    mkdirSync(file);
    writeFileSync(path.join(file, "keep"), "x");
    expect(() => writeFileAtomic(file, "new")).toThrow();
    expect(existsSync(`${file}.tmp`)).toBe(false);
  });
});
