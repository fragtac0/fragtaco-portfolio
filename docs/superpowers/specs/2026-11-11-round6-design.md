# Round 6 design: work page, experience map, wall, shelf and page changes

Written 2026-11-11 from Aditya's feedback on the built preview. What he asked for, word for word in substance, and his answers to the questions are in `docs/redesign/feedback-log.md` under "Round 6". This document says what gets built. The plan that builds it is `docs/superpowers/plans/2026-11-11-round6.md`.

## 1. Intent

The site shows a video editor with a lot of interests: a jack of all trades. Round 5 built the pieces; round 6 makes them feel generous and alive without feeling heavy.

- The work page should feel like a lot of work: more videos, wider than the screen.
- The experience page should be a place, not a chart: his career as a climb up the tallest mountain in the solar system, still under way.
- The YouTube wall and the book shelf keep what works and lose what distracts (glow, lift, dark lighting).
- One kind of page change everywhere: the liquid glass the paintings already use.
- Dark with orange stays. Sad, muddy and over-saturated goes.

## 2. Goals, non-goals, anti-goals

Goals
- Every item in the round 6 list is built or has a stated reason.
- No two ring items ever overlap, at any screen size, at any moment.
- Page changes are quick and never drop frames visibly.
- Nothing new is slower to appear than what it replaces.

