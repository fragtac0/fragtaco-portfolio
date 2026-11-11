# Deferred review notes from the home build

During the home page build (R24 to R30), reviewers raised small points that did not block a task. They were recorded and deferred. This is the full list. The [polish plan](../superpowers/plans/2026-11-11-polish-and-work-page.md) assigns each one to the task that touches its file; that task either fixes it or closes it here with a reason.

Status: **open** until a task changes it to **fixed (commit)** or **closed (reason)**.

| No. | From task | Note | Status |
| --- | --- | --- | --- |
| D-01 | 2 | any non-200 thumb HEAD stored as hq (only 404 should be) | open |
| D-02 | 2 | readPrevious JSON.parse outside safeParse aborts on corrupt videos.json | open |
| D-03 | 2 | write not atomic (temp file + rename) | open |
| D-04 | 2 | diffVideos compares JSON.stringify (key-order dependent) | open |
| D-05 | 2 | mapLimit / keep-previous / trim / "header present no count" untested | open |
| D-06 | 2 | one unavailable video lockup throws and blocks the whole sync | open |
| D-07 | 2 | playlist continuation (>100 items) ignored silently | open |
| D-08 | 2 | no retry on transient playlist fetch failure | open |
| D-09 | 2 | vite-node prints Remix future-flag warnings (use a dedicated --config) | open |
| D-10 | 2 | warning text "keeping the previous count" is false when there is no previous count | open |
| D-11 | 2 | readPrevious returns [] silently on an invalid committed file, disabling keep-previous for that run | open |
| D-12 | 3 | loaders.test.ts unique-id assertion can never fail (ensureUniqueBy throws first) | open |
| D-13 | 3 | no duplicate-id test | open |
| D-14 | 3 | long destructuring line in loaders.server.ts:35 | open |
| D-15 | 3 | home response carries books+videos (~18 KB) before anything renders them | open |
| D-16 | 3 | closes when blocks/scenes land | open |
| D-17 | 4 | orphaned ui.ts entries (textStyles.displayTitleColumn, factHeadline, factBody, chipLabel, layout.homeContainer) | fixed (R31.4) |
| D-18 | 4 | orphaned app/components/about/about-copy.tsx and about-portrait.tsx | fixed (R31.4) |
| D-19 | 4 | make-painting-sizes.sh summary counts stale files | fixed (R33.1): script replaced by make-paintings.mjs, whose table counts only the manifest paintings |
| D-20 | 4 | no tool check up front | open |
| D-21 | 4 | HomePageProps hand-written rather than derived from the loader return type | open |
| D-22 | 5 | letterOut[5] ties logo at 2120ms | open |
| D-23 | 5 | order relies on push order + stable sort (undocumented) | open |
| D-24 | 5 | makeOrder shuffle untested | open |
| D-25 | 5 | lexicographic sort in test | open |
| D-26 | 5 | head-script tests don't pin the media query string or ES5-ness | open |
| D-27 | 5 | no introMode/script parity matrix | open |
| D-28 | 5 | DEEP_LINKS mutable | open |
| D-29 | 5 | JSON in <script> needs a '<' caution comment | open |
| D-30 | 5 | LoaderStep.step typed string (union would be safer) | open |
| D-31 | 5 | comment says shift is "after reveal" (it starts at reveal) | open |
| D-32 | 6 | unnecessary casts at paint-engine.ts:142 and :189 | open |
| D-33 | 6 | createBuffer/createTexture nulls unhandled (context lost mid-init) | open |
| D-34 | 6 | failure paths after getContext leave a live context on the canvas | open |
| D-35 | 6 | no webglcontextlost handling (matches mockup) | open |
| D-36 | 6 | comment "loses the context for good" overstates (restoreContext exists) | open |
| D-37 | 7 | hero.tsx 434 lines, one ~290-line effect | open |
| D-38 | 7 | loader/cycle logic untestable inside the closure - extract before it grows | open |
| D-39 | 7 | IntersectionObserver reads first entry, should read last | open |
| D-40 | 7 | dead code: textStyles.heroTitle/heroSubtitle, surfaces.glassChip, styleUnlessReduced, ken-burns keyframes | fixed (R31.4) |
| D-41 | 7 | stale refs to hero-section.tsx in client-tile.tsx:22 and hero-paintings.json $comment | open |
| D-42 | 7 | .tex fallback hidden until hydration on no-WebGL | open |
| D-43 | 7 | load-image.ts has no timeout | closed (already fixed in R30.1: `loadImage` times out after 12 s) |
| D-44 | 7 | a stalled request stops the painting cycle silently (carry to Task 17 with R9) | open |
| D-45 | 8 | vacuous margin-floor test | open |
| D-46 | 8 | SETTLE_AT test echoes the constant (consumer must use >) | open |
| D-47 | 8 | show outside hidden returns state | open |
| D-48 | 9 | landscape phone (812x375) card height only 183 px because of the dock-clear formula | fixed (R34.2): under `(max-height: 480px)` the cards are `calc(100dvh - 24px)` tall (351 px at 812x375) |
| D-49 | 9 | rail aria-expanded + label-in-name ("the cut" vs "Open about me") | fixed (R32.1): rail text is `about` / `credits`; aria-label `Open about` / `Close about` (credits the same) contains it, with `aria-expanded` |
| D-50 | 9 | .home-hero .card a {color:inherit} outranks .pill color (See the reel renders fog, not cream) | fixed (R34.1): the card's own colour is now `var(--cream)`, so inherited link text is cream like the pill |
| D-51 | 9 | var(--fog) undefined at home.css:395 | fixed (R34.1): cards.css uses the defined `var(--cream)` |
| D-52 | 9 | box-shadow/background transitions on cards and links (mockup-faithful) | open |
| D-53 | 9 | unquoted url() in inline styles | open |
| D-54 | 9 | /profile.png 1.26 MB loaded eagerly for a 110 px avatar | fixed (R34.2): `public/portraits/ohshin.jpg`, 220 px wide, 17 KB; `profile.png` deleted |
| D-55 | 9 | poses use window.innerWidth (classic scrollbar offset) | open |
| D-56 | 9 | use root.clientWidth | open |
| D-57 | 9 | use-card-gestures.ts 320 lines, one 180-line effect | fixed (R31.4): use-card-poses.ts and use-card-input.ts, one effect per input |
| D-58 | 9 | modeOf/twoLines/cardClass/inertIf untested | open |
| D-59 | 9 | inert="" becomes falsy under React 19 | fixed (R31.4): one helper, `inertProps` in app/utils/inert.ts, is now the only place; the React 19 change is `inert: true` there |
| D-60 | 9 | "See the reel" focus ring clipped left/bottom by .intro-text scroll box on desktop | fixed (R34.2): `.intro-text` has 4 px padding all round |
| D-61 | 9 | add overscroll-behavior: none on html.cards-open (pull-to-refresh on rail/scrim drags) | fixed (R34.2): `html.cards-open { overscroll-behavior: none }` |
| D-62 | 9 | scrollbar-gutter: stable also reserves a strip during the intro on classic-scrollbar systems | open |
| D-63 | 10 | same-document hash change to #about on a loaded home opens the card but leaves #about in the URL | open |
| D-64 | 10 | inertProps duplicates inertIf (card-shell.ts) | fixed (R31.4): inertIf deleted; cards, reading fallback and dock use `inertProps` |
| D-65 | 10 | getNavHeight unused | fixed (R31.4): deleted |
| D-66 | 10 | home.hidden hard-coded false until Task 11 | open |
| D-67 | 11 | LayerControlContext default is a silent no-op | fixed (R31.4): no default, `useLayerControl()` throws outside the provider |
| D-68 | 11 | "1 books" pluralisation | fixed (R34.2): `countLabel` in `app/utils/count-label.ts`, used by the blocks and the layer header |
| D-69 | 11 | layerTitle inside component | open |
| D-70 | 11 | redundant cast | open |
| D-71 | 12 | Forward-open vs Remix ScrollRestoration may offset the grow origin (not observed) | open |
| D-72 | 12 | rapid Back+Forward during the 680 ms shrink leaves #reading with layer closed | open |
| D-73 | 12 | deep-link close drops the query string | open |
| D-74 | 12 | R10 history logic and near-gate untested (node-only env, extractable) | fixed (R31.4): `nextHistoryState` and `createNearGate` extracted and tested |
| D-75 | 12 | isHashOnlyMove true for identical URLs | open |
| D-76 | 12 | "1 books" pluralisation | fixed (R34.2): same `countLabel` |
| D-77 | 12 | closest("article") where refs exist | open |
| D-78 | 12 | InterestBlocks not memo'd | open |
| D-79 | 12 | block box-shadow/outline-color transitions and Lora DOM text on mini spines (mockup-faithful) | open |
| D-80 | 13 | 2.3-cap and dH floor asserted loosely | open |
| D-81 | 13 | tests use span 14 (real ~2.5-3) | open |
| D-82 | 14 | engine in lazy useState not a ref (sound) | open |
| D-83 | 14 | MSAA buffer kept while closed | open |
| D-84 | 14 | openBook reallocates the blur canvas each open | fixed (R31.2) |
| D-85 | 14 | fonts.load failure silent | fixed (R31.2) |
| D-86 | 14 | images[] retained | closed (already released after upload) |
| D-87 | 14 | shelf-engine.ts 801 lines (extract build into shelf-scene.ts) | fixed (R31.2) |
| D-88 | 14 | fine/reducedMotion read once | open |
| D-89 | 14 | three 0.169 is WebGL2-only, R30 fallback must cover no-WebGL2 | open |
| D-90 | 14 | un-timed cover painter can starve on a never-idle page (cosmetic) | open |
| D-91 | 14 | prepare() ~26 idle slices (deep-link start verified prompt) | fixed (R35.1) |
| D-92 | 15 | layoutTiles out-of-range idx when count < 8 (unreachable today) | fixed (R36.1) |
| D-93 | 15 | hitTile gap test weak | fixed (R36.1) |
| D-94 | 15 | capacity cap not pinned to 112 | fixed (R36.1) |
| D-95 | 15 | tileTransform input/output both named w | fixed (R36.1) |
| D-96 | 15 | unused cols option and DRIFT export | fixed (R36.1) |
| D-97 | 16 | createPickChannel exported from a component file (Fast Refresh) | fixed (R31.3) |
| D-98 | 16 | right-click/non-primary pointers open tiles | open |
| D-99 | 16 | no webglcontextlost handling | open |
| D-100 | 16 | shaders not deleted | fixed (R31.3) |
| D-101 | 16 | failed Images retained | fixed (R31.3) |
| D-102 | 16 | visible hint never mentions keyboard | open |
| D-103 | 16 | .xp-head inert set via DOM query | open |
| D-104 | 16 | wall-engine.ts 784 lines | open: 396 lines after R31.3 (the engine, GL, thumbnails and input are split), stays open until Task 15 |
| D-105 | 16 | detail shot no onError fallback / no wait for img | open |
| D-106 | 16 | reduced motion still redraws every frame and keeps a 0.2 s vfade delay | open |
| D-107 | 16 | pre-size uses innerWidth/innerHeight vs sizes() clientWidth (classic scrollbars may still resize once on first open) | open |
| D-108 | 16 | fly-back not cut short on resize | open |
| D-109 | 16 | deep-link open still does GL setup in the opening frame | open |
| D-110 | 17a | image-fallback interrupt comment/dip | open |
| D-111 | 17a | reduced-motion .home-layer fade bound to element (layer mounts per open, so fine) | open |
| D-112 | 17a | reading start().then without catch | open |
| D-113 | 17a | watching hasFailed timing | open |
| D-114 | 17a | selectors without CSS.escape | open |
| D-115 | 17a | no tests for fallback components/reduced paths | open |
| D-116 | 17a | zoomOf ordering | fixed (R33.2) |
| D-117 | 33 | paint-engine.ts 390 lines (over ~350); move shader sources out | open |
| D-118 | 34 | the layer's video title `clamp(18px, 2vw, 28px)` (watching.css) passes through 19 to 23px between about 950 and 1200 px wide; the audited widths (390, 1440) are on the scale | open |
| D-119 | 34 | at 320 px wide the dock strip is 18 px wider than its pill (scrollable, `overflow-x: auto`), so the last social icon is partly out of sight until scrolled; same before and after R34.1b | open |
