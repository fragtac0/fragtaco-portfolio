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

  it("sends no header that belongs to documents (the document folder /work/ holds routes, and is not named; the policy needs a nonce made per response, so it is made by the server)", () => {
    const keys = config.headers.flatMap((r) => r.headers.map((h) => h.key.toLowerCase()));
    for (const k of ["content-security-policy", "reporting-endpoints", "permissions-policy", "x-frame-options", "cross-origin-opener-policy"]) expect(keys).not.toContain(k);
  });
});
