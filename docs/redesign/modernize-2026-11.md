# Modernize, the modern web pass (Task 36)

Date: 18 November 2026. Branch `r7/r59-web-pass`. Plan: `docs/superpowers/plans/2026-11-17-modern-web-pass.md`, Task 36; design: `docs/superpowers/specs/2026-11-17-modern-web-pass-design.md`, section 4.4. Records: `docs/redesign/compare/web-pass/`.

The guides were read with the Modern Web Guidance command line, skill version `2026_11_09-5bcc021b` (a newer one, `2026_11_10-47b4c80e`, existed and was not used: the whole pass used one version). The scan covers about a fifth of the guides (52 rules in 38 guides); the sweep below covers the four general guides (`js`, `css`, `html`, `motion`) by searching the code for every pattern they call legacy.

**The result in one paragraph.** The site's own code was already close to what the guides ask for. Nothing in the code the site ships is changed. One change was made (a deferred promise became `Promise.withResolvers()`); the review found that on browsers older than Chrome 119, Safari 17.4 and Firefox 121 it would show the error page instead of the home, for no visible gain, and it was reverted (R151). One setting moved and stays (the TypeScript library level goes to ES2024, type checking only). Everything else is listed below as left, with the reason. The pictures of the five pages before and after are the same (the home picks its painting at random). The rule used for a change: the replacement is Baseline widely available, behaviour and look stay the same, and a test covers the code. The browser floor is part of that rule (section 3.2).

## 1. The scan

`npx -y modern-web-guidance@latest legacy-scan app --json` and the same for `scripts`, each finding checked against its rule's `keepWhen` and `dropWhen`.

| Where | Rule | Finding | Decision |
| --- | --- | --- | --- |
| `app` | `ime-safe-enter-submit` | `components/home/watching/wall-input.ts:85`, Enter on the video wall's canvas | Dropped, left as it is: the rule is about text fields (a composition from a Chinese, Japanese or Korean keyboard); the wall is a canvas with no text input, which the rule's own `dropWhen` names (a non-text widget). |
| `app` | `js/promise-with-resolvers` | `components/home/reading/shelf-spine-fonts.ts:57`, `new Promise((r) => (resolve = r))` | Changed, then reverted (R151, section 3.1): left as it was. |
| `scripts` | `js/copying-array-methods` | five copies sorted or reversed: `audit/make-dock-over-tiles.mjs:49`, `audit/shelf-ready.mjs:101`, `audit/web-vitals-table.mjs:106`, `audit/web-vitals.mjs:57`, `perf/sample-frames.js:30` | Kept as findings, left (ruling R146 below). |
| `scripts` | `js/promise-with-resolvers` | `audit/long-frames.mjs:119`, `audit/make-glass-cost.mjs:130` | Kept as findings, left (R146). |
| `scripts` | `js/structured-clone` | `audit/make-wall-edges.mjs:51`, `JSON.parse(JSON.stringify(x))` | Dropped: the value is serialized again at once by `JSON.stringify` to write a file (the rule's wire-payload exception), so the copy's only job is the JSON round trip. |

The scan skipped 181 tests and docs. With the change in place `legacy-scan app` found one thing, the kept Enter handler (`legacy-scan-app-after.json`); with the code back at `ca22d72`'s it finds the two of `legacy-scan-app-before.json` again (the Enter handler and the shelf's promise).

## 2. The sweep

One line per rule that names a legacy pattern: the guide, the pattern, where it was found (searched in `app/` and `scripts/`, code and tests), the decision.

### Guide `js`

