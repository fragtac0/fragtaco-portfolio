# Home page redesign

Working folder for the home page redesign and the polish pass that followed it: the running log of feedback and decisions, the audit, the list of changes, every mockup, and screenshots.

| File | What it is |
| --- | --- |
| [feedback-log.md](feedback-log.md) | Every round of feedback, what changed in response, decisions so far, the build lines and the measured table. Start here. |
| [audit-2026-11-11.md](audit-2026-11-11.md) | The 11 November 2026 audit of the built site: 65 findings with evidence (ids such as K-10, T-04). |
| [changes-2026-11.md](changes-2026-11.md) | One row per audit finding fixed: what changed, where, and the commit. |
| [deferred-review-notes.md](deferred-review-notes.md) | The 116 small review notes deferred during the build (D-ids). None is left open: each is fixed or closed with a reason. |
| [compare/](compare/) | Before and after screenshots for the polish pass. The comparison page (`compare/index.html`) is added at the end of the build. |
| [mockups/home-v4.html](mockups/home-v4.html) | Signed-off mockup. The build matches this. |
| [mockups/home-v3.html](mockups/home-v3.html) | Previous mockup, kept for comparison. |
| [mockups/home-v2.html](mockups/home-v2.html) | Earlier mockup, kept for comparison. |
| [mockups/home-v1.html](mockups/home-v1.html) | First mockup, kept for comparison. |
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

They need a local web server (WebGL will not read images from `file://`) and an internet connection (fonts, three.js, YouTube thumbnails and Open Library covers load from their CDNs).

```bash
python3 -m http.server 5181 --directory docs/redesign/mockups
```

Then open http://localhost:5181/home-v4.html. The row of buttons at the top (replay loader, next painting, jump to the blocks, wall blur on or off) is review tooling, not part of the design.

## Notes

- `mockups/assets/` holds smaller copies of the paintings (1600 px) plus the two portraits, so the mockups run on their own. The site itself uses the full-size paintings in `public/paintings/`.
- YouTube thumbnails are never stored in this repo. The mockups load them from `i.ytimg.com`, and the screenshots here leave the video wall out for the same reason.
