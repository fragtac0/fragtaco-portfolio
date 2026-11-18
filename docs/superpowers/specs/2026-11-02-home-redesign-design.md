# Home page redesign: design

**Date:** 2026-11-02
**Status:** design signed off (mockup v4). Build plan: `docs/superpowers/plans/2026-11-02-home-redesign.md`.
**Reference implementation:** [`docs/redesign/mockups/home-v4.html`](../../redesign/mockups/home-v4.html). Every behaviour, timing and value in this document comes from that file. Where this document is silent, the mockup is the answer.
**History:** [`docs/redesign/feedback-log.md`](../../redesign/feedback-log.md) has every round of feedback and every decision, with the reason for each.

## 1. What this is

The home page of fragtaco.com, the portfolio of Aditya Bhoir (FragTaco), a creative editor in Mumbai. The home page today is a painting hero over an "about" section with a fact shuffler and a physics pill toy. The redesign replaces it with one cinematic screen and three directions out of it:

- **The hero:** a public-domain painting, revealed through a liquid-glass refraction and changed every 15 to 20 seconds. Over it sit Aditya's name, the FragTaco logo (फ्रैग in outline, TACO solid) and the roles line "Creative Editor - Side Quests Maxxer".
- **Right:** the intro card ("the cut"): a portrait and who Aditya is.
- **Left:** the credits card: Ohshin Bhat, who built the site this one was forked from.
- **Down:** "My Interests": two blocks, reading and watching. Each opens in place into a full-screen scene: a 3D book shelf, and a drifting wall of the 51 videos in Aditya's playlist.

The loader plays once per browser session: the name, then the logo, then the painting opening out of black.

## 2. Why

Aditya wants the first screen to feel like walking into an edit suite with taste, not a résumé. The current home page reads as sections stacked down a page. The redesign makes the home page one place you look around in: left, right, down. The reading and watching scenes show what feeds the work. The page must stay smooth on ordinary phones and laptops, because the people opening it are clients.

## 3. Goals

1. The home page matches mockup v4 in look, motion and behaviour, on desktop, tablet and phone.
2. Navigation from the hero: arrow keys, trackpad horizontal swipe and touch swipe open the cards; Esc, the opposite arrow, or a tap on the blurred hero closes them. Down (scroll, or "My Interests") goes to the blocks.
3. The reading and watching scenes open in place, have their own links (`/#reading`, `/#watching`), close with Esc, Back, or the Close button, and load their heavy code only when needed.
4. Content lives in `content/site/*.json` with zod schemas, like the rest of the site. Videos and subscriber counts refresh with one command and no API key.
5. Smooth: 60 fps on a mid-range phone and an integrated-graphics laptop for every scenario in section 9. Nothing heavy loads until it is about to be seen.
6. Built in public: a new public repo `fragtac0/fragtaco-portfolio`, one PR per part with screenshots, commits numbered on from R23.

## 4. Non-goals

- Substack articles on the reading side (a horizontal stack beside the shelf). Parked for a later round.
- Changes to the `/work` ("reel") page, other than what the shared dock needs.
- Video playback on the site. "Watch" opens YouTube in a new tab.
- A CMS. Content stays in JSON files in the repo.
- Writing the placeholder copy (the Ohshin paragraph and the per-book notes). Aditya writes those; the build ships the placeholders.

## 5. Anti-goals (a failure even if it works)

- Jank: a stutter during the loader, a card opening, the shelf drop-in, or the wall drifting. The client sees the stutter, not the idea.
- Anything below the hero visible or scrollable before the loader finishes.
- Serif type in the interface. (Lora survives only as printed type on the book spines.)
- The फ्रैग outline showing lines where its letters join.
- Videos bending or bulging on the wall. Focus is a flat, sharp tile.
- YouTube thumbnails or the owner's email address added to the repo by this work. Thumbnails load from `i.ytimg.com` at runtime.
- Lenis or any scroll hijacking library.
- Em dashes in new interface copy.

## 6. Constraints

