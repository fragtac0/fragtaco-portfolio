# Round 7, the edge's look (Task 32) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The page change's bend becomes the hero painting's liquid (a noise push with the hero's colour split, at the edge and in a wake behind it, on both pages) at 150% strength, at no extra cost per frame.

**Architecture:** Only the bend changes: what the displacement tiles hold (`glass-texture.ts`, with the noise in a new pure module `glass-noise.ts`), the numbers that scale it (`glass-math.ts`), the tiles' ladder (`glass-field.ts`) and the vignette's reach (`glass-vignette.ts`). The SVG filters, the run loop, the guard, the warm-up, the reveal, the glow and the shade keep their structure.

**Tech Stack:** Remix 2.17 (Vite 6), React 18, TypeScript strict, vitest, the CDP audit harness (`scripts/audit/cdp.mjs`) against the production build.

**Spec:** `docs/superpowers/specs/2026-11-17-round7-edge-look-design.md` (read it first). A spike of this look is on the local branch `preview/r7-fringe` (commit 69a833f, worktree `scratchpad/fringe`): read its diff for how the noise tile was made, but do not copy its variant switch, its panel or its guard change; none of that is product code.

## Global Constraints

- Branch `r7/r58-edge-look`, cut from the top branch of round 7 after Task 21; commits `R58.1`, `R58.2`, ... by explicit paths (never `git add -A` or `commit -a`); never amend or force-push; never push to `main`.
- `GLASS.ms` stays 2250. The front's path, the soft edge, the wander, the glow, the shade, the guard (four frames over 25 ms drop the bend; two trips switch it off for the tab), the warm-up, reduced motion and the plain reveal outside Chromium are not changed.
- Cost limits: glass cost gate compositor busy time at most 450 ms (renderer) and 300 ms (viz); no frame over 34 ms in `page-change.json`, `page-change-hook.json`, `page-change-phone.json`. Timed runs hold the lock (`lanes-common.md`).
- Earlier rulings that bear on this task: R125 (the dropped-frame rule): the cost gate's no-dropped-frame rule leaves out the change's first frame, where a change from home takes its pictures of the live boxes. R113: in R54 early bend tiles every 0.025 failed the frame gate, when the bend cost three times what it costs since R56; if step 7 moves `BEND_EARLY_STEP` to 0.025, the gates of step 8 decide whether it stays.
- This task is part R58 of round 7 (R57 is the whole-branch review and its write-up).
- No file over the file guide's length; no em dashes or en dashes in visible copy; no test or app code reads from `docs/`.
- No YouTube thumbnails or book covers in tracked files: tracked pictures are made with generated tiles; pictures with real thumbnails go to `docs/redesign/compare/local/`.
- yarn runs with `COREPACK_HOME="$HOME/.cache/corepack-alt"`.

## Review Focus

- A window resized (or a phone turned) between two changes: the vignette is remade for the larger push and no strip of the page behind shows along any edge in the next change that has the bend.
- A viewport 1200 px high or more: the push is capped at 96 px; at 320 by 568 it is 49 px. Neither cuts the page off at an edge.
- A change that starts before the warm-up has finished, or while the tiles are being made: it runs with no bend and no half-pushed frame, as today.
- The guard dropping the bend in the middle of a change: the pushes go to 0 and the reveal carries on, as today, with the larger push.
- The moment the map's tile changes, at every swap from the first early tile to the last: no step visible on playback.

Each of these has its check in Task 32's steps below (steps 6 to 8).

---

### Task 32: the hero's liquid in the bend

