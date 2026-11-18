# Round 7 follow-ups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the shelf and wall open from the home page as one continuous move, bring the page change to the tenth preview's look at 2.5 s, and fill the portfolio page.

**Architecture:** The page change keeps its View Transitions build (mask pictures, a line picture, an SVG bend in Chromium) and changes its numbers and pictures. The portfolio page changes `ring-math.ts`'s tile sizes and re-solves the rings. The home boxes stop using a poster: each scene engine learns to draw into a frame smaller than the window, the home box hosts that drawing, and the layer animates the frame from the box to the window.

**Tech Stack:** as round 7 (Remix, React 18, TypeScript strict, three.js 0.169, View Transitions, vitest, the CDP audit scripts).

**Spec:** `docs/superpowers/specs/2026-11-14-round7-followups-design.md` (adds to `2026-11-13-round7-design.md`). The looks are in `docs/redesign/round7-preview-10/` (`change.js`, `open.js`); no test and no app code may read from `docs/`.

## Global Constraints

Everything in `2026-11-13-round7.md`'s Global Constraints, plus:

- Page change length 2500 ms; opening and closing a home box 1000 ms.
- `GLASS.band = 0.15`, `WARP = 0.12`, bend peak 5.7% of the viewport's height capped at 64 px, colour split 1.29 / 1 / 0.71, `UNCOVERED_AT = 0.95`.
- Portfolio thumbnails cover 30% to 40% of a 1440 by 900 screen, averaged over one turn.
- A scene in a home box draws only while its box is on screen and the tab is visible: the wall at most 30 times a second, the shelf on demand.
- The 34 ms frame gate (R33, R67, R72) holds for the page change and for scrolling the home page past both boxes.
- No poster, screenshot or copy of the block stands in for a scene.
- Commits by explicit paths only.

## Review Focus

1. A click on a home box in the first second after the page loads, before the scene is ready: the box waits up to 400 ms, then opens to the plain grid with the same move; it never opens empty and never ignores the click.
2. Resizing or rotating the window while a box is open, then closing: the frame returns to where the box is now, not where it was.
3. Close pressed half way through an opening (and a click half way through a closing): the move turns round from where it is, with no jump of the scene.
4. The home page scrolled so a box is half off screen when clicked: the frame grows from the visible place of the box; closing returns there.
5. A browser tab left in the background for a minute with a box on screen, then brought back: the box's scene resumes without a burst of frames and without a lost context; if the context was lost, the flat preview is in the box.
6. The page change started twice in quick succession (R59) and on a phone: still one reveal, still inside the frame gate with the three-colour bend, or the recorded two-pass fallback.

## How this plan is executed

As `2026-11-13-round7.md`: one fresh Sonnet implementer (effort high) per task, a fresh Opus review (effort high) per task, fix rounds of fresh agents, rulings in the ledger, a PR per part stacked on the previous part. These parts run after task 19 and before tasks 20 and 21.

---

## Part R54: the page change and the portfolio page (`r7/r54-change-rings`)

### Task 22: The page change at 2.5 s with a wide, refracted edge

**Files:**
- Modify: `app/components/page-change/glass-math.ts` + test, `glass-edge.ts` + test, `glass-texture.ts` + test, `glass-filter.tsx`, `glass-run.ts`, `glass.css`, `scripts/audit/make-glass-frames.mjs`, `make-page-change.mjs`, `make-hero-return.mjs`, `glass-*.json`, `page-change.json`, `hero-return.json`, `scripts/audit/README.md`
- Create: `docs/redesign/compare/round7/r54-change-beside-preview.jpg` (the sheet in the last step)

**Interfaces:**
- Changes: `GLASS = { ms: 2500, band: 0.15, bendShare: 0.057, bendMaxPx: 64 }` (`bendPx` becomes `bendPxFor(viewportHeight: number): number`), `WARP = 0.12`, `SPLIT = { r: 1.29, g: 1, b: 0.71 }`.
- Produces: `bendProfile(x: number): number`, the push at `x` half-bands from the front as a share of the peak: `(exp(-1.6 x^2) * 0.03 + x * exp(-0.9 x^2) * 0.022) / 0.03`.
- Produces: `glowAt(x: number): number`, the cream glow's strength: `0.16 * exp(-30 x^2) + 0.05 * exp(-14 (x - 0.9)^2)`.
- Changes: `frontAt(t, plan)`: the front's outer soft edge is at the origin at `t = 0` (radius of the middle starts at `-(band + WARP)` of the travel, clamped for drawing), and the screen is clear at `UNCOVERED_AT`.

