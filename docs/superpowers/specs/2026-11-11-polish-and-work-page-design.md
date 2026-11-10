# Polish pass, new work page and timeline: design outline

**Date:** 2026-11-11
**Status:** proposed, waiting for Aditya's review. Nothing is built.
**Inputs:** [audit of the live site](../../redesign/audit-2026-11-11.md), round 5 in the [feedback log](../../redesign/feedback-log.md), the earlier [home design](2026-11-02-home-redesign-design.md).
**Build plan:** [`docs/superpowers/plans/2026-11-11-polish-and-work-page.md`](../plans/2026-11-11-polish-and-work-page.md)

**Design read:** a portfolio for a video editor, read by clients and collaborators, in a dark, cinematic, technical language (old paintings, mono type, a pixel display face, one orange accent). The home page is a **preserve** redesign: polish, no new look. The work page is an **overhaul**: new layout on the same language.

## 1. What this covers

Three pieces, built in this order:

1. **Polish pass** on the home page: fix every bug in the audit, settle the type and spacing, make the shelf and wall start reliably, add depth to the wall, rename the dock tabs, add a page transition, and reorganise the code.
2. **New work page** at `/work`: rotating rings of work around a short intro, a switcher that regroups them, on a dark moving background.
3. **Timeline page** at `/timeline`: one square per day since December 2020, coloured by role, zoomable.

After those, a set of **variations** (section 8) can be tried one at a time and judged.

## 2. Decisions already made by Aditya (round 5)

- Dock tabs read **home** and **work**. Home goes to the hero, not the intro card. Home gets a new icon.
- A quick blur transition between pages; no glitch frames; it must not feel slow.
- The work page follows the dark look, mostly black with a little orange, with a moving but quiet gradient.
- Work page: concentric rotating rings. From the centre out: editing stack, long form, short form, clients. A short intro in the middle. A control at the bottom switches between long form, short form and clients. Picking one sends the others away and arranges the chosen set so each item can be hovered and clicked.
- Videos open their public link directly. The stack does nothing on click. Clients show their socials.
- Videos come from YouTube (long and Shorts), Instagram Reels and other places, so covers are both wide and tall, and the count is not known yet.
- Timeline: its own page, reached from the work page's switcher, same page transition. **One square per day**, starting zoomed out, zoom with mouse or keyboard. Styled like the Tender poster, structured like the F1 graphic.
- Roles: student and part-time editor from Dec 2020; full-time editor from Jun 2021; social media manager from Jan 2022; content creator and editor from Sep 2022; content head from Jan 2023; freelance creative editor from Dec 2025.
- The stacked glass panes image is mood only.
- No contact section for now. The dock's mail icon stays.
- Paintings change every 10 seconds.
- The polish pass must not make the site look different.
- Placeholders (random images, placeholder names) until Aditya sends the real videos and clients.

## 3. Polish pass

### 3.1 Tokens

One file, `app/styles/tokens.css`, holds every shared value. Everything else refers to it.

| Token | Value | Used for |
| --- | --- | --- |
| `--t-micro` | 12px | key hints, the artist line of the caption |
| `--t-meta` | 13px | labels, counts, pills, hints, the cue, list rows |
| `--t-body` | 15px (14px under 700px) | all running text: cards, block copy, notes |
| `--t-lead` | 18px (15px under 700px) | the small name, the credits blurb |
| `--t-title` | `clamp(24px, 2.4vw, 38px)` | layer titles |
| `--t-display` | `clamp(40px, 3.6vw, 56px)` | block titles |
| `--t-hero` | `clamp(46px, 4vw, 80px)` | card headings |
| `--ink-1` / `--ink-2` / `--ink-3` | cream at 92% / 72% / 62% | primary, secondary, quiet text |
| `--z-*` | hero 1, cards 20, dock 30, layer 300, detail 400, transition 900 | the only z-index values allowed |
| `--space-section` | `clamp(72px, 10vh, 120px)` | space above and below a section |

No text meant to be read is smaller than 12px or fainter than 62%. Doto stays for display words, Space Mono for the name, captions and titles of things, IBM Plex Mono for everything else.

### 3.2 Dock

