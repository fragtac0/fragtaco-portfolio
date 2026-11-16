// The stylesheets of the entrance and of the words beside the mountain (round 7 second look specs 7 and 8): they read the numbers entrance.ts and
// words-layout.ts write, they hide a word before its time, they move nothing but opacity and transform, and they have a reduced-motion form.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BEAD_FROM, ENTRANCE, ENTRANCE_FAILSAFE_MS, entranceVars } from "./entrance";
import { WIDE_MEDIA } from "./words-layout";
import { DY_VAR, TITLE_VAR } from "./use-words-layout";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const entrance = read("./entrance.css");
const words = read("./experience.css");
const cards = read("./cards.css");

describe("entrance.css", () => {
  it("reads only variables that entrance.ts writes (or the letter's and line's own places, --i and --k)", () => {
    const used = new Set([...entrance.matchAll(/var\((--[A-Za-z-]+)/g)].map((m) => m[1]));
    const written = new Set([...Object.keys(entranceVars(2250, 0)), "--i", "--k"]);

    expect([...used].filter((v) => !written.has(v))).toEqual([]);
    expect(used.size).toBeGreaterThan(10);
  });

  it("writes every variable it needs: the delays of the title, the description, the label and the lines", () => {
    for (const name of ["--ent-title", "--ent-desc", "--ent-label", "--ent-lines", "--ent-lag", "--ent-title-gap", "--ent-label-gap", "--ent-line-gap"]) expect(entrance).toContain(`var(${name})`);
  });

  it("does not show a word before its time: opacity 0 while waiting", () => {
    expect(entrance).toMatch(/\[data-entrance="wait"\] :is\(\.map-letter, \.map-rise\) \{\s*opacity: 0;/);
  });

  it("shows the words by itself after the failsafe if the script never plays the entrance, in the time entrance.ts says, with its own keyframes (opacity 0 to 1)", () => {
    const waiting = entrance.slice(entrance.indexOf('[data-entrance="wait"]'), entrance.indexOf("/* the title, letter by letter"));

    expect(waiting).toContain(`map-failsafe-in var(--ent-reduced-ms, 200ms) linear ${ENTRANCE_FAILSAFE_MS / 1000}s both`);
    expect(entrance).toMatch(/@keyframes map-failsafe-in \{\s*to \{\s*opacity: 1;/);
    expect(ENTRANCE_FAILSAFE_MS).toBeGreaterThan(5000); // past the longest a working page waits (the hold, the reveal's 0.7 T, the picture's wait)
  });

  it("moves only opacity and transform", () => {
    const keyframes = [...entrance.matchAll(/@keyframes [\w-]+ \{([\s\S]*?)\n\}/g)].map((m) => m[1]);
    const props = new Set(keyframes.flatMap((k) => [...k.matchAll(/^\s+([a-z-]+):/gm)].map((m) => m[1])));

    expect(keyframes.length).toBe(4);
    expect([...props].sort()).toEqual(["opacity", "transform"]);
    expect(entrance).not.toMatch(/\b(top|left|width|height|margin|font-size)\s*:/);
  });

  it("has the reduced-motion form: no letters, one fade for everything after the reveal", () => {
    const reduced = entrance.slice(entrance.indexOf("@media (prefers-reduced-motion: reduce)"));

    expect(reduced).toContain("map-fade-in var(--ent-reduced-ms)");
    expect(reduced).toContain("animation-delay: calc(var(--ent-T) - var(--ent-lag))");
    expect(reduced).not.toContain("map-letter-in");
  });
});

describe("the words beside the mountain (experience.css)", () => {
  it("is for the screens words-layout.ts calls wide, in the same words", () => {
    expect(WIDE_MEDIA).toBe("(min-width: 900px) and (min-aspect-ratio: 1001/1000)");
    expect(words).toContain(`@media ${WIDE_MEDIA}`);
  });

  it("puts both blocks on the middle row (the summit's), the mountain's flush right at the gutter, and reads the two numbers the page writes", () => {
    const wide = words.slice(words.indexOf(`@media ${WIDE_MEDIA}`), words.indexOf("@media (max-width: 699.98px)"));

    expect(wide).toMatch(/\.map-heading \{\s*top: 50%;/);
    expect(wide).toMatch(/\.map-caption \{[^}]*right: var\(--map-gutter\);/);
    expect(wide).toContain(`var(${DY_VAR}`);
    expect(wide).toMatch(/max-width: 32ch;/);
    expect(wide).toContain('[data-words="old"]');
    expect(wide).toContain('[data-engine="off"]');
    expect(TITLE_VAR).toBe("--map-title-size"); // the token's own name: the page overrides it on the page element
  });
});

describe("the beads' entrance (cards.css)", () => {
  it("hides a bead until its time, shows it when it has the focus, and grows it from 0.6 over 260 ms", () => {
    expect(cards).toMatch(/\.map-pin\[data-wait\] \{\s*opacity: 0;/);
    expect(cards).toMatch(/\.map-pin\[data-wait\]:focus \{\s*opacity: 1;/);
    expect(cards).toContain(`scale(calc(var(--bs, 1) * ${BEAD_FROM}))`);
    expect(cards).toMatch(new RegExp(`\\.map-pin\\[data-enter\\] \\{\\s*transition-duration: ${ENTRANCE.beadMs}ms;`));
    expect(cards).toContain(`transform ${ENTRANCE.beadMs}ms ease-out`);
  });

  it("has no transition for a bead shown at once, and 200 ms with no growth under reduced motion", () => {
    expect(cards).toMatch(/\[data-instant\][^{]*\{\s*transition: none;/);
    expect(cards.slice(cards.indexOf("@media (prefers-reduced-motion: reduce)"))).toMatch(new RegExp(`\\.map-pin\\[data-enter\\] \\{\\s*transition-duration: ${ENTRANCE.reducedMs}ms;`));
  });
});
