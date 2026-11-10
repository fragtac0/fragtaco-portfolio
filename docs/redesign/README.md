# Home page redesign

Working folder for the home page redesign: the running log of feedback and decisions, every mockup, and screenshots.

| File | What it is |
| --- | --- |
| [feedback-log.md](feedback-log.md) | Every round of feedback, what changed in response, decisions so far, and open questions. Start here. |
| [audit-2026-11-11.md](audit-2026-11-11.md) | Audit of the built site: what is wrong, with evidence. |
| [deferred-review-notes.md](deferred-review-notes.md) | Small review notes deferred during the build, each to be fixed or closed. |
| [compare/](compare/) | Before and after screenshots for the polish pass. |
| [mockups/home-v4.html](mockups/home-v4.html) | Signed-off mockup. The build matches this. |
| [mockups/home-v3.html](mockups/home-v3.html) | Previous mockup, kept for comparison. |
| [mockups/home-v2.html](mockups/home-v2.html) | Earlier mockup, kept for comparison. |
| [mockups/home-v1.html](mockups/home-v1.html) | First mockup, kept for comparison. |
| [screenshots/](screenshots/) | v3 and v4 screenshots, desktop and phone. |

The design doc is in `docs/superpowers/specs/` and the build plan in `docs/superpowers/plans/`.

## Viewing the mockups

They need a local web server (WebGL will not read images from `file://`) and an internet connection (fonts, three.js, YouTube thumbnails and Open Library covers load from their CDNs).

```bash
python3 -m http.server 5181 --directory docs/redesign/mockups
```

Then open http://localhost:5181/home-v4.html. The row of buttons at the top (replay loader, next painting, jump to the blocks, wall blur on or off) is review tooling, not part of the design.

## Notes

- `mockups/assets/` holds smaller copies of the paintings (1600 px) plus the two portraits, so the mockups run on their own. The site itself uses the full-size paintings in `public/paintings/`.
- YouTube thumbnails are never stored in this repo. The mockups load them from `i.ytimg.com`, and the screenshots here leave the video wall out for the same reason.
