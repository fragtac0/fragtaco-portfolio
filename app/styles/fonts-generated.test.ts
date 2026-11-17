import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("../../", import.meta.url));

describe("the generated font files", () => {
  it("are what scripts/fonts/build-font-css.mjs makes now (a hand edit or a package bump without `yarn fonts` fails here)", () => {
    // exits 1, and so throws, when a committed stylesheet or public/font-licences.txt differs from the generator's output
    expect(() => execFileSync(process.execPath, ["scripts/fonts/build-font-css.mjs", "--check"], { cwd: root, stdio: "pipe" })).not.toThrow();
  });
});

// The built site (after `yarn build`; skipped, and said so, when there is no build yet): not one address of another origin in a font's way.
const client = join(root, "build/client/assets");
const server = join(root, "build/server");
const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));

describe.skipIf(!existsSync(client) || !existsSync(server))("the built site's fonts (needs `yarn build` first)", () => {
  const built = () => walk(join(root, "build")).filter((f) => /\.(css|js|mjs|html)$/.test(f));

  it("no stylesheet, script or page names a Google font origin", () => {
    for (const file of built()) expect(readFileSync(file, "utf8"), file).not.toMatch(/fonts\.googleapis\.com|fonts\.gstatic\.com/);
  });

  it("the font stylesheets ask for no file at another origin, and every font file is a hashed file, never a data: address", () => {
    const sheets = readdirSync(client).filter((f) => /^fonts-(interface|spine)-.*\.css$/.test(f));
    expect(sheets.length).toBe(2);
    for (const sheet of sheets) {
      const text = readFileSync(join(client, sheet), "utf8");
      expect(text, sheet).not.toMatch(/https?:\/\//);
      expect(text, sheet).not.toMatch(/data:/);
      const urls = [...text.matchAll(/url\(([^)]+)\)/g)].map((m) => m[1].replace(/["']/g, ""));
      expect(urls.length).toBeGreaterThan(20);
      for (const url of urls) {
        expect(url, sheet).toMatch(/^\/assets\/[^/]+-[\w-]{8}\.woff2$/);
        expect(existsSync(join(client, url.replace("/assets/", ""))), url).toBe(true);
      }
    }
  });
});
