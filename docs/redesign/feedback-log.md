# Home redesign: feedback log

Every round of feedback on the home page redesign, what changed in response, and what is still open. Each round lists the requests as given, then what the next mockup did about them. Newest round is at the bottom.

**Status (2026-11-11):** the home page redesign is built (R24 to R30) and live for review at https://fragtaco-portfolio.vercel.app. Round 5 produced an [audit](audit-2026-11-11.md), a [design outline](../superpowers/specs/2026-11-11-polish-and-work-page-design.md) and a [build plan](../superpowers/plans/2026-11-11-polish-and-work-page.md) for a polish pass, a new work page and a timeline page. The polish pass on the home page (R31 to R37) is built; the work page and the timeline are next.

## Contents

1. [Round 0: the brief](#round-0-the-brief-2026-11-01)
2. [Round 1: feedback on v1](#round-1-feedback-on-v1-2026-11-01)
3. [Round 2: feedback on v2](#round-2-feedback-on-v2-2026-11-02)
4. [Round 3: feedback on v3](#round-3-feedback-on-v3-2026-11-02)
5. [Round 4: feedback on the built shelf and walls](#round-4-feedback-on-the-built-shelf-and-walls-2026-11-05)
6. [Round 5: audit, polish and the work page](#round-5-audit-polish-and-the-work-page-2026-11-11)
7. [Decisions so far](#decisions-so-far)
8. [Open questions](#open-questions)
9. [Later, not now](#later-not-now)

---

## Round 0: the brief (2026-11-01)

**Asked for**

- A loader: the name, then the logo, then a liquid-glass refraction that reveals the painting.
- A hero with the name, logo and roles centred: "Creative Editor - Side Quests Maxxer" (no "remote").
- Three directions out of the hero: right for an intro with a photo, left for Ohshin's credits, down for books and YouTube recommendations. Arrow keys, trackpad swipe, and touch swipe on phones.
- Replace the YouTube fact box with a video section built from playlist `PLV4vaojDpwnw` (51 videos).
- A 3D books section.
- Process: design first, then a detailed build plan. Track the work in a new public GitHub repo under `fragtac0`, one PR per part with screenshots, commits numbered on from R23.

**Answers given along the way**

- Sideways navigation works only from the hero. Phones swipe the same way as desktop.
- The loader plays once per session.
- Show all 51 videos. Aditya writes the blurbs; ship placeholders.
- Keep the videos current with a sync command that re-reads the playlist, no API key.
- Placeholder books are real books with real covers.
- The red-wall photo is the intro portrait. Ohshin's photo is the current `/profile.png`. Aditya writes the Ohshin paragraph; ship a placeholder.
- Approaches picked: the panels are an animated stage, the refraction is a small hand-written WebGL shader, the books are a three.js scene.

## Round 1: feedback on v1 (2026-11-01)

v1 ([mockup](mockups/home-v1.html)) showed the loader, the hero with full-page side panels, and two options each for the books (A, B) and the videos (A, B).

**Feedback**

- Logo: cut off, with a box behind it. Use `frag.svg` and `taco.svg` side by side without cutting anything, in `#fdfce6`. फ्रैग is outline only, TACO is filled.
- Side panels: should be blocks sliding over the hero with the hero blurred behind, not two separate pages, and neither too small nor too large. The edge peek should be wider and shorter, with a stronger glow or shadow so it is obvious. Same on phones. Credits were too thin on detail and too big overall. Both panels should take less space.
- Books: go with B (the shelf). Much more designed, a nicer load-in, real texture, gradients with contrast instead of flat colour.
- Videos: go with B (fisheye), drop the duration stamp. A large wall of videos that moves very slowly and never looks empty, a little refraction and a very faint blur on hover. Same page, but it should feel expansive.
- Loader: start in the centre and grow while loading, a little slower. Name first, then the logo, then the reveal. Keep the painting shuffle, 15 to 20 seconds per painting, and change paintings with a liquid-glass refraction, not a fade.
- Below the hero: two blocks, "What I am reading" and "What I am watching", each with a faded peek, expanding into the real thing on click. Asked whether that is a good idea from a UX point of view.

**What v2 did** ([mockup](mockups/home-v2.html))

- Logo rebuilt from the two SVGs, side by side in `#fdfce6`, nothing clipped and no backing box.
- Cards slide over the hero and blur it. The resting peek became wider and shorter with a breathing orange glow at each edge. Credits gained a colophon (framework, styling, type, paintings) and three links. Phones use the same cards, centred.
- Shelf: cloth-grain spines in three styles (plain, foil bands, printed block), printed titles, page edges, a hinge crease and sheen on the covers, real heights from trim size, books dropping in one after another, real Open Library covers when opened.
- Wall: all 51 thumbnails on one slowly drifting surface with a fisheye lens on hover, chromatic fringing at the rim and a faint blur elsewhere. Durations removed everywhere.
- Loader: the name starts small in the centre and grows as its letters come into focus, rolls away, the logo rises, then the painting opens from the centre through liquid glass (about 4.8 s, up from about 3 s). Paintings change every 15 to 20 seconds with a liquid-glass sweep in a random direction.
- The two blocks were built with live peeks (spines on a plank, drifting thumbnails) that grow into a full-screen layer.

**UX answer on the two blocks:** yes, with conditions. The peeks have to show real content rather than a vague fade, the expansion has to stay on the page (it grows out of the block and shrinks back into it), Esc, Close and the browser Back button all return, and each view gets its own link (`#reading`, `#watching`). The heavy scenes then only load when someone asks for them, which also keeps the home page fast. The cost is one extra click before the content.

## Round 2: feedback on v2 (2026-11-02)

"I am liking this new version much better than previous."

**Feedback, and what v3 did** ([mockup](mockups/home-v3.html))

| Asked for | v3 |
| --- | --- |
| "Aditya Bhoir" in Space Mono, as in the earlier mockups | Loader name and the small name above the logo are both Space Mono. |
| Too much space between the logo and the name | The name now sits just above the TACO cap line, next to the rise of the matra on फ्रैग, instead of above the logo's whole box. |
| फ्रैग stroke should be outer, no lines between the letters | The outline rings overlap where the letters join. v3 cuts those overlaps out using फ्रैग's own fill shapes as a mask, so only the outer contour is left ([screenshot](screenshots/v3-logo-frag-outline.jpg)). |
| Painting caption in Space Mono; the serif "is not really that well" | Caption is Space Mono. The serif is gone from the interface everywhere (card blurb, book note, video titles). It survives only as printed type on the book spines. |
| Cards: remove the arrow | Chevrons removed from both rails. |
| Cards larger on desktop and tablet, smaller on phones | Open cards scale with the screen (intro 33vw up to 640 px, credits 27vw up to 520 px, height up to 760 px). The desktop peek is wider (rail up to 100 px). Phones get a slimmer card (84vw up to 360 px) and a thinner peek. |
| "Scroll for books and videos" becomes "My Interests" | Done. It is also a button now that scrolls to the blocks. |
| Block buttons overlap the previews | The preview has its own row under the text, so it can never sit behind the button. |
| Animations sluggish and laggy | See [Performance](#performance-v3) below. Interaction timings are also shorter (cards 0.72 s, block expansion 0.66 s, video detail 0.52 s). The loader keeps its slower pace, as asked in round 1. |
| Room for the site's navigation dock | The existing bottom dock (the cut, reel, YouTube, Instagram, X, mail) is in the mockup, hides while scrolling and returns when scrolling stops. The cue, caption and cards all keep clear of it. "the cut" now opens the intro card. |
| Substack articles later, as a horizontal stack beside the vertical shelf | Not built (see [Later](#later-not-now)). All 14 books now stand upright, so the horizontal stack is free for articles. |
| Wall: fisheye too narrow and bulgy, the video should not bend | No more lens. The focused video stays flat and sharp; it grows about 13% and its neighbours move out of the way in a wide, gentle falloff. |
| Wall: in-focus look, more spacing around the focused video, no circular border, subtle orange glow | The focused tile gets a soft lift shadow and a faint orange glow, nothing else. The rest of the wall dims slightly and softens with a very low blur (switchable in the review bar, see open questions). The wall settles while you look at something and drifts again when you move on. |
| Video title and description below the video, not at the bottom | Hover label sits right under the focused video. In the detail view, the title is directly under the thumbnail. |
| Detail view: channel name top left, subscriber count top right, no description, "Watch" below the title without "on YouTube" | Done. Subscriber counts are read from each channel page (see decisions). |
| Clicking away from an open video should scale it back into the grid | The thumbnail flies back to its tile, which then eases back into the grid. |
| Shelf: blur behind the open book not apparent | Opening a book now copies the shelf once, blurs and darkens the copy, and fades the live shelf into it ([screenshot](screenshots/v3-book-open.jpg)). |
| Shelf: the title bubble sits too far to the side; it should be beside the book, both centred | The book and its note are laid out as one pair, centred on screen. On phones the note sits below. |
| Shelf: the shadow steps frame by frame as a book moves; remove it and animate a shadow separately | The shadow map is gone. Each book has its own soft contact shadow on the plank and a soft shadow on the wall, animated with the book every frame. The wall behind the shelf is lit warmer so those shadows read. |
| Hero: bring back the dotted texture with some grain; use it on the shelf wall and the video wall too | The old hero's dot screen (0.6 px dots on a 4 px grid) plus a fixed grain, drawn in the painting shader for the hero and as a static layer behind the shelf, the wall and the blocks section. |
| Ask questions properly | Open questions are listed below and asked in one go. |
| Document and track every change in the repo | This folder, committed on branch `redesign/home`. |

### Performance (v3)

What changed:

- **No full-screen blur layer.** In v2 the cards sat on a full-screen `backdrop-filter: blur()` over a canvas that redrew every frame, so the browser re-blurred the whole screen every frame while a card was open or moving. In v3 the painting shader blurs itself (a biased mipmap lookup) and the scrim is a plain tint.
- **The hero redraws only when something moves.** Every frame during a reveal, a painting change or the blur; 30 fps for the slow zoom alone (it moves less than a fifth of a pixel a frame); nothing at all while the hero is off screen, covered by an expanded block, or blurred behind an open card.
- **Dots and grain are drawn in the same shader pass** instead of being blended over the canvas as a separate layer.
- **Heavy scenes load lazily.** three.js (1.3 MB before compression) used to download on page load; it now loads only when the reading block comes near, and its textures are painted in idle time a few books at a time. Wall thumbnails also load only when the watching block is near.
- **Nothing heavy starts during the grow animation.** The shelf or wall starts after the block has finished expanding.
- **The shelf renders only when something changes**, has no shadow map, and while a book is open only that book is drawn.
- **The wall draws whole tiles as quads**, so the focus effect is a handful of draw calls rather than a full-screen distortion pass.
- **The mini wall in the watching block pauses** when it is off screen.

Measured in Chrome on the development Mac (120 Hz), frame interval averaged over 1.2 to 3 s:

| Scenario | v3 average | v3 worst frame |
| --- | --- | --- |
| Hero idle | 8.4 ms | 25 ms (once, during a painting load) |
| Card opening | 8.3 ms | 9.3 ms |
| Painting change (liquid-glass sweep) | 8.3 ms | 16.7 ms |
| Book opening and closing | 8.3 ms | 14.4 ms |
| Video wall drifting | 8.3 ms | 9.4 ms |
| Video wall, hover sweeping across tiles | 8.3 ms | 9.4 ms |

v2 also held 120 fps on this machine, so these numbers show v3 is smooth here; they do not prove the fix on slower hardware. Most of the work v3 removes is GPU work (the full-screen re-blur, constant full-resolution redraws), which is what slows down laptops with integrated graphics and phones. Checking on a mid-range phone and an integrated-graphics laptop is part of the build plan.

---

## Round 3: feedback on v3 (2026-11-02)

**Asked for**, then what [v4](mockups/home-v4.html) did. After these changes the design is signed off and goes to the design doc and the build.

| Asked for | v4 |
| --- | --- |
| Intro card only: slightly wider, photo on the left and the intro on the right, same height | The intro card is now two columns: the portrait fills a full-height column on the left (cropped to the figure) and the words scroll on the right. Width is 54vw, from 660 px up to 1000 px; height is unchanged ([screenshot](screenshots/v4-intro-card-desktop.jpg)). The credits card is unchanged. On phones the card is too narrow for two columns, so the photo sits on top and the text scrolls under it ([screenshot](screenshots/v4-intro-card-phone.jpg)). |
| During the loader you can scroll and see the books and videos; they should only appear after the final reveal | The page is locked while the loader runs and the section below the hero is hidden. Both are released at the same moment the cards and the dock arrive (4.8 s), and the section fades in. |
| Shelf: book tops are clipped, make the shelf slightly smaller so every book shows | The camera now frames 3.05 units of height instead of 2.5 and aims a little higher, so the tallest book (11 in) clears the header with room for its hover lift ([screenshot](screenshots/v4-shelf-fits.jpg)). |
| Shelf: books come out too fast and the animation looks janky; smoother and a bit slower | Drop-in: each book falls a shorter distance (1.2 instead of 2.6 units) over 1.5 s instead of 0.95 s, fades in as it falls, and the stagger is wider (0.09 s); the whole entrance takes about 2.9 s. Hover pull and opening now use a critically damped spring, so they ease in as well as out (the old lerp started at full speed). Book covers that arrive late are uploaded one per frame after the entrance, never during it. Measured: 120 fps with no frame over 9.4 ms through opening the shelf and the whole drop-in. |
| A very subtle glow on the main logo | A second, warm drop shadow on the logo: 22 px wide at 20% opacity. |

---

## Round 4: feedback on the built shelf and walls (2026-11-05)

| Asked for | Done (R30) |
| --- | --- |
| An opening book overlaps the others; it should come out as it is, then turn; a little slower | The book slides straight out in front of its neighbours, then turns. The open spring is slower. |
| The heading in both walls is too far into the top-left corner | Both layer headers are inset from the top and sides. |
| "14 books this year" and the video count go below the heading | Done, on phones too. |
| A public link for review | https://fragtaco-portfolio.vercel.app (a new Vercel project; not the live site). |
| The site icon is still Ohshin's photo | The TACO wordmark, cream on ink. |

---

## Round 5: audit, polish and the work page (2026-11-11)

**Asked for:** analyse the whole site and fix every bug without changing how it looks; cleaner, organised code; every change documented. Named problems: the book case animations, the shelf clipped on a phone with no way to slide it, the phone view, layout and symmetry, the wall's animations (more depth and life), the loader, the hero, font and card sizes, glitch frames between pages. Paintings should change every 10 seconds. The dock's first tab should be "home" and open the hero; "reel" becomes "work". A quick blur transition between pages. A completely new work page built on rotating rings, and a timeline of his roles as a grid of squares. Variations to try afterwards.

**Answers to the questions asked:**

| Question | Answer |
| --- | --- |
| Name of the home tab | "home" |
| What one timeline square stands for | One day. The timeline is its own page, starts zoomed out, zooms with mouse or keyboard. |
| How to reach the timeline | From the work page's switcher only |
| The glass panes image | Mood only |
| Where the videos live | YouTube long form, Shorts, Instagram Reels and other places |
| How many videos | Not known yet; the rings must adapt |
| Contact section | Skip for now |

**What was produced:** the [audit](audit-2026-11-11.md) (65 findings with evidence), the [design outline](../superpowers/specs/2026-11-11-polish-and-work-page-design.md), the [build plan](../superpowers/plans/2026-11-11-polish-and-work-page.md) (27 tasks, R31 to R39), the [list of 116 deferred review notes](deferred-review-notes.md), the audit tools in `scripts/audit/`, and "before" screenshots in `compare/before/`.

**How it is built:** Sonnet at high effort implements one task at a time; Opus 5.5 reviews every task. At the end: a Vercel preview and a before and after page at `compare/index.html`.

### What was done (R31 to R37, the home page)

| Asked for | Done |
| --- | --- |
| Fix every bug, cleaner and organised code | 65 audit findings and 116 review notes worked through. Every change has a row in [changes-2026-11.md](changes-2026-11.md); every review note is fixed or closed with a reason in [deferred-review-notes.md](deferred-review-notes.md). One stylesheet per area, a tokens file, the shelf and wall engines and the hero split by job, dead code deleted (R31). |
| The dock's first tab is "home" and opens the hero; "reel" becomes "work"; a quick blur between pages | Done (R32). With reduced motion the page change is a plain fade. |
| The loader, the hero, paintings every 10 seconds | Lighter WebP paintings with blurred placeholders, the first painting chosen on the server, the name animating from first paint, a new painting every 10 seconds, the page never locked past 6.3 seconds (R33). |
| Font and card sizes | One type scale and three text strengths; readable card rails; balanced blocks; focus rings for the keyboard only (R34). |
| The book case animations and the shelf clipped on a phone with no way to slide it | The shelf never opens empty, books drop straight in, and it pans with mouse drag, trackpad, shift+wheel and touch, with a flick and a position marker (R35). |
| The wall: more depth and life | Far and near planes, a gentle lean against the pointer, a channel echo, tiles that fade in from the centre, no empty panel while it loads (R36). |
| Phone view, layout and symmetry | Landscape phones, the 320 px dock and the blocks' spacing fixed and measured (R34, R37). |
| Video sync | Hardened: a bad playlist entry no longer stops it, the file is written atomically, thumbnails are checked properly (R37). |
| Accessibility | Keyboard walk of every control and a reduced-motion walk: every control reachable with a visible ring, focus goes back where it came from, `Esc` closes video or book, then the layer, then the card; no motion at all with reduced motion (R37). |
| A completely new work page, the timeline, variations | Not yet (R38 and R39). |

Decisions taken while building, for Aditya to overrule:

- Lighthouse is not installed and no dependency may be added, so the load numbers below come from `scripts/audit/load-metrics.json` (same idea: a phone, slow 4G, CPU 4x, cache off), not from Lighthouse.
- The largest contentful paint on a slow phone is the roles line, which the loader reveals on purpose at about 4.3 s. Moving it earlier would change the loader's look, so it is left as designed.
- The intro card's portrait (196 KB) is requested after the loader, in an idle moment, or sooner when the card is open or the pointer is over it. It used to compete with the first painting at about 490 ms.

### Measured (R37)

Production build, headless Chrome on the build machine at 60 Hz, frame gaps from `requestAnimationFrame` (the same method as `scripts/perf/sample-frames.js`, which also reports the 95th percentile). Every scenario was sampled at three sizes: 1440x900 (dpr 1), 390x844 (dpr 2, touch) and 390x844 with the CPU throttled 4x. The result was the same in all three, and in every scenario, so the table lists each scenario once.

| Scenario | Sizes | Frames | Average | Worst frame | Frames over 20 ms |
| --- | --- | --- | --- | --- | --- |
| Hero idle for 12 s, with a painting change | all three | 720 | 16.67 ms | 16.8 ms | 0 |
| Card open and close | all three | 150 | 16.67 ms | 16.8 ms | 0 |
| Scroll to the blocks | all three | 120 | 16.67 ms | 16.8 ms | 0 |
| Open the reading layer and the shelf entrance | all three | 210 | 16.67 ms | 16.8 ms | 0 |
| Hover along the shelf | all three | 150 | 16.67 ms | 16.8 ms | 0 |
| Open a book | all three | 90 | 16.67 ms | 16.8 ms | 0 |
| Close the book | all three | 90 | 16.67 ms | 16.8 ms | 0 |
| Close reading and open the watching layer | all three | 210 | 16.67 ms | 16.8 ms | 0 |
| Wall drift | all three | 180 | 16.67 ms | 16.8 ms | 0 |
| Hover sweep across the wall | all three | 150 | 16.67 ms | 16.8 ms | 0 |
| Open a video | all three | 90 | 16.67 ms | 16.8 ms | 0 |
| Close the video | all three | 90 | 16.67 ms | 16.8 ms | 0 |

Cold shelf (CPU 4x, deep link `/#reading`): the placeholder is on screen in the frame the layer is ready; the 3D shelf replaces it 67 ms later; the worst frame while it prepares is 33 ms and none is over 50 ms.

Caveat: this is a fast laptop in headless Chrome, so it shows the code does no avoidable work, not that a mid-range Android phone, an iPhone or an integrated-graphics laptop is smooth. Those three checks are Aditya's. `scripts/perf/sample-frames.js` is the snippet to paste into DevTools for them.

Load for `/` on a phone profile (390x844, dpr 2, slow 4G at 1638 kbit/s and 150 ms latency, CPU 4x, cache off). Lighthouse is not installed and may not be added, so these come from `scripts/audit/load-metrics.json` (run through `scripts/audit/cdp.mjs`), not from Lighthouse; treat them as close, not identical, to a Lighthouse mobile run.

| Measure | Before the portrait change (3eaaa28) | After (7780d64) | Note |
| --- | --- | --- | --- |
| First contentful paint | 744 ms | 720 ms | |
| DOMContentLoaded | 728 ms | not recorded | |
| Largest contentful paint | 5.8 s | 5.0 s (4976 ms) | Above the 2.5 s target. The element is the roles line, which the loader reveals as part of its sequence. |
| Cumulative layout shift | 0.006 | 0.004 | |
| Total transfer | 1049 KB in 47 requests | 1027 KB in 47 requests | Varies with the painting chosen for the first visit (one run read 1397 KB, because that painting is 480 KB). |
| Largest files | `aditya.jpg` 196 KB, `three.module.js` 172 KB (requested at 3.35 s, idle time), `destruction-of-pompeii.webp` 128 KB, `isle-of-the-dead.webp` 89 KB | same files | Before, the portrait was requested at 493 ms, before the first painting finished. After, on a 1440x900 desktop load it is first requested at 4858 ms (after the loader) and shows on the intro card when it opens. |

---

## Decisions so far

| Decision | Round | Why |
| --- | --- | --- |
| Side panels are floating cards over a blurred hero, reachable only from the hero | 0, 1 | They should feel like one page, not three. |
| Loader plays once per session | 0 | Returning visitors should not wait twice. |
| Painting changes every 15 to 20 s with a liquid-glass sweep | 1 | Asked for directly. |
| Books: option B, the 3D shelf; videos: option B, the wall | 1 | Asked for directly. |
| Two expandable blocks below the hero | 1 | Good UX with live peeks, in-page expansion, Esc, Back and its own link; heavy scenes load only on demand. |
| Logo built from `frag.svg` and `taco.svg`, `#fdfce6`, फ्रैग as outer outline only | 1, 2 | Asked for directly; the mask keeps the designer's original outline exactly. |
| Space Mono for the name and painting caption; no serif in the interface | 2 | Asked for directly. |
| Wall focus moves whole tiles instead of bending pixels | 2 | The lens bent the videos too much; a flat, sharp tile reads as "in focus". |
| Video durations removed everywhere | 1 | Asked for directly. |
| Subscriber counts come from each channel's page header, refreshed by the same sync command as the playlist | 2 | No API key. Reading the first "subscribers" string on the page picks up counts from featured channels, so the parser must read the channel header. |
| Book shadows are per-book soft shadows, not a shadow map | 2 | Smooth with the book's motion and cheaper. |
| Interface copy uses no em dashes; the Ohshin and book notes stay placeholders | 0 | Aditya writes those. |
| Wall keeps a very faint blur around the focused video | 2 | Answered after v3. |
| "Watch" opens YouTube in a new tab | 2 | Answered after v3; nothing from YouTube loads until someone clicks. |
| Public repo is `fragtac0/fragtaco-portfolio` | 2 | Answered after v3. |
| Roles line stays "Creative Editor - Side Quests Maxxer" | 2 | Answered after v3. |
| Intro card is two columns (photo left, words right); stacked on phones | 3 | Asked for directly; phones are too narrow for two columns. |
| Nothing below the hero exists, and the page cannot scroll, until the loader finishes | 3 | Asked for directly. |
| Shelf motion uses springs, and late textures upload outside the entrance | 3 | Smoother start to every move, and no upload stalls mid-animation. |
| The build is executed by Sonnet subagents at high effort, one task at a time, with a review after each | 3 | Asked for directly. |
| Commits use the GitHub no-reply address; the history was rewritten to it before the first push | 3 | Answered after the builder check: the repo is public. |
| Hero paintings use 1600 and 2560 px copies; the name and logo do not wait for the first painting; a tap opens a video on touch | 3 | Builder check: smooth on phones and slow connections; matches v4. |
| Load numbers come from `scripts/audit/load-metrics.json`, not Lighthouse | 5 | Lighthouse is not installed and no dependency may be added. |
| The roles line stays the largest contentful paint on a slow phone | 5 | The loader reveals it by design; earlier would change the loader's look. |
| The intro card's portrait loads after the loader | 5 | It was competing with the first painting on slow networks; it still loads sooner when the card is about to open. |

## Open questions

None open. Asked after v3 and answered on 2026-11-02:

1. **Wall blur:** keep the very faint blur on the videos around the focused one.
2. **Watch button:** opens the video on YouTube in a new tab.
3. **Repo:** the new public repo is `fragtaco-portfolio` under `fragtac0`.
4. **Spelling:** "Creative Editor - Side Quests Maxxer", as written.

## Later, not now

- **Substack articles** on the reading side: a horizontal stack of articles beside the vertical book shelf. Design to come in a later round.

## Build

- R31 structure: tokens and one stylesheet per area, shelf and wall engines split, hooks extracted, orphans removed; no visible change (computed styles identical in 12 states).
- R32 dock and page changes: dock reads home and work, home goes to the hero, a quick blur transition between pages (a plain fade with reduced motion), the dock preloads the other page.
- R33 loader and hero: lighter paintings with WebP and blurred placeholders, the first painting chosen on the server and preloaded, the last painting kept between pages, a new painting every 10 seconds, the name animates from first paint, and the page never stays locked past 6.3 seconds even on a slow connection.
- R34 type and layout (part 1): the home page's text now uses one type scale (12, 13, 15, 18 px and the display sizes) and three text strengths (92, 72, 62%) from `tokens.css`; card paragraphs are 15 px at line height 1.7.
- R34 type and layout (part 2): the card rails read 13 px at rest and the cue and caption disappear while a card is open; the two blocks have equal space above and below (the dock's band counts below) and the mini shelf is centred and spans the block; counts are pluralised; focus rings show for the keyboard only; the credits portrait is a 17 KB JPEG; the "See the reel" pill reads "See the work".
- R35 shelf: the shelf never opens empty (a flat placeholder of the plank and spines shows until the 3D shelf is ready, which now prepares urgently once the layer is open); books drop straight in; the shelf pans with mouse drag, trackpad, shift+wheel and touch, with a flick and a position marker on narrow screens, and opens at its left end on phones; closing fades the scene before the layer shrinks; the header has a dark fade and the Esc chip is hidden on touch devices.
- R36 wall: alternate columns sit further back (smaller, dimmer, slower), the wall leans gently against the pointer or a drag, other videos from the focused video's channel stay bright with a hairline edge and the chip counts them, tiles fade in from the centre as they load, a dark placeholder shows until the wall is ready, the header hides while a video is open, right-clicks no longer open videos, the hint mentions the keyboard, and a lost graphics context falls back to the plain grid.
- R37 close-out: the video sync is hardened (a bad playlist entry or a corrupt file no longer stops it, the write is atomic, only a 404 stores the lower thumbnail); the keyboard and reduced-motion pass (cue and dock rings, the blocks inert behind an open card, focus back where it came from); the dock fits at 320 px; every deferred review note is fixed or closed with a reason; frame timing measured in 12 scenarios at three setups (none over 20 ms) and load measured on a phone profile; the intro card's portrait loads after the loader; the README is rewritten and this folder is indexed.
