# The redesign

Working folder for the whole redesign of the FragTaco portfolio, from the first mockup on 1 November 2026 to the release on 18 November 2026: the home page, the work pages, My experience, the page change, and the modern web pass (fonts, security, performance, modernize). It holds the running log of feedback and decisions, the audits, the list of changes, every mockup and preview, the screenshots and the before and after pictures.

The story of all of it, in one readable page, is [the case study](../case-study.md). The site as released is described in the repository [README](../../README.md).

## The records

| File | What it is |
| --- | --- |
| [feedback-log.md](feedback-log.md) | Every round of feedback (0 to 7), what changed in response, the decisions and rulings, the build lines, the measured tables, the final status of rounds 5, 6 and 7 and of the modern web pass, and the release. Start here for detail. |
| [audit-2026-11-11.md](audit-2026-11-11.md) | The 11 November 2026 audit of the built site: 65 findings with evidence (ids such as K-10, T-04). |
| [changes-2026-11.md](changes-2026-11.md) | One row per audit finding fixed, and the rows of the later parts: what changed, where, and the commit. |
| [deferred-review-notes.md](deferred-review-notes.md) | The 116 small review notes deferred during the home build (D-ids). None is left open: each is fixed or closed with a reason. |
| [security-audit-2026-11.md](security-audit-2026-11.md) | The security audit of the site (modern web pass, Task 34): each finding with its evidence, what was done, what was left and why, the header set as sent, and what only the owner can do. The proof is `scripts/audit/security.mjs` (record: `compare/web-pass/security.json`). |
| [performance-2026-11.md](performance-2026-11.md) | The performance work of the modern web pass (Task 35): what was ranked by time lost, the before and after table per page and size, the cache lifetimes for the pictures of `public/` (the one change that stays), the changes tried and taken out with their numbers (the shelf's books a step, the idle counter request, a split of the cover colour read), the back/forward cache, and the gates. Records are in `compare/web-pass/`. |
| [modernize-2026-11.md](modernize-2026-11.md) | The modernize part of the modern web pass (Task 36): the legacy scan's findings with their decisions, the sweep of four guides (one line per old pattern: found where, changed or left and why), the `Promise.withResolvers()` change that was reverted, the Node check, and the gates of the final build. |
| [credits.md](credits.md) | Third-party items (the app icons, the Mars pictures, the gallery source): where each came from, the licence and what was changed. |
| [shaders-notes.md](shaders-notes.md) | Notes from round 6 on the `shaders` package used for the work page's ground. Round 7 removed the package and the ground; kept as a record. |

## Specs and plans

Each round has a design document (the spec) and a build plan, in `docs/superpowers/`. The handover says how the build is run and in what order to read them.

| Round | Spec | Plan |
| --- | --- | --- |
| Home redesign (R24 to R30), 2 November | [home-redesign-design](../superpowers/specs/2026-11-02-home-redesign-design.md): the signed-off design for the home page | [home-redesign](../superpowers/plans/2026-11-02-home-redesign.md) |
| Polish pass, work page and timeline (R31 to R39), 11 November | [polish-and-work-page-design](../superpowers/specs/2026-11-11-polish-and-work-page-design.md) | [polish-and-work-page](../superpowers/plans/2026-11-11-polish-and-work-page.md): 27 tasks |
| The handover for the polish pass | | [handover](../superpowers/plans/2026-11-11-handover.md): how the build is run |
| Round 6 (R40 to R46), 11 to 13 November | [round6-design](../superpowers/specs/2026-11-11-round6-design.md) | [round6](../superpowers/plans/2026-11-11-round6.md) |
| Round 7 (R47 to R57), 13 November | [round7-design](../superpowers/specs/2026-11-13-round7-design.md) | [round7](../superpowers/plans/2026-11-13-round7.md) |
| Round 7 follow-ups (Tasks 22 to 26, R54 and R55), 14 November | [round7-followups-design](../superpowers/specs/2026-11-14-round7-followups-design.md) | [round7-followups](../superpowers/plans/2026-11-14-round7-followups.md) |
| Round 7 change and arrival (Tasks 27 and 28, R56), 15 November | [round7-change-arrival-design](../superpowers/specs/2026-11-15-round7-change-arrival-design.md) | [round7-change-arrival](../superpowers/plans/2026-11-15-round7-change-arrival.md) |
| Round 7 second look (Tasks 29 to 31), 16 November | [round7-second-look-design](../superpowers/specs/2026-11-16-round7-second-look-design.md) | [round7-second-look](../superpowers/plans/2026-11-16-round7-second-look.md) |
| Round 7 edge look (Task 32, R58), 17 November | [round7-edge-look-design](../superpowers/specs/2026-11-17-round7-edge-look-design.md) | [round7-edge-look](../superpowers/plans/2026-11-17-round7-edge-look.md) |
| The modern web pass (R59, Tasks 33 to 36), 17 November | [modern-web-pass-design](../superpowers/specs/2026-11-17-modern-web-pass-design.md) | [modern-web-pass](../superpowers/plans/2026-11-17-modern-web-pass.md) |

## Mockups and previews

Throwaway HTML pages made to choose a direction by looking. Nothing in them ships as it is.

| Folder | What it is |
| --- | --- |
| [mockups/home-v4.html](mockups/home-v4.html) | The signed-off mockup of the home page. The build matches this. |
| [mockups/home-v3.html](mockups/home-v3.html), [home-v2.html](mockups/home-v2.html), [home-v1.html](mockups/home-v1.html) | Earlier mockups, kept for comparison. |
| [round7-preview/](round7-preview/index.html) | The first round 7 preview (13 November): the Olympus Mons map in four looks, an idea that is not Mars, moving grounds, the painting's reveal at five speeds, and a row for spine pictures. |
| [round7-preview-2/](round7-preview-2/index.html) | The second: the map direction kept, Eclipse as the ground, designed spines. |
| [round7-preview-3/](round7-preview-3/index.html) | The third: the flat picture following the camera in 3D, a loop trail (rejected), a much larger Mars picture. |
| [round7-preview-4/](round7-preview-4/index.html) | The fourth: the first trail with its points pushed away from the summit, and the Mars picture and mask taken out. |
| [round7-preview-5/](round7-preview-5/index.html) | The fifth: a camera that stays put until a milestone leaves the comfortable part of the view, cards that choose their place, coarse grain. |
| [round7-preview-6/](round7-preview-6/index.html) | The sixth: the chart layer (grid, rings, marks, readout) and three still grounds for the shelves. |
| [round7-preview-7/](round7-preview-7/index.html) | The seventh: a fainter grid fading with the picture, grain at "barely", a dot field for the shelves. |
| [round7-preview-8/](round7-preview-8/index.html) | The eighth: capitals for both titles and a grid that follows the heights in My climb. |
| [round7-preview-9/](round7-preview-9/index.html) | The ninth: the order of importance in the words' sizes and colours. The map was ported from this one. |
| [round7-preview-10/](round7-preview-10/index.html) | The tenth (14 November): how a home box opens (three choices of what it shows, three lengths) and three widths and strengths for the page change's edge. |
| [round7-preview-11/](round7-preview-11/index.html) | The eleventh (17 November): looks for the page change's edge (the lens as built, the hero painting's liquid, a calm arrival, a colour fringe only). The hero liquid at 150% was picked and built as R58 (the noise is in the screen-fixed vignette picture and the bend's tiles hold the strength only, Ruling R129); its pictures, cost and tile-swap records are `compare/round7/r58-*` (the sheet `r58-edge-look-sheet.jpg` is made with generated pictures). |

### Viewing them

They need a local web server (WebGL will not read images from `file://`) and, for the mockups, an internet connection (three.js, YouTube thumbnails and Open Library covers load from their CDNs; the mockups still load their fonts from Google Fonts, the site itself serves its own).

```bash
python3 -m http.server 5181 --directory docs/redesign/mockups
```

Then open http://localhost:5181/home-v4.html. The row of buttons at the top (replay loader, next painting, jump to the blocks, wall blur on or off) is review tooling, not part of the design.

The round 7 previews are served from `docs/redesign` itself (for example `python3 -m http.server 5190 --directory docs/redesign`, then `/round7-preview/` and so on).

## Pictures and records

| Folder | What it is |
| --- | --- |
| [compare/index.html](compare/index.html) | The comparison page, open from disk: round 5 before and after, a Round 6 row (round 5 beside round 6) and a Round 7 row (round 6 beside round 7, with the page change's cost numbers). Rows marked "not stored in the repo" need local pictures that git does not keep. |
| [compare/before/](compare/before/), [compare/after/](compare/after/) | The polish pass, before and after, taken with the same step files. |
| [compare/round7/](compare/round7/) | Round 7's pictures and gate records (JSON), by part: `r50` to `r58`, the page change, the dock, the map, the shelves. |
| [compare/web-pass/](compare/web-pass/) | The modern web pass: the baseline and after records, the security proof (`security.json`), the font, security, performance and modernize pictures, the gate runs (`gates-r59-*`) and the taken-out counter patch. |
| [screenshots/](screenshots/) | Screenshots by part: v3 and v4, `r25` to `r45` (hero, cards, shelf, work page, timeline, mood, glass frames, rings, walls, the round 6 map). |
| [assets/](assets/) | The logo lockup as an SVG. |

The audit tools that produced the pictures and the numbers are in `scripts/audit/` and `scripts/perf/`; the repository [README](../../README.md) says how to run them.

## Notes

- `mockups/assets/` holds smaller copies of the paintings (1600 px) plus the two portraits, so the mockups run on their own. The site itself uses the full-size paintings in `public/paintings/`.
- YouTube thumbnails and book covers are never stored in this repo. The mockups load them from their hosts, and the pictures kept here either leave the walls out or use generated pictures. Pictures that show real thumbnails or covers go in `compare/local/`, which git ignores.
- No test or code reads from `docs/`: the previews are throwaway and the specs are prose.
