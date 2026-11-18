# Performance, the modern web pass (Task 35)

Date: 17 and 18 November 2026. Branch `r7/r59-web-pass`. Plan: `docs/superpowers/plans/2026-11-17-modern-web-pass.md`, Task 35. Records: `docs/redesign/compare/web-pass/`.

**State after the fix round (R59.3c).** The tree's app code equals the clean 3c66e39 build except for `vercel.json` and a comment: the cache lifetimes are the one change that stays. The shelf's book step (`BOOKS_PER_STEP`) was tried at one and at two books and is back at three (section 3.2, ruling R142); the counter's idle request stays out (section 5, ruling R137 stands with the A/A numbers). The first round of this task (R59.3 to R59.3b) kept one book a step; its tables are replaced below by tables of the final tree.

Every number here was measured on one machine (a Mac running other heavy programs: the 1 minute load was 4 to 15 during the work, 5 to 9 at nearly every start; each run records its load), with headless Chrome, the production build, a fresh browser profile per run, under the timing lock, and **alternated**: the clean build of the previous commit (3c66e39, "before") and the build of this task ("after") ran one after the other in turn, three runs per case (more where said). A change stayed in only if it showed a gain and no gate moved. Where a claim is about noise, an A/A control stands beside it: the same build served twice on two ports and run in the same alternation.

## 1. What was ranked, by time lost

From `baseline.json` and `after-fonts.json` (Task 33) and the runs of this task (`long-frames.mjs` traces with the JavaScript sampler, at 1x and 4x CPU).

