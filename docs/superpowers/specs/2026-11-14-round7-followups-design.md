# Round 7 follow-ups: design outline

Date: 2026-11-14. Adds to `2026-11-13-round7-design.md`; where the two differ, this one wins.
Source: Aditya's feedback during the build (see `docs/redesign/feedback-log.md`, "Feedback during the round 7 build") and his choices on the tenth preview, `docs/redesign/round7-preview-10/`.

## 1. Intent

Three things he saw in the running build were not good enough:

1. Opening the shelf or the wall from the home page shows one picture that then fades into another. It has to be one continuous move.
2. The page change looks unlike the preview he approved: a thin ring, almost a perfect circle, with hardly any bend. He wants it at 2.5 s, with a wider, refracted edge.
3. The portfolio page feels empty: the thumbnails are too small.

He also asked for the warp to be removed from the walls. That is already done in task 10 (R51.2); the build he looked at was older. No new work.

## 2. Goals, non-goals, anti-goals

- Goals: nothing is ever swapped or cross-faded between the click on a home box and the open page; the page change reads as the tenth preview does with "Wider" and "Stronger" chosen; the portfolio page is visibly fuller at every screen size.
- Non-goals: no change to what the open shelf and the open wall look like or do (tasks 11 to 15 own that); no change to the walls on `/work/long-form` and `/work/short-form`.
- Anti-goals: a second picture standing in for the scene (a poster, a screenshot, a blurred copy); a home page that scrolls badly because two scenes are live on it; a page change that eats clicks for longer than it looks busy.

## 3. His choices (tenth preview)

| Question | His answer |
|---|---|
| What the home box shows | The whole open page, small |
| Length of opening and closing | 1.0 s |
| Page-change edge | Wider + Stronger, at 2.5 s |
| Browser he checks in | A Chromium browser |

