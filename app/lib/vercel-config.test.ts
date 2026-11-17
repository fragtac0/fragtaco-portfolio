import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

type Rule = { source: string; headers: Array<{ key: string; value: string }> };
const FILE = fileURLToPath(new URL("../../vercel.json", import.meta.url));
const config = JSON.parse(readFileSync(FILE, "utf8")) as { headers: Rule[] };
const rule = (source: string) => config.headers.find((r) => r.source === source);
const value = (source: string, key: string) => rule(source)?.headers.find((h) => h.key.toLowerCase() === key.toLowerCase())?.value;

describe("vercel.json (the headers of the static files; remix-serve does not apply it, the preview deploy does)", () => {
  it("is only headers, and every rule is a path pattern with header names and values a response can carry", () => {
    expect(Object.keys(config)).toEqual(["headers"]);
    for (const r of config.headers) {
      expect(r.source).toMatch(/^\/(\(\.\*\)|[a-z-]+\/\(\.\*\))$/);
      for (const h of r.headers) {
        expect(h.key).toMatch(/^[A-Za-z][A-Za-z0-9-]*$/);
        expect(h.value).not.toMatch(/[\r\n]/);
      }
    }
  });

  it("never lets a browser sniff a file's type, on every path", () => {
    expect(value("/(.*)", "X-Content-Type-Options")).toBe("nosniff");
  });

  it("keeps the fonts, scripts and pictures of this site for this site", () => {
    for (const dir of ["assets", "paintings", "mars", "grounds", "portraits", "stack"])
      expect(value(`/${dir}/(.*)`, "Cross-Origin-Resource-Policy"), dir).toBe("same-origin");
  });

  it("lets a returning visitor keep the pictures of public/ for a day instead of asking about each one on every visit (Task 35)", () => {
    for (const dir of ["paintings", "mars", "grounds", "portraits", "stack"])
      expect(value(`/${dir}/(.*)`, "Cache-Control"), dir).toBe("public, max-age=86400, stale-while-revalidate=604800");
  });

  it("leaves the hashed files under /assets/ and every other path to Vercel's own caching (a year, immutable, for the hashed files)", () => {
    const withCache = config.headers.filter((r) => r.headers.some((h) => h.key.toLowerCase() === "cache-control")).map((r) => r.source);
    expect(withCache.sort()).toEqual(["/grounds/(.*)", "/mars/(.*)", "/paintings/(.*)", "/portraits/(.*)", "/stack/(.*)"]);
    expect(value("/assets/(.*)", "Cache-Control")).toBeUndefined();
    expect(value("/(.*)", "Cache-Control")).toBeUndefined();
  });

  it("promises no more than an unhashed file can (no `immutable`; a fresh period, then a longer stale one)", () => {
    for (const r of config.headers) {
      const v = r.headers.find((h) => h.key.toLowerCase() === "cache-control")?.value;
      if (!v) continue;
      expect(v).not.toMatch(/immutable/);
      const age = Number(/max-age=(\d+)/.exec(v)?.[1]);
      const stale = Number(/stale-while-revalidate=(\d+)/.exec(v)?.[1]);
      expect(age).toBeGreaterThan(0);
      expect(stale).toBeGreaterThan(age);
    }
  });

  it("sends no header that belongs to documents (the document folder /work/ holds routes, and is not named; the policy needs a nonce made per response, so it is made by the server)", () => {
    const keys = config.headers.flatMap((r) => r.headers.map((h) => h.key.toLowerCase()));
    for (const k of ["content-security-policy", "reporting-endpoints", "permissions-policy", "x-frame-options", "cross-origin-opener-policy"]) expect(keys).not.toContain(k);
  });
});