**Files:**
- Create: `app/components/page-change/glass-noise.ts`, `app/components/page-change/glass-noise.test.ts`
- Modify: `app/components/page-change/glass-math.ts`, `glass-texture.ts`, `glass-field.ts`, `glass-vignette.ts`, `glass-run.ts`, `glass-prepare.ts`, `glass-warm.ts`, `glass-filter.tsx` (comments only), and their tests (`glass-math.test.ts`, `glass-texture.test.ts`, `glass-field.test.ts`, `glass-vignette.test.ts`)
- Modify: the audits and records that hold the bend's numbers (`scripts/audit/glass-constants.mjs` and whatever reads the pushes, the split or the tile count; `docs/redesign/compare/round7/` records made by them)
- Modify: `docs/redesign/README.md` (the page change's lines), `docs/redesign/changes-2026-11.md` (a row for Task 32), `docs/superpowers/specs/2026-11-16-round7-second-look-design.md` (one line under its section 4: superseded for the bend by the 17 November design)

**Interfaces:**
- Consumes: `newShare(x)`, `eachTilePixel(n, front, visit, within)`, `TILES`, `BEND_EARLY`, `TILE_RATIO`, `HAND_OVER` from `glass-field.ts`; `bendAt`, `frontAt`, `pushScale` from `glass-math.ts`.
- Produces:
  - `glass-noise.ts`: `fbm(x: number, y: number): number` (the hero shader's `h`, `n` and `fbm`, the same formulas); `NOISE_SCALE = 2.9`; `NOISE_STEP = 0.02`; `NOISE_NORM = 1.55`; `noiseGradient(u: number, v: number): { x: number; y: number }` (the gradient of `fbm` at `(u, v) * NOISE_SCALE` by forward differences of `NOISE_STEP`, divided by `NOISE_NORM`, clamped to length 1); `WAKE_REACH = 3.7`; `NOISE_S_MAX = 1.3`; `noiseStrength(x: number): number` (`band + 0.6 * wake` as in the spec's 4.2).
  - `glass-texture.ts`: `BEND_RANGE = NOISE_S_MAX` (replaces `BEND_MAX` everywhere: the push is stored over it); `bendTilePixels(n: number, front: number): Uint8ClampedArray<ArrayBuffer>` (same signature; red and green hold `128 + 127 * gradient * noiseStrength(x) / BEND_RANGE`, visited with `within = WAKE_REACH + 0.2`).
  - `glass-math.ts`: `GLASS.bendShare = 0.0855`, `GLASS.bendMaxPx = 96`; `SPLIT = { r: 1.4, g: 1, b: 1 / 1.4 }`; `BEND_OLD = 1`, `BEND_NEW = 1`; `bendProfile` removed (nothing uses the lens any more).
  - `glass-field.ts`: `BEND_TILES = [...BEND_EARLY, ...TILES]` (every tile), `pickBendTile` with the ladder's own ratio.
  - `glass-vignette.ts`: `maxPush(peakPx) = peakPx * SPLIT.r * BEND_RANGE`.

- [ ] **Step 1: Write the failing tests**

`glass-noise.test.ts`:

```ts
it("the gradient is never longer than 1 and uses its range", () => {
  let max = 0;
  for (let v = -1.12; v <= 1.12; v += 0.02) for (let u = -1.12; u <= 1.12; u += 0.02) {
    const g = noiseGradient(u, v);
    max = Math.max(max, Math.hypot(g.x, g.y));
  }
  expect(max).toBeLessThanOrEqual(1 + 1e-9);
  expect(max).toBeGreaterThan(0.9);
});
it("the push is not radial (a lens would score 1)", () => {
  let sum = 0, count = 0;
  for (let v = -1; v <= 1; v += 0.05) for (let u = -1; u <= 1; u += 0.05) {
    const g = noiseGradient(u, v), len = Math.hypot(g.x, g.y), rho = Math.hypot(u, v);
    if (len < 1e-6 || rho < 1e-6) continue;
    sum += Math.abs((g.x * u + g.y * v) / (len * rho));
    count++;
  }
  expect(sum / count).toBeLessThan(0.8);
});
it("the strength is the hero's band and wake", () => {
  expect(noiseStrength(0)).toBeCloseTo(1.3, 6);
  expect(noiseStrength(1)).toBe(0);
  expect(noiseStrength(-1)).toBeCloseTo(0.492, 2);
  expect(noiseStrength(-WAKE_REACH)).toBe(0);
  for (let x = -5; x <= 2; x += 0.01) expect(noiseStrength(x)).toBeLessThanOrEqual(NOISE_S_MAX + 1e-9);
});
```

`glass-math.test.ts` (replace the lens's cases):

```ts
expect(bendPxFor(900)).toBe(77);
expect(bendPxFor(568)).toBe(49);
expect(bendPxFor(1200)).toBe(96);
expect(SPLIT.r).toBeCloseTo(1.4, 9);
expect(SPLIT.b).toBeCloseTo(1 / 1.4, 9);
expect(pushScale(-1, BEND_NEW, 100, SPLIT.r)).toBe(-pushScale(1, BEND_OLD, 100, SPLIT.r));
```

`glass-texture.test.ts`: for `bendTilePixels(128, 0.8)`: every alpha is 255; every pixel more than 1.2 half-bands outside the front is (128, 128); at least one pixel between 1.5 and 3 half-bands inside the front differs from 128 by 8 or more (the wake); the tile is not a lens (over the non-neutral pixels, the mean of `|push . radial| / |push|` is under 0.8).

`glass-field.test.ts`: `BEND_TILES.length === BEND_EARLY.length + TILES.length`; for 200 radii from `HAND_OVER` to `TILE_TOP`, `Math.abs(pickBendTile(r).scale - 1) <= 0.04`.

`glass-vignette.test.ts`: `maxPush(77)` is `77 * 1.4 * 1.3` to 6 places.

- [ ] **Step 2: Run them and see them fail**

Run: `COREPACK_HOME="$HOME/.cache/corepack-alt" yarn vitest run app/components/page-change`
Expected: the new cases fail (no `glass-noise.ts`, old numbers).

- [ ] **Step 3: Implement**

`glass-noise.ts` as in Interfaces (pure, no DOM). `bendTilePixels` reads it. `glass-math.ts`, `glass-field.ts`, `glass-vignette.ts` and `glass-run.ts` take the new numbers and `BEND_RANGE`; `glass-prepare.ts` yields (`calm()`) after every bend tile, as a noise tile costs more to make than a lens tile; `glass-warm.ts` warms every tile of the longer list. Rewrite the header comments of `glass-math.ts`, `glass-texture.ts`, `glass-filter.tsx` and `glass-field.ts` to describe the liquid (they describe the lens today), citing the spec.

- [ ] **Step 4: Unit tests, types, lint, build**

Run: `yarn vitest run`, `yarn typecheck`, `yarn lint`, `yarn build` (with the corepack variable; the build and the full test run respect the lock).
Expected: all green. Update any other test that held the lens's numbers (the half share on the arriving page, 23 or fewer bend tiles, `BEND_MAX`).

- [ ] **Step 5: Commit** (`R58.1: the bend is the hero's liquid at 150% ...`)

- [ ] **Step 6: The look, in pictures**

Serve the build on port 5180. With the harness, capture home to the portfolio and the portfolio to My experience at 30%, 50% and 70% of the change, at 1440 by 900, 390 by 844 and 320 by 568 (generated tiles for the tracked sheet `docs/redesign/compare/round7/r58-edge-look-sheet.jpg`; the same with real thumbnails into `compare/local/`). Look at them: a liquid warp with a red and blue fringe at the edge and a wake behind it; no strip of the page behind along any edge; no hard line where the wake ends. Then resize the window between two changes (1440 by 900 to 1100 by 700) and capture the second change: the same holds.

- [ ] **Step 7: No step at a tile swap**

Film home to the portfolio at 60 fps at 1440 by 900. For each frame in which the bend's tile changes (read the swap frames from the run loop through the audit's own trace hook, or add one behind the existing audit flag), compare the mean absolute difference to the frame before with the average of the two neighbouring frame-to-frame differences. Target: at most 1.5 times at every swap. If the early tiles (fronts under `HAND_OVER`) exceed it, set `BEND_EARLY_STEP` to 0.025 and run again. Record the numbers in `docs/redesign/compare/round7/r58-tile-swaps.json`. If the target is still missed, report the numbers and a film strip of the worst swap: the controller rules by eye.

- [ ] **Step 8: The gates, under the lock**

Run `page-change.json`, `page-change-hook.json`, `page-change-phone.json` (no frame over 34 ms), the glass audits (`glass-sim`, `glass-coverage`, `glass-finish`, `glass-interrupt`, `glass-warm`, `glass-phone`), `make-arrival.mjs` and `arrival.json`, and the glass cost gate (`make-glass-cost.mjs`, three runs at each of its sizes; the record goes to `docs/redesign/compare/round7/r58-glass-cost.json` with the load average of each run). Expected: every gate as before Task 32; the compositor numbers within the limits. A gate that fails is run once more under the lock before it counts. A change that starts before the warm-up and a guard drop in mid-change are covered by `glass-warm.json` and the guard's tests: confirm they still pass with the new numbers and say so in the report.

- [ ] **Step 9: Docs and commit** (`R58.2: results and docs ...`): the README lines, the changes row, the superseded line in the second-look spec, the records of steps 6 to 8.