- Stack stays as is: Remix 2 on Vite 6, React 18, Tailwind v4, TypeScript strict, zod, motion. Run yarn with `COREPACK_HOME="$HOME/.cache/corepack-alt"`.
- New dependencies allowed: `three@0.169.0` with `@types/three`, and `vitest` for tests. Nothing else without asking.
- Server rendering must not touch `window`, WebGL or three.js. Every engine starts in an effect, on the client.
- Colours (from `tailwind.config.ts`): ink `#050403`, fog `#F5EFE6`, cream `#fdfce6`, accent `#FC4C00`, gilt `#D9A441`.
- Type: Space Mono for the name, the painting caption, the card blurb, book and video titles; IBM Plex Mono for body text; Doto for display words; Tektur and Lora only painted onto book spines. Space Mono (400, 700, italic 400) is added to the Google Fonts link in `app/root.tsx`.
- The dock is the existing `SiteNav` (bottom glass pill: "the cut", "reel", YouTube, Instagram, X, Mail). The home page keeps a clear band above it (`--dock-clear`: 108 px, 84 px on phones).
- Commits are authored with Aditya's GitHub no-reply address (`257250329+fragtac0@users.noreply.github.com`), never the Gmail address; the existing history is rewritten to it before the first push (Aditya's answer after the builder check). The Mail link, `reach-out.json` and the résumé keep the address: it is the site's public contact.
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; PR descriptions end with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.

## 7. Approaches

Aditya chose the techniques in round 0: a hand-written shader for the painting, three.js for the shelf, a WebGL wall. The question left was how to fit them into the Remix app.

| | Approach | Trade-off |
| --- | --- | --- |
| **A (chosen)** | Port the mockup's engines (paint, wall, shelf, card gestures) as framework-free TypeScript modules with small, typed APIs. Thin React components own the markup, the content and the URL, and start or stop the engines in effects. | Keeps every tuned value and the measured performance of v4. Engines can be unit-tested where they hold pure math. React never re-renders per frame. |
| B | Rebuild in React idioms: React Three Fiber for the shelf, motion components for the cards, a WebGL helper library for the wall. | More familiar React code, but re-derives every timing, adds dependencies, and per-frame React work is the exact jank v3 removed. |
| C | Serve the mockup as a static page. | Fastest, but loses the content system, types, routing and the shared dock; nobody can maintain it. |

**A** is my call: v4 already meets the performance bar on this machine, and porting it keeps what Aditya signed off. The mockup's DOM structure and CSS move into React components and Tailwind (or a co-located CSS file where Tailwind would be unreadable, such as the card and shot transforms).

## 8. The design, part by part

Values here are the important ones; the rest are in the mockup. Section references like *(mockup: Cards)* point at the module of that name in `home-v4.html`.

### 8.1 Loader *(mockup: playLoader)*

- Plays once per browser session (sessionStorage key `ft:intro-seen`). On later loads in the same session, the hero starts in its final state with no animation.
- Timeline: name letters resolve out of a blur (0.16 to 1.7 s) while the name grows from 0.72 to 1 scale over 3.2 s; the name rolls away (2.0 s); फ्रैग rises as one piece, then T, A, C, O stagger in 80 ms apart (from 2.12 s); the painting opens from the centre (2.8 to 4.8 s); the small name returns above the logo (4.05 s); the roles line (4.3 s); at 4.8 s the cards peek in, the dock rises, the caption and cue appear, and the page unlocks.
- Until 4.8 s, the page cannot scroll and nothing below the hero is visible (`html.intro`: `overflow: hidden`, below-hero section `visibility: hidden`, then a 0.9 s fade in). To avoid a flash, `html.intro` is set by an inline script in the document head before first paint, only when the loader will play.
- The name and logo play on time even while the first painting is still downloading. The reveal at 2.8 s waits until that painting is decoded, and everything after it (small name, roles, cards, unlock) shifts by the same wait. If 8 s pass with no painting, the loader moves on to the next painting in the order (my call: the mockup waited for the image before starting anything, which on a slow connection means seconds of black).
- Arriving with `/#about`, `/#reading` or `/#watching` skips the loader and goes straight to that place (my call: a deep link means the visitor wants that thing now).

### 8.2 Hero *(mockup: createPaint, paint loop, nextPainting, setCaption)*

