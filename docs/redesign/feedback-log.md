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
   - [Round 6: feedback on the built preview](#round-6-feedback-on-the-built-preview-2026-11-11) (at the end)
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

### Device check (audit M-05, for Aditya)

Everything above was measured in headless Chrome on a fast laptop. These three checks need real hardware; write down what feels wrong (stutter, a blank panel, a gesture that does nothing, text too small), with the device and page.

| Device | What to try |
| --- | --- |
| A mid-range Android phone (Chrome) | Home: the loader and hero (paintings change every 10 s, no jank); open and close both cards; reading layer: the shelf drag, flick and tap on a book; watching layer: wall drag and tap on a video; `/work`: the rings turn, tap an item, switch All, Long form, Short form, Clients and scroll a view; `/timeline`: pinch to zoom, drag to pan, tap a square. |
| An iPhone in Safari, portrait and landscape | The same list. Landscape with a card open: the card fills the screen and the dock and cue are hidden. Check the dock clears the home indicator, the frosted dock shows the page through it, the page blur between pages plays (or the page just changes if Safari lacks it), and `/work` and `/timeline` do not scroll the page itself. |
| A laptop with integrated graphics (Chrome or Safari) | Hero and cards; shelf drag, flick and tap; wall drag and tap (watch the frame rate); `/work` rings and the four views; `/timeline` zoom with the mouse wheel and with a two-finger trackpad pinch and scroll. |

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
- R38 work page: the old projects page is gone; /work shows four rings turning slowly around a short intro (tools, long form, short form, clients) on a dark moving glow, and a second dock row switches to long form, short form or clients, where the same items travel out of their ring into a flat, browsable grid (links open in a new tab; clients show their socials). Placeholders stand in for real videos and clients. Screenshots: docs/redesign/screenshots/r38-*.jpg.
- R39 timeline: /timeline, reached from the work page's switcher, shows one square per day since 1 December 2020 (2,172 days today), coloured by role, with a legend of the roles and their day counts; it zooms around the pointer (wheel, pinch, + and -, buttons), pans (drag, arrows, trackpad), shows month names and then day numbers as it zooms, and today's square breathes. Screenshots: docs/redesign/screenshots/r39-*.jpg.
- R38 work page (part 1): `content/site/work.json` with placeholder content and its schema; the old work page and everything only it used are removed; `/work` shows the dark ground and the intro with the dock for now.
- R38 work page (part 3): `/work` has the four rings turning round the intro (tools, long form, short form, clients; alternating directions, items upright, hover or focus pauses only that ring), the two drifting glows under the dot screen and grain, and the 500 ms staggered arrival; reduced motion stands everything still.
- R38 work page (part 4): the dock on `/work` has a second row (all, long form, short form, clients, timeline). Choosing a kind pulls its items out of the rings and lays them flat in a scrolling view (long form in a brick pattern, short form taller covers, clients in a loose honeycomb) with a 600 ms staggered travel; the other rings scale out, the tools become a still row at the top right, and the view is in the address (`?view=long`), so Back works and a link opens it directly. Videos show a caption and dim their neighbours on hover; clients show their socials on hover or focus (first tap on touch).
- R39 timeline (part 2): `/timeline` shows one square for each day since 1 December 2020 on one canvas, coloured by role (the last square is today and reads freelance, with a slow pulse; the first day of each role has a notched corner). It opens zoomed out with every day visible; the wheel or a pinch zooms towards the pointer, drag or two fingers pan, `+`, `-`, `0` and the arrow keys work, and two buttons zoom and fit. Month names and year rules appear at 10 px a square, day numbers at 28 px. Hover, tap or Shift with the arrow keys shows the date and role. The label block (gilt) names the page, the dates, the day count and the way back to work, with each role and its days under it. Reached from the work page's switcher; the dock shows work.
- R39.4 final review fixes: the dock's glass blurs again (the view-transition name moved from the header to the pill), dead code and two dependencies removed, the work tab is `aria-current="true"` on `/timeline`, 700 px is desktop in CSS and JS alike, `/work` has a skip link, tabpanel wiring and a `headers` export; the device checklist above is for Aditya's M-05 check.
- R40.1 assets and installs (round 6): `shaders` 4.0.7 is installed and imported nowhere yet; the ObsidianUI gallery source sits unchanged in `vendor/obsidianui/` (excluded from lint and typecheck); the eight stack icons are in `public/stack/` and listed in `work.json`; `work.json` holds 35 long form and 35 short form placeholders; `docs/redesign/credits.md` and `docs/redesign/shaders-notes.md` are new.
- R40 assets and Mars (round 6, part 1): the `shaders` library is installed, the gallery source is kept as a reference copy, all eight app icons on the work page are the real ones from Wikimedia Commons, 35 long form and 35 short form placeholder videos are in place, and the Olympus Mons tile pyramid (13.7 MB, graded orange, summit crater in the middle) is ready for the map page. Check picture: docs/redesign/screenshots/r40-mars-grade.jpg.
- R41.1 page changes and the lag (round 6): every move between pages, Back and Forward included, goes through one module (`app/lib/page-change.ts`); the router loads the next page's data while the old page stays live and only then starts the transition, so the screen no longer freezes for the network round trip; the full-screen blur is gone (for now a plain 200 ms crossfade; the glass reveal is a later part); the rings, the painting engine and the painting upload start after the change is over, with the last painting already on screen. Measured at 1440 by 900, dpr 2: with the CPU slowed 4 times the worst frame is about 50 to 130 ms (it was 150 to 280 ms), and with no slowdown it is 33 to 67 ms; what is left is the new page being built while the browser holds its picture (see the report).
- R41.2 the work dock's second row (round 6): it no longer arrives oddly during a page change; it is closed in both pictures of the change (so the dock keeps one size and stays still), and opens 140 ms after the change is over, by height and opacity over 260 ms (no animation under reduced motion).

## Round 5: final status (11 November 2026)

- Built: R31 to R39 (polish pass of the home page, the new work page, the timeline page), Tasks 0 to 25 of the plan, each reviewed by Opus, then one whole-branch review and one fix wave (the dock's glass blur, lost since R32, is back).
- Pull requests, stacked, to merge in order: #7 R30, #8 R31, #9 R32, #10 R33, #11 R34, #12 R35, #13 R36, #14 R37, #15 R38, #16 R39.
- Preview (Vercel, behind Vercel sign-in): https://fragtaco-portfolio-mnh4409tz-workfragtaco-gmailcoms-projects.vercel.app . The public link https://fragtaco-portfolio.vercel.app still shows the old version; nothing was deployed to production.
- Comparison page: `docs/redesign/compare/index.html` (open from disk; rows marked "not stored in the repo" need the local images in `compare/local/`).
- Measured: see the measured table above (every scenario 0 frames over 20 ms in headless Chrome; LCP 5.0 s on the slow 4G phone profile because the loader reveals the roles line by design).
- Waiting for Aditya: the device checks in the table above; real videos, covers, clients and the intro line in `content/site/work.json`; the role dates in `content/site/timeline.json`; whether a Mac mouse wheel should zoom the timeline; the variations in spec section 8.

## Round 6: feedback on the built preview (2026-11-11)

Given after looking at the local preview of the round 5 build. Design outline: [2026-11-11-round6-design.md](../superpowers/specs/2026-11-11-round6-design.md). Build plan: [2026-11-11-round6.md](../superpowers/plans/2026-11-11-round6.md).

**Asked for**

Order of work: get every asset and install first, then fix the bugs, then build the features. Fable analyses, asks and plans; Sonnet builds; Opus oversees.

Work page
- The stack marks become the real app icons, and sit a little further from the centre. Every radius grows.
- Everything should overflow the screen like the Vitra chairs page, so the amount of work feels massive. More videos, wider, two layers each of long form and short form, larger thumbnails. Try alternating layers against two and two.
- Remove the clients panel and hide clients on the whole site for now. The focus is long form and short form.
- The background looks bad: either flat or with real depth. Install the `shaders` library and find something better with the design skills.
- The bottom row reads Long form, Short form, My experience. No All tab, no Clients tab.
- On the long form and short form views the stack icons at the top right go. Something useful takes that corner.
- Each video wall becomes the ObsidianUI art gallery component: far smaller margins, a very slow movement, a scale small enough that every video is on screen. Not endless like the YouTube wall. Long form the same with its own scale.
- Moving between long form and short form does not go back through the rings. A glass change, or the old videos leave and the new ones scale in.
- The switcher row appears oddly; it should arrive on a slight delay.
- On a phone and on a tablet the ring items overlap with no pattern.

Page changes
- Home to work is buggy and laggy.
- Every page change (home, work, experience and between them) uses the same liquid-glass refraction as the paintings. Find the right use of a radial and a linear reveal.

My experience (replaces the timeline)
- Remove the day grid. Show Olympus Mons on Mars from straight above, peak in the centre, in high resolution, 2D throughout.
- Trace a line toward the mountain that marks the main moments: part-time short form editor (Feb 2021), graduated and full time (Jun 2021), social media manager (Jan 2022), started making YouTube videos and Reels (Sep 2022), content head and producer (Jan 2023, find a better title), interviewed the German embassy's spokesperson at the embassy (Jun 2024), quit and went freelance full time (Dec 2025). Better words for all of it.
- "Now" is a repeating radar ping.
- Two zoom states: zoomed out with the whole mountain and small markers; zoomed in, moving around like Google Earth.
- A separate layer can point out places on and around the mountain.
- Zoomed out: "My experience" at the top left with a short description of the path from engineer to editor to content producer to full-time freelancer, and the mountain's name with the tallest-peak fact, like the painting captions.
- Sent while the plan was being written: use a good orange picture of the mountain, not a brown one, so it belongs on the site; add an elliptical blur on all the edges so the eye stays on the middle.
- The point of the page: a lot of interests, a jack of all trades.

YouTube wall
- The glow is too much. Tone it down; balance.
- A subtle fish-eye warp at the borders.
- No more lifting on hover. A large wall, a very small proximity effect on hover, and only on click does the chosen video take the centre with its title, subscribers and the rest below while the others move apart (reference: a museum collection wall).

Book shelf
- Keep the 3D books but lay the spines out flat, face on, large (reference: a row of scanned spines). On click the book lifts up, not out, and shows its cover as a 3D object.
- Real spine pictures would be best. Brighter, less contrasty lighting; it should feel like a nice space.

Whole site
- Dark and orange is right, but it must not feel sad, depressing or over-saturated. Keep the contrast; fix the overall feel.

**Answers to questions (2026-11-11)**

| Question | Answer |
| --- | --- |
| Which apps get real icons | The 8 already shown: Premiere Pro, After Effects, Final Cut Pro, Blender, Photoshop, Illustrator, Figma, Lightroom |
| Real videos or placeholders | Placeholders, 30 to 40 of each kind (60 was too many) |
| Top-right corner on the video walls | A return mark that goes back to the rings |
| Background | Deep and layered |
| Where "now" sits | Part-way up, still climbing |
| Route shape | Follows the terrain; it must not reach the peak ("I am still early in my career") |
| Names in the copy | First company was Bharat in Germany; left in Dec 2025 to freelance |
| Where the story starts | 2017: IIT (crossed out), started engineering at VESIT, Mumbai |
| Wall depth | One flat plane; the two depth planes and the lean from round 5 go |
| Book spines | Designed spines for now; photos can replace them later, one image per book |
| Site mood | Warmer, cleaner darks: neutral warm charcoal grounds, cream carries the light, orange only for accents, glows cut back |
| Review step | Plan, then build straight away |
| Company name | "Bharat in Germany" is confirmed, as written in the experience words |
| Wording of the moments | Will be revised later; build with the words in the design outline, all kept in `content/site/experience.json` so a later edit touches only that file |
| App icons | Real icons for as many of the 8 as possible: the vendor's product page, press or brand kit, its App Store or Mac App Store listing artwork, or Wikimedia Commons all count; never redrawn by hand; the two-letter mark only when none of those gives a usable file |

**My calls (say if any is wrong)**

- Long form and short form become their own addresses (`/work/long-form`, `/work/short-form`) and the timeline becomes `/experience`, so one glass page change covers every move. `/timeline` redirects.
- Radial reveal (from the control that was clicked) for moves between sections; linear sweep for the move between long form and short form.
- The ring overlap on phones and tablets is fixed by the ring rebuild, not by a patch to the old layout: items keep a fixed clearance at every width and the outer rings run off the screen.
- At laptop sizes the ring thumbnails grow only a little (about 100 to 115 px wide at 1440 by 900), because 70 upright videos that never overlap need the room. They grow with the screen. The walls show every video.
- Alternating layers (long, short, long, short) ship; the two-and-two order is one constant away and both are photographed for comparison.
- Spines may use serif and script type: they are book art, not interface.
- Real app icons come from the vendor or Wikimedia Commons with the source recorded. Any icon that cannot be sourced that way keeps its two-letter mark and is listed.
- "Bharat in Germany" is read as the company's name for all roles from Feb 2021 to Dec 2025.
- The `shaders` background needs WebGPU; other browsers get a still gradient.