- Labels: **home** (house icon) and **work** (clapperboard icon, which moves over from the old "the cut" tab).
- Home, when already on the home page: close any open card or layer, scroll to the top. From another page: go to `/` with the page transition.
- `/#about` still opens the intro card, so old links keep working.
- Active state: home is active on `/`, work on `/work` and `/timeline`.
- Idle labels at 85% opacity, active at 100%.

### 3.3 Page transition

One transition for every page change (home, work, timeline):

- The outgoing page blurs to 12px and fades out over 160 ms; the incoming page fades in from an 8px blur over 220 ms. No movement, no scale. Total under 400 ms.
- Built on the browser's View Transitions API through Remix's `viewTransition` link option, so the browser holds a snapshot of the old page while the new one renders. That removes the half-drawn frames. Browsers without it change pages instantly, as today.
- The dock is excluded from the transition (its own `view-transition-name`), so it stays still while the page behind it changes.
- Dock links preload the other page's code and data when the pointer or a finger reaches the dock, which removes the 420 ms of nothing after a click.
- Reduced motion: a plain 120 ms fade.

### 3.4 Loader and hero

Same sequence, same look. What changes is when things start and what happens when the network is slow.

- **Starts at first paint.** The name's letters are in the server's HTML and animate with CSS as soon as the page paints. The JavaScript joins the timeline where it is (using a start time recorded by the head script), then runs the logo, reveal and the rest as today.
- **The name leaves before the logo arrives:** the exit starts at 1.75 s (was 2.0 s); the logo still starts at 2.12 s.
- **First painting chosen on the server** and preloaded from the HTML with high priority. The "not one of the last three" rule still applies from the second painting on.
- **Lighter paintings:** 1600px copies at about 250 KB, 2560px at about 600 KB. Each painting also carries a 24px blurred placeholder inside `hero-paintings.json` (about 1 KB each).
- **The reveal never waits more than 1.5 s.** If the painting is not ready 1.5 s after its cue, the liquid-glass reveal opens onto the placeholder, the loader finishes on time, and the sharp painting crossfades in when it arrives. The page unlocks at the normal moment regardless.
- **Coming back from another page:** the last painting is kept in memory and shown immediately; the placeholder covers the case where it is gone.
- **Every 10 seconds** a new painting. The slow zoom runs over 12 s instead of 21 s so it still reads within one painting.
- "My Interests" at 13px and 75%. Rail labels stay 13px whatever the card's scale; the right rail reads **about**.
- While a card is open the cue and caption are hidden, not dimmed.

### 3.5 Cards and blocks

- Card copy uses `--t-body`; quiet text uses `--ink-3` at the lowest.
- Blocks section: equal space above and below (`--space-section`), with the dock's band added to the bottom.
- Block titles use `--t-display`; copy uses `--t-body`, up to 38 characters wide as now.
- The mini shelf is centred and spans the same inner width as the mini wall.
- Counts are pluralised.
- Focus rings show for keyboard focus only.

### 3.6 Shelf