- One WebGL canvas draws everything on the hero (WebGL2 when available, as the mockup does, else WebGL1; under WebGL1 there are no mipmaps for these image sizes, so the card blur falls back to the tint alone): the first reveal from black, each later change as a liquid-glass front sweeping across, a slow Ken Burns drift, the blur behind an open card (a biased mipmap lookup smoothed over five taps, eased in and out), and on top a dot screen (0.6 px dots on a 4 px grid, about 7%) and a static grain. No CSS filter or backdrop blur sits over the canvas.
- The draw loop runs every frame only while something moves (reveal, sweep, blur easing); Ken Burns alone redraws at 30 fps. It parks when the hero is off screen, when the reading or watching layer is open, when the tab is hidden, or when a card is open and the blur has settled.
- Paintings come from `content/site/hero-paintings.json` (22 available). The hero never uploads the 3840 px originals as textures: it uses downscaled copies in `public/paintings/1600/` and `public/paintings/2560/` (longest side, made once with macOS `sips -Z`, quality 82), picking 1600 when `innerWidth * min(devicePixelRatio, 1.5)` is at most 1400 and 2560 otherwise (my call: v4 was tuned on 1600 px copies, and 3840 px uploads stall phones and exceed some phones' 4096 px texture limit). The first painting of the session is random, excluding the last three shown (the existing `heroRecentPaintings` rule). Each `focal` (`"50% 30%"`) becomes the shader's focus point; `zoom` scales the cover fit.
- Changes every 15 to 20 s, skipped while the hero is off screen, the layer is open, or a card is open; the next image preloads during the wait.
- Lockup, centred: small name in Space Mono just above the TACO cap line; the logo; the roles line below in IBM Plex Mono, letter-spaced. The logo is cream `#fdfce6` with a soft dark shadow and a very faint warm glow (`drop-shadow(0 0 22px rgba(255,190,140,.2))`).
- The logo SVG is `docs/redesign/assets/fragtaco-lockup.svg` (viewBox `465 227 1228 296`). फ्रैग is the designer's outline with the overlapping rings cut away by a mask made from its own fill shapes, so only the outer contour shows. The groups `.gw` (फ्रैग, rises as one so its mask moves with it) and `.gl` (each TACO letter) are what the loader animates.
- Caption bottom right in Space Mono: title in italic, artist and year below. It crossfades when the painting changes. Under 1180 px wide it sits above the dock band.
- Cue "My Interests" centred above the dock; it is a button that scrolls to the blocks. Hidden on phones (they scroll).
- Edge glows breathe on both sides while the hero is at rest, hinting that there is something left and right.

### 8.3 Cards and hero navigation *(mockup: Cards)*

- Two cards float over the hero. At rest each peeks in from its edge at 0.56 scale (0.5 on phones), showing only its rail, which carries its name written vertically ("the cut" right, "credits" left). Rails have no arrows.
- Open: the card slides in to full scale (0.72 s, the mockup's ease), the hero blurs (shader blur), the lockup softens (blur 7 px, 38% opacity), a plain 26% ink tint covers the hero, and focus moves into the card.
- Right card (intro): width `clamp(660px, 54vw, 1000px)`, height `min(clamp(520px, 72dvh, 760px), 100dvh - 2 * dock-clear + 24px)`. Two columns: the portrait fills a full-height left column (cropped to the figure, `background-position: 60% 50%`), the words scroll in the right column ("the cut" in Doto, "Aditya Bhoir, also FragTaco. / Creative Editor, Mumbai.", four paragraphs, then "See the reel" and "Esc or ← to close"). Under 700 px: `min(84vw, 360px)` wide, the photo on top (4:3) and everything scrolls together.
- Left card (credits): width `clamp(400px, 27vw, 520px)`; Ohshin's photo, "Ohshin Bhat", "Site architect, original build", the blurb in Space Mono italic, the placeholder paragraph, a definition list (Framework, Styling, Type, Paintings), and links to ohsh.in, GitHub and X.
- Gestures, only while the hero is in view and nothing else is open: ← and → (→ opens the right card from the hero, ← closes it; mirrored for the left), horizontal trackpad swipe (wheel `deltaX`), and touch swipe with the card following the finger and settling past 30% of the way. Esc closes. A click or tap on the blurred hero closes. The page does not scroll while a card is open.
- The dock's "the cut" opens the right card (scrolling to the top first if needed) and shows as active while it is open. "reel" still goes to `/work`.

### 8.4 Dock *(mockup: Dock, and the existing SiteNav)*

The existing `SiteNav` stays, with three changes on the home page: it rises at 4.8 s with the cards (not during the loader); "the cut" opens the intro card instead of scrolling to `#about`; it hides while the reading or watching layer is open. It keeps hiding while scrolling and returning 560 ms after scrolling stops.

### 8.5 My Interests: the two blocks *(mockup: BELOW THE HERO, blocks)*

- Below the hero, on the dotted, grained ink texture: two blocks side by side (stacked under 860 px). Each block has its words at the top and a live preview in its own row below, so the button can never cover the preview.
- Reading: "What I'm reading", a line of copy (counts in the copy come from the data, never hard-coded), and a mini shelf of spines in CSS (no WebGL) that tilt on hover.
- Watching: "What I'm watching", a line of copy, and columns of thumbnails drifting up and down in CSS, faster on hover, paused while the block is off screen.
- The whole block is one button ("Open the shelf", "Open the wall"). Opening grows a full-screen layer out of the block's own shape (clip-path, 0.66 s); the scene fades in after 680 ms.
- When a block comes within 240 px of the viewport, its scene's code and data start loading in idle time (three.js for reading, the wall's atlas for watching), so opening is instant.

### 8.6 The layer *(mockup: XP)*

- Full screen over everything, its own URL (`/#reading`, `/#watching`) pushed onto history. Esc, Back and the Close button all close it, in that layering order (an open book or video closes first). Closing shrinks it back into the block.
- Header: the title in Doto ("What I'm reading" / "What I'm watching"), a count ("14 books this year", "51 videos") hidden on phones, and Close with an Esc hint.
- While open: the page is locked, the hero's paint loop is parked, the dock is hidden, focus is trapped in the layer, and the scene's render loop runs. When closed, the scene stops completely.

### 8.7 Reading: the shelf *(mockup: Shelf)*

- three.js 0.169, imported dynamically so it is its own chunk. Renderer: antialias, alpha, pixel ratio capped at 1.75, ACES tone mapping at 1.12. Hemisphere, key, fill and an accent rim light.
- 14 books standing on a wooden plank in front of a warm-lit wall. Real proportions (trim height in inches times 0.17, cover aspect, thickness from page count). Spines are painted on canvas: the spine colour, grain, title in Lora (plain and band styles) or Tektur (block style), the author's surname in IBM Plex Mono, foil bands. Covers come from Open Library at runtime (`covers.openlibrary.org/b/isbn/{isbn}-L.jpg?default=false`); until one loads, or if none exists, a generated cover is used.
- Shadows: no shadow map. Each book has a soft contact shadow on the plank and a soft shadow on the wall, animated with the book every frame. The plank casts a soft band on the wall below it.
- Framing: the camera fits 3.05 units of height (the tallest book is 11 in) and the shelf's width; it aims at y 0.88. On narrow screens the shelf is wider than the view and drags sideways.
- Entrance: each book falls 1.2 units and fades in over 1.5 s, 0.09 s apart (about 2.9 s in all), while the camera eases in over 2.6 s. Covers that arrive late are uploaded one per frame after the entrance, never during it.
- Hover (fine pointers): the book under the pointer lifts and pulls forward. Click or tap opens it. Hover, opening and the fade of the other books use a critically damped spring (no overshoot, eases in and out).
- Open: the shelf is copied once to a half-resolution canvas, blurred and dimmed in CSS, while the live shelf fades out under it. The open book turns to show its cover, breathes gently, and sits beside its note card ("title", "author, pages", the placeholder note, "Put it back"), the pair centred on screen (60% of the height wide screens, 40% narrow; on phones the note sits at the bottom). Clicking outside the book, Esc or "Put it back" closes it.
- Renders only when something changes.

### 8.8 Watching: the wall and the detail view *(mockup: Wall, VOV)*

- A WebGL1 wall of the 51 thumbnails in columns that drift (alternate columns in opposite directions at 0.72 speed), on the same dotted texture. Thumbnails are packed into a power-of-two atlas with mipmaps (4096 x 2048, 512 x 288 cells; 256 x 144 cells under 700 px), uploaded three per frame. Tile size `clamp(vw / 5.2, 230px, 380px)` (`vw / 2.15` on phones), gap 7.5% of the tile width.
- Focus (fine pointers only; on touch a tap opens the video straight away, as in v4, and the hint reads "Drag to look around. Tap a video to open it."): the focused tile stays flat and sharp, grows about 13%, gains a soft lift shadow and a subtle orange glow; its neighbours move out of the way with a wide, gentle falloff and dim slightly with a very faint blur. Hit testing uses the undisplaced grid, gaps included, so focus never drops between two tiles. A chip below the focused tile shows its title and channel.
- Drag or wheel pans the wall.
- Click opens the detail view: the tile's image flies (FLIP, 0.52 s) to a centred shot over a 95% ink backdrop. Above the shot: the channel name on the left, "{subscribers} subscribers" on the right. Below: the title in Space Mono and a "Watch" button that opens `https://www.youtube.com/watch?v={id}` in a new tab. No description, no duration. While open, the wall freezes, then holds still. Closing (Esc, the close button, a click on the backdrop) flies the shot back into its tile, which eases back into the grid as the wall thaws.
- Thumbnails: `i.ytimg.com/vi/{id}/sddefault.jpg`, or `hqdefault.jpg` where the sync recorded that sddefault does not exist (so the console stays free of 404s).

### 8.9 Texture

The hero, the blocks section, the shelf wall and the video wall share one texture: the dot screen (0.6 px dots on a 4 px grid at 7%) plus a static grain (an SVG turbulence noise at 5%). The hero draws it in its shader; everywhere else it is two static CSS layers. Nothing about it animates.

### 8.10 Accessibility, reduced motion, fallbacks

- `prefers-reduced-motion: reduce`: no loader (final state, 0.4 s fade), no Ken Burns, paintings change by a plain crossfade, cards and layers open without travel, the shelf skips its entrance, the wall does not drift (focus still works), the CSS previews do not move.
- Keyboard: everything reachable by Tab with a visible focus ring; the cards and the layer trap focus while open and return it to where it came from; the wall and the shelf can be browsed with the arrow keys and Enter (my call: the mockup is pointer-first; this adds a roving focus over the same tiles and books). A visually hidden list of the books and of the videos (with links) sits inside each layer for screen readers.
- No WebGL: the hero shows the painting as a plain image with a CSS crossfade; reading shows the books as a simple grid of covers; watching shows a static grid of thumbnails with the same detail view.
- Touch targets at least 44 px.

### 8.11 Responsive

Three widths matter: phones (under 700 px), tablets (700 to 1180 px) and desktops. The mockup's media queries at 700, 860 and 1180 px are the reference. On phones: the cards are 84vw up to 360 px, the rails are 46 px, the cue is hidden (people scroll), the blocks stack, the shelf drags, the wall uses smaller atlas cells.

## 9. Performance

Budget: 60 fps (no frame over 33 ms, average under 17 ms) on a mid-range Android phone and an integrated-graphics laptop, in these scenarios: hero idle, card open and close, painting change, scroll to the blocks, open the reading layer and the shelf entrance, hover along the shelf, open and close a book, open the watching layer, wall drift, hover sweep across the wall, open and close a video.

On the build machine, a frame-timing sampler (`requestAnimationFrame` deltas over each scenario) must show v4's numbers or better: about 8.3 ms average at 120 Hz and no frame over 20 ms, except a single frame while a painting decodes. The two device checks are done by Aditya on real hardware before the last PR merges; the PR lists them as a checklist.

Rules that keep it there: animate only `transform`, `opacity`, `clip-path` and shader uniforms; no `backdrop-filter` over moving content; no React state updates per frame; every loop parks when its scene is not visible; heavy code loads in idle time ahead of need; textures upload in small batches outside animations.

## 10. Content and data

| File | Shape | Notes |
| --- | --- | --- |
| `content/site/home.json` | `hero` is replaced by `{ name, roles }`; `about` gains `title` ("the cut"), `who` (two lines) and keeps `paragraphs` (the four paragraphs from v4); `credits` gains `role`, `note` (placeholder) and `facts` (the four rows). | Copy comes from the v4 mockup, which already has no em dashes. |
| `content/site/books.json` | `{ items: [{ id, title, author, pages, isbn, heightIn, aspect, spine, style, note }] }` | The 14 books in mockup order. `style` is `plain`, `band` or `block`. `note` is the placeholder. |
| `content/site/videos.json` | `{ playlistId, syncedAt, items: [{ id, title, channel, channelUrl, subscribers, thumb }] }` | Written only by the sync command. `thumb` is `sd` or `hq`. |
| `content/site/hero-paintings.json` | unchanged | |
| `public/portraits/aditya.jpg` | 899 x 1200 JPEG | The red-wall photo (copy of `docs/redesign/mockups/assets/aditya.jpg`). |
| `/profile.png` | existing | Ohshin's photo for the credits card. |

`facts.json` is no longer used by the home page (the fact shuffler goes); the file stays in `content/`.

## 11. The sync command

`yarn sync:videos` (Node, TypeScript, no API key) reads `https://www.youtube.com/playlist?list=PLV4vaojDpwnw`:

1. Fetch the playlist page with an English `Accept-Language` and a desktop user agent; parse `var ytInitialData = {...};`.
2. Videos are at `contents.twoColumnBrowseResultsRenderer.tabs[0].tabRenderer.content.sectionListRenderer.contents[0].itemSectionRenderer.contents[*].lockupViewModel`: `contentId` is the video id, `metadata.lockupMetadataViewModel.title.content` the title, and the first metadata row's first part gives the channel name (`text.content`) and its URL (`text.commandRuns[0].onTap.innertubeCommand.browseEndpoint.canonicalBaseUrl`). Keep only `contentType` `LOCKUP_CONTENT_TYPE_VIDEO`.
3. For each distinct channel, fetch the channel page and read the subscriber count from the page header: find `"pageHeaderViewModel"`, then the first `"content":"X subscribers"` after it. (Taking the first match on the whole page picks up featured channels' counts.)
4. For each video, check `sddefault.jpg` with a HEAD request; record `thumb: "hq"` when it is missing.
5. Write `content/site/videos.json` sorted in playlist order, and print a summary (new, removed, changed counts).

Requests run at most four at a time. A failure on one channel keeps that channel's previous count and is reported; a failure to read the playlist exits non-zero and leaves the file untouched.

## 12. Delivery

- New public repo `fragtac0/fragtaco-portfolio`. `main` is pushed as it is (R23 and earlier), then the design work.
- `main` is never touched until the whole redesign is done. `redesign/home` (the design docs) is the integration branch. Each part is one PR, stacked: the R24 branch starts from `redesign/home`, each later part's branch starts from the previous part's branch, and each PR targets the previous part's branch, so it shows only its own part. Aditya merges them in order; a final PR from `redesign/home` to `main` comes after R30 (my call: whatever deploys the site later never sees a half-built home page). Real-device checks use the dev server on the local network (`yarn dev --host`). Parts and numbers:
  - R24 foundations (tests, content, the video sync command and data, logo, fonts, removal of the old about section)
  - R25 hero and loader
  - R26 cards, gestures and dock
  - R27 blocks and the layer
  - R28 reading shelf
  - R29 watching wall and detail
  - R30 accessibility, reduced motion, fallbacks and the performance pass
- Commits inside a part are numbered `R24.1`, `R24.2`, and so on, matching the repo's existing `R18.4` style.
- Every PR has desktop and phone screenshots of what it changed (none showing YouTube thumbnails), and the checks it ran (`yarn typecheck`, `yarn lint`, `yarn test`, `yarn build`).
- `docs/redesign/feedback-log.md` gets a line per merged part.

## 13. Decided

By Aditya: commit emails rewritten to the GitHub no-reply address; the three directions from the hero only; phones swipe the same way; loader once per session; option B for both scenes (shelf and wall); the painting cycle; the logo construction; Space Mono and no serif; flat focus on the wall with a faint blur; "Watch" opens YouTube in a new tab; the repo name and visibility; "Side Quests" as written; two-column intro card; locked page during the loader; shelf framing and slower entrance; the logo glow; Sonnet executes the plan at high effort with periodic checks.

My calls (open to change): approach A; stacked PRs on an integration branch, `main` untouched until the end; downscaled painting copies for the hero; the name and logo not waiting for the first painting; tap opens a video on touch (as v4); deep links skip the loader; Open Library covers at runtime rather than stored; keyboard browsing on the wall and shelf; the no-WebGL fallbacks; `facts.json` kept on disk; vitest for tests.

## 14. Left to the builder

File and component boundaries inside `app/components/home/`; how the mockup CSS splits between Tailwind classes and a co-located stylesheet; the engine APIs' exact names (the plan fixes the ones other tasks depend on); test fixtures; the screenshot tooling.
