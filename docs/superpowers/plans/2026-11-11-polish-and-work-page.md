# Polish Pass, Work Page and Timeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Implementers run on Sonnet at high effort. Every task review runs on Opus 5.5. Read `docs/superpowers/plans/2026-11-11-handover.md` first.

**Goal:** Fix every finding in the 11 November audit without changing the home page's look, reorganise the code, then replace the work page with rotating rings and add a zoomable day-by-day timeline page.

**Architecture:** Part one is a refactor with no behaviour change (tokens, one stylesheet per area, engines split by job, hooks extracted). Part two fixes behaviour area by area on that tidy base. Parts three and four add two new routes built from pure, unit-tested math modules plus thin React components; the rings are DOM elements moved with CSS and the Web Animations API, the timeline is one 2D canvas.

**Tech Stack:** Remix 2.17 (Vite 6), React 18, TypeScript strict, Tailwind v4, zod, three.js 0.169, vitest, WebGL, Canvas 2D, View Transitions API.

**Spec:** `docs/superpowers/specs/2026-11-11-polish-and-work-page-design.md`. Evidence: `docs/redesign/audit-2026-11-11.md` (finding ids such as L-01, S-02). Deferred notes: `docs/redesign/deferred-review-notes.md` (ids D-01 to D-116).

## Global Constraints

- **Do not change the look of the home page.** Only the audit's fixes. When in doubt, match the live site at https://fragtaco-portfolio.vercel.app.
- Node 22, yarn 1 through corepack: prefix every yarn command with `COREPACK_HOME="$HOME/.cache/corepack-alt"`.
- No new dependencies except: `sharp` as a dev dependency (image re-encoding script, Task 7). Nothing else without asking.
- No Lenis or any scroll library. No em dashes or en dashes in any visible copy, title or alt text. No serif in the interface.
- Never commit YouTube thumbnails, Open Library covers or screenshots that show them. Never add the owner's email address to any new file, URL or request.
- Server rendering never touches `window`, `document`, WebGL, canvas or three.js. three.js only through `import("three")`.
- Animate only `transform`, `opacity`, `clip-path`, `filter` on small elements, and shader uniforms. No React state updates per animation frame. Every loop stops when its scene is not visible.
- Reduced motion (`prefers-reduced-motion: reduce`) is handled in every task that adds motion.
- Type and colour come from `app/styles/tokens.css` (Task 1). No new hard-coded font sizes below 24px, opacities for text, or z-index values outside the tokens.
- No file over about 350 lines after its task. Every pure function has a vitest test.
- Commits: authored by the repo's configured identity (the GitHub no-reply address). Message starts with its number (`R31.1: ...`) and ends with the `Co-Authored-By` line the controller gives in the dispatch (the session's current attribution line). PR bodies end with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
- Each task ends green: `yarn typecheck`, `yarn lint`, `yarn test`, `yarn build`.
- Each task that fixes a deferred note edits its row in `docs/redesign/deferred-review-notes.md` to `fixed (R..)` or `closed (reason)`.
- Each part adds one line to the "Build" section of `docs/redesign/feedback-log.md` and its findings' ids to `docs/redesign/changes-2026-11.md` (created in Task 1) with what changed and the commit.

## Review Focus

