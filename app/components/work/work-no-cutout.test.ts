import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// R56.4 (spec 4 of the round 7 second look): the portfolio page has no cut-out, mask, shade or pointer block round the dock. The tiles pass under its glass.
const ROOT = fileURLToPath(new URL(".", import.meta.url));

function files(dir: string, ext: RegExp): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path, ext) : ext.test(name) && !/\.test\./.test(name) ? [path] : [];
  });
}

/** The rules of a stylesheet, as [selector, body] pairs (nested blocks such as @media are searched inside). */
function rules(css: string): [string, string][] {
  const out: [string, string][] = [];
  const text = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const re = /([^{}]+)\{([^{}]*)\}/g;
  for (let m = re.exec(text); m; m = re.exec(text)) out.push([m[1].trim(), m[2]]);
  return out;
}

describe("the portfolio page has no cut-out round the dock (R56.4)", () => {
  it("has no CSS under app/components/work/ that sets a mask on a ring, a ring group or the rings", () => {
    const css = files(ROOT, /\.css$/);
    expect(css.length).toBeGreaterThan(0);
    for (const file of css) {
      for (const [selector, body] of rules(readFileSync(file, "utf8"))) {
        if (!/work-ring|work-item|work-keep/.test(selector)) continue;
        expect(body, `${file}: ${selector}`).not.toMatch(/(^|[\s;{-])(mask|mask-image|mask-composite|mask-size|-webkit-mask[\w-]*)\s*:/);
      }
    }
  });

  it("has no stylesheet of the keep-out, no block that takes the pointer over the dock, and none of its custom properties", () => {
    const names = files(ROOT, /\.(css|ts|tsx)$/);
    expect(names.some((n) => /keep-out|use-dock-box/.test(n))).toBe(false);
    for (const file of names) {
      const src = readFileSync(file, "utf8");
      expect(src, file).not.toMatch(/--keep-[lrtf]\b|work-keep-out|\.work-keep/);
    }
  });

  it("no longer has keepOutFor, keepOutVars, maskAlpha, nominalDock, KEEP_MARGIN or KEEP_FEATHER in the page's code", () => {
    for (const file of files(ROOT, /\.(ts|tsx)$/)) {
      expect(readFileSync(file, "utf8"), file).not.toMatch(/\b(keepOutFor|keepOutVars|maskAlpha|nominalDock|settleDock|visibleArea|KEEP_MARGIN|KEEP_FEATHER|useDockBox)\b/);
    }
  });

  it("leaves the dock over the rings (a tile under the glass cannot be pressed through it): the dock's layer is above the cards'", () => {
    const tokens = readFileSync(new URL("../../styles/tokens.css", import.meta.url), "utf8");
    const z = (name: string) => Number(new RegExp(`--z-${name}:\\s*(\\d+)`).exec(tokens)?.[1]);
    expect(z("dock")).toBeGreaterThan(z("cards"));
    const nav = readFileSync(new URL("../site-nav.tsx", import.meta.url), "utf8");
    expect(nav).toMatch(/data-dock-glass[\s\S]{0,400}pointer-events-auto/);
    expect(nav).toMatch(/<header\s+className=\{`pointer-events-none fixed[^`]* z-30 /);
  });
});