Non-goals
- Real videos, real clients and real spine photos. Placeholders and designed spines now; each is one content file or one folder away from real.
- The contact page.
- Safari and Firefox testing on real devices (still Aditya's check).

Anti-goals
- A site that feels like a tech demo: effects that draw attention to themselves over the work.
- A brown, muddy Mars. A sad dark site. Orange haze everywhere.
- Thumbnails rotated on their side, or squeezed so small they stop reading as videos.

## 3. Order of work

1. Assets and installs (the `shaders` package, the gallery component's source, the app icons, the Mars tiles, more placeholders).
2. Bugs (page-change lag, the switcher row's odd arrival).
3. Features (site mood and glass page change, work page, home wall and shelf, experience map).

The ring overlap on phones and tablets is not patched in the old layout; the ring rebuild (first work-page feature) removes it at the root. Said openly in the feedback log.

## 4. Site mood: warmer, cleaner darks

The darks are brown-black today (`#050403`, `#130f0d`, `#191411`) with orange glows up to 80 px wide. That is what reads as muddy and sad.

New tokens in `app/styles/tokens.css`, used everywhere a dark ground, panel or line is drawn:

| Token | Value | Use |
| --- | --- | --- |
| `--ground` | `#0e0e0d` | page grounds (work, experience, layers, hero fallback) |
| `--surface-1` | `#171716` | panels, placeholders, tiles before their picture loads |
| `--surface-2` | `#21201f` | raised panels, chips |
| `--line` | `rgba(253, 252, 230, 0.10)` | hairlines and borders |
| `--accent` | `#fc4c00` | unchanged |
| `--accent-soft` | `rgba(252, 76, 0, 0.14)` | active pill fill |
| `--glow` | `0 0 28px -10px rgba(252, 76, 0, 0.18)` | the only orange glow allowed |

Rules
- Text contrast does not drop: cream on the new grounds is still above 12:1.
- Orange appears as: the active dock pill, small marks (dots, the radar ping, the route), focus accents. Not as haze, tinted shadows or large glows.
- Shadows are neutral black, never brown or orange.
- The paintings are art and are not regraded. The dot screen and grain stay.
- The dock glass moves from `rgba(17, 12, 8, …)` to the same alpha on `rgb(16, 16, 15)`.

## 5. Page changes: liquid glass

### 5.1 What it looks like

The painting change in the hero is the reference (`app/components/home/hero/paint-shaders.ts`): a front crosses the picture, soft and slightly irregular; just at the front the picture bends as if seen through thick glass, with a thin bright line and a faint colour fringe. Both a radial and a linear front exist there.

- **Radial reveal**, growing from the centre of the control that was clicked, for moves between sections: home, work, a video wall, experience. 560 ms.
- **Linear sweep** for the move between the two video walls, in the direction of the tab that was picked (right when going from long form to short form, left the other way). 480 ms.
- Easing `cubic-bezier(0.3, 0.7, 0.2, 1)`. The band is about 7% of the travel, the bend peaks near 22 px, as in the painting shader.
- Browser Back and Forward use the radial reveal from the centre of the screen.
- Reduced motion: the plain 120 ms fade that exists today.
- No View Transitions support: the page changes at once, as today.

### 5.2 How it is built

The pages are DOM, so a WebGL shader cannot bend them. The View Transitions API gives the browser's own pictures of the old and new page; those can be masked and filtered.

- `app/lib/page-change.ts` owns every page change: it calls `document.startViewTransition` itself (not the `viewTransition` link prop), so it has the transition's `ready` and `finished` promises, knows the origin point and the kind (radial or linear), and can tell the rest of the app when the change is over.
- The new page's picture is revealed with an animated mask (`@property` radius or position).
- The bend at the front is an SVG displacement filter on the transition's picture pair, strongest in a band at the front.
- **Gate.** Measured in headless Chrome at 1440 by 900, device pixel ratio 2, CPU slowed 4 times: if any frame during the change takes more than 34 ms with the banded bend, fall back to (b) the same bend applied evenly at low strength, rising and falling over the change, then (c) mask and bright line only. Record which one shipped. The bend is switched on only in Chromium browsers; others get (c).
- **Lag fix.** Heavy work on the arriving page (starting WebGL, decoding ring pictures, starting ring motion) waits for `finished`. `usePageSettled()` exposes that. The old 160 and 220 ms full-screen blur keyframes go: blurring two full-screen pictures is the most likely cause of the lag.
- The dock keeps its own transition name, so it stays still. Its second row is not in either picture: it opens 140 ms after the change is over, by height and opacity over 260 ms. That fixes the odd arrival.

## 6. Work

### 6.1 Addresses and the dock row

| Address | Shows |
| --- | --- |
| `/work` | the rings |
| `/work/long-form` | the long form wall |
| `/work/short-form` | the short form wall |
| `/experience` | the Mars map (`/timeline` redirects here) |

- On all four the dock has a second row with three tabs: **Long form**, **Short form**, **My experience**. No All tab, no Clients tab. The tab of the current address is active; on `/work` none is.
- Back to the rings: the dock's work tab, the return mark, Esc on a wall, or clicking the active tab again.
- Clients are hidden on the whole site. `clients` stays in `content/site/work.json` and its schema so it can come back; no component reads it. The client components and tests are deleted.
- `?view=` links from round 5 redirect to the new addresses.

### 6.2 The rings

One stack ring and video rings round a short intro, turning slowly, alternate rings in opposite directions, items always upright. Bigger than the screen by design: the outer rings pass through the corners and run off the edges.

Geometry (all in CSS pixels; `ringPlan(vw, vh, counts)` in `ring-math.ts` returns it)

- `halfDiag = sqrt(vw² + vh²) / 2`. The outermost ring's radius is `0.92 × halfDiag`, so its items are only seen passing through the corners.
- The stack ring's radius is `min(max(190, 0.24 × vh), 0.42 × vw)` (it was `0.21 × min(vw, vh)`); icons are 60 px (52 px under 700 px wide).
- Every video tile has the same long side `L`: long form is `L` by `0.5625 L`, short form is `0.5625 L` by `L`.
- **Clearance rule.** Upright rectangles on turning rings can meet at any angle, so two items never overlap only if their centres stay at least `clear(a, b) = sqrt(((aw + bw)/2 + g)² + ((ah + bh)/2 + g)²)` apart, with `g = 12`. Neighbours on one ring: the chord between them is at least `clear`. Neighbouring rings: their radii differ by at least `clear`.
- The video rings are evenly spaced between the stack ring and the outermost ring. `L` is the largest value from 96 to 220 px for which the clearance rule holds. If 4 video rings cannot fit with `L ≥ 96`, use 3, then 2.
- A ring's capacity is the largest count whose chord meets the clearance rule. Items beyond the total capacity are not in the rings (they are all on the walls). Which ones are left out is stable (the last ones in the content order).
- Order of the video rings from the inside: long, short, long, short (`RING_ORDER_MODE = "alternating"`). `"paired"` (long, long, short, short) is the other value. Both are photographed for Aditya; alternating ships.
- With 2 video rings: long inside, short outside.

What this gives (worked numbers to test against): at 1440 by 900, 4 video rings 141 px apart with `L` near 110 and room for all 70 videos; at 1920 by 1080, `L` near 155; at 390 by 844, 2 video rings with `L` near 104 showing about 32 videos.

Motion and behaviour
- Periods 90 s (stack), then 150, 190, 230, 270 s outward. Hover or focus pauses that ring only, as today.
- A video opens its public link in a new tab. A stack icon does nothing and is not a tab stop.
- Arrival: after the page change is over, rings fade and settle from 96% scale over 500 ms, inside first, 60 ms apart.
- Reduced motion: rings do not turn.

### 6.3 Stack icons

The real product icons of Premiere Pro, After Effects, Final Cut Pro, Blender, Photoshop, Illustrator, Figma and Lightroom, as SVG (or PNG at 240 px where no vector exists) in `public/stack/`. Source for each is the vendor's own press or brand page, or Wikimedia Commons; the source address and its terms go in `docs/redesign/credits.md`. An icon that cannot be sourced that way keeps its two-letter mark and is listed in the handback. Each has the app's name as its accessible name.

### 6.4 Background

The `shaders` package (MIT, WebGPU) draws the ground of the four work addresses, client only, loaded after the page change is over.

Brief for the composition
- Deep and layered: a near-black ground (`--ground`), one large soft pool of cool cream-grey light off centre, one low ember of orange near a lower corner, slow drift (a full cycle no shorter than 40 s), fine grain. The site's dot screen and grain stay on top in CSS.
- At least 85% of the screen stays darker than `#2a2826`. Orange covers no more than about 8% of the screen and never reaches full strength.
- It must not compete with thumbnails: no hard shapes, no visible banding, no movement the eye follows.
- The canvas renders at a device pixel ratio capped at 1.25 and stops when the tab is hidden.
- No WebGPU, reduced motion, or the package fails to start: a still CSS gradient that matches the first frame.
- The experience page does not use it (the map is its ground).

### 6.5 The video walls

Each wall is the ObsidianUI Art Gallery component (MIT), ported to TypeScript in `app/components/work/gallery/` with its notice kept: one full-screen shader that draws a grid of pictures from an atlas with a slight barrel warp. Changes from the original:

- **Finite.** Exactly the videos of that kind, once each. No repeat.
- **Everything on screen.** The grid is fitted: `fitGrid(count, vw, vh, tileAspect)` picks the columns and rows that give the largest tile with every tile inside a safe area (the screen less a 4% margin, less the dock's band below and the heading's band above). The last row is centred if it is short.
- **Small gaps.** 10 px between tiles (the original leaves wide gutters), corner radius 8 px.
- **Very slow movement.** The whole grid drifts on a slow path a few pixels wide (one loop about 50 s). A drag moves it a little and it settles back; it does not scroll.
- **Barrel warp** kept but lighter than the original (0.05, original 0.08).
- **Hover.** The tile under the pointer grows 4%; its title and year show in a caption at the lower left, like the painting caption.
- **Click or Enter** opens the public link in a new tab.
- **Keyboard and screen readers.** A visually hidden list of links mirrors the grid; arrow keys move a visible ring between tiles.
- **Phones.** Same fitting; tiles get small but stay on screen. Tap opens.
- Long form tiles are 16:9, short form 9:16.
- Heading at the top left: the kind and the count. At the top right, the **return mark**: three small turning arcs with the label "rings", which goes back to `/work`.
- Pictures that fail to load show `--surface-1`.
- No WebGL: a plain CSS grid of the same links.

### 6.6 Content

`content/site/work.json`: 35 long form and 35 short form placeholder entries (pictures still come from picsum at run time and are never stored). The intro line stays.

## 7. The YouTube wall

- **One flat plane.** The near and far planes, the pointer lean, the arrival ripple's plane bias and their code go. Columns drift as they did before R36.
- **Fish-eye at the borders.** The wall is drawn to a texture and shown through a barrel warp that starts at 55% of the half-diagonal and reaches about 2.2% displacement at the corners. Pointer positions are un-warped before hit testing.
- **Glow.** The glow under a focused tile drops from 50% strength and 70 px to 16% and 28 px; the detail's CSS glow uses `--glow`.
- **Hover.** No lift and no dimming of the others. Tiles within 220 px of the pointer grow by up to 4% and ease away from it by up to 4 px.
- **Click.** The chosen video moves to the centre, a little above the middle, at about twice its size (no wider than 52% of the screen, 86% on phones). The drift stops. The other tiles move away from the centre (up to 140 px for the nearest, none beyond 60% of the half-diagonal), shrink to 92% and dim to 55%. Its title, channel, subscribers, date and the "Watch on YouTube" link appear under it. Other videos from the same channel stay bright and the chip still counts them. Open 420 ms, close 320 ms.
- Esc, the close button or a click outside closes. Arrow keys move the choice.
- Reduced motion: the chosen video and its text fade in; nothing travels.

## 8. The book shelf

- **Flat, face on, large.** The books are still 3D objects, but the camera looks straight at the spines with no perspective lean, in one row on a line. The row is as large as fits: the tallest spine at most 78% of the layer's height, the row at most 88% of its width. On narrow screens the height rule wins and the row pans sideways as it does now.
- **Even, bright light.** Spines in the row are drawn with their true colours (no shading falloff, no heavy vignette). The ground is `--ground`. A lifted book is lit softly from the upper left and has a soft neutral shadow.
- **Designed spines.** Each spine is drawn from the book's real cover colours, with the real title and author set in type along the spine, reading top to bottom. Five spine styles, chosen from the book's id so a book always looks the same: heavy condensed capitals; classic serif capitals between rules; italic serif title; typewriter; light wide-spaced capitals. System fonts only, no new font files. Serif is allowed here: it is book art, not interface.
- **Real spine photos later.** A book with `spine` set in `content/site/books.json` (a path under `public/`) uses that picture instead.
- **Open.** The book rises straight up by about 38% of its height, then turns to show its cover, and stays above the row; the row dims to 70%. Its note shows beside it as today. 620 ms. Close is the reverse.
- The drop-in, the placeholder, panning, the marker and the keys stay.

## 9. My experience: the Mars map

### 9.1 The picture

Olympus Mons from straight above, the summit crater in the centre of the frame.

- Source: the USGS Astrogeology map service (`planetarymaps.usgs.gov`, layer `THEMIS` for detail and `MDIM21_color` for colour), public domain, credited "NASA / JPL-Caltech / USGS / Arizona State University".
- Frame: 14 degrees of latitude and longitude centred on the summit crater (about 18.35 N, 226.8 E; the script takes the exact centre from the picture). Width is scaled by the cosine of the latitude so the mountain is round.
- **Orange, not brown.** The detail picture is graded with a colour ramp: deep shadow `#1a0a04`, mid `#c2410c`, light `#ff8a3d`, highlight `#ffd9b0`. It should look lit and warm, and sit next to `--accent` as the same family. The first test of the grade is a side-by-side with the dock's orange pill.
- **Elliptical blur at the edges.** Outside an ellipse round the mountain the picture blurs and darkens gradually toward the screen edges (blur to about 14 px, darkening to 55%), so the eye stays on the mountain and the heading and caption sit on calm ground. Screen-fixed: it does not move with the map.
- Stored as a tile pyramid in `public/mars/` (512 px WebP tiles, levels 0 to 4, 8192 px across at the top level, the detail picture's native 100 m per pixel), made by `scripts/make-mars.mjs` (`yarn mars`). Target total under 16 MB.

### 9.2 Two states

- **Overview** (how it opens): the whole mountain, its cliff ring about 78% of the smaller screen side. Small markers with years. The heading block, the caption and the controls are visible.
- **Explore**: closer, moving around like a map. Drag pans, wheel or pinch zooms from 2 times to the picture's native size, arrow keys pan, `+` and `-` zoom, `0` or Esc goes back to the overview, `[` and `]` fly to the previous and next moment. Markers become cards with the date, a title and one line.
- Getting from one to the other: click a marker (flies to it), the `+` button, a wheel or pinch in, a double click. Back: the fit button, `0`, Esc, or zooming out past 2 times. The move is 700 ms.
- The heading block and the caption fade out in explore so the map is clear.

### 9.3 The route

- A line that follows the terrain: it starts on the plain outside the cliff, crosses the cliff (Olympus Rupes), and climbs the flank bending round real features (the two named craters, lava channels), toward the summit. **It stops well short of the summit**: the last point is about 60% of the way from the cliff to the crater rim.
- Drawn as a smooth curve through hand-placed points (longitude and latitude in the content file), cream, 2 px, with the travelled part solid. It draws itself from the start over 1.6 s when the page opens.
- Moments sit on the line. Their spacing follows time from February 2021 to today; 2017 to 2021 is the short approach across the plain.
- **Now** is the end of the line: an orange dot with a ring that expands and fades every 2.4 s (a radar ping). Reduced motion: a still ring.

### 9.4 Words

Heading block (top left, overview)

> **My experience**
> I trained as an engineer in Mumbai, took a part-time editing job in 2021 and never went back. Five years at Bharat in Germany took me from cutting shorts to running content and producing. Since December 2025 I edit full time as a freelancer. Still climbing.

Moments

| Date | Title | Line |
| --- | --- | --- |
| 2017 | ~~IIT~~ Engineering at VESIT, Mumbai | Plan A did not happen. Plan B was four years of engineering. |
| Feb 2021 | First editing job | Part-time short form editor at Bharat in Germany, while finishing the degree. |
| Jun 2021 | Graduated, went full time | The degree was done. Editing became the job. |
| Jan 2022 | Social media manager | From cutting the videos to running the channels they went out on. |
| Sep 2022 | Started making my own | YouTube videos and Reels, from the idea to the upload. |
| Jan 2023 | Head of Content and Producer | Responsible for what got made and how. |
| Jun 2024 | Interview at the German Embassy | Interviewed the embassy's spokesperson, at the embassy. |
| Dec 2025 | Went freelance | Left Bharat in Germany to edit full time for myself. |
| Now | Freelance creative editor | Still climbing. |

"IIT" in the first title is shown struck through. No em dashes or en dashes anywhere.

Caption (lower left, overview, in the painting caption's style)

> **Olympus Mons, Mars**
> The tallest mountain known in the solar system. (Height and width as NASA gives them, with the source recorded.)
> Image: NASA / JPL-Caltech / USGS / Arizona State University

### 9.5 Places

A switch at the top right, **Journey / Places**. Places hides the route and moments and shows named features inside the frame: the summit craters, Pangboche crater, Karzok crater, Olympus Rupes, the aureole to the north-west (Lycus Sulci) and any others the gazetteer lists inside the frame, to a limit of 8. Each has its name and one factual line. Names, positions and facts come from the USGS Gazetteer of Planetary Nomenclature and NASA pages, with the source address kept in the content file. Nothing is written from memory.

### 9.6 Build shape

- `content/site/experience.json`: frame, moments (date, title, line, strike), route points, places, facts with sources. Checked by a zod schema.
- Pure, tested modules: projection (longitude and latitude to picture pixels and back), the curve through the route points and positions along it by date, the view (fit, clamp, zoom about a point, fly), tile selection for a view.
- The map draws tiles on one 2D canvas; markers, cards, the route (SVG) and the ping are DOM on top, placed by the same view, so they are focusable.
- The day grid, its engine, its content file and its tests are deleted.
- No canvas support or reduced data: the level 2 picture as one image with the markers in a list.

## 10. Approaches considered

**Page change.** (a) Our own WebGL transition between pictures of the pages: not possible, the browser gives no picture of the DOM to WebGL. (b) Rasterise the DOM to a canvas with a library: slow and inexact. (c) View Transitions with masks and an SVG bend: uses the browser's own pictures, cheap, degrades cleanly. **Chosen: (c)**, with the measured gate in 5.2.

**Rings and overlap.** (a) Keep the round 5 rings and nudge sizes per breakpoint: the overlap comes back at the next size. (b) Tiles turned along the ring, packed like bricks: densest, but thumbnails on their side. (c) Upright tiles with a clearance rule, rings larger than the screen: sparse at laptop sizes, never overlaps, overflows as asked. **Chosen: (c).** Its cost is stated: thumbnails at 1440 by 900 are only a little larger than before.

**Video walls.** (a) Keep the round 5 DOM grids with FLIP travel from the rings. (b) Reuse the YouTube wall engine. (c) Port the ObsidianUI gallery as asked and make it finite and fitted. **Chosen: (c)**; it is what was asked for, and making the walls their own addresses lets the round 5 travel code be deleted.

**Mars picture.** (a) Colour photo mosaic as it comes: brown. (b) Elevation colours: reads as a chart. (c) High-detail grey picture graded through an orange ramp: sharp, on palette. **Chosen: (c)**, after Aditya asked for orange, not brown.

**Map engine.** (a) A map library (Leaflet, MapLibre): a dependency for one page and its own look. (b) One big image with CSS transforms: blurry or heavy at depth. (c) Own tile canvas reusing the timeline's view math. **Chosen: (c).**

## 11. Left to the builder

- The exact `shaders` components and their values, within the brief in 6.4.
- The exact route points and marker label sides, within 9.3, judged on the real picture.
- The spine style details within 8.
- File splits, as long as no file passes about 350 lines.
- The fallback level of the glass bend, by the gate in 5.2.

## 12. For Aditya to confirm or supply later

- "Bharat in Germany" as the company name, and the wording of every moment.
- Real videos (links), real spine photos, real clients when they return.
- Any app icon that could not be sourced.
- The ring order (alternating or paired) from the two photographs.
- Real-device checks: Safari, an iPhone, a tablet.
