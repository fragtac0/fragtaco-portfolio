# Home page redesign

Working folder for the home page redesign and the polish pass that followed it: the running log of feedback and decisions, the audit, the list of changes, every mockup, and screenshots.

| File | What it is |
| --- | --- |
| [feedback-log.md](feedback-log.md) | Every round of feedback, what changed in response, decisions so far, the build lines and the measured table. Start here. |
| [audit-2026-11-11.md](audit-2026-11-11.md) | The 11 November 2026 audit of the built site: 65 findings with evidence (ids such as K-10, T-04). |
| [changes-2026-11.md](changes-2026-11.md) | One row per audit finding fixed: what changed, where, and the commit. |
| [security-audit-2026-11.md](security-audit-2026-11.md) | The security audit of the site (modern web pass, Task 34): each finding with its evidence, what was done, what was left and why, the header set as sent, and what only the owner can do. The proof is `scripts/audit/security.mjs` (record: `compare/web-pass/security.json`). |
| [performance-2026-11.md](performance-2026-11.md) | The performance work of the modern web pass (Task 35): what was ranked by time lost, the before and after table per page and size (LCP, CLS, blocking time, bytes by origin), the changes made (a day of cache for the pictures of `public/`; one and two books a step on the shelf were tried and are out, the step stays three), the changes tried and taken out with their numbers (the idle counter request, a split of the cover colour read), the back/forward cache, what was measured and left, and the gates with their loads. Records: `compare/web-pass/after-r59-3c.json`, `before-r59-3c.json` (and the `-cpu4` pair), `perf-ab-records.json` (the first round), `perf-fix-round-records.json` (the fix round: urgent path, beacon with an A/A pair, long frames, films, the 1920 series), `gates-r59-3c/` and `gates-r59-3c-two-books/`. |
| [modernize-2026-11.md](modernize-2026-11.md) | The modernize part of the modern web pass (Task 36): the legacy scan's findings with their decisions, the sweep of the `js`, `css`, `html` and `motion` guides (one line per old pattern: found where, changed or left and why), the one change (`Promise.withResolvers()` and the TypeScript library at ES2024), the Node check (`engines.node` stays 22), the pictures and the gates of the final build. |
| [deferred-review-notes.md](deferred-review-notes.md) | The 116 small review notes deferred during the build (D-ids). None is left open: each is fixed or closed with a reason. |
| [compare/](compare/) | Before and after screenshots for the polish pass. The comparison page (`compare/index.html`) is added at the end of the build. |
| [mockups/home-v4.html](mockups/home-v4.html) | Signed-off mockup. The build matches this. |
| [mockups/home-v3.html](mockups/home-v3.html) | Previous mockup, kept for comparison. |
| [mockups/home-v2.html](mockups/home-v2.html) | Earlier mockup, kept for comparison. |
| [mockups/home-v1.html](mockups/home-v1.html) | First mockup, kept for comparison. |
| [round7-preview-11/](round7-preview-11/index.html) | The eleventh preview (17 November): looks for the page change's edge (the lens as built, the hero painting's liquid, a calm arrival, a colour fringe only). The hero liquid at 150% was picked and built as R58 (the noise is in the screen-fixed vignette picture and the bend's tiles hold the strength only, Ruling R129); its pictures, cost and tile-swap records are `compare/round7/r58-*` (the sheet `r58-edge-look-sheet.jpg` is made with generated pictures). |
| [screenshots/](screenshots/) | v3 and v4 screenshots, desktop and phone. |
| [assets/](assets/) | The logo lockup as an SVG. |

Outside this folder, in `docs/superpowers/`:

| File | What it is |
| --- | --- |
| [specs/2026-11-02-home-redesign-design.md](../superpowers/specs/2026-11-02-home-redesign-design.md) | The signed-off design for the home page. |
| [plans/2026-11-02-home-redesign.md](../superpowers/plans/2026-11-02-home-redesign.md) | The build plan for it. |
| [specs/2026-11-11-polish-and-work-page-design.md](../superpowers/specs/2026-11-11-polish-and-work-page-design.md) | The design outline for the polish pass, the new work page and the timeline. |
| [plans/2026-11-11-polish-and-work-page.md](../superpowers/plans/2026-11-11-polish-and-work-page.md) | Its build plan: 27 tasks, R31 to R39. |
| [plans/2026-11-11-handover.md](../superpowers/plans/2026-11-11-handover.md) | How the build is run and in what order to read these. |

The audit tools that produced the screenshots and the numbers are in `scripts/audit/` and `scripts/perf/`; the repository [README](../../README.md) says how to run them.

## Viewing the mockups

They need a local web server (WebGL will not read images from `file://`) and an internet connection (three.js, YouTube thumbnails and Open Library covers load from their CDNs; the fonts of the site itself are served from its own origin since R59.1, the mockups still load theirs from Google Fonts).

```bash
python3 -m http.server 5181 --directory docs/redesign/mockups
```

Then open http://localhost:5181/home-v4.html. The row of buttons at the top (replay loader, next painting, jump to the blocks, wall blur on or off) is review tooling, not part of the design.

## Notes

- `mockups/assets/` holds smaller copies of the paintings (1600 px) plus the two portraits, so the mockups run on their own. The site itself uses the full-size paintings in `public/paintings/`.
- YouTube thumbnails are never stored in this repo. The mockups load them from `i.ytimg.com`, and the screenshots here leave the video wall out for the same reason.
