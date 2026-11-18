# Round 7: design outline

Date: 2026-11-13. Owner: Aditya (FragTaco). Written by Fable 5.2 after nine preview rounds. Feedback, answers and each preview's notes: `docs/redesign/feedback-log.md`, "Round 7". Built on top of round 6 (`r6/r45-experience`, PRs #17 to #22) and the preview branch `r7/r47-prep`.

## 1. Intent

Round 6 built the right pages with the wrong feel. Aditya's verdict on the build: page changes too fast and out of step with the painting, grounds that look bad, a map that is ugly and wordy, spines that look drawn, walls that glitch on arrival, and a dozen small faults on the home page. Round 7 fixes the faults, replaces the grounds, rebuilds the experience map to the look agreed in the previews, and gives the shelves spines and a setting that belong to the same world.

The previews are the visual source of truth. Nothing in them ships as code: they are single-file sketches with no tests, no server rendering and no fallbacks. The build ports their behaviour and numbers into the app's typed, tested modules.

| Agreed in | What | Where to look |
|---|---|---|
| Preview 9 | The experience map: both states, trail, milestones, cards, chart layer, words | `docs/redesign/round7-preview-9/` (`map.js`, `extra.css`, and `../round7-preview-4/preview.css`) |
| Preview 7 | The Eclipse ground with "Barely" grain; the dot field behind the books; the single row on the rock ledge; the fourteen spines | `docs/redesign/round7-preview-7/` (`grounds.js`, `shelf.js`) |
| Preview 2 | The page change: 3.5 s, radial from the centre | `docs/redesign/round7-preview-2/change.js` (shape only; the site keeps its View Transition) |

## 2. Goals, non-goals, anti-goals

Goals
- Every page change is the same slow reveal, in step with the painting.
- Each page has a ground that is alive but quiet.
- The experience page reads as a finished map with two clear states.
- The shelves look like real books in a real place.
- The faults Aditya listed are gone.

Non-goals
- "The mountain" tour (hidden for now; its content stays in the content file, unused).
- Real short form videos (placeholders until links arrive). Real spine photographs.
- Rewording the moments (Aditya revises the words later; all words stay in `content/site/experience.json`).
- Rewriting git history to remove the old preview address.

Anti-goals (a failure even if it works)
- Any ground, grain or grid that draws the eye before the content does.
- A camera that moves when it does not need to, or starts and stops hard.
- Text that changes inside a visible card, or a card that covers the thing it describes.
- A flash of empty, blank or unstyled content when a page, wall or shelf opens.

## 3. Order of work

Assets and content first, then the bugs, then the look shared by every page, then page by page. Same rule as round 6, asked for again.

## 4. Page change

- One reveal for every change between home, portfolio, long form, short form and experience, in every combination: radial, opening from the centre of the screen, 3500 ms, the painting's ease, the wandering edge and bright line kept from round 6. The linear sweep between the two walls goes; they use the same radial reveal.
- While a change runs the browser shows pictures of the two pages and nothing can be clicked. So a second click, tap or key press during a change finishes it at once (the transition is skipped to its end and the new page is live). This is my call; Aditya was told and did not object.
- Reduced motion keeps round 6's 120 ms fade.
- The black frame on the painting when returning home is a bug of the change (section 6) and must be gone at this length, where it would show for longer.

## 5. Grounds

### 5.1 Eclipse (pages)

A near-black ground, one soft orange light, a dark round shoulder cutting into it, both drifting slowly against each other, a soft noise moving through the light, and a still, coarse grain so faint it is seen only when looked for. Ported from `round7-preview-7/grounds.js`: the shader's shapes, colours and numbers are the specification. Settings: movement 2.2 (the preview's "Slow"), noise 1 ("Subtle"), grain 0.1 ("Barely").

Placements (my call; Aditya chose the family and left the placing):

| Page | Placement |
|---|---|
| Portfolio (`/work`) | 0: light on the right, shoulder from the lower left |
| Long form | 1: the same, mirrored |
| Short form | 3: light from the upper right |
| Home, the section behind the two shelf blocks | 2: light from below, behind a dark disc |

Built as one small WebGL (not WebGPU) component with a still picture as its fallback (no WebGL, reduced motion, or a lost context). It replaces the round 6 `shaders` ground; the `shaders` package is removed. The loop stops when the page is hidden or the ground is off screen. No Eclipse behind the open book shelf or the open YouTube wall.

### 5.2 Dot field (the open book shelf)

Behind the books: very small dots on the plain ground, one every 7 px, 0.8 to 1.7 px across, 2% to 10% cream, with a slow swell passing through (about one pass in half a minute). Barely visible. Still under reduced motion. From `round7-preview-7/shelf.js`.

