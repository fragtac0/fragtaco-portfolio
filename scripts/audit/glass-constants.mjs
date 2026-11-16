// The numbers the audits read from the app's own source, so they follow it (and fail loudly when the source moved): one place for
// every make-*.mjs that needs the page change's length (GLASS.ms in app/components/page-change/glass-math.ts), as the task 22 review asked.
import { readFileSync } from "node:fs";

/** A number read out of a source file (a path relative to the repository root): the first capture group of `re`. */
export function sourceNumber(file, re, what) {
  const m = re.exec(readFileSync(new URL(`../../${file}`, import.meta.url), "utf8"));
  if (!m) throw new Error(`cannot read ${what} from ${file}`);
  return Number(m[1]);
}

/** The page change's length in ms: GLASS.ms. */
export const glassMs = () => sourceNumber("app/components/page-change/glass-math.ts", /\bms:\s*(\d+)/, "GLASS.ms");