| Pattern | Found | Decision |
| --- | --- | --- |
| `JSON.parse(JSON.stringify(x))` instead of `structuredClone` | `scripts/audit/make-wall-edges.mjs:51` (dropped, section 1); `scripts/audit/make-home-scroll.mjs:94`, inside a string that is run in the page, a copy of two counters | Left: the first is a JSON round trip on purpose; the second is a harness string with no test (R146). None in `app/`. |
| `[...a].sort()`, `a.slice().sort()`, `[...a].reverse()`, `.reverse().find()` instead of `toSorted`, `toReversed`, `findLast` | Scripts: the five of section 1, and six files whose code is run inside the page (`make-experience.mjs`, `make-box-open.mjs`, `make-home-scroll.mjs`, `make-page-change.mjs`, `entrance-page.mjs`, `dock-over-tiles-page.mjs`). In `app/` shipped code: none. Tests: ten (`shuffle`, `change-finish`, `bead-hit`, `climb-engine-chart`, `entrance-css`, `wall-arrival`, `wall-block`, `wall-pose-open`, `wall-spread`, `painting-cycle`) | Left: tests and harnesses are not shipped and have no test of their own (R146). One more look: `components/experience/heights.ts:77,143` sorts a typed array made by `Float32Array.from(...)`; the guide says not to swap a typed array's sort without intending its numeric order and typed result, and the copy there is already of the right kind. Left. |
| `.reduce()` that builds buckets, instead of `Object.groupBy` | `scripts/audit/security-resilience.mjs:23` | Left: it counts (a scalar aggregation, which the guide says to keep). None in `app/`. |
| A deferred promise (`let resolve; new Promise(r => resolve = r)`) instead of `Promise.withResolvers()` | `shelf-spine-fonts.ts` (changed and reverted, R151; left); `app/lib/page-change.ts:121` (the executor assigns a function that calls `resolve`), `app/components/home/layer/frame-box.ts:251` (`resolve` pushed into a list of waiters); scripts: the two of section 1 | The two in `app/` are left: the scan does not flag them, no outer `let resolve` exists to remove, and `page-change.ts` is the page change's core, behind the 34 ms frame gates, so a rewrite with no gain is not worth the risk. Scripts: R146. |
| `new AbortController()` plus `setTimeout` instead of `AbortSignal.timeout()` / `any()` | None. The four `AbortController`s in `app/` (`page-change.ts`, `gallery-engine.ts`, `shelf-engine.ts`, `wall-engine.ts`) tear down listeners and have no timer; `scripts/make-mars.mjs` and `scripts/sync-videos.ts` already use `AbortSignal.timeout()` | Nothing to change. |
| Re-throwing with the old message pasted in, instead of `new Error(message, { cause })` | None. `scripts/audit/chrome-lite.mjs:61` builds a message from a DevTools answer, not from a caught error | Nothing to change. |
| Query strings cut by hand (`split('&')`, `split('=')`) instead of `URLSearchParams` | `app/` uses `URLSearchParams` (`page-view-tracker.tsx`, `webgl-support.ts`). `scripts/audit/shelf-ready.mjs:21` and `long-frames.mjs:130` split `name=value` lists from an environment variable (not query strings) | Left (R146). |
| `decodeURIComponent(escape(...))`, `String.fromCharCode(...bytes)` instead of `TextDecoder` | None. `atob` with `Uint8Array.from` in three audit strings decodes an image, which the guide says to keep | Nothing to change. |
| `innerHTML = ''` or removal loops instead of `replaceChildren()` | None. The site writes no `innerHTML` and has no `removeChild` (the security task removed the last HTML writer) | Nothing to change. |
| `document.createEvent`, `initEvent` instead of `new Event()` | None. The one synthetic event (`wall-engine.ts:216`) already uses `new Event("webglcontextlost")` | Nothing to change. |

### Guide `css`

| Pattern | Found | Decision |
| --- | --- | --- |
| BEM-style names to manage specificity; `@layer` and `:where()` instead | None. The classes are short and component-scoped; Tailwind's own layers are used in `app/styles/tailwind.css` | Nothing to change. |
| An override that undoes a rule (`li { border }`, `li:last-child { border: none }`) instead of `:not()` | None. The one `:last-child` (`home/cards/cards.css:268`) sets a colour on a span, not an override | Nothing to change. |
| The same rule written twice for a pseudo-class that may not be supported, instead of `:is()` / `:where()` | None. The CSS already uses `:is()`, `:not()` with lists and `:where()` | Nothing to change. |
| Resets on `*` | None in the site's CSS (Tailwind's preflight is the library's). The `.home-hero *` style blocks are scoped reduced-motion rules (see `motion`) | Nothing to change. |
| Physical properties (`margin-left`, `left`) instead of logical ones | 64 places in 15 of the 27 style files | Left: the guide itself says not to use logical properties blindly ("would I want this to flip in RTL?"). The pages are fixed, art-directed compositions (a painting, a map, a wall, a shelf) in one language: nothing there should flip. |
| Values that belong in tokens written inline | The sheets read `app/styles/tokens.css`. Inline `style` in `app/` is for custom properties and per-item geometry, except `error-page.tsx` (below) | See `html`. |