- **Opens with something on it.** If the 3D shelf is not ready when the layer finishes growing, a flat placeholder shows the plank and the 14 spines as plain coloured bars (the same shapes as the block's preview) at the shelf's position. The real shelf crossfades over it when ready, then the drop-in is skipped (the books are already "there").
- **Urgent preparation.** Once the layer is open and waiting, preparation stops yielding to idle time and runs in short back-to-back slices (at most 8 ms of work per frame), so it finishes in well under a second on a laptop.
- **Straight drop-in.** No tilt. Each book falls 0.6 units (was 1.2) and fades in; same 1.5 s and 0.09 s stagger.
- **Moves with anything.** Drag with mouse, pen or touch; horizontal trackpad scroll and shift-wheel pan it; a flick keeps moving and settles. A thin marker under the plank shows where you are along the shelf when it is wider than the screen. On first open on a narrow screen the shelf starts at its left end, so the first book is fully visible and the cut-off edge on the right says "there is more".
- **Close cleanly.** The scene fades out in 120 ms, then the layer shrinks.
- Header gets a dark fade behind it. The "Esc" hint is hidden on touch devices.

### 3.7 Wall

Keep the flat, sharp focus and the orange glow. Add depth and life with four restrained changes:

1. **Two depth planes.** Alternate columns sit "further back": 86% size, 82% brightness, a slight softness, and they drift at 60% of the speed. The near columns are as today. The difference in speed is what reads as depth.
2. **Pointer parallax.** The whole wall leans up to 14px against the pointer, the far plane half as much. On phones, the same from the tilt of a drag, not from the gyroscope.
3. **Same-channel echo.** When a video is in focus, other videos from the same channel stay bright and gain a hairline cream edge while the rest dim. It shows what Aditya keeps going back to. The chip adds "3 more from this channel" when there are any.
4. **Tiles arrive.** Each thumbnail fades in and settles from 96% to 100% over 300 ms as it loads, in a ripple from the centre outwards, instead of popping.

Also: a dark fade behind the header; the layer header hides while a video is open; primary pointer only; a keyboard line in the hint on devices with a keyboard; the plain grid takes over if the graphics context is lost.

### 3.8 Code organisation

No behaviour changes in this part; it is done first so every later change lands in a tidy place.

```
app/
  styles/
    tokens.css              type, colour, spacing, z-index, easing
  components/
    home/
      home-page.tsx         composition only
      hero/                 hero.tsx, lockup.tsx, use-loader.ts, use-painting-cycle.ts,
                            paint-engine.ts, paint-gate.ts, painting-cycle.ts, hero.css
      cards/                hero-cards.tsx, intro-card.tsx, credits-card.tsx,
                            use-card-poses.ts, use-card-input.ts, card-pose.ts, hero-nav.ts, cards.css
      blocks/               interest-blocks.tsx, mini-previews.ts, use-near.ts, blocks.css
      layer/                interest-layer.tsx, layer-state.ts, use-layer-history.ts, layer.css
      reading/              reading-scene.tsx, reading-fallback.tsx, shelf-engine.ts (loop only),
                            shelf-scene.ts, shelf-covers.ts, shelf-input.ts, shelf-canvases.ts,
                            shelf-math.ts, reading.css
      watching/             watching-scene.tsx, video-detail.tsx, wall-engine.ts (loop only),
                            wall-gl.ts, wall-thumbs.ts, wall-input.ts, wall-math.ts, watching.css
    work/                   new (section 4)
    timeline/               new (section 5)
    site-nav.tsx, page-transition.css
  utils/
    inert.ts, idle.ts, load-image.ts
```

Rules: no file over about 350 lines; every pure function has a test; each stylesheet is imported by the component that owns it; the 116 deferred review notes (`docs/redesign/deferred-review-notes.md`) are each fixed or closed with a reason.

## 4. Work page

### 4.1 The idea

One screen, no page scroll. Four rings turn slowly around a short introduction. The rings are the whole portfolio at a glance; the switcher pulls one kind of work out of the rings and lays it flat so it can be browsed.

```
                 . - ~ clients (avatars, outermost, partly off screen) ~ - .
            .                                                                .
        .        . - ~  short form (tall covers)  ~ - .                          .
      .       .                                         .                          .
     .      .        . - ~ long form (wide) ~ - .          .                        .
     .     .       .                               .        .                       .
     .     .      .      . ~ stack (tools) ~ .      .       .                       .
     .     .      .     .                      .    .       .                       .
     .     .      .     .   WORK               .    .       .                       .
     .     .      .     .   Two lines of       .    .       .                       .
     .     .      .     .   intro.             .    .       .                       .
     .     .      .      ' ~ - . _ _ . - ~ '       .       .                       .
     .      .       ' - ~ . _ _ _ _ _ . ~ - '      .        .                       .
      .       ' - ~ . _ _ _ _ _ _ _ _ _ _ . ~ - '          .                       .
        ' - ~ . _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ . ~ - '

              [ all | long form | short form | clients | timeline ]   <- switcher
              [ home | work |  youtube  instagram  x  mail ]          <- dock
```

### 4.2 Rings

| Ring | Holds | Item shape | Turns | Click |
| --- | --- | --- | --- | --- |
| 1 (innermost) | Editing stack: 8 tools | 56px rounded square with a two-letter mark (Pr, Ae, Fc, Bl, Ps, Ai, Fg, Lr) | clockwise, one turn in 90 s | nothing; hover shows the tool's name |
| 2 | Long form | wide cover, 16:9 | anticlockwise, 150 s | opens the video's public link in a new tab |
| 3 | Short form | tall cover, 9:16 | clockwise, 200 s | opens the link in a new tab |
| 4 (outermost) | Clients | round avatar | anticlockwise, 260 s | in the rings: switches to the clients view |

- Items stay upright as their ring turns.
- Ring radii come from the screen: the stack ring's radius is `min(vw, vh) * 0.21`, then 0.34, 0.50 and 0.68. The outer rings run off the screen's edges on purpose, as on the Vitra page.
- Item size adapts to how many there are: `size = clamp(min, circumference / (count * 1.3), max)`. Wide covers 96 to 176px wide; tall covers 54 to 96px wide; avatars 44 to 72px. If a ring would need items below its minimum, the extra items go to a second, slightly larger sub-ring turning the other way.
- Hovering an item pauses its ring, lifts the item 12% and shows a one-line label (title for videos, name for clients). Leaving resumes the turn.
- The stack marks are drawn in type, in the site's palette, not brand logos. That keeps the ring visually even and avoids using vendor logos.
- Rotation is pure CSS on the ring containers, so it costs nothing per frame in JavaScript. Reduced motion: the rings stand still.

### 4.3 Centre

- "Work" in Doto, then at most 20 words. Placeholder for Aditya to replace: "Six years of cutting long videos, shorts and brand films for creators and companies."
- Nothing else in the centre. No stats, no buttons. The rings are the content.

### 4.4 Switcher

The dock grows a second row on this page, so the two controls read as one console and do not fight for the bottom of the screen.

- Entries: **all**, **long form**, **short form**, **clients**, **timeline**.
- all, long form, short form and clients change the view in place and set `?view=long` (and so on), so a view can be linked and Back works.
- timeline goes to `/timeline` with the page transition.
- On phones the row scrolls sideways if it does not fit.

### 4.5 A view is picked

- The other rings scale up and fade out past the screen edges (350 ms). The stack ring shrinks into a small still row at the top right, since it is never browsed.
- The chosen items leave their ring and travel to their places in a staggered layout (each item's move takes 600 ms, 12 ms apart, slight overshoot). The same elements move; nothing is swapped.
- Layouts:
  - **Long form:** rows of wide covers, alternate rows shifted by half a cover (a brick pattern), 4 across on desktop, 2 on phones.
  - **Short form:** tall covers in rows of 7 on desktop, 3 on phones, alternate rows shifted.
  - **Clients:** avatars in a loose honeycomb, each with name and handle beneath.
- The view scrolls inside the stage if it is taller than the screen. A dark fade keeps the top title and the console readable.
- A small title replaces the centre intro at the top left: "Long form" with the count beneath.
- Hover or focus on a video: the cover brightens, the others dim to 70%, and a line shows title, who it was for, and the year. Click opens the link in a new tab.
- Hover or focus on a client: its socials appear as a row of icons (YouTube, Instagram, X, website, whichever exist). Each icon is its own link; clicking the avatar opens the client's main link.
- "all" reverses everything back into the rings.

### 4.6 Background

- Ink `#050403` with two very large, soft radial glows: ember `#31100A` at 60% and accent `#FC4C00` at 9%. They drift on slow, different loops (70 s and 110 s), moved with transforms only.
- The site's dot screen and grain on top, fixed and still.
- Reduced motion: the glows stand still.

### 4.7 Data

`content/site/work.json`, validated like the other content files:

```
intro:     { title, text }
stack:     [{ id, mark, label }]
longForm:  [{ id, title, for, year, url, cover, source }]     source: youtube | instagram | vimeo | other
shortForm: [{ id, title, for, year, url, cover, source }]
clients:   [{ id, name, handle, avatar, url, socials: [{ type, url }] }]
```

- `cover` and `avatar` are either a path under `public/work/` or a full URL. For YouTube items `cover` may be left out and the thumbnail is taken from the video id at runtime.
- Placeholders now: 16 long, 24 short, 10 clients, using `https://picsum.photos/seed/<id>/<w>/<h>` (loaded at runtime, not stored), placeholder titles marked "Placeholder", and links to Aditya's YouTube channel.
- The old `projects.json`, `clients.json`, `tech-stack.json` and `work-experience.json` are removed once nothing reads them. `reach-out.json` stays for the contact section later.

### 4.8 Phones

- The rings scale with the screen's width, so on a phone the stack and long-form rings are fully visible and the outer two sweep through the corners.
- The intro shortens to the title and one line.
- Picked views are simple scrolling grids (2 wide covers, 3 tall covers, 3 avatars across) with the same travel animation.
- Tap replaces hover: first tap on a client shows its socials, second tap opens its main link. A video opens on the first tap.

### 4.9 Accessibility

- Each ring is a list; every item is a link or a button with a real name.
- Tab order follows the rings from the centre out. Focus pauses the ring.
- The switcher is a set of tabs (`role="tablist"`), arrow keys move between them.
- No WebGL is needed on this page.

## 5. Timeline page

### 5.1 The idea

Every day since 1 December 2020 is one square. Squares are coloured by the role Aditya held that day. From far away it is a poster of coloured bands; zoomed in, each square is a dated day.

```
 TIMELINE                          M T W T F S S M T W T F S S  ...  (56 columns = 8 weeks)
 Dec 2020 - today                  # # # # # # # # # # # # # #
 2,172 days                        # # # # # # # # # # # # # #        student / part time
                                   = = = = = = = = = = = = = =        full-time editor
 [] student, part-time    182      = = = = = = = = = = = = = =
 [] full-time editor      214      + + + + + + + + + + + + + +        social media manager
 [] social media manager  243      * * * * * * * * * * * * * *        content creator
 [] content creator       122      @ @ @ @ @ @ @ @ @ @ @ @ @ @        content head
 [] content head        1,065      @ @ @ @ @ @ @ @ @ @ @ @ @ @
 [] freelance             346      @ @ @ @ @ @ @ @ @ @ @ @ @ @
                                   o o o o o o o o o o o o o o        freelance creative editor
```

### 5.2 Grid

- Reading order: left to right, top to bottom, like text, as in the F1 graphic.
- **56 columns** on wide screens: 8 weeks per row, so each column is always the same weekday. **28 columns** (4 weeks) under 700px.
- The first square is 1 December 2020. The last is today, worked out when the page is requested.
- Today's square has a slow pulse. The first day of each role has a small notch in its corner.
- Optional marked days (`marks` in the data: a date and a label) are drawn in bright yellow like the F1 graphic's title squares. Empty for now.

### 5.3 Look

Taken from the Tender poster, turned dark:

- Ink background with the dot and grain texture. Thin grid lines in cream at 10%.
- Squares are flat fills with a slightly uneven edge and grain, like ink on paper.
- A label block at the top left in gilt with dark type, like the poster's yellow block: the title, the date range, the number of days.
- Colours, all from the site's existing palette:

| Role | From | Colour |
| --- | --- | --- |
| Student and part-time editor | 1 Dec 2020 | verdigris `#3E8A7C` |
| Full-time editor | 1 Jun 2021 | gilt `#D9A441` |
| Social media manager | 1 Jan 2022 | brick `#C94F35` |
| Content creator and editor | 1 Sep 2022 | lavender `#9C8AC9` |
| Content head | 1 Jan 2023 | accent `#FC4C00` |
| Freelance creative editor | 1 Dec 2025 | cream `#fdfce6` |

- The legend lists each role with its colour and its count of days.

### 5.4 Zoom and pan

- Opens zoomed out so the whole grid fits the screen with margins.
- **Zoom:** mouse wheel or trackpad pinch (towards the pointer), `+` and `-` keys, two-finger pinch on touch, and two small buttons.
- **Pan:** drag, arrow keys, two-finger scroll.
- `0` or a "fit" button returns to the full view.
- Three levels of detail as you zoom in:
  - Squares under 10px: colour only.
  - 10 to 28px: month names appear in the left margin at each month's first row, and a thin rule marks each new year.
  - Over 28px: each square shows its day number; the first of a month also shows the month.
- Hover or focus on a square: a small label with the full date and the role.
- Drawn on a single canvas, redrawn only when the view changes. Zoom eases over 180 ms.
- Reduced motion: zoom steps without easing; no pulse.

### 5.5 Data

`content/site/timeline.json`:

```
start: "2020-12-01"
roles: [{ id, label, from, color }]      in date order; each runs until the next one starts
marks: [{ date, label }]
```

### 5.6 Getting there and back

- From the work page's switcher. The dock shows **work** as active.
- A "work" back link sits in the label block. Browser Back works.
- A screen-reader table lists the roles with their dates and day counts.

## 6. Approaches considered

**Rings:** (a) DOM elements on rotating containers, moved with CSS and the Web Animations API (chosen: links stay real links, nothing per frame in JavaScript, and the travel to the grid is a simple measured move); (b) WebGL like the wall (rejected: every item is a link, and there are too few items to need it); (c) SVG (rejected: image covers and rounded masks are clumsier).

**Timeline:** (a) one canvas with a small pure math module (chosen: 2,172 squares redraw in under a millisecond and zoom stays smooth as the count grows daily); (b) a DOM grid with CSS zoom (rejected: thousands of nodes relayout on every zoom step); (c) WebGL (rejected: not needed).

**Page transition:** (a) the browser's View Transitions through Remix (chosen: the browser holds the old page as a picture, so there are no half-drawn frames, and it is a few lines of CSS); (b) a hand-rolled overlay with delayed navigation (rejected: more code, and it delays every click).

## 7. Not in this work

- Contact section.
- Real videos, clients and copy (placeholders until Aditya sends them).
- Substack articles on the reading side (still parked).
- Any change to the home page's look beyond the audit's fixes.

## 8. Variations to try afterwards

Each is built on its own branch from the finished polish, with its own preview link, so they can be compared side by side and the choice made with Opus. None is needed for the main build.

| Area | Variation | What changes |
| --- | --- | --- |
| Work, rings | **R-A Horizon** | The rings are centred below the bottom edge, so only their upper arcs sweep across the screen like a horizon. The intro sits top left. More cinematic, less diagram. |
| Work, rings | **R-B Corridor** | From the glass panes image and the Alim site: covers are translucent panes receding into depth; scroll walks forward through long form, then short form, then clients. |
| Work, picked view | **P-A Filmstrip** | The chosen set runs as one horizontal strip you scrub sideways, with sprocket holes as the only decoration. |
| Work, picked view | **P-B Contact sheet** | A strict grid with frame numbers, like a printed contact sheet. |
| Work, switcher | **C-A Top centre** | The switcher sits at the top, the dock alone at the bottom. |
| Wall | **W-A Feature tiles** | A handful of hand-picked videos are double size, so the wall has anchors. Needs a small list of picks. |
| Wall | **W-B Channel constellations** | Tiles from the same channel sit together, with the channel's name set once beside its cluster. |
| Shelf entrance | **S-A Shelved** | Books slide in from the right along the plank, one after another, as if being shelved. |
| Shelf entrance | **S-B In place** | Books fade up in place, left to right, with no fall. |
| Loader | **L-A Logo first** | Skip the name: फ्रैग and TACO rise out of black, then the painting. One second shorter. |
| Timeline | **T-A Weeks** | 7 rows (weekdays) by about 310 columns, like a contribution chart. A ribbon to scroll along. |
| Timeline | **T-B Year rows** | One row per year, one column per day of the year, so seasons line up vertically. |
| Blocks | **B-A Full-bleed previews** | The previews fill the whole block behind the words. |

## 9. My calls, open to change

- The right rail reads "about" (the heading inside the card stays "the cut").
- The work page's switcher is a second row on the dock, not a separate bar.
- Stack tools are two-letter marks, not vendor logos.
- 56 columns on the timeline (8 weeks per row).
- The first painting of a visit is picked on the server, so it may repeat one of the last three once.
- A shelf that was not ready shows a flat placeholder and skips the drop-in when the real one arrives.
- Clients in the rings switch to the clients view on click instead of opening a link.
- The old work page's content files are deleted except `reach-out.json`.
