# Round 7: lighter page change, finished arrival: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task by task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The page change costs about a third of what it does now with the same look, and the page it uncovers is finished, so nothing appears, grows or starts abruptly when the reveal ends.

**Architecture:** The bend's SVG filters are rebuilt around one map picture each, warmed once after load, and guarded by a frame counter that drops the bend. The reveal is held (at most 500 ms) until the arriving page reports ready; pages report through one small registry; the dock's second row stops closing for a change.

**Tech Stack:** Remix 2.17, React 18, TypeScript strict, View Transitions API, SVG filters, vitest, the CDP audit harness (`scripts/audit/cdp.mjs`).

**Spec:** `docs/superpowers/specs/2026-11-15-round7-change-arrival-design.md` (read it whole; it wins over the two earlier round 7 specs where they differ).

## Global Constraints

- Part R56, branch `r7/r56-arrival` (from `r7/r54-change-rings`), lane A's tree, production server on port 5180. Lane B is building in another folder at the same time: `lanes-common.md` in the ledger folder holds for every command (the timing lock, never kill by name, never touch lane B's folder or port 5181).
- Do not touch lane B's files: `app/components/home/blocks/`, `home/layer/`, `home/reading/`, `home/watching/`, `home/use-scene-engines.ts`, `home/use-box-scenes.ts`. `home/hero/` is yours.
- The reveal's length (2500 ms), ease, band, wander, glow and shade do not change. Rulings R58 to R63 stay.
- No em dashes or en dashes in visible copy. No Lenis. No serif in the interface.
- No test or app code reads from `docs/`.
- Audit pictures that show YouTube thumbnails or book covers go only to the git-ignored `docs/redesign/compare/local/`.
- Commits by explicit paths only. Never amend, never force-push.
- yarn runs with `COREPACK_HOME="$HOME/.cache/corepack-alt"`. Browser checks run against the production build.
- The coordinator's scratch tools that produced the spec's numbers are in the session scratchpad under `pc-perf/` (`trace.mjs`, `shift.mjs`, `diff.py`). Port what is useful into `scripts/audit/`; do not import from the scratchpad.

## Review Focus

1. A destination whose pictures never load (host unreachable): the reveal must start at the cap and the late parts fade in; the change must never hang on a hidden new page.
2. A second click, Back or a key press during the hold: the change finishes or is replaced as it would during the reveal, and nothing stays held.
3. A change that starts before the bend's pictures or the warm-up are done: it runs without the bend, as today, and the warm-up never lands inside a change.
4. A window resized between two changes: the vignette and the single map picture still fit; no bend rather than a wrong one.
5. Keyboard focus in the dock's second row when changing between two pages that both have the row: focus stays where it was.

---

## Part R56: `r7/r56-arrival`

### Task 27: The bend with one map picture, half strength on the arriving page, a warm-up and a guard

**Files:**
- Modify: `app/components/page-change/glass-filter.tsx`, `glass-run.ts`, `glass-prepare.ts`, `glass-math.ts` + test, `glass-field.ts` + test (only if the tile plan changes), `glass.css`, `scripts/audit/README.md`
- Create: `app/components/page-change/glass-guard.ts` + test, `scripts/audit/make-glass-cost.mjs` (the trace), `docs/redesign/compare/round7/r56-glass-cost.json`