- [ ] Tests first: `bendProfile(0) === 1`, its sign changes side with `x`, it is under 0.02 beyond three half-bands; `glowAt(0) === 0.16` within 1e-6 and `glowAt(0.9)` within 0.05 to 0.06; `bendPxFor(900) === 51` (rounded), `bendPxFor(2000) === 64`; `frontAt(0)` puts nothing of the new page on screen and `frontAt(0.2)` has an opening of at least 2% of the farthest-corner distance; the screen is clear at 0.95; `easeGlass` unchanged.
- [ ] Spec 4. Numbers as above. The edge pictures (`glass-edge.ts`): the wander in five or six lobes round the front at `WARP`, the line replaced by `glowAt` (no core line), the band 10% darker than the pages. The shape changes over the change (turn the pictures about 25 degrees, or cross two tables); choose and record.
- [ ] The bend map and filter (`glass-texture.ts`, `glass-filter.tsx`): `bendProfile` across the whole band, old page outward and new page inward, red, green and blue displaced by `SPLIT`. Measure the frame gate on the three audit changes at 1440 by 900 and on the phone profile; if it fails, fall back to two passes or a smaller map, record the ruling and what it cost.
- [ ] Every script and audit that names 3500 or reads the change's length follows `GLASS.ms`; re-run `make-hero-return.mjs` (task 3's carry-over) and `hero-return.json`, the glass audits, the rings-in-reveal gate (R72) and the wall's arrival (R75).
- [ ] Task 6's carried minors: the Back press in the one or two frames before the change commits (end the hold on the target's commit); the stale "1.03" comment; the unused `seen` and step in `make-glass-frames.mjs`.
- [ ] By eye: film home to work and experience to home at 60 fps; make one sheet with the build's frames at 20, 35, 50, 65 and 80% of the time beside the tenth preview's (`round7-preview-10/#tab-change`, "Wider" and "Stronger", captured with the audit tooling) at the same times. The implementer and the reviewer each say in their report whether the columns read as one effect and where they differ.
- [ ] Commit `R54.1`.

### Task 23: Larger thumbnails on the portfolio page

**Files:**
- Modify: `app/components/work/ring-math.ts` + test, `ring-layout.ts` + test, `ring-entries.ts` + test, `rings.tsx`, `work-item.tsx`, `work.css`, `scripts/audit/make-rings.mjs`, `rings.json`, `rings-mode.json`

**Interfaces:**
- Produces: `coverage(plan: RingPlan, vw: number, vh: number): number`, the share of a `vw` by `vh` screen under video tiles, averaged over one turn of every ring (sampled at 24 steps), counting only the part of each tile that is on screen.

- [ ] Tests first: `coverage` of today's plan at 1440 by 900 (record the number in the test's name or comment, about 0.15); the new plan is between 0.30 and 0.40 at 1440 by 900 and at least 1.3 times today's at 390 by 844; the long side of a tile at 1440 by 900 is between 180 and 200 px; the existing clearance tests still pass at every audit size.
- [ ] Spec 5. Raise the tile's long side (and the icon tile from 59 to about 76 px at 1440 by 900), then re-solve the radii and the counts per ring. Nothing within 40 px of the title block; nothing under the dock's tabs. The rings-in-reveal gate (R72) still passes with the larger pictures; if the larger pictures need a larger thumbnail file than `mqdefault`, use the next size and record the weight.
- [ ] Stills at 1440 by 900, 1920 by 1080, 1024 by 768 and 390 by 844 for the controller's look, beside today's.
- [ ] Commit `R54.2`.

- [ ] Part docs for R54 (`changes-2026-11.md` rows, the Build line), commit `R54.3`, push, PR against `r7/r53-experience`.

---

## Part R55: the home boxes (`r7/r55-live-boxes`)

Read `app/components/home/layer/*`, `use-scene-engines.ts`, `blocks/interest-blocks.tsx` and both engines as they stand after tasks 11 to 15 before starting. The names below are the contract between these three tasks; fit the rest to the engines as you find them.

### Task 24: A scene can draw into a frame

**Files:**
- Modify: `app/components/home/watching/wall-engine.ts`, `wall-types.ts`, `app/components/home/reading/shelf-engine.ts`, `shelf-engine-types.ts`, `shelf-fit.ts` (and their tests)
- Create: `app/components/home/layer/frame-math.ts` + test

**Interfaces:**
- Produces: `type Frame = { left: number; top: number; width: number; height: number }` (CSS px in the window).
- Produces: `frameAt(box: Frame, vw: number, vh: number, e: number): Frame`, the straight line from `box` at `e = 0` to the whole window at `e = 1`.
- Produces: `gluedScale(frame: Frame, vw: number, vh: number): number`, `max(frame.width / vw, frame.height / vh)`.
- Produces on both engines: `setFrame(frame: Frame | null): void`. With a frame, the engine draws the open page's picture for the current window, scaled by `gluedScale` and centred in the frame, and nothing outside it; with `null` it draws the full window as today. Calling it never rebuilds the scene.
- Produces on both engines: `setDocked(docked: boolean): void`. Docked: no pointer input; the wall keeps its slow drift at no more than 30 draws a second; the shelf draws only when something changed. Not docked: as today.
- Produces on both engines: `whenDrawn(): Promise<void>`, resolved after the first frame drawn with the current frame.

