# Home page redesign

Working folder for the home page redesign: the running log of feedback and decisions, every mockup, and screenshots.

| File | What it is |
| --- | --- |
| [feedback-log.md](feedback-log.md) | Every round of feedback, what changed in response, decisions so far, and open questions. Start here. |
| [mockups/home-v3.html](mockups/home-v3.html) | Current mockup. |
| [mockups/home-v2.html](mockups/home-v2.html) | Previous mockup, kept for comparison. |
| [mockups/home-v1.html](mockups/home-v1.html) | First mockup, kept for comparison. |
| [screenshots/](screenshots/) | v3 screenshots, desktop and phone. |

The design doc and the build plan will live in `docs/superpowers/specs/` and `docs/superpowers/plans/` once the mockup is signed off.

## Viewing the mockups

They need a local web server (WebGL will not read images from `file://`) and an internet connection (fonts, three.js, YouTube thumbnails and Open Library covers load from their CDNs).

```bash
python3 -m http.server 5181 --directory docs/redesign/mockups
```

Then open http://localhost:5181/home-v3.html. The row of buttons at the top (replay loader, next painting, jump to the blocks, wall blur on or off) is review tooling, not part of the design.

## Notes

- `mockups/assets/` holds smaller copies of the paintings (1600 px) plus the two portraits, so the mockups run on their own. The site itself uses the full-size paintings in `public/paintings/`.
- YouTube thumbnails are never stored in this repo. The mockups load them from `i.ytimg.com`, and the screenshots here leave the video wall out for the same reason.