**Interfaces:**
- Produces in `glass-math.ts`: `export const BEND_NEW = 0.5` (the arriving page's share of the push; the page being left has 1).
- Produces `glass-guard.ts`: `createGuard(opts?: { budgetMs?: number; strikes?: number }): { frame(gapMs: number): "ok" | "drop"; tripped(): boolean }` with defaults 25 ms and 4 frames in a row; pure.
- Produces in `glass-prepare.ts`: `warmGlass(): Promise<void>`, called after `glass-bend-ready`, never while a change runs; marks `glass-warm` with `performance.mark`.
- The session rule: a tab whose guard has tripped in two changes runs later changes without the bend (`sessionStorage` key `ft-glass-bend` = `off`).

- [ ] Tests first: `glass-guard.test.ts` (three slow frames then a fast one is "ok"; four slow in a row is "drop"; after a drop every frame is "drop"; `tripped()`); `glass-math.test.ts` (`BEND_NEW` is 0.5); a test that each filter in `glass-filter.tsx` renders exactly one map picture element besides the vignette.
- [ ] Write `scripts/audit/make-glass-cost.mjs`: launches headless Chrome as `cdp.mjs` does, at a size and pixel ratio from its arguments, loads `/`, waits for the `glass-warm` mark, runs one change to `/work` and back to warm it, then traces one change to `/work` (categories `toplevel`, `benchmark`, `viz`, `gpu`, `cc`, `blink.user_timing`, `__metadata`) between two `performance.mark`s, and prints the busy time of the top-level tasks on `Renderer/Compositor` and `GPU Process/VizCompositorThread` and the counts of `PipelineReporter` states. Run it on the build as it is (R54) first and record the baseline in `r56-glass-cost.json` (expect about 1,000 and 600 ms).
- [ ] Rebuild the filters around one map picture each; `glass-run.ts` writes what the new shape needs each frame and nothing else.
- [ ] The arriving page's pushes are scaled by `BEND_NEW`.
- [ ] `warmGlass()` and the guard, with the session rule. When the guard drops the bend, `data-glass` goes off `<html>` and the pushes go to 0; the edge, glow and shade carry on.
- [ ] Gate, under the timing lock: at 1512 by 982 at 2x and 1920 by 1080 at 1x, `Renderer/Compositor` at most 450 ms and `VizCompositorThread` at most 300 ms inside the change, every frame presented (three runs each, all three must pass). Three cold runs with `page-change.json`: no frame over 34 ms in the first change after a load. Record all numbers in `r56-glass-cost.json`.
- [ ] The sheet at 20, 35, 50, 65 and 80% beside R54.1b's frames, to `docs/redesign/compare/round7/r56-change-beside-r54.jpg` (generated pictures only, no thumbnails; else `compare/local/`). The page being left looks the same.
- [ ] Review Focus 3 and 4: an audit step that starts a change before `glass-warm`, and one after a resize.
- [ ] Commit `R56.1`.

### Task 28: The arriving page is finished before the reveal; the dock keeps its row

**Files:**
- Create: `app/lib/arrival.ts` + test, `scripts/audit/make-arrival.mjs`, `scripts/audit/arrival.json`, `docs/redesign/compare/round7/r56-arrival.json`
- Modify: `app/lib/page-change.ts` + test, `app/lib/use-page-settled.ts`, `app/components/page-change/glass-run.ts`, `glass.css`, `app/components/use-dock-row.ts`, `dock-row.css`, `site-nav.tsx`, `page-transition.css`, `app/components/work/work-page.tsx`, `work/rings.tsx`, `work/gallery/video-wall.tsx`, `work/gallery/use-wall-engine.ts`, `app/components/home/hero/hero.tsx` (and the hero hooks it needs), `app/components/ground/eclipse-ground.tsx`, the experience page's map component, `scripts/audit/README.md`, the audits that assert the old behaviour (`dock-row.json`, `gallery.json`, `rings*.json`, `make-hero-return.mjs`), `docs/redesign/changes-2026-11.md`

**Interfaces:**
- Produces `arrival.ts`:
  - `export const HOLD_MS = 500`, `export const HOLD_REDUCED_MS = 300`, `export const LATE_FADE_MS = 200`.
  - `holdFor(label: string, ready: Promise<unknown>): void`: called by a page that mounts during a change, once per thing the reveal should wait for.
  - `whenArrivalReady(capMs: number): Promise<{ late: string[] }>`: resolves when every promise given to `holdFor` since the change began has settled, or at the cap, with the labels still pending.
  - `resetArrival(): void`: called when a change begins.
  - Pure core for the test: `raceAll(items: Array<{ label: string; ready: Promise<unknown> }>, capMs: number, sleep: (ms: number) => Promise<void>): Promise<{ late: string[] }>`.
- Consumes from `page-change.ts`: the change's `adopt(t)`; the reveal's clock starts when `whenArrivalReady` resolves.
- Changes `use-dock-row.ts`: `open` no longer follows `usePageSettled`; it is true whenever the current page has the row.

- [ ] Tests first: `arrival.test.ts` (`raceAll` with all ready before the cap gives `late: []` and resolves early; one never settling resolves at the cap with its label; a rejected promise counts as settled; `resetArrival` drops the old list); `page-change.test.ts` (a change does not start its reveal before ready or the cap; a `finishChange` during the hold ends it at once and leaves nothing held).
- [ ] Hold the reveal: while the pictures are up and until ready or the cap, nothing of the new page shows and the reveal's clock stands at 0; then it runs as now. Reduced motion uses `HOLD_REDUCED_MS`.
- [ ] Each page reports what the spec's 5.1 lists through `holdFor`: Home (the sharp painting, the caption), Portfolio (ring items mounted in full, pictures decoded: the batching for the reveal goes), the two walls (tiles at their final places with pictures; the plain grid stands in when the engine has not drawn, and the engine takes over after the change with no visible difference and no arrival), My experience (the overview picture), the ground.
- [ ] Anything late at the cap fades in over `LATE_FADE_MS` and moves nothing else.
- [ ] The dock: the second row keeps its state across a change; between two pages with the row nothing moves; from and to Home the dock changes shape once during the reveal. Focus in the row is kept. Remove the 140 ms wait and the after-change opening.
- [ ] After the reveal: resting motion (rings, wall drift, the painting's zoom) eases in from standstill over at least 800 ms.
- [ ] `make-arrival.mjs` and `arrival.json` implement the spec's 5.4 for the six changes at both sizes: F, E and L pictures (to `compare/local/`), the pixel shares, the layout-shift count, the dock's box, the click-to-reveal time warm and with every picture blocked. Results to `r56-arrival.json`. All of 5.4's limits are pass conditions.
- [ ] Review Focus 1, 2 and 5 as audit steps.
- [ ] Re-run under the lock the audits this touches (`page-change.json`, `glass-*.json`, `dock-row.json`, `gallery.json`, `rings.json`, `rings-mode.json`, the hero-return film, `experience.json`) and task 27's cost gate; the 34 ms gate holds with the new page's work moved before the reveal.
- [ ] Part docs for R56 (a Build line in `docs/redesign/feedback-log.md`, rows in `docs/redesign/changes-2026-11.md`), commit `R56.2` for the code and `R56.3` for the docs, push, PR against `r7/r54-change-rings`.

---

## After this part

The join merges `r7/r56-arrival` (not `r7/r54-change-rings`) into `r7/r55-live-boxes`; R55's pull request is opened against `r7/r56-arrival`. Task 20's whole-branch review and task 21's comparison page then cover this part too: the comparison page gets one more row (the page change before and after R56, with the cost numbers).