| Rank | What | Time lost | Whose | Decision |
| --- | --- | --- | --- | --- |
| 1 | Home LCP 3.7 to 3.9 s at both sizes; its element is a `div` | 3.7 s | Round 7's arrival timing: the hero, the name and the boxes appear at their times on purpose | Out of scope (not changed). Same on every build. |
| 2 | `/experience` LCP 5.2 to 5.3 s at both sizes (the map's text rises on a timer) | 5.2 s | The arrival timing of the map, by design | Out of scope. |
| 3 | First frame of every page: one long frame (150 to 250 ms, blocking 85 to 185 ms) at 8 to 100 ms, with no script in it | up to 250 ms | The browser's first style and layout of a fresh profile (a warm browser: one task of about 38 ms); total blocking time is 0 | Measured and left. |
| 4 | The home's hydration, 77 to 94 ms at 4x CPU (57 ms at 1x), at about 230 ms; these are the 83 to 133 ms frames Task 20 passed on | 80 ms at 4x | React committing the home page. Largest self times inside it: `u` 15 to 20 ms (a canvas resize reader that reads `--dot-res`), the ground 9 to 10 ms, `Ct` 8 to 9, `Ca` 4 to 6, `Gi` 3 to 6, then a long tail | Measured and left (section 4). |
| 5 | The shelf's three books a step: one task of 65 to 78 ms at 4x CPU in the first half second (about 36 ms of it is `document.fonts.check` called by `faceLoaded` in `spine-fonts.ts`, about 12 ms the spine text fitting) | 65 to 78 ms at 4x | The site's own work | One and two books a step tried; both out (section 3.2, R142). |
| 6 | One idle task of 66 to 70 ms at 4x CPU at 1.5 to 2 s, 64 to 67 ms of it one function: `coloursOfImage` (`cover-colours.ts`: a 32 by 48 canvas `drawImage` and `getImageData` of one cover) | 65 ms at 4x | The site's own | Split of the read tried, no gain, taken out (section 5); the cost is in the read itself, not tried further. |
| 7 | A returning visitor: every picture of `public/` asked for again (3 to 12 requests answered 304 per page; 250 to 1860 ms of waiting at 120 ms round trip) | up to 1.9 s per visit | `vercel.json` | **Changed**: a day of cache (section 3.1). |
| 8 | Home is often not restored from the back/forward cache at 1440 (`CacheFlushed`) | a full reload when it happens | Not found to be ours (section 6) | Measured and left. |
| 9 | The counter's request leaves at high priority in the first second | none measured beyond the A/A spread | The site's | Tried, no gain outside the A/A spread, out (section 5, R137). |
| 10 | The largest requests of each page's load, all five pages at both sizes (the list below the table in section 2): the hero painting (594 to 746 KB at 1440 wide), the Mars relief (654 KB at 1440, 346 KB on a phone), `three.module` 172 KB, a font 129 KB, the video thumbnails (6.2 MB from `i.ytimg.com` on the home at 1440) | bytes, not time (LCP is timed by design) | Looks | Measured and left (section 7). |

No page has a CLS over 0 (all 0). The only pages with LCP over 2.5 s are ranks 1 and 2. Nothing the spec's 4.3 "not done" list names (speculation rules; splitting three.js further or loading it later) was touched, nor the service worker its section 4 leaves out.

## 2. Before and after, per page and size

Medians of three alternated runs, the clean build of 3c66e39 and the final tree, run in turn page by page under the lock (the spread in brackets for LCP). "Blocking time" is the total blocking time after first paint inside the first five seconds. Bytes are what crossed the network until 5.6 s (compressed, the `encodedDataLength`), site / YouTube thumbnails / book covers (Open Library and the archive.org hosts it redirects to). Requests are the http and https requests of the load counted before the back/forward round trip (the first round counted after it and printed 436 for the home at 1440 in the runs that were flushed from the cache: 171 is the number). The home page's hero painting is picked at random, so its bytes move by a few hundred KB between runs. LCP differences of 20 to 80 ms on pages with no code difference (the work pages, whose LCP is a YouTube thumbnail fetched over the internet) are noise, and an A/A pair shows the same size of difference between two servers of one build (section 5). Raw runs, with the load of each: `before-r59-3c.json`, `after-r59-3c.json`, `before-r59-3c-cpu4.json`, `after-r59-3c-cpu4.json` (made by `scripts/audit/web-vitals-table.mjs` from one `web-vitals.mjs` run per case). Loads at the start of these runs: 2.5 to 7.2. The tables of the first round (with one book a step) are in `before-r59-3.json`, `after.json` and the two `-cpu4` files, and the two-books candidate's in `gates-r59-3c-two-books/web-vitals-after-*.json`.

#### CPU 1x (this machine)

| Page | Size | LCP before (ms, spread) | LCP after | CLS | Blocking time before to after (ms) | Bytes before to after (KB): site / YouTube / covers | Requests (http and https, before to after) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| / | 1440x900 | 3756 (3708 to 3820) | 3836 (3788 to 3872) | 0 to 0 | 0 to 0 (after spread 0 to 0) | 1881 / 6169 / 382 to 1636 / 6170 / 382 | 171 to 171 |
| /work | 1440x900 | 888 (860 to 912) | 912 (864 to 920) | 0 to 0 | 0 to 0 (after spread 0 to 42) | 355 / 225 / 0 to 355 / 225 / 0 | 52 to 52 |
| /work/long-form | 1440x900 | 212 (164 to 240) | 236 (216 to 248) | 0 to 0 | 0 to 0 (after spread 0 to 0) | 481 / 461 / 0 to 481 / 461 / 0 | 60 to 60 |
| /work/short-form | 1440x900 | 232 (164 to 236) | 280 (116 to 288) | 0 to 0 | 0 to 0 (after spread 0 to 0) | 482 / 0 / 0 to 482 / 0 / 0 | 39 to 39 |
| /experience | 1440x900 | 5228 (5224 to 5244) | 5232 (5224 to 5248) | 0 to 0 | 0 to 0 (after spread 0 to 0) | 1039 / 0 / 0 to 1039 / 0 / 0 | 33 to 33 |
| / | 390x844 | 3672 (3660 to 3760) | 3708 (3696 to 3716) | 0 to 0 | 0 to 0 (after spread 0 to 0) | 1410 / 0 / 291 to 1369 / 0 / 375 | 62 to 62 |
| /work | 390x844 | 288 (136 to 300) | 308 (188 to 308) | 0 to 0 | 0 to 0 (after spread 0 to 0) | 302 / 116 / 0 to 302 / 116 / 0 | 47 to 47 |
| /work/long-form | 390x844 | 280 (220 to 284) | 172 (104 to 284) | 0 to 0 | 0 to 0 (after spread 0 to 0) | 427 / 462 / 0 to 427 / 461 / 0 | 60 to 60 |
| /work/short-form | 390x844 | 204 (200 to 228) | 224 (60 to 224) | 0 to 0 | 0 to 0 (after spread 0 to 0) | 429 / 0 / 0 to 429 / 0 / 0 | 39 to 39 |
| /experience | 390x844 | 5240 (5228 to 5244) | 5224 (5216 to 5236) | 0 to 0 | 0 to 0 (after spread 0 to 0) | 732 / 0 / 0 to 732 / 0 / 0 | 33 to 33 |

#### CPU 4x slower CPU

| Page | Size | LCP before (ms, spread) | LCP after | CLS | Blocking time before to after (ms) | Bytes before to after (KB): site / YouTube / covers | Requests (http and https, before to after) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| / | 1440x900 | 632 (624 to 652) | 636 (600 to 648) | 0 to 0 | 93 to 99 (after spread 92 to 99) | 1849 / 6170 / 382 to 1673 / 6170 / 382 | 171 to 171 |
| /work | 1440x900 | 1052 (1024 to 1100) | 1084 (1048 to 1100) | 0 to 0 | 0 to 0 (after spread 0 to 0) | 355 / 225 / 0 to 355 / 225 / 0 | 52 to 52 |
| /work/long-form | 1440x900 | 308 (304 to 312) | 304 (292 to 320) | 0 to 0 | 0 to 0 (after spread 0 to 0) | 481 / 462 / 0 to 481 / 462 / 0 | 60 to 60 |
| /work/short-form | 1440x900 | 288 (280 to 304) | 300 (272 to 316) | 0 to 0 | 0 to 0 (after spread 0 to 0) | 482 / 0 / 0 to 482 / 0 / 0 | 39 to 39 |
| /experience | 1440x900 | 5260 (5252 to 5272) | 5240 (5240 to 5248) | 0 to 0 | 31 to 33 (after spread 31 to 33) | 1039 / 0 / 0 to 1039 / 0 / 0 | 33 to 33 |
| / | 390x844 | 612 (608 to 652) | 596 (584 to 608) | 0 to 0 | 96 to 95 (after spread 92 to 98) | 1385 / 0 / 291 to 1400 / 0 / 291 | 62 to 62 |
| /work | 390x844 | 456 (452 to 456) | 444 (428 to 456) | 0 to 0 | 0 to 0 (after spread 0 to 0) | 302 / 116 / 0 to 302 / 116 / 0 | 47 to 47 |
| /work/long-form | 390x844 | 296 (288 to 316) | 292 (284 to 320) | 0 to 0 | 0 to 0 (after spread 0 to 0) | 427 / 462 / 0 to 427 / 462 / 0 | 60 to 60 |
| /work/short-form | 390x844 | 292 (292 to 308) | 304 (280 to 308) | 0 to 0 | 0 to 0 (after spread 0 to 0) | 429 / 0 / 0 to 429 / 0 / 0 | 39 to 39 |
| /experience | 390x844 | 5252 (5248 to 5252) | 5232 (5228 to 5248) | 0 to 0 | 30 to 30 (after spread 30 to 32) | 732 / 0 / 0 to 732 / 0 / 0 | 33 to 33 |

Reading it: the final tree's app code is the clean build's, so every difference above is noise: LCP, CLS, blocking time and bytes of the first visit do not move, as they should not. The home's blocking time at 4x CPU (93 to 99 ms at 1440, 95 to 96 at 390) is the three-book step and the hydration (section 4); what changed in this task is the second visit (section 3.1).

#### The largest requests of each page's load

| Page | Size | Six largest (KB, origin and path) |
| --- | --- | --- |
| / | 1440x900 | 594 localhost/paintings/2560/tower-of-babel.webp; 209 localhost/paintings/2560/death-of-socrates.webp; 196 localhost/portraits/aditya.jpg; 172 localhost/assets/three.module-D5rf0S9N.js; 129 localhost/assets/newsreader-latin-opsz-normal-s-izfB6B.woff2; 113 i.ytimg.com/vi/yoNNS1WA9gI/sddefault.jpg |
| /work | 1440x900 | 83 localhost/assets/components-KaAGY9VR.js; 52 localhost/stack/final-cut-pro.png; 48 localhost/assets/eclipse-ground-3VqzLK6-.js; 30 localhost/grounds/eclipse-1.webp; 29 localhost/grounds/eclipse-0.webp; 25 i.ytimg.com/vi/FKc_IY2oQK4/hqdefault.jpg |
| /work/long-form | 1440x900 | 172 localhost/assets/three.module-D5rf0S9N.js; 83 localhost/assets/components-KaAGY9VR.js; 48 localhost/assets/eclipse-ground-3VqzLK6-.js; 34 i.ytimg.com/vi/67tM7Vb_-HU/hqdefault.jpg; 32 i.ytimg.com/vi/wit1TTy0UWY/hqdefault.jpg; 30 localhost/grounds/eclipse-1.webp |
| /work/short-form | 1440x900 | 172 localhost/assets/three.module-D5rf0S9N.js; 83 localhost/assets/components-KaAGY9VR.js; 48 localhost/assets/eclipse-ground-3VqzLK6-.js; 30 localhost/grounds/eclipse-1.webp; 29 localhost/grounds/eclipse-0.webp; 21 localhost/grounds/eclipse-3.webp |
| /experience | 1440x900 | 654 localhost/mars/relief.webp; 121 localhost/mars/heights.png; 83 localhost/assets/components-KaAGY9VR.js; 48 localhost/assets/eclipse-ground-3VqzLK6-.js; 24 localhost/assets/experience-UjyPB4Bn.js; 16 localhost/assets/ibm-plex-mono-latin-600-normal-BgSNZQsw.woff2 |
| / | 390x844 | 196 localhost/portraits/aditya.jpg; 172 localhost/assets/three.module-D5rf0S9N.js; 135 localhost/paintings/1600/stanczyk.webp; 129 localhost/assets/newsreader-latin-opsz-normal-s-izfB6B.woff2; 109 localhost/paintings/1600/death-of-julius-caesar.webp; 91 ia800505.us.archive.org/view_archive.php |
| /work | 390x844 | 83 localhost/assets/components-KaAGY9VR.js; 52 localhost/stack/final-cut-pro.png; 48 localhost/assets/eclipse-ground-3VqzLK6-.js; 24 i.ytimg.com/vi/o321t-rfScA/hqdefault.jpg; 24 i.ytimg.com/vi/9hkHhSmcA9s/hqdefault.jpg; 24 i.ytimg.com/vi/yTF_aczKJzg/hqdefault.jpg |
| /work/long-form | 390x844 | 172 localhost/assets/three.module-D5rf0S9N.js; 83 localhost/assets/components-KaAGY9VR.js; 48 localhost/assets/eclipse-ground-3VqzLK6-.js; 34 i.ytimg.com/vi/67tM7Vb_-HU/hqdefault.jpg; 32 i.ytimg.com/vi/wit1TTy0UWY/hqdefault.jpg; 29 i.ytimg.com/vi/x9Y46uLTBII/hqdefault.jpg |
| /work/short-form | 390x844 | 172 localhost/assets/three.module-D5rf0S9N.js; 83 localhost/assets/components-KaAGY9VR.js; 48 localhost/assets/eclipse-ground-3VqzLK6-.js; 15 localhost/assets/ibm-plex-mono-latin-400-normal-DMJ8VG8y.woff2; 14 localhost/work/short-form; 11 localhost/assets/wall-page-BPaOsjIy.js |
| /experience | 390x844 | 346 localhost/mars/relief-phone.webp; 121 localhost/mars/heights.png; 83 localhost/assets/components-KaAGY9VR.js; 48 localhost/assets/eclipse-ground-3VqzLK6-.js; 24 localhost/assets/experience-UjyPB4Bn.js; 16 localhost/assets/ibm-plex-mono-latin-600-normal-BgSNZQsw.woff2 |

The home's first two items are the hero painting (random) and another painting of the hero's rotation (by its name). `three.module` (172 KB) and `components` (83 KB) are among the six largest on every page but `/work`, where the video thumbnails (25 KB each) and the stack icons come next; `/experience` is dominated by the Mars relief picture. The list is of the whole load until 5.6 s, not only of what the first screen needs: `requests.largest` has no start-time filter.

## 3. The changes made

### 3.1 Cache lifetimes (`vercel.json`, test in `app/lib/vercel-config.test.ts`)

`/paintings/(.*)`, `/mars/(.*)`, `/grounds/(.*)`, `/portraits/(.*)` and `/stack/(.*)` get `Cache-Control: public, max-age=86400, stale-while-revalidate=604800`. Nothing touches `/assets/` (hashed files keep Vercel's year) or documents. Measured with `scripts/audit/vercel-headers-proxy.mjs`, a stand-in for what Vercel does to the files of `public/` (`public, max-age=0, must-revalidate`, then the rules of the given `vercel.json`) with 120 ms round trip, and `repeat-visit.mjs` (a page is loaded, left, loaded again in the same browser; three runs each, alternated, load 3.8 to 7):

| Page | Second visit, before: requests to the server / answered 304 / for the picture folders / wait for them | after |
| --- | --- | --- |
| `/` | 9 / 5 to 6 / 7 / 863 to 870 ms | 3 to 4 / 0 / 1 to 2 / 128 to 254 ms |
| `/work` | 12 / 11 / 11 / 1846 to 1858 ms | 1 / 0 / 0 / 12 ms |
| `/work/long-form` | 4 / 3 / 3 / 376 to 383 ms | 1 / 0 / 0 / 6 to 8 ms |
| `/work/short-form` | 4 / 3 / 3 / 374 to 375 ms | 1 / 0 / 0 / 7 to 8 ms |
| `/experience` | 3 / 2 / 2 / 248 to 249 ms | 1 / 0 / 0 / 2 ms |

The "1" left is the counter's request. The first visit is unchanged (the headers only matter after it). The guide `performance` is the one on caching; it is about service workers, so the rule it gives (stale-while-revalidate for what may be slightly stale, never a hashed file's name bypassed) is applied to the headers instead. A picture changed in `public/` shows to a returning visitor up to a day late (a week at most while the server answers). Cost if wrong: one `vercel.json` edit.

### 3.2 Books a step (`app/components/home/reading/shelf-scene.ts`, `BOOKS_PER_STEP`): tried at 1 and at 2, back at 3 (ruling R142)

The shelf paints its 14 book spines in idle steps, one step per idle callback. At three books a step one step is a task of 65 to 78 ms at 4x CPU (25 ms here) in the first half second (`document.fonts.check` 31 to 37 ms and the spine text fitting 10 to 15 ms of it, by the corrected sampler, section 4). The first round of this task kept one book (a step of 40 to 44 ms) on the evidence of blocking time and of the shelf's scene being ready about 100 ms later at 1x. The review found that readiness was only measured where it cannot be seen, so the fix round measured it where it can: a box that comes on screen while the shelf is still being built draws its dark ground until the scene's first live draw. Builds: base (clean 3c66e39, three books), the same build served again (A/A), one book, two books, alternated, cold browser each, 4x CPU, `scripts/audit/shelf-ready.mjs`; raw runs in `perf-fix-round-records.json`.

**The urgent path** (time from the box coming on screen to its first live draw / animation frame gaps over 34 ms / longest gap ms / longest long animation frame ms, medians; the first sets of 9 or 10 rounds, loads 2.7 to 11):

| Case | base | base again (A/A) | 1 book | 2 books |
| --- | --- | --- | --- | --- |
| after a page change into the home, 1440, box scrolled in at 0.3 s (10 rounds) | 558 / 5 / 108.5 / 115 | 529 / 5 / 100 / 115.5 | 571.5 / 3 / 67 / 79.5 | 542.5 / 4 / 100 / 101 |
| same, box scrolled in at 2 s (9 rounds) | 546 / 5 / 100 / 121 | 554 / 5 / 100 / 120 | 577 / 4 / 67 / 81 | 561 / 4 / 100 / 109 |
| same at 390, 0.3 s (9 rounds) | 489 / 4 / 117 / 122 | 478 / 4 / 100 / 113 | 513 / 2 / 67 / 80 | 473 / 2 / 83 / 100 |
| same at 390, 2.5 s (9 rounds) | 638 / 3 / 283 / 303 | 624 / 2 / 300 / 304 | 642 / 2 / 267 / 277 | 657 / 2 / 283 / 298 |
| first load, 1440, box at 0.7 s (10 rounds) | 257.5 / 1 / 50 / 25 | 275.5 / 1 / 50 / 67.5 | 285 / 0 / 0 / 0 | 268.5 / 1 / 50 / 0 |
| first load, 390, box at 0.8 s (7 rounds) | 88 / 0 / 0 / 0 | 108 / 0 / 0 / 0 | 143 / 0 / 0 / 0 | 130 / 0 / 0 / 0 |

Pooled over the 54 paired rounds of the six cases and read against the mean of the two base servers: the first live draw of one book comes **29 ms later** (median; 43 rounds later, 11 earlier; interquartile range 4 to 53), of two books **10 ms later** (mean 4; 32 later, 21 earlier; range minus 19 to 35), and the A/A pair differs by minus 1 (range minus 14 to 17; 24 later, 29 earlier). The longest animation frame in the window is shorter by 38 ms for one book (a step of 40 ms instead of 72) and by 12 ms for two. Two cases for two books were run again with 14 rounds (box at 2 s at 1440: 556 / 562 / 561 ms for base / A/A / two; at 390, 2.5 s: 664 / 670 / 674): inside the noise. Those first measurements had loads of 5 to 11; a one-off run at load 2.1 to 3.2 (the two-books build against base and the A/A server, 10 rounds, box at 0.3 s): 444 / 442 / 461 ms for base / A/A / two books. A wait over 400 ms is a click the open gate (`READY_WAIT_MS`) answers with the plain grid: in the page-change cases it is over 400 ms on every build in every run (base included), so that window is not changed by the step; in the first load cases it is 0 to 340 ms on every build.

**Rule R142** (one book stays only if the box's first live draw is not later beyond noise and no frame is longer): one book fails the first half (29 ms later against an A/A of minus 1), although its frames are shorter. It is out.

**Two books** (a step of 57 to 67 ms at 4x, still over the 50 ms line; the draw inside the noise; the longest frame 12 ms shorter): total blocking time of the home at 4x, eight alternated rounds per size with the A/A pair (`web-vitals.mjs`, loads 2.7 to 5.5):

| Home at 4x CPU | base | A/A | 1 book | 2 books | beacon (section 5) |
| --- | --- | --- | --- | --- | --- |
| 1440, blocking time ms (median [range]) | 67 [61 to 143] | 70.5 [58 to 108] | 52 [40 to 100] | 58.5 [50 to 92] | 74.5 [61 to 104] |
| paired with base: median (rounds lower / higher) | | minus 1 (4 / 4) | minus 18.5 (7 / 1) | minus 9 (7 / 1) | 0 (3 / 3) |
| 390, blocking time ms | 72.5 [65 to 92] | 78.5 [57 to 85] | 46.5 [43 to 53] | 55.5 [54 to 83] | 67.5 [56 to 84] |
| paired with base | | plus 1 (4 / 4) | minus 26.5 (8 / 0) | minus 17 (7 / 1) | minus 8 (5 / 2) |

So two books has a measured gain (outside the A/A spread) and no later draw. It is then a **gate** question: the plan says gates decide over any performance idea, so the two-books build ran the page change's cost gate (compositor and display times, dropped frames after the change's first frame) at 1920 by 1080 at 1x, three runs an invocation, alternated with the clean build in the 1920 gate's own way, under the lock (`gates-r59-3c-two-books/`, the series in `perf-fix-round-records.json`, loads 2.6 to 9):

| Build | invocations of three runs that FAIL the dropped-frame rule | runs that dropped a frame after the first | invocations under load 4.5 |
| --- | --- | --- | --- |
| clean (three books) | 2 of 20 | 2 of 60 | 0 of 10 |
| two books | 10 of 21 (the worktree build of the same code 1 of 4) | 18 of 63 | 4 of 11 |
| one book | 0 of 3 (and 0 of 4 in the first round, 12 of 12 runs) | 0 of 9 | 0 of 3 |

The compositor and display limits held in every run of every build; what fails is one dropped frame 30 to 50 ms after the change starts (its second or third frame, the commit frame region), once or twice in a run. Two books fails that rule about five times as often as the clean build at the same loads (10 of 21 against 2 of 20; none of the 10 clean invocations under load 4.5 failed against 4 of 11 for two books), which the page change gate forbids. The cause was not found (the gate starts its traced change about 4 s after the warm-up change returned to the home, long after the shelf's steps; a step cannot be inside it). One book never failed. The conclusion under R142 is the third branch: **back to three books a step**, no change of the shelf. The comment in `shelf-scene.ts` records this.

The home-scroll cold film (`make-home-scroll.mjs --cold`, desktop 1440 at dpr 2 with 4x CPU, 12 passes a build, phone 390 with 4 passes, loads 2.5 to 8.8) had no frame over 34 ms outside a painting change's window on any build; inside the changes' own windows (the hero's cost) 3 frames over 34 ms for base, 7 for one book and 4 for two books in 12 passes, worst 50 ms on all three. The box-open cost film (`make-box-open.mjs --only cost`, shelf and wall at 1440 dpr 2 and 390 dpr 3, 4x CPU, 6 runs a build, loads 3.4 to 6.5): no frame over 34 ms and no long animation frame in any run of any build (the worst frame 33.4 ms, once, in base's closing). So the films do not separate the builds; the urgent path and the gate did. A reading box open, before against after: `perf-reading-box.jpg` (three, one and two books side by side at 1440 and 390 with generated covers: the spines, the shelf and the closed box are the same; the 0.04% of pixels that differ at 1440 are the hero's random painting behind the dock).

Possible follow-up, not done (it would be a new change): by the corrected sampler about 36 ms of the 72 ms step is `document.fonts.check` in `faceLoaded` (`spine-fonts.ts`), called for each face of each book, and about 12 ms is the text fitting (`$c`); caching the answer per face would take the step under 50 ms at three books with no change of step size and no later draw. The 66 to 70 ms idle task at 1.5 to 2 s is one `coloursOfImage` call per cover (64 to 67 ms of it, one function).

Guide `break-up-long-tasks`: a task over 50 ms is the one to cut. `yieldToMain()` was not needed (there is no loop of the site's own to yield inside; the steps are already separate idle callbacks), so `app/lib/yield.ts` was not written.

## 4. Long frames: measured and left

- The first frame of each page (rank 3): no script, the browser's first layout. With a warm browser (`WARM=/favicon.svg`, another page loaded first) the first layout is 38 ms at 1x.
- The home's hydration (rank 4): a trace with the sampler at 4x CPU (`long-frames.mjs`, five alternated rounds a build, `scripts/audit/long-frames.mjs` as fixed in R59.3c; the first round's figures came from a tool that timed the samples from each chunk's emission time and are withdrawn) puts 95 to 102 ms in one task with the sampler on (80 ms without it): `u` 17 to 20 ms (a canvas resize reader reading `--dot-res`), the Eclipse ground's set-up 9 to 11 ms (`bh`), `Ct` 8 to 10 ms, `Ca` 4 to 7 ms, `Gi` (React's commit) 3 to 7 ms of its own, then a long tail of small calls and 16 to 18 ms of layout. The first round had named `Gi` at 43 ms; that was a misattribution (the samples of the next 40 ms of work were counted in it). Cutting the three named calls out (ground, `Ct`, `Ca`: about 22 ms) would leave about 60 ms of the 83, still over the line, and moving them later would change when the ground and the boxes appear, which Round 7 fixed on purpose. Left.
- Checked on a trace the fixed tool reads again with `REANALYSE=` (`scratchpad` dump of the home at 4x): the 83 ms task at 231 ms gives `u` 15.2, ground 9.5, `Ct` 7.3, `Ca` 4.0, `Gi` 4.0; the idle task at 1906 ms (68 ms) gives `Fc` (`coloursOfImage`) 64.9 ms and no idle time, where the old placement gave it 31 ms and 7.4 ms of `(idle)`, which cannot happen inside a busy task.
- The shelf's step at about 0.4 s (three books, 65 to 78 ms at 4x without the sampler, 84 to 110 ms with it): `Mi` (`document.fonts.check` through `faceLoaded`) 31 to 37 ms without the sampler's slowdown and 38 to 63 with it, `$c` (fitting the spine text with `measureText`) 10 to 16 ms. The idle task at 1.5 to 2 s: `Fc` alone, 64 to 74 ms (one `coloursOfImage`: a `drawImage` of a decoded cover into a 32 by 48 canvas and a `getImageData`).

## 5. Tried and taken out

| What | Measured | Why out |
| --- | --- | --- |
| The counter's request after the page is idle, `priority: "low"`, `keepalive: true`, one request per route key, flushed on `pagehide` (the inherited `page-view-beacon.ts`, matching the plan's step 4 and the guide `deprioritize-background-fetches`). **Ruling R137 was suspended by the review (the first round's "no gain in LCP" contradicted its own record) and decided again here** | **Fix round**: home at 1440 and at 390, 4x CPU, eight rounds each of five builds in turn (rotated order), loads 2.7 to 5.5 (`web-vitals.mjs`; raw in `perf-fix-round-records.json`): base, base again on a second server (A/A), the beacon, one book, two books. LCP at 1440 (median, range): base 594 (560 to 692), A/A 544 (528 to 616), beacon 584 (556 to 868); paired with base: A/A minus 50 ms (7 of 8 rounds lower), beacon minus 8 (6 of 8 lower). At 390: base 586, A/A 564, beacon 568; paired: A/A minus 42, beacon minus 38. First contentful paint at 1440: base 330, A/A 298, beacon 294; at 390: 332, 298, 302. Blocking time at 1440: 67, 70.5, 74.5; at 390: 72.5, 78.5, 67.5. The request itself leaves later: counter start 445 ms (base), 402 (A/A), 531 (beacon) at 1440 and 441, 413, 526 at 390; in all 8 rounds of each size the beacon's request was later than base's, by 52 to 296 ms, at priority Low instead of High. The stopped fix work's own 10 rounds a size at loads 4 to 21 (base against beacon, A/A pair beside them) gave LCP 650 against 654 ms at 1440 (A/A medians 640 and 818) and 586 against 602 at 390 (A/A 620 and 612): inside the A/A spread too. First round, `/work` at 1440 on a throttled network (150 ms, 1.6 Mbit): the request leaves at 2064 to 2088 ms (high, 160 ms long) before and 2101 to 2127 ms (low, 345 to 400 ms long) after; LCP 3744 and 3740 ms | The beacon's LCP gain (minus 8 and minus 38 ms) is smaller than the A/A pair's own difference between two servers of the same build (minus 50 and minus 42 ms), so it is **not outside the A/A spread**; first paint and blocking time are the same. The one stable effect is that the request goes out 50 to 300 ms later at low priority. **R137 stands**: out for lack of a measured gain (spec 4.3's rule), although plan step 4 and the guide ask for it. Its patch, tests included, is in `compare/web-pass/counter-beacon-taken-out.patch` |
| Reading a cover's colours in an idle step of its own, apart from painting and uploading it (`shelf-covers.ts`) | `long-frames.mjs`, home 1440, 4x CPU, six alternated rounds, base / one book a step / this: the 62 to 68 ms idle task at 1.5 to 1.9 s stayed 64 to 67 ms (with the split) against 65 to 66 ms (without) | The first round explained this by the browser running several idle callbacks in one task. The fixed sampler says otherwise: the task is one function, `coloursOfImage` (64 to 74 ms of the 66 to 80), so moving the read into a step of its own moves the same 65 ms, and only a cheaper read (not tried) would shorten it |
| Font preloads | (Task 33, ruling R133) | Already out |

## 6. The back/forward cache

On the build of the previous commit, home at 1440 is restored from the back/forward cache in about half of the runs and is flushed in the others, with the reason `CacheFlushed` and nothing else. The other pages (`/work`, `/experience`, `/work/short-form`) were restored in 14 of 15 runs of the same kind. What was tried:

- Same page, alternated, the clean build, the build with the counter change, the build with the books change and the build with both: restored 10 of 21, 6 of 10, 8 of 10 and 10 of 16. A run of seven on the clean build alone, one after the other, was restored 0 of 7, a run of ten an hour later 8 of 10. So no change of this task moves it, and the pattern in the stopped work's records (5 of 6 flushed before, 2 of 6 after) is inside that spread.
- `CacheFlushed` is not one of the blocking reasons (an `unload` handler, `Cache-Control: no-store`, an open connection): it means the browser threw the entry away. The machine is at memory pressure level 2 (warning) while the owner's video programs run. With Chrome's `--memory-pressure-off`: 4 of 7 restored against 0 of 7 in a first run, 8 of 10 against 8 of 10 in a second, so the memory-pressure link is not proven either way.
- The home is the heaviest page (two WebGL scenes, about 130 pictures); the lighter pages were flushed once in 15 runs.

Nothing of the site's was found to cause it and nothing was changed. The `performance` guide's rule is "DON'T use `Cache-Control: no-store` for non-sensitive resources", and it names `Cache-Control: no-cache` or `max-age=0` for pages that need fresh content; the documents send `private, no-cache` (seen on the preview in Task 34), which is the form the guide asks for. A real-browser check on the deployed site (Chrome's `chrome://` back/forward cache test, or the `NotRestoredReasons` API in field data) is the way to find a cause that headless Chrome under load hides; listed for the owner.

## 7. Measured and left, with the reason

- The hero painting is 764 KB at the 2560 size for windows 1401 to 2560 wide (the `srcset` is `1400w` / `2560w`). A smaller file would be a softer picture on a 1440 screen, which the look rule does not allow, and the LCP of the home is its timer, not this file.
- The 109 YouTube thumbnails (6.2 MB on the home at 1440): the wall's pictures, the look.
- `three.module` (172 KB compressed): the spec's "not done" list (loading it later changes when the hero and the boxes appear).
- Total blocking time of `/experience`, 26 ms at 4x CPU: a single task at about 4 s, under the line that matters and not on a first-screen path.

## 8. Pictures

`compare/web-pass/perf-before-after-1440.jpg`, `-390.jpg`, `-320.jpg`: the five pages, before (the clean build) next to after (the final tree, taken again in the fix round), at 1440 by 900, 390 by 844 and 320 by 568, with generated pictures for the thumbnail and cover hosts (`make-web-pass-pictures.mjs <before|after> generated`; tracked sheets, no thumbnails or covers). The four work and experience pairs are the same (at most 0.06% of the pixels differ by more than 25 levels, the dock's glow and the tiles' own motion); the home shows another painting each load (the hero picks one at random: Wanderer above the Sea of Fog against The Tower of Babel at 1440), every layout is the same. `perf-reading-box.jpg`: the home's reading box closed and open at 1440 and 390 on the clean build (three books a step), one book and two books, with generated covers: the spines, the shelf and the box are the same in all three (0 to 0.04% of the pixels differ). The real pictures of the three video pages are in `compare/local/perf/` (git-ignored; those of the first round).

## 9. Gates

All on the production build of the final tree (three books a step; the comment of `shelf-scene.ts` was reworded after the build, no code), under the lock, loads in `compare/web-pass/gates-r59-3c/loads.tsv`:

| Gate | Result | Load at the start (1, 5, 15 min) |
| --- | --- | --- |
| `yarn typecheck`, `yarn lint`, `yarn build` | pass | |
| `yarn vitest run` | 187 files, 2561 tests pass | |
| `page-change.json`, `-hook`, `-phone` | 5 changes each, no frame over 34 ms in all 15 (longest 33.3 ms, in the first) | 4.41 4.02 4.22; 4.87 4.19 4.27; 4.43 4.12 4.24 |
| `arrival.json` | 16 of 16 steps ok | 3.84 4.02 4.20 |
| `make-arrival.mjs run --generated` | 12 of 12 PASS | 3.62 3.85 4.10 |
| Glass cost 1512x982@2 | PASS: compositor 242, 241, 242 ms (limit 450), display 180, 168, 170 ms (limit 300), one dropped frame a run (the first, excluded per R125/R127) | 3.44 3.76 3.99 |
| Glass cost 1920x1080@1 | three invocations of three runs against the clean build, alternated: the final tree FAIL, PASS, PASS (the failure: 2 frames dropped after the first in one run, at the 3.65 load of its end; the re-run under the rule passed twice); the clean build PASS, PASS, PASS. Compositor 298 to 369 ms, display 197 to 258 ms in every run of both | 4.75 4.08 4.09 (final 1); 3.65 3.94 4.04 (base 1); 3.34 3.76 3.96 (base 2); 4.21 3.91 4.00 (final 2); 3.02 3.61 3.88 (final 3); 3.42 3.64 3.87 (base 3) |

The loads at the start of the 1920 gate in the first round (the review found the figures printed there, 3.63 to 5.38, were not in the records) were, in run order, 4.2 to 6.5 per run (`gates-r59-3/glass-1920-*.json`, field `loadAverage`); the 1 minute load at the start of each invocation of this round is above and in `loads.tsv`. The final tree is, in app code, the clean build, so the 1920 gate shows the clean build's own dropped-frame behaviour: it fails now and then (2 of 20 invocations of the clean build in the alternated series of the fix round, 1 of 3 of the final tree in the last one), the compositor and display limits holding every time. Ruling R136 (environmental) is supported for the clean build; section 3.2 shows that one build, two books, makes it about five times as frequent.

The gates of the two-books candidate (page change x3 and arrival, make-arrival, glass 1512: all passed, 1920: failed as in section 3.2) are in `gates-r59-3c-two-books/`.