### Guide `html`

| Pattern | Found | Decision |
| --- | --- | --- |
| A hand-made modal (a `div` with `role="dialog"` and its own focus trap) instead of `<dialog>` | `home/layer/interest-layer.tsx:186` and `home/watching/video-detail.tsx:232` (`role="dialog"`, `aria-modal`, `inert` on what is behind, a Tab trap) | Left: they are full-screen scenes that grow out of a box and are carried by the page's own animation. The browser's top layer would change how they stack with the page change's glass, and no test can show the look is the same. A change of this size would be a design task, not polish. |
| A `<pre>` with no `<code>`, with static inline styles | `app/components/error-page.tsx:22` (the root error boundary: empty in production, the stack while developing) | Left: the page was made on purpose with inline styles to match what Remix's default page showed (a test pins the markup, R59.2c), and the band is empty for a visitor. |
| Clickable `div` or `span`, inline `onclick`, `disabled="disabled"`, positive `tabindex`, `autocomplete="off"`, tooltips from `title` | None. The one click handler on a non-button is the reading fallback's backdrop (`reading-fallback.tsx:114`, `role="presentation"`, not focusable; clicking it is an extra way to close, the layer's own Close control does the same) | Nothing to change. |
| `<img>` without `width` and `height` | Five: `video-wall.tsx:212`, `video-detail.tsx:254`, `reading-fallback.tsx:94`, `hero.tsx:188` and `:197` | Left: each one fills a box whose size is set by the stylesheet or an `aspect-ratio`; CLS is 0 on every page in the baseline and in the final tables, so the attributes would add nothing, and a wrong one would change a layout. The images that have a natural size already carry both attributes. |
| `loading="lazy"` on the first screen | The walls' thumbnails (`work/gallery/video-wall.tsx:218`) are lazy on a direct load and not lazy when the page is made during a page change (`byChange`, because that page is not painted until the reveal ends); the work items are lazy only when asked (`work-item.tsx:106`, off by default); the other lazy images are in the home's blocks and fallback grids, below the first screen. The hero is not lazy | Left: a browser loads a lazy image that is already inside the window at once, the first-screen LCP of the work pages is 0.2 to 1.1 s, and the arrival holds of round 7 depend on the order the thumbnails load in; a change here would be a performance change and would have to earn its place by measurement (Task 35 did not find one). |
| `focus({ preventScroll: true })` without checking where the focused element is | 19 calls in 10 files, each a focus move into a layer or onto a control the page has just placed | Left: not re-judged in this pass. The guide asks for a check, call by call, that the focused element stays in view; that would be a task of its own, and none of the calls was changed. |
| `aria-hidden` on something focusable | None: `utils/inert.ts` always sets `inert` with `aria-hidden`, and an inert element cannot take focus | Nothing to change. |
| Page basics (`<!DOCTYPE html>`, `lang`, viewport, one `h1`) | `lang="en"`, the viewport `width=device-width, initial-scale=1`, one `h1` per page | Nothing to change. |

### Guide `motion`

