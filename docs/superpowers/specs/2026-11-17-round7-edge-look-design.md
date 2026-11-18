# Round 7, the edge's look: the hero painting's liquid in the page change (design)

Date: 2026-11-17. Follows `2026-11-16-round7-second-look-design.md`. One task (Task 32), after the whole-branch review (Task 20) and the comparison page (Task 21), with its own review.

## 1. What the owner said

On 17 November, looking at the joined build:

> "Also in the page transitions, the effect of chromatic abberation is missing. We had decieded on the same effect which is going on the hero paintings so that's something that I would like there without hurting performance."

And of the build on port 5180, where the bend and its colour split were running:

> "even on 5180 it just looks like a weird ripple"

He had asked for the fringe twice before (16 November: "bring back the slight chromatic aberration in the page animations"; "it should be proper with chromatic aberration and 2.25 secs").

## 2. What was wrong

The page change's bend is a radial lens: every pixel near the front is pushed along the line from the middle of the screen, by a bell-shaped profile. It travels outward with the front as one ring, which reads as a ripple. Its colour split (red 1.29, blue 0.71 of the push) only shows where the ring crosses a hard edge.

The hero painting's change (`app/components/home/hero/paint-shaders.ts`) is a different thing: the push is the gradient of a smooth noise, so it has no single direction; it is strongest at the front and trails off in a wake behind it; and red and blue are pushed 1.4 times and 1/1.4 times as far as green. It reads as liquid glass with a colour fringe, not as a ring.

## 3. Approaches

Shown to him as a standalone preview (`docs/redesign/round7-preview-11/`, the site's own front, path and numbers on three stand-in pages) with a strength slider:

| Look | What it is | Trade-off |
|---|---|---|
| A, as built | The radial lens | The ripple he rejected |
| B, hero liquid | The hero's noise push and colour split, at the edge and in a wake behind it, on both pages | The closest to the paintings; the arriving page wobbles in the wake until the front has passed |
| C, liquid with a calm arrival | B on the page being left; half the push and no wake on the arriving page | Calmer arrival, less like the paintings; needs a second set of map tiles |
| D, colour fringe only | No bending; red and blue part at the edge | The lightest (two pushes a picture instead of three), the least like the paintings |

**He picked B, at "Stronger, about 150%"** (structured questions, 17 November).

## 4. The design

Everything about the change stays as it is (2.25 s, the front's path, the soft edge and its wander, the glow, the shade, the arrival rules, the guard, the warm-up, reduced motion, the plain reveal in browsers that are not Chromium) except the bend:

1. **The push is the hero's noise, not a radial lens.** At a point `(u, v)` (farthest-corner distances from the middle of the screen) the push's direction and size are the gradient of the hero shader's `fbm` at `q = (u, v) * 2.9`, with the same step `e = 0.02`, divided by 1.55 and clamped to length 1 (measured in the spike: the gradient's length over a screen has a maximum of 1.54, a median of 0.45).
2. **Its strength follows the front as the hero's does.** At `x` half-bands from the front: `s(x) = band(x) + 0.6 * wake(x)`, with `band(x) = 1 - |2 * newShare(x) - 1|` and `wake(x) = smoothstep(-3.7, 0, x) * newShare(x)`. Its maximum is 1.3.
3. **Strength 150%.** The peak push is 8.55% of the viewport's height, capped at 96 CSS px (today 5.7% and 64 px). A point's push is `gradient * s(x) * peak * bendAt(p)`.
4. **Both pages are pushed alike**, the page being left by `+push` and the arriving page by `-push`, both at the full share. This replaces the second look's spec 4, where the arriving page had half the push: that rule was written for the lens, which slid the whole arriving page inward and back.
5. **The colour split is the hero's**: red 1.4, green 1, blue 1/1.4 of the push.
6. **The filters keep their structure** (one map picture, a vignette, three pushes per picture), so the cost per frame does not change. The vignette is made for the larger push, so the picture is never cut off along the screen's edge.
7. **No jump when the map's tile changes.** The noise is fixed on the screen while a tile is scaled onto the front, so the bend's tiles use the whole ladder (4% steps, not every other tile), and the early tiles are spaced closely enough that no step shows on playback.

## 5. What must hold

- The cost limits of the page change as they stand: compositor busy time within 450 ms (renderer) and 300 ms (viz) in the glass cost gate, no frame over 34 ms in the page change, hook and phone gates. The spike measured the same cost for A, B and B at 150% (236 to 258 ms and 165 to 185 ms).
- The arrival rules: the arriving page is finished before the reveal; nothing appears, grows or sharpens after the change ends. The push is nil from eased progress 0.93 on, as today.
- No strip of the page behind along the screen's edge at any moment, at 1440 by 900, 390 by 844 and 320 by 568.
- The guard and the tab's rule about the bend are unchanged.

## 6. Not in this task

The hero's glint of light on the liquid and its warm tint (the page change has its own glow and shade, which he did not ask to change); looks C and D; any change to the front's path or length.

## 7. For the owner's list

The look on his 120 Hz display, on real thumbnails and at the strength he chose; whether the arriving page's wobble in the wake is what he wants (C is the fallback: one rule to change).
