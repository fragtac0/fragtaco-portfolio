# Performance, the modern web pass (Task 35)

Date: 17 November 2026. Branch `r7/r59-web-pass`. Plan: `docs/superpowers/plans/2026-11-17-modern-web-pass.md`, Task 35. Records: `docs/redesign/compare/web-pass/`.

Every number here was measured on one machine (a Mac running other heavy programs: the 1 minute load was 4 to 15 during the work, 5 to 9 at nearly every start; each run records its load), with headless Chrome, the production build, a fresh browser profile per run, under the timing lock, and **alternated**: the clean build of the previous commit (3c66e39, "before") and the build of this task ("after") ran one after the other in turn, three runs per case (more where said). A change stayed in only if it showed a gain and no gate moved.

## 1. What was ranked, by time lost

From `baseline.json` and `after-fonts.json` (Task 33) and the runs of this task (`long-frames.mjs` traces with the JavaScript sampler, at 1x and 4x CPU).

| Rank | What | Time lost | Whose | Decision |
| --- | --- | --- | --- | --- |
| 1 | Home LCP 3.7 to 3.9 s at both sizes; its element is a `div` | 3.7 s | Round 7's arrival timing: the hero, the name and the boxes appear at their times on purpose | Out of scope (not changed). Same on every build. |
| 2 | `/experience` LCP 5.2 to 5.3 s at both sizes (the map's text rises on a timer) | 5.2 s | The arrival timing of the map, by design | Out of scope. |
| 3 | First frame of every page: one long frame (150 to 250 ms, blocking 85 to 185 ms) at 8 to 100 ms, with no script in it | up to 250 ms | The browser's first style and layout of a fresh profile (a warm browser: one task of about 38 ms); total blocking time is 0 | Measured and left. |
| 4 | The home's hydration, 77 to 94 ms at 4x CPU (57 ms at 1x), at about 230 ms; these are the 83 to 133 ms frames Task 20 passed on | 80 ms at 4x | React committing the home page. The effects inside it are the ground (about 11 ms), `Ca` (9 ms), `Ct` (8) and a long tail | Measured and left (section 4). |
| 5 | The shelf's three books a step: one task of 70 to 73 ms at 4x CPU in the first half second | 70 ms at 4x | The site's own work | **Changed**: one book a step (section 3.2). |
| 6 | One idle task of 62 to 68 ms at 4x CPU at 1.5 to 1.9 s (a cover's colour read, the wall's tile upload and the page change's set-up, run together by the browser) | 65 ms at 4x | The site's own, three owners | Split tried, no gain, taken out (section 5). |
| 7 | A returning visitor: every picture of `public/` asked for again (3 to 12 requests answered 304 per page; 250 to 1860 ms of waiting at 120 ms round trip) | up to 1.9 s per visit | `vercel.json` | **Changed**: a day of cache (section 3.1). |
| 8 | Home is often not restored from the back/forward cache at 1440 (`CacheFlushed`) | a full reload when it happens | Not found to be ours (section 6) | Measured and left. |
| 9 | The counter's request leaves at high priority in the first second | 0 ms of LCP or blocking time | The site's | Tried, no gain, taken out (section 5). |
| 10 | The largest first-screen requests: the hero painting (up to 764 KB at 1440 wide), `three.module` 171 KB, a font 129 KB, the video thumbnails (6.2 MB from `i.ytimg.com` on the home at 1440) | bytes, not time (LCP is timed by design) | Looks | Measured and left (section 7). |

No page has a CLS over 0 (all 0). The only pages with LCP over 2.5 s are ranks 1 and 2. Nothing the spec's "not done" list names (speculation rules, a service worker, loading three.js later) was touched.

## 2. Before and after, per page and size

Medians of three alternated runs (the spread in brackets for LCP). "Blocking time" is the total blocking time after first paint inside the first five seconds. Bytes are what crossed the network in the first five seconds (compressed, the `encodedDataLength`). The home page's hero painting is picked at random, so its bytes move by a few hundred KB between runs. LCP differences of 20 to 60 ms on pages with no code change (the work pages, whose LCP is a YouTube thumbnail fetched over the internet) are noise: `/work` at 1440 measured again in 8 alternated pairs gave 764 to 964 ms before and 848 to 1000 ms after. Raw runs, with the 1, 5 and 15 minute load of each: `before-r59-3.json`, `after.json`, `before-r59-3-cpu4.json`, `after-cpu4.json`.


#### CPU 1x (this machine)

| Page | Size | LCP before (ms, spread) | LCP after | CLS | Blocking time before to after (ms) | Bytes before to after (KB): site / YouTube / covers | Requests |
| --- | --- | --- | --- | --- | --- | --- | --- |
| / | 1440x900 | 3888 (3880 to 3920) | 3840 (3740 to 3848) | 0 to 0 | 0 to 0 (after spread 0 to 7) | 1976 / 6170 / 382 to 1739 / 6170 / 382 | 436 to 435 |
| /work | 1440x900 | 912 (892 to 924) | 940 (928 to 960) | 0 to 0 | 0 to 0 (after spread 0 to 0) | 355 / 225 / 0 to 355 / 225 / 0 | 142 to 142 |
| /work/long-form | 1440x900 | 264 (240 to 280) | 260 (224 to 272) | 0 to 0 | 0 to 0 (after spread 0 to 0) | 481 / 461 / 0 to 481 / 461 / 0 | 159 to 159 |
| /work/short-form | 1440x900 | 196 (176 to 288) | 264 (152 to 304) | 0 to 0 | 0 to 0 (after spread 0 to 0) | 482 / 0 / 0 to 482 / 0 / 0 | 152 to 152 |
| /experience | 1440x900 | 5240 (5232 to 5256) | 5272 (5224 to 5304) | 0 to 0 | 0 to 0 (after spread 0 to 0) | 1039 / 0 / 0 to 1039 / 0 / 0 | 113 to 113 |
| / | 390x844 | 3700 (3696 to 3772) | 3696 (3680 to 3700) | 0 to 0 | 0 to 0 (after spread 0 to 0) | 1510 / 0 / 377 to 1418 / 0 / 382 | 151 to 151 |
| /work | 390x844 | 232 (200 to 284) | 288 (256 to 296) | 0 to 0 | 0 to 0 (after spread 0 to 0) | 302 / 116 / 0 to 302 / 116 / 0 | 124 to 124 |
| /work/long-form | 390x844 | 228 (204 to 272) | 256 (180 to 260) | 0 to 0 | 0 to 0 (after spread 0 to 0) | 427 / 461 / 0 to 427 / 462 / 0 | 157 to 157 |
| /work/short-form | 390x844 | 300 (296 to 300) | 208 (196 to 252) | 0 to 0 | 0 to 0 (after spread 0 to 0) | 429 / 0 / 0 to 429 / 0 / 0 | 150 to 150 |
| /experience | 390x844 | 5236 (5232 to 5264) | 5272 (5264 to 5276) | 0 to 0 | 0 to 0 (after spread 0 to 0) | 732 / 0 / 0 to 732 / 0 / 0 | 111 to 111 |

#### CPU 4x slower CPU

| Page | Size | LCP before (ms, spread) | LCP after | CLS | Blocking time before to after (ms) | Bytes before to after (KB): site / YouTube / covers | Requests |
| --- | --- | --- | --- | --- | --- | --- | --- |
| / | 1440x900 | 596 (580 to 632) | 588 (580 to 676) | 0 to 0 | 95 to 64 (after spread 53 to 81) | 2090 / 6170 / 382 to 2090 / 6170 / 382 | 262 to 260 |
| /work | 1440x900 | 1040 (1028 to 1068) | 1076 (1048 to 1120) | 0 to 0 | 0 to 0 (after spread 0 to 0) | 355 / 225 / 0 to 355 / 225 / 0 | 142 to 142 |
| /work/long-form | 1440x900 | 296 (292 to 384) | 328 (288 to 348) | 0 to 0 | 0 to 0 (after spread 0 to 0) | 481 / 462 / 0 to 481 / 461 / 0 | 159 to 159 |
| /work/short-form | 1440x900 | 288 (280 to 320) | 312 (300 to 336) | 0 to 0 | 0 to 0 (after spread 0 to 3) | 482 / 0 / 0 to 482 / 0 / 0 | 152 to 152 |
| /experience | 1440x900 | 5276 (5240 to 5280) | 5292 (5272 to 5308) | 0 to 0 | 27 to 26 (after spread 25 to 31) | 1039 / 0 / 0 to 1039 / 0 / 0 | 113 to 113 |
| / | 390x844 | 604 (584 to 604) | 568 (556 to 592) | 0 to 0 | 96 to 51 (after spread 48 to 57) | 1430 / 0 / 382 to 1400 / 0 / 382 | 151 to 151 |
| /work | 390x844 | 412 (324 to 420) | 424 (416 to 468) | 0 to 0 | 0 to 0 (after spread 0 to 0) | 302 / 116 / 0 to 302 / 116 / 0 | 124 to 124 |
| /work/long-form | 390x844 | 324 (312 to 328) | 312 (308 to 316) | 0 to 0 | 0 to 0 (after spread 0 to 0) | 427 / 461 / 0 to 427 / 461 / 0 | 157 to 157 |
| /work/short-form | 390x844 | 292 (244 to 324) | 288 (288 to 304) | 0 to 0 | 0 to 0 (after spread 0 to 0) | 429 / 0 / 0 to 429 / 0 / 0 | 150 to 150 |
| /experience | 390x844 | 5260 (5256 to 5272) | 5296 (5264 to 5300) | 0 to 0 | 26 to 27 (after spread 25 to 27) | 732 / 0 / 0 to 732 / 0 / 0 | 111 to 111 |


Reading it: on this machine's CPU nothing but the cache lifetimes moves (they show on a second visit, section 3.1). On a 4 times slower CPU the home page's blocking time drops from 95 to 64 ms at 1440 and from 96 to 51 ms at 390 (the books change). LCP, CLS and the bytes of the first visit do not change, as they should not.

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

### 3.2 One book a step (`app/components/home/reading/shelf-scene.ts`, `BOOKS_PER_STEP` 3 to 1)

The shelf paints its book spines in idle steps. At three books a step one step was 70 to 73 ms at 4x CPU (25 ms here) in the first half second; at one it is 40 to 44 ms, under the 50 ms line. Measured:

- `web-vitals.mjs`, home 1440, 4x CPU, five alternated rounds (load 4.1 to 7): total blocking time 63, 63, 71, 86, 180 ms before (median 71), 45, 48, 49, 49, 51 ms with this change alone (median 49). In the final alternated runs: 95 to 64 ms at 1440 and 96 to 51 ms at 390.
- `long-frames.mjs`, home 1440, 4x CPU, warm profile, eight alternated rounds: tasks over 40 ms per run 3 to 4 before (55 to 82, 70, 66), 3 after the step goes from 70 to 73 ms down to 40 to 44; the others (first layout 55, hydration 77 to 86, the idle task 62 to 68) do not move. Animation frame gaps over 34 ms: 4 per run before, 3 after.
- The cost: the shelf's scene is ready later, about 100 ms at 1x (850 to 960 ms after the load) and 40 ms at 4x (1330 to 1460 against 1383 to 1467 ms). It is prepared long before the first box is drawn live (the arrival rules run to 3.8 s), and the gates below did not move.

Guide `break-up-long-tasks`: a task over 50 ms is the one to cut. `yieldToMain()` was not needed (there is no loop of the site's own to yield inside; the steps are already separate idle callbacks), so `app/lib/yield.ts` was not written.

## 4. Long frames: measured and left

- The first frame of each page (rank 3): no script, the browser's first layout. With a warm browser (`WARM=/favicon.svg`, another page loaded first) the first layout is 38 ms at 1x.
- The home's hydration (rank 4): a trace with the sampler at 4x CPU puts 85 ms in one task: the commit of React's work (`Gi`, 43 ms) with the home's effects inside it (the ground's set-up 10.7 ms, `Ca` 9 ms, `Ct` 8 ms) and 19 ms of rendering. It is a long tail of small calls. Cutting the three named calls out would leave about 55 ms, still over the line, and moving them later would change when the ground and the boxes appear, which Round 7 fixed on purpose. Left.

## 5. Tried and taken out

| What | Measured | Why out |
| --- | --- | --- |
| The counter's request after the page is idle, `priority: "low"`, `keepalive: true`, one request per route key, flushed on `pagehide` (the inherited `page-view-beacon.ts`, matching the plan's step 4 and the guide `deprioritize-background-fetches`) | Home 1440 at 4x CPU, five alternated rounds: request leaves at 413 to 467 ms (high) before, 489 to 538 ms (low) after; LCP 592 and 556 ms, blocking time 63 to 86 and 63 to 70 ms (the books change, not the counter, moves blocking time). `/work` at 1440 on a throttled network (150 ms, 1.6 Mbit), six alternated pairs: the request leaves at 2064 to 2088 ms (high, 160 ms long) before and 2101 to 2127 ms (low, 345 to 400 ms long) after; LCP 3744 and 3740 ms, no change in first paint or blocking time | No gain in LCP, first paint, blocking time or CLS in any case; the one measured effect is that the request goes out 30 to 60 ms later at low priority. The plan's own rule (spec 4.3) says a change with no measured gain is taken out. Its patch, tests included, is in `compare/web-pass/counter-beacon-taken-out.patch` (ruling R137 asks for it back if the coordinator prefers the guide's rule to the measurement) |
| Reading a cover's colours in an idle step of its own, apart from painting and uploading it (`shelf-covers.ts`) | `long-frames.mjs`, home 1440, 4x CPU, six alternated rounds, base / one book a step / this: the 62 to 68 ms idle task at 1.5 to 1.9 s stayed 64 to 67 ms (with the split) against 65 to 66 ms (without) | The browser runs several idle callbacks in one task (the colour read, the wall's tile upload and the page change's set-up were in the same 67 ms task), so a split inside one owner does not shorten it |
| Font preloads | (Task 33, ruling R133) | Already out |

