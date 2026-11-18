# Round 7: second look (tasks 29 to 31): implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task by task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** No cut-out round the dock on the portfolio page, a page change of 2.25 s, and a reading box that shows every book whole on its ledge.

**Architecture:** Task 29 deletes the ring keep-out (mask, pointer block, measured dock box where nothing else needs it) and re-solves the rings for the whole screen, then changes one number in `glass-math.ts`. Task 30 changes how the shelf's scene is framed while it is docked in its home box and lets the framing ease over the opening.

**Tech Stack:** Remix 2.17, React 18, TypeScript strict, three.js, vitest, the CDP audit harness.

**Spec:** `docs/superpowers/specs/2026-11-16-round7-second-look-design.md` (read it whole; it wins over the earlier round 7 specs where they differ).

## Global Constraints

- Task 29: lane A's tree, branch `r7/r56-arrival`, port 5180, after task 28 is committed. Task 30: lane B's tree, branch `r7/r55-live-boxes`, port 5181, after task 26. `lanes-common.md` and `lane-b-rules.md` hold.
- Lane A does not touch `app/components/home/blocks/`, `home/layer/`, `home/reading/`, `home/watching/`, `home/use-scene-engines.ts`, `home/use-box-scenes.ts`. Lane B does not touch `app/components/work/` or `app/components/page-change/`.
- The thumbnails' sizes on the portfolio page do not change. The opening's length (1.0 s), ease and frame path do not change.
- No em dashes or en dashes in visible copy. No Lenis. No serif in the interface. No test or app code reads from `docs/`.
- Audit pictures that show YouTube thumbnails or book covers go only to the git-ignored `docs/redesign/compare/local/`.
- Commits by explicit paths only. Never amend, never force-push. yarn runs with `COREPACK_HOME="$HOME/.cache/corepack-alt"`. Browser checks run against the production build.

## Review Focus

1. A bright thumbnail directly under a tab label: the label is still readable (measured, not judged by eye).
2. Keyboard: Tab through the video tiles while the rings turn; focus is never on a tile hidden under the dock, and the ring does not lurch when focus moves.
3. A phone whose dock spans the screen (320 by 568): tiles under the dock are not clickable through it, and the visible tile area is no smaller than before.
4. The reading box at a narrow, tall size (390 by 844) and a short, wide one (1366 by 768): no book cut, ledge inside, no jump at the click.
5. A click on the reading box while its scene is still fading in: the framing at the click is the framing the move starts from.

---

### Task 29: The dock without its cut-out; the change at 2.25 s

