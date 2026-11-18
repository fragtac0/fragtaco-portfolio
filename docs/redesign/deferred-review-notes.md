# Deferred review notes from the home build

During the home page build (R24 to R30), reviewers raised small points that did not block a task. They were recorded and deferred. This is the full list. The [polish plan](../superpowers/plans/2026-11-11-polish-and-work-page.md) assigns each one to the task that touches its file; that task either fixes it or closes it here with a reason.

Status: **open** until a task changes it to **fixed (commit)** or **closed (reason)**.

| No. | From task | Note | Status |
| --- | --- | --- | --- |
| D-01 | 2 | any non-200 thumb HEAD stored as hq (only 404 should be) | fixed (R37.1) |
| D-02 | 2 | readPrevious JSON.parse outside safeParse aborts on corrupt videos.json | fixed (R37.1) |
| D-03 | 2 | write not atomic (temp file + rename) | fixed (R37.1) |
| D-04 | 2 | diffVideos compares JSON.stringify (key-order dependent) | fixed (R37.1) |
| D-05 | 2 | mapLimit / keep-previous / trim / "header present no count" untested | fixed (R37.1) |
| D-06 | 2 | one unavailable video lockup throws and blocks the whole sync | fixed (R37.1) |
| D-07 | 2 | playlist continuation (>100 items) ignored silently | fixed (R37.1): warns that only the first page was read; following the continuation stays out of scope (53 videos today) |
| D-08 | 2 | no retry on transient playlist fetch failure | fixed (R37.1) |
| D-09 | 2 | vite-node prints Remix future-flag warnings (use a dedicated --config) | fixed (R37.1) |
| D-10 | 2 | warning text "keeping the previous count" is false when there is no previous count | fixed (R37.1) |
| D-11 | 2 | readPrevious returns [] silently on an invalid committed file, disabling keep-previous for that run | fixed (R37.1) |
| D-12 | 3 | loaders.test.ts unique-id assertion can never fail (ensureUniqueBy throws first) | closed (the assertion is redundant by design: `ensureUniqueBy` throws on a duplicate before the test can see one, so the test only confirms the load succeeds; the duplicate-id test is D-13) |
| D-13 | 3 | no duplicate-id test | fixed (R37.2): `app/content/mappers.test.ts` tests `ensureUniqueBy` (a duplicate throws with its label and value) |
| D-14 | 3 | long destructuring line in loaders.server.ts:35 | closed (cosmetic: the loader was rewritten in R33.2 and the destructuring now reads as one clear statement) |
| D-15 | 3 | home response carries books+videos (~18 KB) before anything renders them | closed (accepted: the block previews and both scenes render from this data at first paint, so deferring it would add a second request on the path to the layer; it is about 18 KB before compression and the hero does not wait for it) |
| D-16 | 3 | closes when blocks/scenes land | closed (done: the blocks, the shelf and the wall landed in R27 to R30 and all use this data) |
| D-17 | 4 | orphaned ui.ts entries (textStyles.displayTitleColumn, factHeadline, factBody, chipLabel, layout.homeContainer) | fixed (R31.4) |
| D-18 | 4 | orphaned app/components/about/about-copy.tsx and about-portrait.tsx | fixed (R31.4) |
| D-19 | 4 | make-painting-sizes.sh summary counts stale files | fixed (R33.1): script replaced by make-paintings.mjs, whose table counts only the manifest paintings |
| D-20 | 4 | no tool check up front | closed (superseded: the script that needed `sips` and `cwebp` was replaced by `scripts/make-paintings.mjs` on `sharp` in R33.1; `sharp` is a dev dependency, so there is no external tool to look for) |
| D-21 | 4 | HomePageProps hand-written rather than derived from the loader return type | fixed (R37.2): `HomePageProps` is `Awaited<ReturnType<typeof getHomePageContent>>`, a type-only import, so the page cannot drift from the loader |
| D-22 | 5 | letterOut[5] ties logo at 2120ms | closed (superseded: R33.3 moved the name out to 1.75 s, ahead of the logo at 2.12 s, so no letter ties it) |
| D-23 | 5 | order relies on push order + stable sort (undocumented) | fixed (R37.2): the `loaderSchedule` comment says the list is already in time order, and the existing "is sorted by time" test pins it |
| D-24 | 5 | makeOrder shuffle untested | fixed (R37.2): `makeOrder` tests for the shuffle itself (fixed random values give known orders; different seeds give different orders) |
| D-25 | 5 | lexicographic sort in test | fixed (R37.2): the permutation test sorts numerically |
| D-26 | 5 | head-script tests don't pin the media query string or ES5-ness | fixed (R37.2): a test pins the exact media query the head script asks for and that the script is plain ES5 (no arrows, `let`, `const`, template strings, spread, optional chaining) and cannot close its `<script>` element |
| D-27 | 5 | no introMode/script parity matrix | fixed (R37.2): a test runs `introMode` and the head script over every combination of seen, reduced motion and five hashes and requires the same answer |
| D-28 | 5 | DEEP_LINKS mutable | fixed (R37.2): `DEEP_LINKS` is typed `readonly string[]` |
| D-29 | 5 | JSON in <script> needs a '<' caution comment | fixed (R37.2): a comment on `INTRO_HEAD_SCRIPT` says only constants are interpolated and a `<` would have to be escaped if one ever became input |
| D-30 | 5 | LoaderStep.step typed string (union would be safer) | fixed (R37.2): `LoaderStepName` is a union (`logo`, `reveal`, `nameSmall`, `roles`, `done`) |
| D-31 | 5 | comment says shift is "after reveal" (it starts at reveal) | fixed (R37.2): the `loaderSchedule` comment says the shift starts at the reveal itself |
| D-32 | 6 | unnecessary casts at paint-engine.ts:142 and :189 | closed (the casts are needed: a `webgl2` context is not assignable to `WebGLRenderingContext` in the DOM types, and the uniform table is filled on the next lines; the line numbers have moved since) |
| D-33 | 6 | createBuffer/createTexture nulls unhandled (context lost mid-init) | fixed (R37.2): `createBuffer` and `createTexture` returning null (context lost during set-up) now release what was made and return null, so the hero falls back to the image |
| D-34 | 6 | failure paths after getContext leave a live context on the canvas | fixed (R37.2): every failure after `getContext` (compile, link, buffer, texture) loses the context through `WEBGL_lose_context`, so a canvas that failed does not keep a live one |
| D-35 | 6 | no webglcontextlost handling (matches mockup) | fixed (R36.2) |
| D-36 | 6 | comment "loses the context for good" overstates (restoreContext exists) | fixed (R37.2): the header comment says `dispose` and a failed start lose the context and that the canvas is not reused |
| D-37 | 7 | hero.tsx 434 lines, one ~290-line effect | fixed (R31.4): `hero.tsx` is 116 lines; the paint engine, the cycle and the loader are three hooks |
| D-38 | 7 | loader/cycle logic untestable inside the closure - extract before it grows | fixed (R31.4, R33.3): the loader and cycle logic moved out of the closure into pure, tested functions (`loaderSchedule`, `revealPlan`, `joinLoader`, `introMode`, `makeOrder`, `pickNext`, `nextRevealTry`) |
| D-39 | 7 | IntersectionObserver reads first entry, should read last | fixed (R37.2): the hero's visibility observer reads the last entry of a batch |
| D-40 | 7 | dead code: textStyles.heroTitle/heroSubtitle, surfaces.glassChip, styleUnlessReduced, ken-burns keyframes | fixed (R31.4) |
| D-41 | 7 | stale refs to hero-section.tsx in client-tile.tsx:22 and hero-paintings.json $comment | fixed (R37.2): the comment in `client-tile.tsx` and the `$comment` in `hero-paintings.json` name the files that exist now |
| D-42 | 7 | .tex fallback hidden until hydration on no-WebGL | closed (cosmetic: it affects only visitors without WebGL, for the moment between first paint and hydration, when the painting is not drawn yet either) |
| D-43 | 7 | load-image.ts has no timeout | closed (already fixed in R30.1: `loadImage` times out after 12 s) |
| D-44 | 7 | a stalled request stops the painting cycle silently (carry to Task 17 with R9) | closed (done: `loadImage` resolves null after 12 s (R30.1) and the cycle schedules the next change when an image comes back null, so a stalled request delays one change and never stops the cycle) |
| D-45 | 8 | vacuous margin-floor test | fixed (R37.2): the vacuous assertion is gone; the test now walks every width from 700 to 3840 and checks the 24 px floor holds (it is a guard: 4.5% of 700 is already 31.5) |
| D-46 | 8 | SETTLE_AT test echoes the constant (consumer must use >) | fixed (R37.2): the drag release rule is `settlesOnTarget(progress)` (strictly greater than `SETTLE_AT`), used by the input hook and tested at, below and just above the boundary |
| D-47 | 8 | show outside hidden returns state | closed (covered: `hero-nav.test.ts` "show moves hidden to hero and leaves other states alone") |
| D-48 | 9 | landscape phone (812x375) card height only 183 px because of the dock-clear formula | fixed (R34.2): under `(max-height: 480px)` the cards are `calc(100dvh - 24px)` tall (351 px at 812x375) |
| D-49 | 9 | rail aria-expanded + label-in-name ("the cut" vs "Open about me") | fixed (R32.1): rail text is `about` / `credits`; aria-label `Open about` / `Close about` (credits the same) contains it, with `aria-expanded` |
| D-50 | 9 | .home-hero .card a {color:inherit} outranks .pill color (See the reel renders fog, not cream) | fixed (R34.1): the card's own colour is now `var(--cream)`, so inherited link text is cream like the pill |
| D-51 | 9 | var(--fog) undefined at home.css:395 | fixed (R34.1): cards.css uses the defined `var(--cream)` |
| D-52 | 9 | box-shadow/background transitions on cards and links (mockup-faithful) | closed (accepted: mockup-faithful, hover only, on small elements; moving the glow to an opacity layer would risk the look) |
| D-53 | 9 | unquoted url() in inline styles | fixed (R37.2): the portrait and credits images are `url("...")` with quotes |
| D-54 | 9 | /profile.png 1.26 MB loaded eagerly for a 110 px avatar | fixed (R34.2): `public/portraits/ohshin.jpg`, 220 px wide, 17 KB; `profile.png` deleted |
| D-55 | 9 | poses use window.innerWidth (classic scrollbar offset) | fixed (R37.2): card poses use the hero's own width (`parentElement.clientWidth`), so a classic scrollbar no longer shifts the resting rail; unchanged where scrollbars overlay (poses compared before and after at 1440 and 390) |
| D-56 | 9 | use root.clientWidth | fixed (R37.2): same change as D-55 |
| D-57 | 9 | use-card-gestures.ts 320 lines, one 180-line effect | fixed (R31.4): use-card-poses.ts and use-card-input.ts, one effect per input |
| D-58 | 9 | modeOf/twoLines/cardClass/inertIf untested | fixed (R37.2): `card-shell.test.ts` covers `modeOf`, `twoLines` and `cardClass` (`inertIf` became `inertProps`, tested since R31.4) |
| D-59 | 9 | inert="" becomes falsy under React 19 | fixed (R31.4): one helper, `inertProps` in app/utils/inert.ts, is now the only place; the React 19 change is `inert: true` there |
| D-60 | 9 | "See the reel" focus ring clipped left/bottom by .intro-text scroll box on desktop | fixed (R34.2): `.intro-text` has 4 px padding all round |
| D-61 | 9 | add overscroll-behavior: none on html.cards-open (pull-to-refresh on rail/scrim drags) | fixed (R34.2): `html.cards-open { overscroll-behavior: none }` |
| D-62 | 9 | scrollbar-gutter: stable also reserves a strip during the intro on classic-scrollbar systems | closed (cosmetic: a classic-scrollbar strip during the 4.8 s intro; the stable gutter is what keeps the layout from jumping when the lock lifts) |
| D-63 | 10 | same-document hash change to #about on a loaded home opens the card but leaves #about in the URL | closed (no link on the site makes a same-document move to `#about` any more: the dock tab was replaced by the rail in R32.1, and `/work#about` arrives as a fresh mount, which opens the card and drops the hash) |
| D-64 | 10 | inertProps duplicates inertIf (card-shell.ts) | fixed (R31.4): inertIf deleted; cards, reading fallback and dock use `inertProps` |
| D-65 | 10 | getNavHeight unused | fixed (R31.4): deleted |
| D-66 | 10 | home.hidden hard-coded false until Task 11 | closed (done: the dock's `hidden` is `layerActive` since Task 11) |
| D-67 | 11 | LayerControlContext default is a silent no-op | fixed (R31.4): no default, `useLayerControl()` throws outside the provider |
| D-68 | 11 | "1 books" pluralisation | fixed (R34.2): `countLabel` in `app/utils/count-label.ts`, used by the blocks and the layer header |
| D-69 | 11 | layerTitle inside component | fixed (R37.2): the layer titles are a constant outside the component |
| D-70 | 11 | redundant cast | fixed (R37.2): the cast on the layer reducer's initial state is gone (the reducer types it) |
| D-71 | 12 | Forward-open vs Remix ScrollRestoration may offset the grow origin (not observed) | closed (not observed in the audit's history walk, `scripts/audit/history.json`; revisit if a report arrives) |
| D-72 | 12 | rapid Back+Forward during the 680 ms shrink leaves #reading with layer closed | closed (a rare race: two history moves inside the 680 ms shrink leave the URL on `#reading` with the layer closed, and the next Back, Forward or a click on the block puts it right; fixing it needs a re-open queue in the layer reducer, a behaviour change this close-out does not take) |
| D-73 | 12 | deep-link close drops the query string | fixed (R37.2): closing a deep-linked layer keeps the query string |
| D-74 | 12 | R10 history logic and near-gate untested (node-only env, extractable) | fixed (R31.4): `nextHistoryState` and `createNearGate` extracted and tested |
| D-75 | 12 | isHashOnlyMove true for identical URLs | fixed (R37.2): the doc comment says an identical URL counts as hash-only on purpose (the content is static), with a test |
| D-76 | 12 | "1 books" pluralisation | fixed (R34.2): same `countLabel` |
| D-77 | 12 | closest("article") where refs exist | fixed (R37.2): the blocks open the layer from their refs instead of `closest("article")` |
| D-78 | 12 | InterestBlocks not memo'd | fixed (R37.2): `InterestBlocks` is `memo`ised |
| D-79 | 12 | block box-shadow/outline-color transitions and Lora DOM text on mini spines (mockup-faithful) | closed (accepted: mockup-faithful; hover only, and the Lora text sits on the small mini spines) |
| D-80 | 13 | 2.3-cap and dH floor asserted loosely | fixed (R37.2): the 2.3 cap and the height floor are asserted with `toBeCloseTo` |
| D-81 | 13 | tests use span 14 (real ~2.5-3) | fixed (R37.2): a test uses a realistic span (2.8) for a wide screen and a phone |
| D-82 | 14 | engine in lazy useState not a ref (sound) | closed (sound as is: the engine is created once in lazy state and never reassigned) |
| D-83 | 14 | MSAA buffer kept while closed | closed (by design: the engine keeps its GL scene for an instant re-open and `dispose()` frees it when the home page goes away, see the note on `ShelfEngine`) |
| D-84 | 14 | openBook reallocates the blur canvas each open | fixed (R31.2) |
| D-85 | 14 | fonts.load failure silent | fixed (R31.2) |
| D-86 | 14 | images[] retained | closed (already released after upload) |
| D-87 | 14 | shelf-engine.ts 801 lines (extract build into shelf-scene.ts) | fixed (R31.2) |
| D-88 | 14 | fine/reducedMotion read once | closed (accepted: the two media queries are read when each engine is created; a change of the reduced-motion setting mid-visit needs a reload for the 3D scenes, while the CSS follows it live) |
| D-89 | 14 | three 0.169 is WebGL2-only, R30 fallback must cover no-WebGL2 | closed (done: the reading scene checks `hasWebGL2()` and shows the plain grid of covers without it) |
| D-90 | 14 | un-timed cover painter can starve on a never-idle page (cosmetic) | closed (cosmetic: covers are painted in idle slices, which still run between frames of a busy page) |
| D-91 | 14 | prepare() ~26 idle slices (deep-link start verified prompt) | fixed (R35.1) |
| D-92 | 15 | layoutTiles out-of-range idx when count < 8 (unreachable today) | fixed (R36.1) |
| D-93 | 15 | hitTile gap test weak | fixed (R36.1) |
| D-94 | 15 | capacity cap not pinned to 112 | fixed (R36.1) |
| D-95 | 15 | tileTransform input/output both named w | fixed (R36.1) |
| D-96 | 15 | unused cols option and DRIFT export | fixed (R36.1) |
| D-97 | 16 | createPickChannel exported from a component file (Fast Refresh) | fixed (R31.3) |
| D-98 | 16 | right-click/non-primary pointers open tiles | fixed (R36.2) |
| D-99 | 16 | no webglcontextlost handling | fixed (R36.2) |
| D-100 | 16 | shaders not deleted | fixed (R31.3) |
| D-101 | 16 | failed Images retained | fixed (R31.3) |
| D-102 | 16 | visible hint never mentions keyboard | fixed (R36.2) |
| D-103 | 16 | .xp-head inert set via DOM query | fixed (R36.2) |
| D-104 | 16 | wall-engine.ts 784 lines | fixed (R36.2): 345 lines, with the types, the tiles' pose, the drawing, the lean and the chip in their own modules |
| D-105 | 16 | detail shot no onError fallback / no wait for img | fixed (R36.2) |
| D-106 | 16 | reduced motion still redraws every frame and keeps a 0.2 s vfade delay | closed (accepted: under reduced motion the wall keeps its frame loop, with no drift or lean, because a redraw-on-change path would add state to the loop for a saving only on that path; the 0.2 s delay does not apply, the reduced rule's `transition` shorthand resets it) |
| D-107 | 16 | pre-size uses innerWidth/innerHeight vs sizes() clientWidth (classic scrollbars may still resize once on first open) | closed (cosmetic: on a classic scrollbar the first open may resize once) |
| D-108 | 16 | fly-back not cut short on resize | closed (cosmetic: a resize during the 530 ms fly-back lets it finish, and the next frame lays out at the new size) |
| D-109 | 16 | deep-link open still does GL setup in the opening frame | fixed (R36.2): the setup is slicer steps, urgent once the layer is open, behind a placeholder |
| D-110 | 17a | image-fallback interrupt comment/dip | closed (done: an interrupting change settles the old picture first, see `show()` in `image-fallback.ts`) |
| D-111 | 17a | reduced-motion .home-layer fade bound to element (layer mounts per open, so fine) | closed (as the note says, the layer mounts per open, so the fade runs each time) |
| D-112 | 17a | reading start().then without catch | fixed (R37.2): both scenes catch a rejected `start()` and show the plain grid |
| D-113 | 17a | watching hasFailed timing | fixed (R36.2): `start()` is async and the scene checks `hasFailed()` after it resolves |
| D-114 | 17a | selectors without CSS.escape | fixed (R37.2): the three attribute selectors built from ids use `CSS.escape` |
| D-115 | 17a | no tests for fallback components/reduced paths | closed (the project has no DOM test environment; the reduced-motion and fallback paths were walked with emulation in R37.2a, and their pure parts are tested: `createAnimate`, the wall planes and parallax, `kenBurnsZoom`) |
| D-116 | 17a | zoomOf ordering | fixed (R33.2) |
| D-117 | 33 | paint-engine.ts 390 lines (over ~350); move shader sources out | fixed (R37.2): the shader sources are `paint-shaders.ts`; `paint-engine.ts` is 359 lines (was 390) |
| D-118 | 34 | the layer's video title `clamp(18px, 2vw, 28px)` (watching.css) passes through 19 to 23px between about 950 and 1200 px wide; the audited widths (390, 1440) are on the scale | closed (accepted: a fluid clamp between two steps of the scale, and the audited widths 390 and 1440 sit on it) |
| D-119 | 34 | at 320 px wide the dock strip is 18 px wider than its pill (scrollable, `overflow-x: auto`), so the last social icon is partly out of sight until scrolled; same before and after R34.1b | fixed (R37.2): at 320 px the tabs' minimum width is 4.5rem and the social icons 32 px, so the dock content fits its pill (291 px in 291 px; was 18 px over); 340 px and wider are unchanged |
