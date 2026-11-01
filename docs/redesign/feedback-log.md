# Home redesign: feedback log

Every round of feedback on the home page redesign, what changed in response, and what is still open. Each round lists the requests as given, then what the next mockup did about them. Newest round is at the bottom.

**Status (2026-11-02):** mockup v3 is in review. No product code has changed yet; the design doc and build plan come after v3 is signed off.

## Contents

1. [Round 0: the brief](#round-0-the-brief-2026-11-01)
2. [Round 1: feedback on v1](#round-1-feedback-on-v1-2026-11-01)
3. [Round 2: feedback on v2](#round-2-feedback-on-v2-2026-11-02)
4. [Decisions so far](#decisions-so-far)
5. [Open questions](#open-questions)
6. [Later, not now](#later-not-now)

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

## Open questions

None open. Asked after v3 and answered on 2026-11-02:

1. **Wall blur:** keep the very faint blur on the videos around the focused one.
2. **Watch button:** opens the video on YouTube in a new tab.
3. **Repo:** the new public repo is `fragtaco-portfolio` under `fragtac0`.
4. **Spelling:** "Creative Editor - Side Quests Maxxer", as written.

## Later, not now

- **Substack articles** on the reading side: a horizontal stack of articles beside the vertical book shelf. Design to come in a later round.