## 6. The back/forward cache

On the build of the previous commit, home at 1440 is restored from the back/forward cache in about half of the runs and is flushed in the others, with the reason `CacheFlushed` and nothing else. The other pages (`/work`, `/experience`, `/work/short-form`) were restored in 14 of 15 runs of the same kind. What was tried:

- Same page, alternated, the clean build, the build with the counter change, the build with the books change and the build with both: restored 10 of 21, 6 of 10, 8 of 10 and 10 of 16. A run of seven on the clean build alone, one after the other, was restored 0 of 7, a run of ten an hour later 8 of 10. So no change of this task moves it, and the pattern in the stopped work's records (5 of 6 flushed before, 2 of 6 after) is inside that spread.
- `CacheFlushed` is not one of the blocking reasons (an `unload` handler, `Cache-Control: no-store`, an open connection): it means the browser threw the entry away. The machine is at memory pressure level 2 (warning) while the owner's video programs run. With Chrome's `--memory-pressure-off`: 4 of 7 restored against 0 of 7 in a first run, 8 of 10 against 8 of 10 in a second, so the memory-pressure link is not proven either way.
- The home is the heaviest page (two WebGL scenes, about 130 pictures); the lighter pages were flushed once in 15 runs.

Nothing of the site's was found to cause it and nothing was changed. The `performance` guide's rule is `Cache-Control: no-store` for non-sensitive pages; the documents send `private, no-cache` (seen on the preview in Task 34), which is the form the guide asks for. A real-browser check on the deployed site (Chrome's `chrome://` back/forward cache test, or the `NotRestoredReasons` API in field data) is the way to find a cause that headless Chrome under load hides; listed for the owner.

## 7. Measured and left, with the reason

- The hero painting is 764 KB at the 2560 size for windows 1401 to 2560 wide (the `srcset` is `1400w` / `2560w`). A smaller file would be a softer picture on a 1440 screen, which the look rule does not allow, and the LCP of the home is its timer, not this file.
- The 109 YouTube thumbnails (6.2 MB on the home at 1440): the wall's pictures, the look.
- `three.module` (171 KB compressed): the spec's "not done" list (loading it later changes when the hero and the boxes appear).
- Total blocking time of `/experience`, 26 ms at 4x CPU: a single task at about 4 s, under the line that matters and not on a first-screen path.

## 8. Pictures

`compare/web-pass/perf-before-after-1440.jpg`, `-390.jpg`, `-320.jpg`: the five pages, before (the clean build) next to after (this build), at 1440 by 900, 390 by 844 and 320 by 568, with generated pictures for the thumbnail and cover hosts (`make-web-pass-pictures.mjs <before|after> generated`). At 1440 the ten pictures are the same (home 0.000%, the work pages up to 0.23% of the pixels differing by more than 25 levels, in the dock's glow and the tiles' own motion). On the phone sizes the home shows another painting each time (the hero picks one at random); every layout is the same. The real pictures of the three video pages are in `compare/local/perf/` (git-ignored).

## 9. Gates

All on the production build of the final tree, under the lock, loads in `compare/web-pass/gates-r59-3/loads.tsv`:

| Gate | Result | Load at the start (1, 5, 15 min) |
| --- | --- | --- |
| `yarn typecheck`, `yarn lint`, `yarn build` | pass | |
| `yarn vitest run` | 187 files, 2561 tests pass (the three tests of the cache headers are new; the stopped work's five tests of the counter went out with it) | |
| `page-change.json`, `-hook`, `-phone` | 5 changes each, no frame over 34 ms in all 15 (longest 33.3 ms) | 12.65 7.40 6.34; 8.02 6.88 6.20; 6.57 6.66 6.15 |
| `arrival.json` | 16 of 16 steps ok | 6.43 6.54 6.13 |
| `make-arrival.mjs run --generated` | 12 of 12 PASS | 5.32 6.19 6.06 |
| Glass cost 1512x982@2 | PASS: compositor 282, 287, 300 ms (limit 450), display 184, 183, 193 ms (limit 300), one dropped frame a run (the first, excluded per R125/R127) | 8.29 6.91 6.30 |
| Glass cost 1920x1080@1 | PASS in four alternated invocations of three runs (12 of 12): compositor 290 to 374 ms, display 184 to 243 ms, none dropped after the first frame | 3.63, 5.38, 3.99, 5.33 (mine) |

The 1920 gate on the clean build of the previous commit, alternated with it: pair 1 FAIL (3 dropped frames after the first in one run), pair 2 FAIL (27 in one run), pairs 3 and 4 PASS, at the same loads (4.7 to 5.5). So the dropped-frame failures Task 34 saw are intermittent and belong to the machine, not to any build (ruling R136 holds). The machine never went quiet: the lowest 1 minute load was 3.63 and the gate ran under 4 at the start of two invocations only; this is said plainly in ruling R138 of the report. The compositor and display limits held in every run on both builds.