1. **Slow network on first load** (the audit's worst finding): the loader must finish and unlock on time with the painting still downloading. Pinned in Task 9 (`revealPlan` tests, a throttled check).
2. **Engines still not ready when a layer opens:** the shelf and wall must show a placeholder at once and never an empty panel. Pinned in Tasks 12 and 15.
3. **Leaving and returning between pages mid-animation** (transition running, layer open, card open): no black hero, no stuck lock class, no leaked loop. Pinned in Tasks 6 and 8.
4. **Input variety on narrow screens:** mouse, trackpad, touch and keyboard must each be able to reach every book and every video. Pinned in Tasks 13 and 15.
5. **Unknown counts in the rings and the timeline growing every day:** 1, 8, 40 and 120 items per ring; a timeline that ends today, across a leap year and a month boundary. Pinned in Tasks 19 and 22.

## How this plan is executed

- **Branches:** stacked as before. `redesign/r30-finish` is the base. Parts: `polish/r31-structure`, `polish/r32-nav`, `polish/r33-hero`, `polish/r34-layout`, `polish/r35-shelf`, `polish/r36-wall`, `polish/r37-closeout`, `work/r38-rings`, `work/r39-timeline`. Each starts from the previous part's branch and its PR targets that branch. Nobody merges; Aditya merges in order.
- **Implementers** (Sonnet, high effort) do one task, commit, do not push.
- **Reviewers** (Opus 5.5) review every task's diff: spec compliance and quality.
- **The controller** dispatches, runs the browser checks named in each task with `scripts/audit/` (Task 0), takes "after" screenshots, pushes each finished part, opens its PR, and at the end builds the comparison page and the Vercel preview (Task 26).
- **Browser checks** use headless Chrome through `scripts/audit/cdp.mjs` against the dev server (`yarn dev --port 5178 --strictPort`). The in-app browser pane does not animate when the window is hidden.
- **Frame budget:** no frame over 20 ms at 60 Hz in any animated scenario once content is loaded; no long-animation-frame entry over 50 ms.

---

## Part R30 close-out (controller only)

### Task 0: Open the R30 pull request and save the audit tools

- [ ] **Step 1:** `scripts/audit/` already holds `cdp.mjs`, `sheet.sh`, `README.md` and the capture step files (committed with this plan). Confirm `node scripts/audit/cdp.mjs scripts/audit/smoke.json /tmp/x` prints a title.
- [ ] **Step 2:** Push `redesign/r30-finish` and open its PR against `redesign/r29-wall`: "R30: fallbacks, reduced motion, round 4 fixes, Vercel, site icon, audit and plan". Body lists commits 7b6eb47 to the docs commit and links the audit, the design outline and this plan.
- [ ] **Step 3:** `git checkout -b polish/r31-structure`.

---

## Part R31: structure (no behaviour change)

Every task in this part must leave the rendered site pixel-identical. The check for each: `scripts/audit/capture-desktop.json` and `capture-phone.json` before and after, compared by eye on the contact sheets.

### Task 1: Tokens and one stylesheet per area

**Files:**
- Create: `app/styles/tokens.css`, `app/components/home/hero/hero.css`, `cards/cards.css`, `blocks/blocks.css`, `layer/layer.css`, `reading/reading.css`, `watching/watching.css`, `docs/redesign/changes-2026-11.md`
- Delete: `app/components/home/home.css`
- Modify: each owning component to import its stylesheet; `app/root.tsx` to load `tokens.css`

**Interfaces:**
- Produces: the custom properties in spec section 3.1 with exactly those names and values, plus the existing `--ease`, `--dock-clear`, `--rail`, `--card-h`, `--dots`, `--grain` moved here unchanged. `--z-hero: 1; --z-cards: 20; --z-dock: 30; --z-layer: 300; --z-detail: 400; --z-transition: 900`.
- In this task the tokens are **defined but not yet applied** to existing sizes (that is Task 10). Only z-index values are switched to the tokens, value for value.

- [ ] **Step 1:** Capture the before sheets (desktop and phone).
- [ ] **Step 2:** Create `tokens.css`. Move each rule of `home.css` to the stylesheet of the area that owns its selector (hero and loader and texture to `hero.css`; `.card*`, `.rail`, `.scrim` to `cards.css`; `.home-blocks*` to `blocks.css`; `.home-layer` frame and header to `layer.css`; shelf and note rules to `reading.css`; wall, chip and `.vov` to `watching.css`). Media-query and reduced-motion rules move with their selectors. Keep rule order within each area.
- [ ] **Step 3:** Run all checks. Capture the after sheets and compare: no visible difference.
- [ ] **Step 4:** Start `docs/redesign/changes-2026-11.md`: a table `| Id | What changed | Where | Commit |`, first row K-01 and K-09.
- [ ] **Step 5: Commit** `R31.1: tokens file and one stylesheet per area`.

### Task 2: Split the shelf engine

**Files:**
- Create: `app/components/home/reading/shelf-scene.ts` (builds renderer, lights, books, plank, shadows; returns the scene record), `shelf-covers.ts` (cover download, decode, paint queue, upload rule), `shelf-input.ts` (pointer and keyboard listeners; calls back into the engine)
- Modify: `shelf-engine.ts` (keeps state, `frame`, `openBook`/`closeBook`, `layoutOpen`, lifecycle)

**Interfaces:**
- `ShelfEngine`'s public shape does not change.
- `buildShelfScene(T: typeof import("three"), canvas, books, nextIdle): Promise<ShelfScene>`; `createCoverQueue(deps): { add(tex, book, img): void; drain(): void; clear(): void }`; `attachShelfInput(canvas, handlers, signal): void`.
- Fix in passing and mark in the deferred notes: D-notes from Task 14 that live in these files (blur canvas reallocated every open: reallocate only on size change; `fonts.load` failure silent: `console.warn` once; decoded images retained: already released, close the note).

- [ ] **Step 1:** Move code without changing logic. Run all checks.
- [ ] **Step 2:** Controller check: `scripts/audit/shelf.json` shows the same drop-in, hover, open and close; frame sampler has no frame over 20 ms.
- [ ] **Step 3: Commit** `R31.2: shelf engine split into scene, covers, input and loop`.

### Task 3: Split the wall engine

**Files:**
- Create: `app/components/home/watching/wall-gl.ts` (context, shaders, program, quad draw), `wall-thumbs.ts` (thumbnail load, decode, atlas cell paint, upload pump), `wall-input.ts` (pointer, wheel, keyboard), `pick-channel.ts` (moved out of `watching-scene.tsx`)
- Modify: `wall-engine.ts`, `watching-scene.tsx`

**Interfaces:**
- `WallEngine`'s public shape does not change.
- `createWallGl(canvas): WallGl | null` with `{ gl, uniforms, quad(x, y, w, h, kind, alpha, pad, rad): void, dispose(): void }`; `createThumbs(gl, atlas, videos): { pumpFrame(): boolean; loaded: Float32Array; dispose(): void }`; `attachWallInput(canvas, handlers, signal): void`.
- Fix in passing: delete shaders after linking; drop failed `Image` objects from the retained set; `createPickChannel` now in its own module (Fast Refresh note).

- [ ] **Step 1:** Move code without changing logic. Run all checks.
- [ ] **Step 2:** Controller check: `scripts/audit/wall.json`: drift, hover sweep, open and close a video; no frame over 20 ms.
- [ ] **Step 3: Commit** `R31.3: wall engine split into gl, thumbnails, input and loop`.

### Task 4: Hooks, shared helpers, orphans

**Files:**
- Create: `app/components/home/hero/use-loader.ts`, `hero/use-painting-cycle.ts`, `layer/use-layer-history.ts`, `cards/use-card-poses.ts`, `cards/use-card-input.ts`, `blocks/use-near.ts`, `app/utils/inert.ts`, `app/utils/idle.ts`
- Modify: `hero.tsx`, `home-page.tsx`, `use-card-gestures.ts` (deleted once split), `interest-blocks.tsx`, `site-nav.tsx`, `card-shell.ts`, `layer-context.ts`
- Delete: `app/components/about/about-copy.tsx`, `app/components/about/about-portrait.tsx`; from `app/config/ui.ts`: `textStyles.displayTitleColumn`, `factHeadline`, `factBody`, `chipLabel`, `heroTitle`, `heroSubtitle`, `layout.homeContainer`, `surfaces.glassChip`, `styleUnlessReduced` (each only if `grep -r` finds no user); `getNavHeight` in `app/utils/nav.ts`; the `ken-burns` keyframes in `tailwind.config.ts` if unused; `public/background.png` if nothing references it
- Test: `app/components/home/layer/use-layer-history.test.ts` (pure part), `app/utils/inert.test.ts`, `app/components/home/blocks/near-gate.test.ts`

**Interfaces:**
- `inertProps(on: boolean): Record<string, string>` in `app/utils/inert.ts`, used by cards and dock (one helper, D-note "inertProps duplicates inertIf").
- `whenIdle(cb, timeoutMs?)`, `idleSlice(cb)` (no timeout) in `app/utils/idle.ts`, used by blocks, shelf and wall.
- Pure helpers extracted for tests: `nextHistoryState(current: unknown, kind: LayerKind): object` (keeps Remix's `key`/`usr`, sets `xp`, bumps `idx`); `createNearGate(schedule): { hit(kind): void; cancel(): void }` (fires once per kind).
- `useLayerControl()` throws `Error("LayerControl used outside its provider")` when there is no provider (K-13).
- `hero.tsx` and `home-page.tsx` each end under 220 lines.

- [ ] **Step 1: Write the failing tests:** `nextHistoryState({ key: "k", idx: 2, usr: null }, "reading")` equals `{ key: "k", idx: 3, usr: null, xp: "reading" }`; with `null` it equals `{ xp: "reading", idx: 1 }`; the near gate fires once per kind even when `hit` is called three times before the scheduled callback runs, and not at all after `cancel`; `inertProps(true)` equals `{ inert: "", "aria-hidden": "true" }` and `inertProps(false)` equals `{}`.
- [ ] **Step 2:** Run tests. Expected: FAIL (modules missing).
- [ ] **Step 3:** Extract. Behaviour identical. Delete the orphans after grepping.
- [ ] **Step 4:** Run all checks. Controller: capture sheets, compare with Task 1's before sheets; check cards (keys, swipe, drag), layer history (open, Back, Forward, deep link) with `scripts/audit/history.json`.
- [ ] **Step 5: Commit** `R31.4: hooks extracted, shared helpers, orphans removed`.
- [ ] **Step 6 (controller):** push, PR `R31: structure` against `redesign/r30-finish`. Start `polish/r32-nav`.

---

## Part R32: dock and page changes

### Task 5: Home and work tabs

**Files:**
- Modify: `content/site/navigation.json`, `app/components/site-nav.tsx`, `app/components/react-bits/dock-nav.tsx`, `app/types.ts`, `app/content/schemas.ts`, `app/utils/nav.ts`, `app/components/home/home-page.tsx`, `app/components/home/cards/intro-card.tsx`, `app/root.tsx`, `app/routes/_index.tsx`, `app/routes/work.tsx`
- Test: `app/utils/nav.test.ts`

**Interfaces:**
- `navigation.json`: `[{ "key": "home", "label": "home", "href": "/", "visible": true }, { "key": "work", "label": "work", "href": "/work", "visible": true }]`. `NavigationKey = "home" | "work"`.
- Icons from `react-icons/fa6`: home `FaHouse`, work `FaClapperboard`.
- `activeNavKey(pathname: string): "home" | "work" | null` in `app/utils/nav.ts`: `/` gives `home`; `/work` and `/timeline` (and anything under them) give `work`.
- Home tab on the home page: `event.preventDefault()`, close any open layer, dispatch `{ kind: "go", to: "hero" }`, `window.scrollTo({ top: 0, behavior: "smooth" })`. From another page: a normal link to `/`.
- `/#about` on arrival still opens the intro card. The right rail's label is `about`; its `aria-label` becomes `Open about` / `Close about` with `aria-expanded` (D-note on rail semantics); the left rail the same with `credits`.
- Titles: `FragTaco - Aditya Bhoir`, `Work - FragTaco` (N-05).
- Dock labels: idle 85% opacity, active 100% (M-04).

- [ ] **Step 1: Write the failing test:** `activeNavKey("/") === "home"`, `"/work"` and `"/timeline"` give `"work"`, `"/other"` gives `null`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run all checks. Controller: `scripts/audit/nav.json` (home from the blocks scrolls to top and opens nothing; home with a card open closes it; `/#about` opens the card; work goes to `/work`; tab titles have no long dash).
- [ ] **Step 5: Commit** `R32.1: dock reads home and work; home goes to the hero`.

### Task 6: Page transition and preloading

**Files:**
- Create: `app/components/page-transition.css`
- Modify: `app/components/react-bits/dock-nav.tsx`, `app/components/site-nav.tsx`, `app/root.tsx`, `app/components/home/hero/hero.tsx`

**Interfaces:**
- Dock links and every in-app link added later use Remix `<Link viewTransition prefetch="intent">` (the prop exists in the installed react-router-dom). Programmatic navigation uses `navigate(to, { viewTransition: true })`.
- CSS, exactly:
  ```css
  ::view-transition-old(root) { animation: page-out 160ms ease-in both; }
  ::view-transition-new(root) { animation: page-in 220ms ease-out both; }
  @keyframes page-out { to { opacity: 0; filter: blur(12px); } }
  @keyframes page-in { from { opacity: 0; filter: blur(8px); } }
  header[data-site-nav] { view-transition-name: site-dock; }
  @media (prefers-reduced-motion: reduce) {
    ::view-transition-old(root), ::view-transition-new(root) { animation-duration: 120ms; filter: none; }
  }
  ```
- On leaving the home page the hero's cleanup removes `intro`, `cards-open` and `locked` from `<html>` (whichever it or its children own) so no lock survives a page change (Review Focus 3).

- [ ] **Step 1:** Implement.
- [ ] **Step 2:** Run all checks. Controller: `scripts/audit/transition.json` captures 10 frames after clicking work and after clicking home: the first changed frame is within 100 ms of the click on a warm second visit, no frame shows a half-drawn page, and `<html>` has no lock class after each change.
- [ ] **Step 3: Commit** `R32.2: blur transition between pages; dock preloads the other page`.
- [ ] **Step 4 (controller):** push, PR `R32: dock and page changes`. Start `polish/r33-hero`.

---

## Part R33: loader and hero

### Task 7: Lighter paintings and placeholders

**Files:**
- Modify: `package.json` (dev dependency `sharp`; script `"paintings": "node scripts/make-paintings.mjs"`), `content/site/hero-paintings.json`, `app/content/schemas.ts`, `app/types.ts`, `app/components/home/hero/painting-cycle.ts`
- Create: `scripts/make-paintings.mjs`, `public/paintings/1600/*.webp`, `public/paintings/2560/*.webp` (keep the `.jpg` copies as fallbacks, re-encoded)
- Delete: `scripts/make-painting-sizes.sh`
- Test: `app/components/home/hero/painting-cycle.test.ts`, `app/content/schemas.test.ts`

**Interfaces:**
- `scripts/make-paintings.mjs` reads the non-missing items of `hero-paintings.json` and, for each original in `public/paintings/`, writes: 1600px WebP at quality 72 and JPEG at quality 70 (mozjpeg); 2560px (never upscaled) WebP at quality 74 and JPEG at quality 72; and a `blur` field back into the JSON: a 24px-wide JPEG at quality 40, base64, as a `data:image/jpeg;base64,...` string. It prints a table of sizes and exits non-zero if any 1600px WebP is over 320 KB or any 2560px WebP is over 750 KB.
- `SiteHeroPainting` gains `blur: string`. Schema: `blur` starts with `data:image/` and is under 2,500 characters.
- `paintingSrc(file, viewportWidth, dpr, webp: boolean): string` returns `/paintings/{1600|2560}/{name}.{webp|jpg}` (same 1400 rule as today).
- `supportsWebp(): boolean` (cached, client only) in `app/utils/load-image.ts`.

- [ ] **Step 1: Write the failing tests:** `paintingSrc("a.jpg", 375, 3, true) === "/paintings/1600/a.webp"`; `paintingSrc("a.jpg", 1440, 2, false) === "/paintings/2560/a.jpg"`; every loaded painting has a `blur` under 2,500 characters.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Write the script, run it, implement. Report the size table (before and after totals for each folder).
- [ ] **Step 4:** Run all checks. Controller: the hero looks the same; a 1600px painting is under 320 KB on the network.
- [ ] **Step 5: Commit** `R33.1: paintings re-encoded with WebP and blurred placeholders`.

### Task 8: First painting from the server, memory between pages, ten-second cycle

**Files:**
- Modify: `app/routes/_index.tsx`, `app/content/loaders.server.ts`, `app/components/home/hero/use-painting-cycle.ts`, `painting-cycle.ts`, `paint-engine.ts`, `hero.tsx`, `home-page.tsx`
- Create: `app/components/home/hero/painting-memory.ts`
- Test: `painting-cycle.test.ts`, `painting-memory.test.ts`, `app/content/loaders.test.ts`

**Interfaces:**
- The home loader returns `firstPaintingId: string`, picked with `Math.random()` on the server from the available paintings. The response's `Cache-Control` becomes `private, no-store` (the pick must differ per visit).
- `_index.tsx` drops its static `links` preload. `app/root.tsx`'s `Layout` reads the home loader's data with `useRouteLoaderData("routes/_index")` and, when present, renders in `<head>`: `<link rel="preload" as="image" href={1600 webp} imageSrcSet="{1600 webp} 1400w, {2560 webp} 2560w" imageSizes="100vw" fetchPriority="high" />` for the painting with `firstPaintingId`.
- `makeOrder(length, first, random)` is called with the server's pick as `first`. The recent-three rule applies from the second painting on: `pickNext(order, position, recent): number` skips entries in `recent` (unit-tested).
- `nextDelayMs(): number` returns exactly `10000` (L-07). The slow zoom in `paint-engine.ts` runs over 12 s (`zoomOf` uses 12000 in place of 21000).
- `painting-memory.ts`: `rememberPainting(id: string, img: HTMLImageElement): void`, `recallPainting(): { id: string; img: HTMLImageElement } | null`, module-level, holds one entry, survives route changes (it is not React state).
- On mount when the intro is skipped (returning from another page or same-tab reload): if `recallPainting()` has an image, `reveal(img, meta, 0)` in the first effect, before any network; otherwise draw the `blur` placeholder with `reveal(blurImg, meta, 0)` and crossfade (`swap` with a plain 400 ms crossfade mode) to the sharp image when it loads (N-02, L-06).

- [ ] **Step 1: Write the failing tests:** `nextDelayMs() === 10000`; `pickNext([3, 1, 2, 0], 0, ["1"], ids)` returns position 2; `recallPainting()` is null before and returns the same object after `rememberPainting`; the home loader's `firstPaintingId` is one of the painting ids.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run all checks. Controller: `scripts/audit/transition.json`: after work then home, the first frame of the home page shows a painting (not black); the HTML of `/` contains the preload link for the painting that is then revealed; paintings change 10 s apart (two changes timed).
- [ ] **Step 5: Commit** `R33.2: first painting from the server, kept between pages, changes every 10 s`.

### Task 9: A loader that starts at first paint and never waits

**Files:**
- Modify: `app/lib/intro-session.ts`, `app/components/home/hero/loader-timeline.ts`, `use-loader.ts`, `lockup.tsx`, `hero.css`, `hero.tsx`
- Test: `app/lib/intro-session.test.ts`, `app/components/home/hero/loader-timeline.test.ts`

**Interfaces:**
- `INTRO_HEAD_SCRIPT` also sets `window.__introT0 = performance.now()` when it adds `intro` (test with an injected fake `performance` and `window`).
- The name's letters are rendered by the server with `style="--i: {index}"`. CSS under `html.intro`: each letter runs `name-in` (the current blur-up, 0.9 s) with `animation-delay: calc(160ms + var(--i) * 58ms)` and `name-out` with `animation-delay: calc(1750ms + var(--i) * 24ms)`; the wrapper runs the 3.2 s grow from 0.72 to 1. No JavaScript is needed for the name.
- `LOADER.lettersOut` becomes `1750`. New constants: `revealMaxWait: 1500`, `firstPaintingMaxWait` removed.
- `loaderSchedule` no longer emits `grow`, `letterIn`, `letterOut` (CSS owns them); it emits `logo`, `reveal`, `nameSmall`, `roles`, `done`.
- `use-loader.ts` computes `elapsed = performance.now() - window.__introT0` on mount and schedules each remaining step at `max(0, step.at - elapsed)`.
- `revealPlan(s: { paintingReadyAt: number | null; now: number; revealAt: number }): { action: "sharp" | "placeholder" | "wait"; at: number }`: sharp if the painting is ready by `revealAt`; wait until it is ready if that happens before `revealAt + 1500`; otherwise placeholder at `revealAt + 1500`. Steps after the reveal shift by `at - revealAt`, so the loader's total length is at most 4.8 s + 1.5 s. When the reveal used the placeholder, the sharp painting crossfades in (400 ms) when it arrives; if it never arrives the cycle moves on after 10 s.
- `html.intro` is removed at `done` in every case. The 15 s head-script failsafe stays.

- [ ] **Step 1: Write the failing tests:** `revealPlan({ paintingReadyAt: 2000, now: 2800, revealAt: 2800 })` gives `{ action: "sharp", at: 2800 }`; ready at 3500 gives `{ action: "sharp", at: 3500 }`; `paintingReadyAt: null` at `now: 4300` gives `{ action: "placeholder", at: 4300 }`; at `now: 3000` with null gives `{ action: "wait", at: 4300 }`; `loaderSchedule("Aditya Bhoir")` has no `letterIn` step and ends with `done` at 4800; the head script sets `__introT0` only in the play case.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run all checks. Controller, with `scripts/audit/loader-throttled.json` (CDP network throttling to 400 kbit/s, cache off): the name is visible within 300 ms of first paint; `html.intro` is gone by 6.5 s after navigation; the hero shows the blurred placeholder then the sharp painting; the name is fully gone before the logo starts. Unthrottled: the sequence matches the before sheet apart from the earlier name exit.
- [ ] **Step 5: Commit** `R33.3: loader starts at first paint and never waits more than 1.5 s for the painting`.
- [ ] **Step 6 (controller):** push, PR `R33: loader and hero`. Start `polish/r34-layout`.

---

## Part R34: type and layout

### Task 10: Apply the tokens

**Files:**
- Modify: `hero.css`, `cards.css`, `blocks.css`, `layer.css`, `reading.css`, `watching.css`, `app/components/site-nav.tsx`, `app/components/react-bits/dock-nav.tsx`

**Mapping (every text style on the home page lands on one of these):**

| Today | Becomes |
| --- | --- |
| 10.5px key hints, 11px close hint, 11px caption artist | `--t-micro` (12px) |
| 11.5px cue and layer hints, 12px role and counts, 12.5px lists, pills, placeholders, link rows, 13px chip title | `--t-meta` (13px) |
| 13.5px card paragraphs, block copy, book note | `--t-body` |
| 13.5px caption title | `--t-meta` in Space Mono italic (unchanged face) |
| 14px credits blurb, 18px small name | `--t-lead` |
| 14.5px roles line | stays `clamp(11.5px, 1.05vw, 14.5px)` (signed off) |
| 34.6px layer titles | `--t-title` |
| 63.4px block titles | `--t-display` |
| 57.6px card heading | `--t-hero` |
| text at 42 to 55% opacity | `--ink-3` (62%) |
| text at 60 to 72% | `--ink-2` (72%) |
| text at 84 to 100% | `--ink-1` (92%), except headings which stay 100% |

- Card paragraphs get `line-height: 1.7`. Block copy keeps `max-width: 38ch`.

- [ ] **Step 1:** Apply the mapping. No layout rules change in this task.
- [ ] **Step 2:** Run all checks. Controller: `scripts/audit/fonts.json` lists every visible font size on hero, cards, blocks, both layers and the detail view at 1440 and 390 wide; the only sizes under 24px are 12, 13, 14, 15 and 18 plus the roles clamp; no text colour has alpha under 0.62.
- [ ] **Step 3: Commit** `R34.1: one type scale and three text strengths`.

### Task 11: Rails, cue, blocks, focus, small fixes

**Files:**
- Modify: `cards.css`, `hero.css`, `blocks.css`, `layer.css`, `interest-blocks.tsx`, `mini-previews.ts`, `credits-card.tsx`, `content/site/home.json`, `app/root.tsx` (global `:focus-visible` rule)
- Create: `public/portraits/ohshin.jpg` (220px JPEG from `public/profile.png`, with `sips`)
- Test: `app/components/home/blocks/mini-previews.test.ts`

**Interfaces and values:**
- Rail label: the span counter-scales so it renders at 13px at rest: `transform: rotate(180deg) scale(calc(1 / var(--card-scale)))`, with `--card-scale` set by `use-card-poses.ts` alongside the transform (0.56, 0.5 on phones, 1 when open) (H-01).
- Cue: `--t-meta`, `--ink-2` at 75% (H-02). While a card is open, cue and caption are `opacity: 0; visibility: hidden` (C-03).
- Blocks section: `padding: var(--space-section) 0 calc(var(--space-section) + var(--dock-clear))`, blocks vertically centred in what is left (B-01). The mini shelf row is centred and scaled to span the block's inner width: `fitMiniShelf(spines: { w: number }[], innerWidth: number, gap: number): number` returns the scale, capped at 1.6 (B-02).
- `countLabel(n: number, one: string, many: string): string` ("1 book", "14 books") used by blocks and layer header (B-04).
- Focus rings only for keyboard: every `:focus` outline rule on the home page becomes `:focus-visible`; add `:focus:not(:focus-visible) { outline: none }` for buttons and links (N-06).
- Credits portrait uses `/portraits/ohshin.jpg`; `home.json` `credits.image` updated (C-04). `public/profile.png` deleted if nothing else uses it.
- Landscape phones: under `(max-height: 480px)` the cards' height is `calc(100dvh - 24px)` and the dock clear is ignored while a card is open (C-05).
- Add `overscroll-behavior: none` on `html.cards-open`; the "See the reel" pill reads "See the work" and its focus ring is not clipped (4px padding on `.intro-text`) (deferred notes from Task 9).

- [ ] **Step 1: Write the failing tests:** `fitMiniShelf([{ w: 20 }, { w: 30 }], 200, 3)` is `1.6` (capped); with inner width 60 it is `60 / 53`; `countLabel(1, "book", "books") === "1 book"`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run all checks. Controller: rail labels are readable at rest (measured rendered height at least 12px); the space above and below the blocks is equal within 4px at 1440x900 and 1920x1080; no outline on a block after closing a layer with the mouse; Tab still shows rings.
- [ ] **Step 5: Commit** `R34.2: readable rails, balanced blocks, keyboard-only focus rings`.
- [ ] **Step 6 (controller):** push, PR `R34: type and layout`. Start `polish/r35-shelf`.

---

## Part R35: shelf

### Task 12: A shelf that is never empty

**Files:**
- Create: `app/components/home/reading/shelf-placeholder.tsx`
- Modify: `shelf-engine.ts`, `shelf-scene.ts`, `reading-scene.tsx`, `reading.css`, `app/utils/idle.ts`
- Test: `app/utils/idle.test.ts`

**Interfaces:**
- `createSlicer(): { run(steps: Array<() => void>): Promise<void>; setUrgent(on: boolean): void }` in `idle.ts`. Relaxed: one step per idle callback (1200 ms timeout). Urgent: steps run back to back inside `requestAnimationFrame` callbacks, stopping each frame once 8 ms of work has been done. Switching to urgent takes effect at the next step.
- `ShelfEngine` gains `setUrgent(on: boolean): void` and `ready(): boolean`. `ReadingScene` calls `setUrgent(true)` when it mounts and `setUrgent(false)` when it unmounts.
- `ShelfPlaceholder({ books })`: the plank and one flat bar per book (spine colour, width `14 + pages * 0.055` px scaled to the stage, height from `heightIn`), laid out along the bottom third of the stage where the 3D shelf will stand. Shown when the layer becomes active and `engine.ready()` is false; it fades out over 300 ms when the engine's first frame has drawn. When the placeholder was shown, `start({ skipIntro: true })` places the books without the drop-in.
- When the engine was ready, nothing changes: the drop-in plays.

- [ ] **Step 1: Write the failing test:** in urgent mode with a fake `requestAnimationFrame` and a fake clock where each step takes 3 ms, 10 steps complete in 4 frames (3, 3, 3, 1); in relaxed mode each step waits for its own idle callback; switching to urgent after step 2 runs the rest in frames.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run all checks. Controller: `scripts/audit/shelf-cold.json` (fresh profile, deep link `/#reading`, CPU throttled 4x): the placeholder is visible in the first frame after the layer finishes growing; the 3D shelf replaces it within 2.5 s; no frame over 50 ms while it prepares. Warm: the drop-in still plays.
- [ ] **Step 5: Commit** `R35.1: the shelf shows a placeholder until it is ready and prepares urgently when open`.

### Task 13: Straight drop, movement with any input, clean close

**Files:**
- Modify: `shelf-math.ts`, `shelf-engine.ts`, `shelf-input.ts`, `reading-scene.tsx`, `reading.css`, `layer/interest-layer.tsx`, `layer.css`
- Test: `shelf-math.test.ts`

**Interfaces:**
- Drop-in: no tilt (remove the `qZ((1 - e) * tilt)` term); fall distance `DROP_FALL = 0.6`; `DROP` and `STAG` unchanged (S-03).
- `panFromDrag(startX: number, dxPx: number, dist: number, viewH: number, maxX: number): number` (today's formula, clamped) and `flick(v: number, dt: number): { dx: number; v: number }` with friction `v *= 0.05 ** dt`, stopping under 0.02 units/s. Drag pans for every pointer type; a drag is a movement over 6px, and a drag never opens a book. `setPointerCapture` on drag start. Horizontal wheel (`|deltaX| > |deltaY|`) and shift+wheel pan by `delta * dist / viewH`. Release velocity carries on through `flick` (S-02).
- `initialCamX(maxX: number, narrow: boolean): number`: `-maxX` when `narrow` (viewport under 700px) so the first book is fully visible, else 0.
- Position marker: a 2px line under the plank, shown only when `maxX > 0`; its thumb's left edge is `((camX + maxX) / (2 * maxX)) * (1 - visibleFraction)` of the track. `visibleFraction(dist, aspect, fovDeg, span): number` in `shelf-math.ts`.
- Hint text: narrow screens with a fine pointer read "Drag or scroll sideways to look along the shelf. Click a book to open it."
- Close: `InterestLayer` first removes `ready` (stage fades over 120 ms), then starts the shrink 120 ms later (S-04). Reduced motion: no delay.
- Layer header: `background: linear-gradient(180deg, rgba(5,4,3,.92), rgba(5,4,3,.6) 60%, rgba(5,4,3,0))`, at least 120px tall (S-05, W-03). The `Esc` key chip is hidden under `(hover: none)` (S-06).

- [ ] **Step 1: Write the failing tests:** `initialCamX(0.8, true) === -0.8`, `initialCamX(0.8, false) === 0`; `panFromDrag(0, -200, 8.6, 844, 0.82)` is `0.82` (clamped) and with `dxPx: 40` is about `-0.367`; `flick(1, 1 / 60)` returns a `v` of about `0.951` and after 200 steps `v` is exactly 0; `visibleFraction` is 1 when `maxX` is 0 for the same inputs.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run all checks. Controller, at 390x844: with **mouse** events (no touch emulation) a drag moves the shelf to both ends and a click opens a book; horizontal wheel events pan it; with touch a drag pans and a tap opens; the first book is fully visible on open; the marker moves. At 1440x900 nothing pans (the shelf fits) and no book tilts during the drop-in. Frame sampler: no frame over 20 ms.
- [ ] **Step 5: Commit** `R35.2: books drop straight; the shelf pans with mouse, trackpad and touch`.
- [ ] **Step 6 (controller):** push, PR `R35: shelf`. Start `polish/r36-wall`.

---

## Part R36: wall

### Task 14: Wall math for depth, echo and arrival

**Files:**
- Modify: `app/components/home/watching/wall-math.ts`
- Test: `wall-math.test.ts`

**Interfaces:**
- `PLANE = { far: { scale: 0.86, dim: 0.82, speed: 0.6, bias: 0.6, parallax: 0.5 }, near: { scale: 1, dim: 1, speed: 1, bias: 0, parallax: 1 } }`; `planeOf(cx: number): "near" | "far"` (odd columns are far; correct for negative `cx`).
- `columnOffset(t, cx)` multiplies its speed by `PLANE[planeOf(cx)].speed` (the existing `-0.72` direction factor stays).
- `parallaxShift(pointer: { x: number; y: number } | null, vw: number, vh: number, plane): { x: number; y: number }`: `((0.5 - px / vw) * 28) * plane.parallax` on x and the same on y with 20; `{0, 0}` when the pointer is null.
- `echoSet(videos: { channel: string }[], focusIndex: number | null): Set<number>`: indexes of other videos with the focused video's channel; empty when nothing is focused.
- `arrival(sinceLoadedMs: number, distanceFromCentre: number, pitch: number): { alpha: number; scale: number }`: starts after a delay of `distanceFromCentre / pitch * 40` ms (capped at 600), then eases over 300 ms from `{ alpha: 0, scale: 0.96 }` to `{ alpha: 1, scale: 1 }`.
- Also fix the deferred notes in this file: `layoutTiles` skips columns `c >= count` (D-note from Task 15), `tileTransform`'s input `w` is renamed `weight`, the unused `cols` option and `DRIFT` export are removed, and the two weak tests are tightened (capacity pinned to 112, the gap probe).

- [ ] **Step 1: Write the failing tests:** `planeOf(-1) === "far"`, `planeOf(0) === "near"`; a far column's offset advances 0.6 times as fast as it did before; `parallaxShift(null, ...)` is `{ x: 0, y: 0 }` and at the left edge on the near plane x is `14`; `echoSet` for a focus on the first of three videos by one channel among ten returns the other two; `arrival(0, 0, 300)` is `{ alpha: 0, scale: 0.96 }`, `arrival(300, 0, 300)` is `{ alpha: 1, scale: 1 }`, and at distance 3 pitches it is still `{ 0, 0.96 }` at 100 ms; `layoutTiles` with `count: 3` returns only indexes 0 to 2.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run tests. Expected: PASS.
- [ ] **Step 5: Commit** `R36.1: wall math for depth planes, parallax, channel echo and arrival`.

### Task 15: A wall with depth

**Files:**
- Modify: `wall-engine.ts`, `wall-gl.ts`, `wall-thumbs.ts`, `wall-input.ts`, `watching-scene.tsx`, `video-detail.tsx`, `watching.css`, `layer/interest-layer.tsx`
- Create: `app/components/home/watching/wall-placeholder.tsx`

**Behaviour (spec 3.7):**
- Far-plane tiles draw first, at `PLANE.far.scale` about their own centre, with brightness times `PLANE.far.dim` and mip bias plus `PLANE.far.bias`; near tiles draw over them. The focused tile always draws last at full brightness whatever its plane.
- Pointer parallax eases toward its target with `1 - exp(-dt * 6)`; on touch the target comes from the drag velocity, not the gyroscope. None under reduced motion.
- Echo: while a tile is focused, tiles in `echoSet` keep brightness 1 and get a 1px cream edge at 35% (a fourth `uKind` in the shader); the chip's second line appends ", N more from this channel" when N is at least 1.
- Arrival: each tile's alpha and scale come from `arrival` using the time since its thumbnail was uploaded; unloaded tiles keep the animated placeholder.
- `WallPlaceholder`: when the scene becomes active and the engine has not drawn a frame, show a static CSS grid of dark rounded tiles at the wall's tile size; fade out over 300 ms at the engine's first frame. The engine gets the same `setUrgent`/`ready` pair as the shelf for its GL setup (W-01).
- While a video is open the layer header is hidden (`InterestLayer` takes a `headerHidden` prop set through the layer context, replacing the DOM query in `watching-scene.tsx`) (W-04).
- Primary pointer and button 0 only for opening (W-06). The hint adds " Arrow keys and Enter work too." under `(hover: hover)` (W-07).
- `webglcontextlost` on either canvas switches that scene to its plain-grid fallback (W-08, and the shelf's equivalent).
- The detail view's shot waits for its image to decode before the flight (up to 150 ms) and falls back to `hqdefault` on error.

- [ ] **Step 1:** Implement.
- [ ] **Step 2:** Run all checks. Controller, 1440x900 and 390x844: far columns are visibly smaller, dimmer and slower; moving the pointer shifts the near plane more than the far one; focusing a video with siblings keeps them bright; tiles fade in from the centre on a cold open; the header is hidden while a video is open and the two close buttons never overlap on the phone; right-click does not open; frame sampler: drift and a fast hover sweep have no frame over 20 ms and no long-animation-frame over 50 ms. Never save wall screenshots into the repo.
- [ ] **Step 3: Commit** `R36.2: the wall gains depth planes, parallax, a channel echo and arriving tiles`.
- [ ] **Step 4 (controller):** push, PR `R36: wall` (no screenshots; describe the checks). Start `polish/r37-closeout`.

---

## Part R37: close-out of the home page

### Task 16: Harden the video sync

**Files:**
- Modify: `scripts/sync-videos.ts`, `scripts/youtube.ts`, `package.json`
- Create: `scripts/vite.sync.config.ts`
- Test: `scripts/youtube.test.ts`, `scripts/sync-helpers.test.ts`

**Interfaces (deferred notes D-01 to D-12):**
- `thumbFromStatus(status: number | null, previous: "sd" | "hq" | undefined): "sd" | "hq"`: 200 gives `sd`; 404 gives `hq`; anything else keeps `previous`, or `sd` if there is none.
- `readPrevious` returns `[]` and warns on unreadable or invalid JSON.
- The file is written to `videos.json.tmp` then renamed.
- `diffVideos` compares `id`, `title`, `channel`, `channelUrl`, `subscribers`, `thumb` field by field.
- `parsePlaylist` skips a video lockup that lacks a title or channel and returns it in a second list: `{ videos, skipped: string[] }`; the script warns once per skipped id.
- The script warns when the page contains a `continuationItemRenderer` ("playlist longer than one page; only the first page was read").
- One retry, after 2 s, on a failed playlist fetch.
- `mapLimit` moves to `scripts/youtube.ts` and is tested (never more than 4 running; results in input order).
- `"sync:videos": "vite-node --config scripts/vite.sync.config.ts scripts/sync-videos.ts"` (no Remix warnings).
- The "keeping the previous count" warning says "no count found" when there was no previous count.

- [ ] **Step 1: Write the failing tests** for each bullet above with the fixture extended by one lockup that has no title.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement. Run `yarn sync:videos` once; commit the refreshed `videos.json`.
- [ ] **Step 4:** Run all checks.
- [ ] **Step 5: Commit** `R37.1: video sync hardened`.

### Task 17: Accessibility pass, measurements, documentation

**Files:**
- Create: `scripts/perf/sample-frames.js` (console snippet: `sampleFrames(ms)` resolving `{ n, avg, p95, max, over20 }`)
- Modify: whatever the pass finds; `README.md`; `docs/redesign/feedback-log.md` (round 5 "what was done", a "Build" section, a measured table); `docs/redesign/README.md`; `docs/superpowers/specs/2026-11-02-home-redesign-design.md` (roles line is IBM Plex Mono, T-04); `docs/redesign/deferred-review-notes.md` (no row left `open`: each fixed or closed with a reason)

- [ ] **Step 1:** Keyboard-only walkthrough of hero, cards, blocks, shelf, wall, detail: everything reachable, visible focus, focus returns to where it came from, Esc order (video or book, then layer, then card). Fix what fails. `yarn lint` (jsx-a11y) clean.
- [ ] **Step 2:** Reduced-motion walkthrough with emulation: no loader, crossfades, no drift, no drop-in, no parallax, page transition is a plain fade.
- [ ] **Step 3:** Measure every scenario of the earlier spec's section 9 at 1440x900 and 390x844 with `sampleFrames`; record average, worst frame and frames over 20 ms in the feedback log. All must have zero frames over 20 ms once content is loaded.
- [ ] **Step 4:** Lighthouse (mobile) on the built site: record LCP, CLS, total transfer for `/`. LCP target under 2.5 s on the simulated slow 4G profile.
- [ ] **Step 5:** Rewrite `README.md`: what the site is, the page map, how to run, test and deploy, `yarn sync:videos`, `yarn paintings`, where content lives, the audit tools, the note about `@vercel/remix` peer versions (K-10).
- [ ] **Step 6:** Close every remaining row in the deferred notes.
- [ ] **Step 7: Commit** `R37.2: accessibility pass, measurements and documentation`.
- [ ] **Step 8 (controller):** push, PR `R37: close-out of the home page` with the measured table and Aditya's device checklist (mid-range Android, iPhone, integrated-graphics laptop). Start `work/r38-rings`.

---

## Part R38: work page

### Task 18: Work content and removal of the old page

**Files:**
- Create: `content/site/work.json`
- Modify: `app/content/schemas.ts`, `app/types.ts`, `app/content/site-content.server.ts`, `app/content/loaders.server.ts`, `app/routes/work.tsx`
- Delete: `app/components/projects/*`, `content/site/projects.json`, `clients.json`, `tech-stack.json`, `work-experience.json`, `public/clients/`, their schemas, types, mappers and loaders, `app/components/ui/*` and `react-bits/decrypted-text.tsx` if nothing else uses them, the Tailwind keyframes only they used
- Create: `app/components/work/work-page.tsx` (for now: the dark background and the intro text only)
- Test: `app/content/schemas.test.ts`, `app/content/loaders.test.ts`

**Interfaces:**
```ts
export type WorkSource = "youtube" | "instagram" | "vimeo" | "other";
export interface WorkVideo { id: string; title: string; for: string; year: number; url: string; cover?: string; source: WorkSource }
export interface WorkClient { id: string; name: string; handle: string; avatar: string; url: string; socials: { type: "youtube" | "instagram" | "x" | "website"; url: string }[] }
export interface WorkStackItem { id: string; mark: string; label: string }
export interface SiteWork { intro: { title: string; text: string }; stack: WorkStackItem[]; longForm: WorkVideo[]; shortForm: WorkVideo[]; clients: WorkClient[] }
```
- Schema: `mark` is 1 to 3 characters; `intro.text` has at most 20 words; `url` is https; `cover`/`avatar` is a root-relative path or https URL; ids unique across each list; a YouTube item without `cover` must have a URL from which `youtubeId(url): string | null` extracts an 11-character id.
- `coverUrl(v: WorkVideo, tall: boolean): string`: `v.cover` if set; else for YouTube `https://i.ytimg.com/vi/{id}/{tall ? "oar2" : "hqdefault"}.jpg`; else `https://picsum.photos/seed/{id}/{tall ? "360/640" : "640/360"}`.
- `work.json`: intro `{ "title": "Work", "text": "Six years of cutting long videos, shorts and brand films for creators and companies." }`; stack (the eight tools of the old `tech-stack.json`, same order): `Pr` Premiere Pro, `Ae` After Effects, `Fc` Final Cut Pro, `Bl` Blender, `Ps` Photoshop, `Ai` Illustrator, `Fg` Figma, `Lr` Lightroom; 16 long-form and 24 short-form placeholders titled `Placeholder long 01` and so on, `for: "Placeholder"`, `year: 2026`, `url: "https://www.youtube.com/@fragtaco"`, `source: "other"`, covers `https://picsum.photos/seed/ft-long-01/640/360` and `https://picsum.photos/seed/ft-short-01/360/640`; 10 clients `Placeholder client 01`, handle `@placeholder`, avatar `https://picsum.photos/seed/ft-client-01/160/160`, the same URL, one `youtube` social.
- `getWorkPageContent()` returns `{ work, navigationItems, socialLinks }`.

- [ ] **Step 1: Write the failing tests:** `work.json` parses; 8 stack items, 16 long, 24 short, 10 clients; `intro.text` word count at most 20; a mark of 4 characters is rejected; `youtubeId("https://youtu.be/GrtKxfATyTw") === "GrtKxfATyTw"` and for `"https://www.youtube.com/watch?v=GrtKxfATyTw&t=3"`, null for an Instagram URL; `coverUrl` for a YouTube item without a cover returns the `hqdefault` URL; no string in the file contains an em dash.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement and delete. `grep -r "components/projects\|work-experience\|tech-stack" app` finds nothing.
- [ ] **Step 4:** Run all checks. `/work` renders the background and intro with the dock; no 404s in the console.
- [ ] **Step 5: Commit** `R38.1: work content file; old work page removed`.

### Task 19: Ring and layout math

**Files:**
- Create: `app/components/work/ring-math.ts`, `app/components/work/view-layout.ts`
- Test: `ring-math.test.ts`, `view-layout.test.ts`

**Interfaces:**
```ts
export type RingId = "stack" | "long" | "short" | "clients";
export const RING = {
  stack:   { radius: 0.21, period: 90,  dir: 1,  min: 44, max: 56,  aspect: 1 },
  long:    { radius: 0.34, period: 150, dir: -1, min: 96, max: 176, aspect: 16 / 9 },
  short:   { radius: 0.50, period: 200, dir: 1,  min: 54, max: 96,  aspect: 9 / 16 },
  clients: { radius: 0.68, period: 260, dir: -1, min: 44, max: 72,  aspect: 1 },
} as const;
export function ringRadius(id: RingId, vw: number, vh: number): number;            // RING[id].radius * Math.min(vw, vh), times 1.25 when vw < 700
export function itemWidth(id: RingId, count: number, radius: number): number;      // clamp(min, 2πr / (count * 1.3), max)
export function splitRing(id: RingId, count: number, radius: number): { rings: number[]; hidden: number };
// one ring when the items fit at min width; else an inner ring filled to capacity and an outer ring at radius r * 1.14 filled to its capacity; anything left over is `hidden` (shown only in the picked view)
export function ringCapacity(id: RingId, radius: number): number;                  // floor(2πr / (min * 1.3))
export function slotAngle(index: number, count: number): number;                   // degrees, index * 360 / count - 90
export function slotPosition(angleDeg: number, radius: number, cx: number, cy: number): { x: number; y: number };
```
```ts
export type ViewId = "all" | "long" | "short" | "clients";
export function viewFromSearch(search: string): ViewId;                            // ?view=long|short|clients, else "all"
export function brickLayout(p: { count: number; cols: number; itemW: number; itemH: number; gapX: number; gapY: number; width: number; top: number }): { x: number; y: number }[];
// rows of `cols`; odd rows shifted right by (itemW + gapX) / 2 and holding cols - 1 items; the block centred in `width`
export function viewColumns(view: Exclude<ViewId, "all">, vw: number): number;      // long: 4 (2 under 700); short: 7 (3); clients: 6 (3)
export function contentHeight(positions: { y: number }[], itemH: number): number;
```

- [ ] **Step 1: Write the failing tests:** `ringRadius("stack", 1440, 900) === 189`; `itemWidth("long", 16, 306)` is `clamp(96, 2π·306 / 20.8, 176)` (about 92.4, so 96); `itemWidth("long", 8, 306) === 176` (capped); `splitRing("short", 24, 450)` is `{ rings: [24], hidden: 0 }`; `ringCapacity("short", 450) === 40`; `splitRing("short", 120, 450)` is `{ rings: [40, 45], hidden: 35 }`; `splitRing("short", 60, 450)` is `{ rings: [40, 20], hidden: 0 }`; `splitRing("stack", 1, 189)` is `{ rings: [1], hidden: 0 }`; `slotAngle(0, 8) === -90`; `slotPosition(-90, 100, 500, 400)` is `{ x: 500, y: 300 }`; `viewFromSearch("?view=short") === "short"`, `"?view=nope"` gives `"all"`; `brickLayout` with 7 items and 4 columns gives rows of 4 and 3 with the second row shifted by half a pitch, no two positions overlapping, all inside `width`; `viewColumns("long", 390) === 2`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5: Commit** `R38.2: ring and view layout math`.

### Task 20: Rings, centre and background

**Files:**
- Create: `app/components/work/rings.tsx`, `work-item.tsx`, `work-background.tsx`, `work.css`
- Modify: `work-page.tsx`

**Behaviour (spec 4.1 to 4.3, 4.6):**
- The stage is `position: fixed; inset: 0` under the dock; the page does not scroll in the `all` view.
- Each ring is a `<ul>` whose rotation is a CSS animation (`rotate` from 0 to `dir * 360deg`, linear, infinite, the ring's period). Each `<li>` is placed with `transform: rotate(angle) translate(radius) rotate(-angle)` and counter-rotates with the reverse animation so it stays upright. Radii and item widths are CSS variables set from `ring-math` on mount and on resize (no per-frame JavaScript).
- Stack items: rounded squares with the mark in Doto on `#191411`, a 1px cream border at 14%; `title` and a tooltip with the label; not links.
- Long and short items: `<a href target="_blank" rel="noopener noreferrer">` with the cover (`loading="lazy"`, `decoding="async"`, rounded 10px), a real `aria-label` (title, for, year).
- Clients in the rings: `<button>` with the avatar (round), `aria-label` the client's name; click switches to the clients view.
- Hover or focus on an item: its ring and the item's counter-rotation pause (`animation-play-state`), the item scales to 1.12, a one-line label appears beside it.
- Centre: `<h1>` "Work" in Doto at `--t-hero`, the intro text at `--t-body` with `max-width: 32ch`, centred.
- Background: two absolutely positioned radial gradients (ember `#31100A` at 60%, accent `#FC4C00` at 9%), each 120vmax, animated with `translate` on 70 s and 110 s alternate loops; the shared dots and grain on top. Reduced motion: rings and glows stand still.
- Enter: on arrival the rings scale from 0.92 and fade in over 500 ms, 60 ms apart from the centre out.

- [ ] **Step 1:** Implement.
- [ ] **Step 2:** Run all checks. Controller at 1440x900, 1920x1080, 390x844: four rings turn in alternating directions, items upright, outer rings cropped by the screen, hover pauses one ring only, links open the right URL in a new tab; frame sampler: no frame over 20 ms with all rings turning; the page does not scroll.
- [ ] **Step 3: Commit** `R38.3: rotating rings, centre intro and moving background`.

### Task 21: Switcher console and picked views

**Files:**
- Create: `app/components/work/work-switcher.tsx`, `use-view-flip.ts`, `client-socials.tsx`
- Modify: `app/components/site-nav.tsx` (an optional `upperRow?: ReactNode` rendered as a second row inside the same glass container, above the main row), `work-page.tsx`, `rings.tsx`, `work.css`

**Behaviour (spec 4.4, 4.5):**
- Switcher: `role="tablist"` with tabs all, long form, short form, clients, and a link "timeline" (`<Link to="/timeline" viewTransition prefetch="intent">`). Arrow keys move between tabs. Choosing a tab calls `navigate("?view=...", { replace: false, preventScrollReset: true })`; the view is always derived from `viewFromSearch(location.search)`.
- Entering a picked view, in this order: (1) record each chosen item's rect; (2) add the view class: the other rings get `scale(1.6)` and `opacity: 0` over 350 ms and `visibility: hidden` after; the stack ring becomes a static row at the top right at 70% size; rotation animations on the chosen ring are removed and the items become absolutely positioned at `brickLayout` positions inside a scrollable stage (`overflow-y: auto`, `overscroll-behavior: contain`, top and bottom dark fades); (3) for each item, animate with the Web Animations API from its old rect to its new one (`transform` only, 600 ms, `cubic-bezier(.2, 1.2, .3, 1)`, delay `index * 12` ms). Leaving reverses: items animate back to their ring slots, then the rotation resumes.
- `use-view-flip.ts` exposes `flip(elements: HTMLElement[], change: () => void, opts): Promise<void>`; reduced motion makes it a 150 ms opacity crossfade with no travel.
- A small title at the top left replaces the centre intro: the view's name in Doto at `--t-title` and `countLabel` beneath.
- Videos in a view: hover or focus brightens the cover and dims the others to 70%; a caption under the cover shows title, `for`, year at `--t-meta`. Click opens the link in a new tab.
- Clients in a view: avatar 72px, name and handle beneath; hover or focus shows `ClientSocials` (icon links from `react-icons/fa6`, each `target="_blank" rel="noopener noreferrer"` with an `aria-label` such as "Placeholder client 01 on YouTube"); clicking the avatar opens `url`. On touch, the first tap shows the socials and the second opens `url`.
- Phones: the same, with `viewColumns` for narrow widths; the switcher row scrolls sideways (`overflow-x: auto`, no scrollbar).

- [ ] **Step 1:** Implement.
- [ ] **Step 2:** Run all checks. Controller at 1440x900 and 390x844: each tab regroups the right items without a jump at the start or end of the travel; Back returns to the previous view; `/work?view=clients` opens directly in that view; the stack is never clickable; frame sampler during each change: no frame over 20 ms; keyboard: Tab reaches every item, arrows move between tabs.
- [ ] **Step 3: Commit** `R38.4: switcher console and picked views`.
- [ ] **Step 4 (controller):** screenshots `r38-work-rings-desktop.jpg`, `r38-work-long-desktop.jpg`, `r38-work-rings-phone.jpg` (placeholders only, so they may be committed); push; PR `R38: work page`. Start `work/r39-timeline`.

---

## Part R39: timeline

### Task 22: Timeline data and math

**Files:**
- Create: `content/site/timeline.json`, `app/components/timeline/timeline-math.ts`
- Modify: `app/content/schemas.ts`, `app/types.ts`, `app/content/site-content.server.ts`, `app/content/loaders.server.ts`
- Test: `app/components/timeline/timeline-math.test.ts`, `app/content/schemas.test.ts`

**Interfaces:**
- `timeline.json`: `{ "start": "2020-12-01", "roles": [ { "id": "student", "label": "Student and part-time editor", "from": "2020-12-01", "color": "#3E8A7C" }, { "id": "editor", "label": "Full-time editor", "from": "2021-06-01", "color": "#D9A441" }, { "id": "social", "label": "Social media manager", "from": "2022-01-01", "color": "#C94F35" }, { "id": "creator", "label": "Content creator and editor", "from": "2022-09-01", "color": "#9C8AC9" }, { "id": "head", "label": "Content head", "from": "2023-01-01", "color": "#FC4C00" }, { "id": "freelance", "label": "Freelance creative editor", "from": "2025-12-01", "color": "#fdfce6" } ], "marks": [] }`. Schema: ISO dates, roles strictly ascending, the first role's `from` equals `start`.
- All date math in UTC days:
```ts
export function dayIndex(iso: string, startIso: string): number;                 // whole days between
export function dateOfIndex(index: number, startIso: string): string;           // ISO date
export function totalDays(startIso: string, todayIso: string): number;          // inclusive
export function roleAt(index: number, roles: { from: string }[], startIso: string): number;   // role index for a day
export function roleCounts(roles: { from: string }[], startIso: string, todayIso: string): number[];
export function columnsFor(vw: number): number;                                 // 28 under 700, else 56
export function cellAt(index: number, cols: number): { col: number; row: number };
export interface View { scale: number; x: number; y: number }                   // scale = pixels per cell; x, y = top-left of the grid in screen pixels
export function fitView(cols: number, rows: number, vw: number, vh: number, margin: number): View;
export function zoomAt(view: View, factor: number, px: number, py: number, min: number, max: number): View;   // keeps the cell under (px, py) fixed
export function clampView(view: View, cols: number, rows: number, vw: number, vh: number): View;             // the grid cannot leave the screen by more than half the viewport
export function hitCell(view: View, px: number, py: number, cols: number, total: number): number | null;
export function detailLevel(scale: number): 0 | 1 | 2;                          // under 10, 10 to 28, over 28
```
- The loader for `/timeline` returns `{ timeline, today: string, navigationItems, socialLinks }` with `today` as the server's UTC date.

- [ ] **Step 1: Write the failing tests:** `totalDays("2020-12-01", "2026-11-11") === 2172`; `roleCounts(...)` for that day is `[182, 214, 243, 122, 1065, 346]`; `dayIndex("2024-02-29", "2020-12-01") === 1185` and `dateOfIndex(1185, ...)` returns it; `roleAt(181, ...) === 0` and `roleAt(182, ...) === 1`; `columnsFor(390) === 28`; `cellAt(57, 56)` is `{ col: 1, row: 1 }`; `fitView(56, 39, 1440, 900, 80)` gives a scale of about 18.97 with the grid centred; `zoomAt` keeps the cell under the pointer within 0.001 px and clamps at `min` and `max`; `hitCell` returns null beyond the last day in the final row; `detailLevel(9.9) === 0`, `detailLevel(10) === 1`, `detailLevel(28.1) === 2`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5: Commit** `R39.1: timeline data and math`.

### Task 23: The timeline page

**Files:**
- Create: `app/routes/timeline.tsx`, `app/components/timeline/timeline-page.tsx`, `timeline-canvas.ts`, `timeline-legend.tsx`, `timeline.css`

**Behaviour (spec section 5):**
- `timeline-canvas.ts`: `createTimeline(canvas, data, today, opts): { setView(v: View, animate: boolean): void; view(): View; fit(): void; hit(px, py): number | null; dispose(): void }`. One 2D canvas at `min(devicePixelRatio, 2)`. Redraws only on a view change, a resize, a hover change or the pulse (the pulse redraws only today's cell, at 30 fps, and not under reduced motion). Squares: flat role colour, inset 8% so grid lines show; grid lines cream at 10%; a grain pattern (one 128px noise canvas, `overlay`, 12%) over the squares; the first day of each role has a notched corner; today's cell breathes between 70% and 100% over 2.4 s. Level 1 adds month names in the left margin at each month's first row and a rule at each new year; level 2 adds the day number in each cell (IBM Plex Mono, ink chosen by the cell's luminance) and the month on the 1st.
- Zoom: wheel (`deltaY`, `ctrlKey` pinch included) around the pointer; `+`/`=` and `-` around the centre; pinch with two pointers; two buttons. Range: the fit scale to 72px per cell. Eased over 180 ms. Pan: drag, arrow keys (48px per press), two-finger scroll when not pinching. `0` and a "fit" button return to `fitView`.
- Hover or keyboard focus on a cell shows a tooltip: `11 November 2026` and the role's label. With the canvas focused, arrow keys move a focus cell when Shift is held.
- `TimelineLegend`: a gilt block (`#D9A441`, ink text) at the top left: "Timeline" in Doto, "Dec 2020 - today", the day count, a back link "work" (`<Link to="/work" viewTransition>`); under it the roles with a colour chip and `countLabel(days, "day", "days")` with thousands separators. Collapses to a single row on phones with a "roles" disclosure.
- A visually hidden table lists each role with its start date, end date and day count.
- The dock shows work as active. Meta title `Timeline - FragTaco`.
- Background: the work page's `WorkBackground` at half strength.

- [ ] **Step 1:** Implement.
- [ ] **Step 2:** Run all checks. Controller at 1440x900 and 390x844: opens fitted with every day visible; wheel zoom stays under the pointer; day numbers appear past 28px per cell; today's cell is the last one and reads as freelance; arrow keys pan; `0` refits; the tooltip matches the cell (check 29 February 2024 and the first of each role); frame sampler while zooming in and out for 3 s: no frame over 20 ms; arriving from the switcher uses the page transition.
- [ ] **Step 3: Commit** `R39.2: timeline page with zoom and pan`.
- [ ] **Step 4 (controller):** screenshots `r39-timeline-fit-desktop.jpg`, `r39-timeline-zoomed-desktop.jpg`, `r39-timeline-phone.jpg`; push; PR `R39: timeline`.

---

## Final (controller only)

### Task 24: Whole-branch review

- [ ] Dispatch one Opus 5.5 reviewer over `redesign/r30-finish..HEAD` with the spec, the audit and this plan: correctness, anything in the audit not fixed, anything on the home page that now looks different from the live site, leftover dead code, files over 350 lines, rows still open in the deferred notes. One fix wave by a Sonnet implementer for Critical and Important findings, re-reviewed.

### Task 25: Comparison page

- [ ] Capture "after" with the same step files used for "before" (`scripts/audit/capture-desktop.json`, `capture-phone.json`, `transition.json`) against the dev server, into `docs/redesign/compare/after/` (and `compare/local/after/` for any image showing YouTube thumbnails or book covers).
- [ ] Write `docs/redesign/compare/index.html`: a single static page, dark, the site's fonts, one row per comparison: a short title, the audit ids it answers, the before image on the left and the after image on the right at the same size, one line on what changed. Rows: loader frames; hero; rails close-up; intro card; credits card; blocks; shelf drop-in; shelf on a phone; shelf opening empty versus placeholder; wall (local images); wall detail on a phone (local); page change home to work; page change work to home; work page old versus rings; timeline (after only); type scale table (before sizes versus after sizes as text). Images under `local/` are referenced with a note "not stored in the repo" and the page hides a row's images if they fail to load.
- [ ] Add `docs/redesign/compare/local/` to `.gitignore`. Commit `R39.3: before and after comparison page`.

### Task 26: Preview and handback

- [ ] `vercel deploy --yes` from the last branch (a **preview**; do not pass `--prod`; the public link stays on the old version until Aditya decides). Record the preview URL.
- [ ] Copy `docs/redesign/compare/` (including `local/`) into the preview build's `public/compare/` **only if** Aditya has asked for the comparison online; by default it is opened from disk.
- [ ] Update `docs/redesign/feedback-log.md` with the final status, the PR list, the preview URL, the measured table, and what is waiting for Aditya: device checks, real videos and clients, the intro copy, the variations in spec section 8.
- [ ] Final message to Aditya: what was built, the preview link, the comparison page's path, what failed or was skipped, what he needs to do.

## Variations (not built by this plan)

Spec section 8 lists them. Each is its own branch from the end of this plan (`variation/<id>`), one Sonnet task plus one Opus review, with its own `vercel deploy` preview. Build them only when Aditya asks, one at a time.