My call, not his: the home page behind an opening box sinks back and dims (the preview's default; he saw it and did not object).

## 4. The page change (replaces spec 4's numbers; the rulings R58 to R63 stay unless listed)

What is wrong today, measured from `docs/redesign/compare/round7/change-experience-to-home.jpg` and the code: the edge wanders 3% of its radius (the preview: about 17% of the screen's height), the bend is 22 px with no colour split, and the front is drawn as a thin bright line (a core 0.6% of the radius wide at up to 70%).

Target: the tenth preview's shader (`docs/redesign/round7-preview-10/change.js`) with `band = 0.15` and `bend = 1.9`.

- Length: 2.5 s (`GLASS.ms = 2500`). The ease stays (in and out, cubic).
- No dead time: the front's outer soft edge leaves the origin at the first frame, and the screen is clear at `UNCOVERED_AT` (R62 stays at 0.95). No hidden lead-in before anything shows.
- Soft edge: half-width 15% of the travel (`GLASS.band = 0.15`, was 0.07).
- Wander: the edge leaves a circle by up to 12% of its radius (`WARP = 0.12`, was 0.03), in five or six slow lobes round the full front, and the shape changes while it travels (the picture turns by about 25 degrees over the change, or two noise tables cross over), so it never reads as one stamp growing.
- Bend: across the whole band, strongest at the front. Along the radius, the old page is pushed outward and the new page inward. Peak push 5.7% of the viewport's height (51 px at 900 px), capped at 64 px. Profile over `x`, the distance from the front in half-bands: `exp(-1.6 x^2) * 0.03 + x * exp(-0.9 x^2) * 0.022`, times 1.9, in viewport heights.
- Colour split: red is pushed 1.29 times as far as green and blue 0.71 times, so the rim of the glass shows a fringe.
- Glint: the thin line goes. In its place a soft cream glow at the front, `exp(-30 x^2)` at 16%, and a fainter one at the outer rim, `exp(-14 (x - 0.9)^2)` at 5%. Inside the band the pages are 10% darker than outside it.
- Browsers without the bend (Safari, Firefox) get the soft edge, the wander and the glow.
- The 34 ms frame gate (R33) holds. If the three-colour bend cannot meet it, the builder drops to two passes or a smaller map and records what it cost in look.
- Everything keyed to the change's length follows it: the hero-return film (`make-hero-return.mjs`), the glass audits, the rings-in-reveal gate, the wall's arrival after the reveal (R75).

Check by eye: one sheet with the build and the tenth preview side by side at 20, 35, 50, 65 and 80% of the time. The two columns must read as the same effect.

## 5. The portfolio page

- On a 1440 by 900 screen the long form thumbnails go from 108 by 60 px to about 190 by 107 px, the short form ones from 60 by 108 to about 104 by 185, the icon tiles from 59 to about 76 px. Other sizes scale the same way; phones grow by at least 1.3 times.
- Measured target: at 1440 by 900, thumbnails cover between 30% and 40% of the screen, averaged over one turn of the rings (today about 15%).
- The rings are solved again for the new sizes: no two tiles closer than today's clearance at every audit size, nothing within 40 px of the title block, nothing under the dock's tabs. Fewer tiles on screen at once is fine; the rings turn.

## 6. The home boxes (replaces task 4's poster, rulings R55 and R56 stay)

### 6.1 The box is the scene

- For a visitor whose browser can draw the scene, the box on the home page holds the scene's own canvas, drawn live, as soon as the scene is ready. Until then the box shows its dark ground; the canvas fades in over 300 ms. The flat mini previews stay only as the picture for visitors without WebGL or after a failed scene.
- What it shows: the open page exactly as it would be at the current window size, scaled down evenly until it covers the box, centred. The shelf shows its whole row on the ledge with the dot field; the wall shows the same part of the wall the open page would show, with its edge treatment. The open page's own heading and Close button are not in the box.
- In the box the wall drifts slowly; the shelf is still. Neither answers the pointer: the whole block is one button, as now.
- Cost limits: a scene in a box draws only while its box is on screen and the tab is visible; the wall at most 30 times a second, the shelf only when something changed. Scrolling the home page past both boxes stays inside the 34 ms frame gate.

### 6.2 Opening

- One move of 1.0 s on the site's ease (in and out). The frame grows in a straight line from the box's place to the whole window; its corners go from the box's radius to square.
- The scene is the same canvas throughout, or a canvas whose first frame is pixel-identical to the box's last frame. Its picture stays glued to the frame: the scale is `max(frameWidth / windowWidth, frameHeight / windowHeight)`, centred. Nothing fades over the scene.
- The home page behind scales to 0.95 and dims to 45% over the same move.
- The open page's heading, Close button and other chrome fade in over the last 28% of the move.
- The scene starts answering the pointer when the move ends. The wall's pan eases from where the drift left it; no jump.
- A click before the scene is ready: the box shows a pressed state and waits up to 400 ms, then opens to the plain grid (R56's fallback) with the same frame move.

### 6.3 Closing and the rest

- Closing (Close, Esc, Back) is the same move backwards; the chrome fades out over its first 28%; focus returns to the block's button.
- Close during an opening, or a click during a closing, turns the move round from where it is.
- A deep link or a hard load that starts open shows the open page at once, with no move.
- Reduced motion: no growing frame; the open page appears with a 200 ms fade and leaves the same way.
- A lost WebGL context in a box puts the flat mini preview back in that box.
- Removed: the poster (`layer-poster.ts`), the copy of the block, the clip-path grow.

Check: in a 60 fps film of opening and closing at 1440 by 900 and 390 by 844, the frame before the click and the frame after it differ in under 1% of the box's pixels, the scene's canvas is the only thing drawn in the frame until the chrome starts, and no frame shows the box empty.

## 7. Order

After task 19 and before the whole-branch review: part R54 (the page change, the portfolio page), then part R55 (the home boxes, which need the finished shelf and wall of tasks 11 to 15).

## 8. Left to the builder

- How the canvas gets from the box to the full window (one canvas moved between parents, or a full-window canvas drawing into a growing rectangle) as long as 6.2's first-frame rule holds.
- How the wander changes shape during the change (4).
- The exact ring counts and radii (5).

## 9. For Aditya to check on the preview deployment

- The page change beside the tenth preview: is it the same effect now.
- The portfolio page's fullness on his own screen.
- Opening and closing both boxes on his laptop and his phone, and how the home page scrolls with the two live boxes.