- [ ] Tests first (`frame-math.test.ts`): `frameAt` at 0, 0.5 and 1; `gluedScale` for a wide box, a tall box and the full window (1); a frame that covers the window gives exactly today's picture (the engines' own projection tests: the picture for `setFrame(full)` equals the picture for `setFrame(null)`).
- [ ] Both engines: `setFrame`, `setDocked`, `whenDrawn`. A picture drawn into a frame at 1440 by 900 and the same frame's region of a full draw scaled by `gluedScale` match (an audit step compares the two, at most 2% of pixels differing).
- [ ] The wall's edge treatment (task 13) and the shelf's dot field and ledge (task 15) are part of the framed picture.
- [ ] Commit `R55.1`.

### Task 25: The box holds the scene, and opening is one move

**Files:**
- Modify: `app/components/home/blocks/interest-blocks.tsx`, `blocks.css`, `use-near.ts`, `app/components/home/layer/interest-layer.tsx`, `layer.css`, `layer-state.ts` + test, `use-layer-history.ts`, `app/components/home/use-scene-engines.ts`, `home-page.tsx`, `watching/watching-scene.tsx`, `reading/reading-scene.tsx`, `scripts/audit/shelf.json`, `wall.json`
- Create: `app/components/home/layer/open-move.ts` + test, `scripts/audit/box-open.json`
- Delete: `app/components/home/layer/layer-poster.ts` + test

**Interfaces:**
- Consumes: `frameAt`, `gluedScale`, `setFrame`, `setDocked`, `whenDrawn` (task 24).
- Produces: `OPEN_MS = 1000`, `CHROME_FROM = 0.72`, `SINK = { scale: 0.95, dim: 0.45 }`.
- Produces: `moveAt(now: number, m: Move): { e: number; done: boolean }` and `turn(now: number, m: Move): Move`, where `Move = { from: number; to: 0 | 1; startedAt: number }`: eased progress on the site's ease, and the same move turned round from where it is.
- Produces: `chromeAlpha(e: number): number`, 0 until `CHROME_FROM`, then up to 1 in a straight line.

- [ ] Tests first (`open-move.test.ts`): `moveAt` at the start, the middle and the end; `turn` at 0.4 gives a move whose first value equals the value it was turned at; `chromeAlpha(0.72) === 0`, `chromeAlpha(1) === 1`; the layer state machine accepts open, close and turn in every order.
- [ ] Spec 6.1. When a scene is ready, its canvas is in its home box, docked, with the box as its frame, and fades in over 300 ms; before that the box shows its dark ground. Without WebGL, or after a failed scene or a lost context, the box shows the flat mini preview (R56's fallback stays). The scene draws only while its box is on screen and the tab is visible.
- [ ] Spec 6.2. On a click: the frame goes from the box's place now to the window over `OPEN_MS`; the same canvas throughout or a first frame identical to the box's last; corners to square; the home page behind to `SINK`; the chrome by `chromeAlpha`; pointer input from the end of the move; the wall's pan eased from the drift. A click before the scene is ready waits up to 400 ms, then opens to the plain grid with the same frame move.
- [ ] Spec 6.3. Closing is the move backwards to where the box is now; Close during an opening and a click during a closing call `turn`; a deep link or hard load that starts open shows no move; reduced motion gets a 200 ms fade and no growing frame; focus returns to the block's button.
- [ ] Remove the poster, the copy of the block and the clip-path grow.
- [ ] Audit `box-open.json` (1440 by 900 and 390 by 844, both boxes, 60 fps films of open and close): the frame before the click and the frame after differ in under 1% of the box's pixels; until the chrome starts, the scene's canvas is the only thing drawn inside the frame; no frame shows the box empty; the Review Focus cases 1 to 5 each have a step. One contact sheet per box for the controller's look.
- [ ] Commit `R55.2`.

### Task 26: The cost of two live boxes, and the clean-out

**Files:**
- Modify: `scripts/audit/load-metrics.json`, `measure.json`, `scripts/audit/README.md`, `app/components/home/blocks/mini-previews.ts` + test, `use-mini-fit.ts`, `docs/redesign/changes-2026-11.md`
- Create: `scripts/audit/home-scroll.json`, `docs/redesign/compare/round7/r55-home-scroll-gate.json`

- [ ] Measure, on the production build at 1440 by 900 and on the phone profile with CPU slowed four times: scrolling the home page from the hero past both boxes and back (no frame over 34 ms beyond the recorded cold-start outliers of R67 and R72), the hero's painting change while a box is on screen, and the page's load numbers against the commit before part R55. Record all of it in the tracked gate file.
- [ ] If a gate fails: lower the docked draw rate or the docked pixel ratio first; only then consider drawing the docked wall once and holding it still. Record the ruling and what it cost in look.
- [ ] The flat mini previews are now only the no-WebGL picture: remove what only the poster used, keep their tests for what remains.
- [ ] Part docs for R55, commit `R55.3`, push, PR against `r7/r54-change-rings`.

---

## After these parts

Tasks 20 and 21 of `2026-11-13-round7.md` run as written, over the whole branch including R54 and R55. The comparison page gets three new rows: the page change beside the tenth preview, the portfolio page before and after, and the box opening sheets.