**Files:**
- Delete: `app/components/work/work-keep-out.css`; `app/components/work/ring-keep-out.ts` + test (keep in another file only what something else still uses)
- Modify: `app/components/work/rings.tsx`, `ring-layout.ts` + test, `ring-math.ts` + test (if the plan's inputs change), `use-dock-box.ts` (delete if unused), `work-page.tsx`, `work.css`, `app/components/page-change/glass-math.ts` + test, the dock's glass style only if spec 4's contrast needs it, `scripts/audit/rings.json`, `rings-mode.json`, `scripts/audit/README.md`, `docs/redesign/changes-2026-11.md`
- Create: `scripts/audit/dock-over-tiles.json` (or a step file beside `rings.json`), `docs/redesign/compare/round7/r56-dock-contrast.json`

**Interfaces:**
- `GLASS.ms` is `2250` in `glass-math.ts`; nothing else reads a literal length.
- `coverage()` in `ring-layout.ts` takes no keep-out; `maskAlpha`, `keepOutFor`, `keepOutVars`, `KEEP_MARGIN`, `KEEP_FEATHER` no longer exist.

- [ ] Tests first: `glass-math.test.ts` (`GLASS.ms` is 2250); `ring-layout.test.ts` (the plan at every audit size has tile sizes and counts no smaller than at the commit before this task; coverage is counted without a mask); a test that no CSS under `app/components/work/` sets a mask on a ring group.
- [ ] Remove the mask, the pointer block and the keep-out; re-solve the rings; the 40 px room round the title block stays.
- [ ] Focus (Review Focus 2): focus never rests on a tile more than half under the dock.
- [ ] Contrast (Review Focus 1): an audit step puts the brightest thumbnail of the set under each tab label in turn and measures the label's contrast from a picture; at least 4.5 to 1. Raise the glass's tint only if needed, on every page alike; record before and after in `r56-dock-contrast.json`.
- [ ] `GLASS.ms` to 2250; run everything keyed to it.
- [ ] Spec 4's picture check at the three sizes (pictures to `compare/local/`).
- [ ] Under the lock: `rings.json`, `rings-mode.json`, `page-change.json`, the glass audits, task 27's cost gate, task 28's arrival audit. All numbers into the report.
- [ ] Commit `R56.4`. The part docs of R56 (task 28's `R56.3`) get this task's rows; if `R56.3` is already made, a follow-up docs commit `R56.5`.

### Task 30: The reading box shows whole books on the ledge

**Files:**
- Modify: the shelf engine's framing for a docked frame (`app/components/home/reading/` and the frame maths of task 24: `frame-math.ts` + test, `shelf-frame.ts` + test), the move driver only where the framing eases (`app/components/home/layer/`), `scripts/audit/box-open*.mjs`, `shelf.json`, `scripts/audit/README.md`
- Create: nothing new unless the framing needs its own pure function: then `app/components/home/reading/box-framing.ts` + test

**Interfaces:**
- A pure function gives the shelf's framing for a frame: `shelfFraming(frame: { w: number; h: number }, win: { w: number; h: number }, row: { top: number; bottom: number; left: number; right: number; ledgeBottom: number }, t: number)` returning the scale and offset the engine draws with; at `t = 0` (docked) every book and the ledge are inside the frame with spec 6's margins, at `t = 1` it is exactly the open page's picture, and it is monotonic in `t`. The name and shape may follow the files as they are; the properties are the contract.

- [ ] Tests first: at `t = 0` for the box's frame at 1440 by 900, 1366 by 768 and 390 by 844, every book's projected box and the ledge are inside the frame and the tallest book's top is at least 6% of the frame's height below its top; at `t = 1` the result equals the open page's framing; the scale is monotonic over `t` in steps of 0.05; the dot field covers the frame at every `t`.
- [ ] The docked shelf uses the framing at `t = 0`; the opening and closing ease it with the move's own clock.
- [ ] An audit step reads the engine's projected boxes in the home box at the three sizes and asserts spec 6's check; the first-frame rule (under 1% of the box's pixels) and the last-frame rule still pass.
- [ ] Review Focus 4 and 5 as audit steps.
- [ ] The box-open films again (to `compare/local/`); the frame-cost numbers of task 26 again under the lock if the framing changed what is drawn.
- [ ] Commit `R55.3c` (or the next free letter).

### Task 31: My experience: the words beside the mountain, their entrance, the trail tracing itself

Lane A, after task 29, on `r7/r56-arrival`. Spec sections 7 and 8.

**Files:**
- Modify: `app/components/experience/experience.css`, `experience-page.tsx`, `experience-map.tsx`, `heading-block.tsx`, `map-caption.tsx`, `milestone-pins.tsx`, `map.css`, `trail-layer.ts` + test, `climb-engine.ts` (only to pass the trace's share to the trail's drawing), `keep-out.ts` + test (if the words' boxes change how the chart keeps out), `app/lib/arrival.ts` users on this page (task 28), `scripts/audit/experience.json`, `scripts/audit/arrival.json` or `make-arrival.mjs` (the exception of spec 8), `scripts/audit/README.md`, `docs/redesign/changes-2026-11.md`
- Create: `app/components/experience/entrance.ts` + test (pure timings), `app/components/experience/split-letters.tsx` (letters for the entrance, one accessible name), `scripts/audit/experience-entrance.json`

**Interfaces:**
- `entrance.ts`, pure:
  - `ENTRANCE = { titleAt: 0.7, letterMs: 300, titleGapMs: 28, labelGapMs: 22, descAfterMs: 120, labelAfterMs: 240, linesAfterMs: 360, lineMs: 400, lineGapMs: 60, traceMs: 2200, beadMs: 260, aheadAfterMs: 100, aheadMs: 600, reducedMs: 200 }`.
  - `traceShare(ms: number): number`: the share of the trail drawn `ms` after the trace began (0 to 1, eased in and out, clamped).
  - `beadDelay(share: number): number`: the ms after the trace began at which the tip reaches a milestone at this share of the trail (the inverse of `traceShare`).
- `drawTrail` in `trail-layer.ts` gains the share of the first trail to draw and the share of the way ahead to draw (both 1 by default, so every existing caller is unchanged) and draws the bright head at the tip while the share is under 1.
- The page reads the reveal's start and length from `app/lib/page-change.ts` and `GLASS.ms`; no literal 2250.

- [ ] Tests first: `entrance.test.ts` (`traceShare` is 0 at 0, 1 at `traceMs`, monotonic; `beadDelay(traceShare(x))` is `x` within 1 ms for x from 0 to `traceMs` in steps of 100; `beadDelay` of the last milestone is `traceMs`); `trail-layer.test.ts` (at share 0.5 the stroked path ends at the point half way along the trail's length, and the way ahead is not drawn; at 1 and 1 the drawing equals today's); a test that the title's letters carry one accessible name ("My experience" read once, the letters hidden from assistive technology).
- [ ] The layout of spec 7: the two blocks on the summit's row on a wide screen, today's places otherwise; the clearances measured from the frame maths, not guessed.
- [ ] The entrance of spec 8 for the words, on the reveal's clock; before their time they are not shown.
- [ ] The trace: the trail by its share, each milestone at `beadDelay` of its share, "now" and the radar at the end, then the way ahead.
- [ ] Finishing at once on a click or a key; focus shows a milestone; first load; coming back from My climb; reduced motion; no map.
- [ ] `experience-entrance.json`: spec 8's film and pictures at the two sizes (to `compare/local/` if any picture shows a thumbnail; the map alone may go to `docs/redesign/compare/round7/`), the layout-shift count, the clearances of spec 7 at 1440 by 900, 1280 by 720, 1024 by 768 and 900 by 600, today's places at 390 by 844 and 844 by 390.
- [ ] Task 28's arrival check for this page leaves the words, the trail and the milestones out; `experience.json` follows the new places.
- [ ] Under the lock: `experience.json`, `experience-entrance.json`, the arrival audit, `page-change.json`.
- [ ] Commit `R56.6` (code) and the rows in R56's part docs.

---

## After these tasks

The join waits for the ledger lines "A: Task 31: complete" (task 29 before it) and "B: Task 30: complete". The comparison page of task 21 shows the dock without its cut-out, the reading box with whole books, and the experience page with its words beside the mountain.