## 6. Home

Bugs
- Returning home from another page shows a black frame on the painting. Find the cause (the loader or the painting's first frame under the change) and remove it.
- The painting's words appear before the next painting. Order: words fade out, the painting changes, words fade in when the new painting is up.
- Opening or closing either shelf blanks its whole box first. The block's picture must stay until the layer's first real frame is ready, and the same in reverse.
- The dock bounces when Home is clicked and not on Work. No bounce anywhere; the highlight slides between tabs.
- The small book shelf block still shows the old spines. It shows the new ones (section 8.2).

Changes
- About and Credits tabs: an orange gradient (accent to a deeper orange), white text, the glow and a drop shadow back. Their panels come in slower, with an ease in and out (about 700 ms; the builder tunes by eye against the painting).
- The painting's lower edge fades into the next section through a soft gradient instead of ending in a line.
- The line of text at the foot of both open shelves goes.
- The headings on both open shelves get a legible layout and sizes: the title largest, the count small and quiet beside or under it, on a calm strip that keeps both readable over whatever is behind (same order of importance as section 9.6).

## 7. Portfolio and the two walls

Portfolio (`/work`)
- The title reads "My portfolio". The dock tab stays "work".
- The app icons sit in solid glass tiles: opaque, a lit top edge, a soft inner glow and a real shadow. Not see-through.
- Long form is real: the 12 linked videos and every long form video on the two channels (21 in all, section 10). Thumbnails come from YouTube at run time and are never stored. Short form stays on placeholders, drawn locally with no outside image service.
- The rotating rings stay.

Walls (`/work/long-form`, `/work/short-form`)
- Something appears wrongly each time a wall opens. The recordings could not be read, so the cause is not known. My reading: tiles show before their pictures (the placeholder service is unreachable, so they are empty dark boxes), then pop, under a warp that exaggerates it. The rebuild removes all three.
- No warp. Frames as large as the count allows, with a small even gap, so the wall reads as a wall: the grid that gives the largest tile while every video stays on screen.
- Arrival each time the page opens: nothing shows until the first pictures are ready, then the tiles come in from the centre outward (a small scale and fade, the rings of tiles a few tens of milliseconds apart, under a second in all). Aditya's reference grid could not be seen; this is my stand-in and he may send the recording later.
- The "rings" mark goes. A go-back button like the one on the shelves takes its place.
- Clicking the tab that is already open does nothing.
- Kept: the very slow drift, the small hover growth, click opens the video, the link list for keyboards and for no WebGL.

## 8. Shelves

### 8.1 YouTube wall

- 109 videos (sync the playlist again), shuffled once with a fixed seed so the order is the same on every visit.
- Tiles about half today's size. The wall is one finite block, larger than the screen, moved with the mouse as today and stopping softly at its edges. No endless wrap.
- A click moves the camera: the wall slides so the chosen video comes to the middle (the video does not fly there on its own), it grows to about today's tile size, and the others push away without overlapping (ruling R37 stays). Its title, channel and details sit under it.
- Edges: a dark fade on all four sides, and toward the corners a blur, the fish-eye and a slight colour fringe. Enough that the heading and the Esc button read well, not more.
- The Esc button is a small glass pill.

### 8.2 Book shelf

- Spines: the fourteen designs from the preview, drawn as one series: a cloth colour, one foil ink, a small emblem for what the book is about, the title, the author, a shared mark at the foot. They are painted onto the 3D books' spines, so the lift and the turn to the cover stay as built. A book without a design gets the series' plain style from its cover colours. Spine type is book art and may be serif; the faces are loaded before a spine is painted.
- One row, in the order of the list.
- The books stand on a ledge drawn as layers of rock: a bright top line and fainter warm lines under it.
- Behind them: the dot field (5.2). No gradient.

## 9. My experience

Two states, one switch (glass, top right): Overview and My climb.

### 9.1 Overview

- The Viking colour mosaic of Olympus Mons and its surroundings (40 by 26 degrees, summit in the middle), toned: grey first, then one orange laid over it, so it is orange without being loud. Shown at a zoom of 1.1 so it always covers the frame.
- A very soft blur toward the edges and corners, and a soft darkening.
- The trail and the milestones as small shaded beads; the radar at "now".

### 9.2 My climb

- One camera move (3.6 s, one eased number carries everything): the picture tilts with the camera in 3D while it fades into a night map drawn from the heights. The contour lines rise to their height, the low ones first and the summit last. Height is stretched (the summit stands 84 map units tall, about eight times the truth).
- The ground runs on past the frame (heights cover 64 by 41.6 degrees) and fades into the night toward the far edge and the sides, with a depth blur far and near.
- Lines are drawn as vectors at the screen's resolution. Colours: cream low, warming to orange at the top; every fifth line stronger.

### 9.3 Trail and milestones

- The first trail (the points in `experience.json`), each point pushed away from the summit, the last by 40%, so "now" sits lower. Solid behind, dotted ahead to the summit.
- Nine milestones at fixed shares of the trail. Each is a shaded bead on a pin whose foot sits on the trail; each carries an icon, not a number: gear, scissors, graduation cap, megaphone, video camera, clapperboard, microphone, paper plane, hiker (now). The chosen one turns orange. "Now" has the radar.
- Click a milestone, or use the arrow keys; Esc returns to the overview.

### 9.4 Camera

- It stays where it is while the chosen milestone is inside the middle of the view (25% to 75% across, 40% to 80% down). Otherwise it moves along the trail to the nearest place from which the milestone is.
- When it moves it follows its goal like a weight on a soft spring (critically damped, no overshoot); a new goal mid-move bends the path without a jolt.

### 9.5 Cards

- Glass, at the smaller size (252 px wide; title 15 px, text 11.5 px).
- A card takes whichever of five places round its milestone covers the fewest other milestones; a milestone it still covers fades back.
- The old card leaves completely before the new words are set, the place chosen and the card shown.

### 9.6 Chart layer and words

- A grid every 2.5 degrees with a small cross every 5, very faint. It is laid over the ground, so it tilts with the picture and in My climb runs up and over the mountain (with a little more ink there, over the dark).
- Overview only, fading with the picture: two dotted rings 150 and 300 km from the summit, a triangle on the summit, north, degree labels, a 200 km scale bar.
- Always: four corner marks, two small edge squares, and a position readout (the summit in the overview, the chosen milestone in My climb).
- Words, in order of importance: "MY EXPERIENCE" largest and brightest (capitals, 34 to 64 px); its description small and quiet (12.5 px, cream at 70%); "OLYMPUS MONS" a small letter-spaced label in warm light orange (13 px); its line the quietest (11 px, cream at 56%). The title block and the mountain label leave in My climb.

### 9.7 Carried from round 6

The hidden list for screen readers, the fallback when there is no canvas, keyboard reach for every control, reduced motion (no camera travel, fades only), and a layout for phones. The round 6 tile pyramid, its engine and the Places view are deleted.

## 10. Content

- Long form: `9hkHhSmcA9s`, `FKc_IY2oQK4`, `yTF_aczKJzg`, `o321t-rfScA`, `-_ovL8w1TMM`, `pjMlXwicWMw`, `dU1E51HJ688`, `JIkttg_SUg8`, `5_d7HivYULE`, `ZDk9QKOLoLA`, `67tM7Vb_-HU`, `wit1TTy0UWY`, and every long form video (not Shorts) on `youtube.com/@AllRiskIsCreative9` (7 on 2026-11-12) and `youtube.com/@TheSamderShow` (2). In that order, duplicates removed.
- YouTube wall: playlist `PLV4vaojDpwnw…` as already configured, now 109 videos.
- Mars: Viking MDIM 2.1 colour mosaic and the MOLA height map, both NASA, public domain, fetched from NASA's Mars Trek tiles; recorded in `docs/redesign/credits.md`.

## 11. Approaches considered

- Experience map: four looks and flat or tilted (preview 1), a line map that is not Mars (rejected), a loop round the mountain with an orbiting camera (rejected), a tour of the mountain and Mars (hidden for now). Chosen: the toned picture, and a tilted night map with raised contours.
- Grounds: six procedural grounds in round 6's palette (all rejected), six grainy glows (Eclipse chosen), grain heavy to barely (barely chosen).
- Spines: real pictures found online (1 of 14 usable, rights unclear), the owner's photographs (not offered again), a designed series (chosen).
- Shelf setting: groups, a leaning book and a model mountain (rejected in favour of the plain row); horizon line or rock ledge (ledge); contour lines, chart grid or dots behind (dots).

## 12. Left to the builder

Module boundaries inside each task, the exact easing of the About and Credits panels, the grid that gives the largest wall tile, how the finite YouTube wall stops at its edges, how the spine faces are loaded, and how the map lays out on a phone. Each such choice is recorded as a ruling with its cost if wrong.

## 13. For Aditya to check

- Real devices: Safari, Firefox, an iPhone, a tablet. None has run any of round 6 or round 7.
- The two recordings (the wall fault and the reference grid): the wall arrival is a stand-in until he sends them.
- The card text fault was fixed from a description, not from the recording.
- Short form links. The moments' wording. Whether the old preview address should be removed from git history.