| Pattern | Found | Decision |
| --- | --- | --- |
| `animation-duration: 0.01ms` (or `transition-duration`) as the reduced-motion switch | Four scoped places: `work/gallery/gallery.css:177`, `home/blocks/blocks.css:271`, `home/layer/layer.css:190`, `home/hero/hero.css:292` (the last three on `.home-xxx *`, with `!important`) | Left. The guide's warning is about doing it for the whole page. These are a section each, and nothing in the code waits for `transitionend` or `animationend` (searched: none), so the instant end changes nothing the visitor sees. Replacing them means listing every transitioned property of a section in a no-motion block: a change to the motion that no test covers. |
| `animation: none` inside `prefers-reduced-motion: reduce` instead of opting in under `no-preference` | `home/cards/cards.css`, `experience/cards.css:276`, `blocks.css:272`, `loader.css:208`, `hero.css:295`, and `glass.css:31` and `:106` (those two are the page change's pictures, not a reduced-motion rule) | Left. The guide's preferred shape moves the animation declarations into `no-preference` blocks in many sheets; the result is the same, the risk is to the look, and the tests do not read CSS cascades. |
| Finding the running `Animation` by `getAnimations().find(a => a.animationName === ...)` instead of `event.animation` | `page-change/glass-run.ts:44`, `work/focus-clear.ts:98`, `work/work-page.tsx:40` | Left: none of them is in an animation event handler; they look up a running animation by name, which is what the guide leaves as the fallback. |
| A scroll listener for a scroll-bound effect instead of `animation-timeline: scroll()` | `site-nav.tsx:167` (the dock hides on scrolling down and shows on scrolling up, with state), `home/layer/move-driver.ts` (scroll position drives the home's sink and the scenes' uniforms) | Left: both need the direction or feed canvas code, which a timeline cannot do. The listener is passive. |
| Animating `left` / `top` / `width` | None per frame: `shelf-open.ts:157` places the note once when a book opens, `shelf-hud.ts:11` sets the marker's `top` at layout and moves the thumb with `transform`, `climb-engine.ts:272` sets a size once | Nothing to change. |
| Waiting on `animationend` when reduced motion means no animation | None (no use of the events) | Nothing to change. |
| Flashes, pause control for motion over five seconds | Out of scope: not a legacy pattern, and the design spec leaves the accessibility audit out of this pass | Listed for a possible later round. |

## 3. What changed

### 3.1 The font cap's deferred promise (guide `js`), made and reverted

`createFontCap` in `app/components/home/reading/shelf-spine-fonts.ts` makes its `reached` promise with an outer `let resolve` and `new Promise((r) => (resolve = r))`. It was changed to `const { promise: reached, resolve } = Promise.withResolvers<void>()`, with the same behaviour (the 19 tests in `shelf-spine-fonts.test.ts` passed), and then reviewed. The review found the cost: `Promise.withResolvers()` is Chrome 119, Safari 17.4 and Firefox 121 (Baseline widely available since 5 September 2026), and `createFontCap` runs while the home is first drawn, with no try and catch around it. On Chrome before 119, Safari before 17.4 (iOS 16 and 17.0 to 17.3) and Firefox before 121 the home would have shown the error page instead of the site on every load, not only lost the shelf, for no gain a visitor sees. The change was reverted (ruling R151): the file is back at its lines of `ca22d72`, `git diff ca22d72 -- app` is empty, and the finding is listed as left. The old pattern works on every browser the site ran on before. The records of the build that had the change (font audits, gate runs) stay in `compare/web-pass/gates-r59-4/` as they happened.

### 3.2 The TypeScript library level

`tsconfig.json` `lib` goes from `ES2022` to `ES2024`. It was moved so the compiler knows `Promise.withResolvers`; the change that used it is reverted and the setting stays (R151). `yarn typecheck` stays clean on Node 22 and on Node 24. `target` stays `ES2022` (it only matters for emitted code; nothing is emitted by `tsc`, Vite builds), so the built site does not change.

Browser floor: the newest runtime APIs in `app/` are `Object.hasOwn` (`components/site-nav.tsx:77`) and `.at()` (`components/experience/view.ts:184`), the Safari 15.4, Chrome 93 and Firefox 92 era. With `lib` at ES2024 the type checker accepts newer ones (`Promise.withResolvers`, `toSorted`, `Object.groupBy`) without a warning, so a new use of one is a decision to raise that floor.

### 3.3 Node: `engines.node` stays `22.x`

Found on 18 November:

| Where | Value |
| --- | --- |
| The Node on this machine (nvm) | v22.18.0 (v24.22.1 is also installed) |
| `package.json` `engines.node` | `22.x` |
| The Vercel project's Node setting (`.vercel/project.json`, a git-ignored local file; not changed) | `26.x` |

Vercel's documentation says `engines.node` in `package.json` overrides the project setting ("Set the major Node.js version in the engines#node field of package.json to override the version selected in Project Settings"). So the build runs on what `engines` says, 22, and the project's 26 is not used while `engines` is set. `engines.node` stays `22.x`: `yarn typecheck`, `yarn lint`, `yarn vitest run` (187 files, 2561 tests) and `yarn build` all pass on Node 22.18.0 (`compare/web-pass/gates-r59-4/`), the preview build of Task 34 was made with it, and it is the version the round's gates ran on. Node 24 was also tried for information and passes the same checks (typecheck, 2561 tests, build; `node24-*.out`); yarn refuses to run on it while `engines` says 22, so those used the tools directly. Node 26 is not installed here and could not be tried; so `engines` was not set to it (ruling R148).

What only the owner can do: the project setting reads 26 and `engines` says 22, so the two disagree on the page of the project's settings. Changing the project setting to 22 would make them agree; it is a project setting and was not touched. Node 22's long-term support ends in April 2027: when the site moves to 24, change `engines.node` to `24.x` and run the same four checks first.

## 4. The scan again

With the change in place: `legacy-scan app` found one thing, the Enter handler on the wall's canvas (kept, section 1), and the changed folder, `app/components/home/reading`, none. After the revert (R151) the code is `ca22d72`'s again and the scan finds the two things of its first run (the Enter handler and the shelf's promise, left). The scan of `scripts` is unchanged by design (R146).

## 5. Proposed rulings

- **R146**: the audit and measuring scripts (`scripts/audit/*`, `scripts/perf/sample-frames.js`) keep their eight scan findings and their copies and deferred promises: they are not shipped, have no tests, run once against a live browser and write the records the earlier rounds' numbers came from, so a change cannot be shown to be the same by a test (the rule for a change). Cost if wrong: the scan still lists eight things in `scripts`; nothing a visitor meets. Changing them would be a small task with a test per script.
- **R147** (withdrawn by R151): `Promise.withResolvers()` with no fallback was proposed and built; on Chrome before 119, Safari before 17.4 and Firefox before 121 it would have shown the error page instead of the home, for no visible gain (section 3.1). Reverted.
- **R148**: `engines.node` stays `22.x` although the Vercel project's setting reads 26 (section 3.3). Cost if wrong: the two keep disagreeing on the project's settings page; the build uses 22 either way.
- **R149** (replaced by R152): accepting the glass cost gate's outcome on the build with the change was proposed; the counts in section 7 are the corrected ones.
- **R150**: the sweep's remaining hits (sections 2) are left as listed. Cost if wrong: the code keeps patterns the guides call old; none shows to a visitor.
- **R151**: the `Promise.withResolvers()` change is reverted and the finding listed as left; `lib` stays ES2024 (type checking only; the built site does not change). Cost if wrong: the code keeps one hand-made deferred promise the guide calls old.
- **R152**: with R151 the app code equals `ca22d72`'s, whose timing gates passed in Task 35's fix round, so this fix round re-ran typecheck, lint, the tests and the build only; the gate runs on the build with the change are kept as they happened. Cost if wrong: none for the shipped code.

## 6. Pictures

`compare/web-pass/modernize-before-after-1440.jpg`, `-390.jpg` and `-320.jpg`: the five pages before (the build of the previous commit) and after (the build of this task), at 1440 by 900, 390 by 844 and 320 by 568, with generated pictures for the thumbnail and cover hosts (`make-web-pass-pictures.mjs <before|after> generated`; tracked sheets, no thumbnails or covers). Looked at side by side: every pair is the same. The work, long form, short form and My experience pairs differ by at most 11 pixels over a difference of 30 grey levels (the dock's glow and the tiles' own motion); the home shows another painting each load, because the hero picks one at random (The Tower of Babel against Pandemonium at 1440), and every layout, word and control is in the same place. The part of the site this task's code touches is the shelf's font wait: `shelf-fonts-late.json` takes the shelf's final picture on this build and on the clean build, and the two are equal to the pixel (kept in `compare/local/modernize/`, which is not tracked because the shelf shows real covers). The pictures and audits were made on the build with the change; the code shipped after the revert is the code of the "before" build.

## 7. Gates

On the production build with the `withResolvers` change (made before the revert, R151), served on :5180, under the lock, loads (1, 5 and 15 minute averages) in `compare/web-pass/gates-r59-4/loads.tsv`. The records of those runs are in that folder. After the revert only typecheck, lint, the tests and the build were run again (R152); the shipped app code equals `ca22d72`'s, whose timing gates passed in Task 35's fix round.

| Gate | Result | Load at the start |
| --- | --- | --- |
| `yarn typecheck`, `yarn lint`, `yarn build` | pass on Node 22.18.0 (`typecheck.out`, `lint.out`, `build.out`) | |
| `yarn vitest run` | 187 files, 2561 tests pass (`vitest.out`); the same 2561 on Node 24.22.1 (`node24-vitest.out`) | |
| `page-change.json`, `-hook`, `-phone` | 15 changes, no frame over 34 ms in any (longest animated frame 33.3 ms) | 3.38 4.87 4.66; 3.22 4.65 4.59; 2.53 4.30 4.46 |
| `arrival.json` | 16 of 16 steps ok | 2.49 4.04 4.36 |
| `make-arrival.mjs run --generated` | 12 of 12 PASS | 3.61 3.74 4.17 |
| Shelf font audits (`shelf-fonts-cold.json`, `shelf-fonts-late.json`) | every case draws the canvas, not the plain grid (waited 616 to 1133 ms of the 1500); the late repaint has a longest gap of 16.8 ms and no frame over 20 ms; the numbers equal the clean build's | 7.08 8.10 7.98 |
| Glass cost 1512x982@2 | PASS on the run recorded as `glass-1512.out`: compositor 289, 280, 280 ms (limit 450), display 185, 179, 181 ms (limit 300), one dropped frame a run (the first, excluded per R125 and R127). See the paragraph below for the runs that failed | 5.85 7.97 7.63 |
| Glass cost 1920x1080@1 | Three invocations of this build failed: `glass-1920-first.out` (compositor 445, 603, 513 ms, over the 450 ms limit in two runs; 3, 5 and 1 dropped frames after the first), `glass-1920-final-1-loaded.out` (compositor 347, 620, 339 ms, over the limit in run 2; 8 dropped after the first in that run) and `glass-1920-final-2.out` (compositor 290, 276, 283 ms; one run dropped 2 frames after the first). Under R144, alternated with the clean build: `glass-1920-alt-*.out`, this build 4 of 4 PASS (two servers), the clean build 3 of 4 | 5.55 4.57 4.36; 9.01 8.15 7.30; 5.43 7.50 7.48 for the three failing runs |

**The glass gate, in full.** The owner's video programs kept the machine busy (the 1 minute load was 4 to 16 during the runs), and the gate failed on this build more often than on the clean build in the first hour, so the runs were kept and extended to find out whether the change is the cause. Serving the same build from two servers and the previous commit's build from two worktrees (the build of `ca22d72` and the earlier `3c66e39`, whose app code is the same except a comment), alternated one after another under the lock, 1512 by 982 at dpr 2, three runs each (`glass-1512-*.out`; the first three runs on :5180 had failed on their own, loads 4.1 to 13): this build (three servers) passed 11 of 21 invocations, the clean builds 19 of 24 (failing 10 of 21 against 5 of 24: not shown to differ, Fisher's exact test, two-sided p about 0.11), and every failure was one to a few dropped frames after the first. What the records do show: inside those alternated invocations 4 of 63 runs of this build were over the 450 ms compositor limit (455, 506, 515 and 656 ms) against 0 of 72 on the clean builds (never above 421 ms). `glass-1512-first.out` (510 ms) and `glass-1512-second.out` (511 ms), before the alternated series, were over the limit too. The first seven 1512 invocations of this build all failed (`first`, `second`, `third`, `alt-mine-1`, `alt-mine-2`, `abc-mine-1`, `abc-mine-2`), and `glass-1512-loaded.out` (18:18) failed five minutes before the run recorded as passing. After a restart of the :5180 server the last 8 invocations on this build passed 6 times, and the final four (:5180 and a copy served from `/private/tmp`, twice each) all passed, at loads up to 12. The two built files differ by 14 bytes (the `withResolvers` call in the home's chunk), which cannot cost a frame in a page change, and the gate is known to fail now and then on the clean build too (R144). The honest reading: the records do not show that the change costs a frame (it runs once, when the home mounts the shelf engine, and nothing in a page change's frames runs it), but they do not show that it does not: the over-limit compositor times appear on this build only, and the load and the time of day cannot be told apart from the build. With the revert (R151, R152) this no longer bears on what ships.
