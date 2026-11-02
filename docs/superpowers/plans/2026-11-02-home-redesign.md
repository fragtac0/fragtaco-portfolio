# Home Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the FragTaco home page with the signed-off v4 design: a WebGL painting hero with a once-per-session loader, intro and credits cards to the right and left, and two "My Interests" blocks that open into a three.js book shelf and a WebGL video wall.

**Architecture:** The mockup's engines (paint, cards, wall, shelf) are ported from `docs/redesign/mockups/home-v4.html` into framework-free TypeScript modules with small typed APIs. Pure math and state logic is split into separate modules with unit tests. Thin React components own markup, content and the URL, and start and stop the engines in effects. Content comes from zod-validated JSON in `content/site/`.

**Tech Stack:** Remix 2 (Vite 6), React 18, TypeScript strict, Tailwind v4, zod, three.js 0.169 (new), vitest (new), WebGL1.

**Spec:** `docs/superpowers/specs/2026-11-02-home-redesign-design.md`. The spec names `docs/redesign/mockups/home-v4.html` as the reference implementation: where a task says "port", read that module in the mockup and carry its behaviour and values over exactly, typed. Mockup module locations (line numbers in `home-v4.html`): CSS 11-286 (hero 43-135, dock 136-164, blocks 165-203, layer 204-239, detail 240-262, media queries 263-285); markup 298-443; DATA 445-487; `createPaint` 488-598; paint loop, cycle, loader 599-666; `Cards` 667-742; `Dock` 744-763; blocks 766-793; `XP` 795-834; `Wall` 836-1019; `VOV` 1021-1047; `Shelf` 1049-1323. Lines 37-42 and 1325-1331 are review tooling: never port them.

## Global Constraints

- Node 22, yarn 1 via corepack: prefix every yarn command with `COREPACK_HOME="$HOME/.cache/corepack-alt"`.
- New dependencies allowed: `three@0.169.0`, `@types/three@0.169.0`, `vitest` (latest 3.x). Remove `matter-js` and `@types/matter-js` (Task 4). No other dependency changes.
- No Lenis or any scroll library. No em dashes in new interface copy. No serif in the interface (Lora only painted on book spines).
- Never commit YouTube thumbnails or Open Library covers. Never add the owner's email address to any new file, URL or request.
- Server rendering never touches `window`, `document`, WebGL or three.js. Engines start inside `useEffect`. three.js is only ever loaded with `import("three")`.
- Colours: ink `#050403`, fog `#F5EFE6`, cream `#fdfce6`, accent `#FC4C00`, gilt `#D9A441`. Fonts: Space Mono, IBM Plex Mono, Doto (interface); Tektur and Lora (spine canvases only).
- Animate only `transform`, `opacity`, `clip-path` and shader uniforms. No `backdrop-filter` over moving content. No React state updates per animation frame.
- Every commit is authored and committed as `257250329+fragtac0@users.noreply.github.com` (the repo's local git config, set in Task 0). The owner's Gmail address must not appear in any commit metadata.
- Every commit message starts with its number (`R24.1: ...`) and ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. PR bodies end with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
- Each task ends green: `yarn typecheck`, `yarn lint`, `yarn test`, `yarn build` all pass.

## Review Focus

1. **Resize and rotate mid-animation** (phone rotation while a card is open, the shelf open, or a video open): every engine re-measures on `resize`; an open book or video closes cleanly; nothing is left mispositioned. Pinned in Task 9 (card poses recomputed), Task 14 (shelf `fit` closes the open book) and Task 16 (detail view closes on resize).
2. **Leaving and returning** (tab hidden, Back while the loader runs, navigating to `/work` and back): loops park and resume without jumps; timers are cleared on unmount; no WebGL context leak. Pinned in Task 5 (`paintStep`), Task 7 (loader cancel on unmount) and Task 11 (layer closes on popstate).
3. **Network failures:** a painting, a cover or a thumbnail that fails to load never blocks the loader, the shelf or the wall. Pinned in Task 7 (`nextPainting` skips a failed image), Task 14 (generated cover stays) and Task 15 (`thumbUrl` fallback and atlas skip).
4. **Fast repeated input** (double-click a block, Esc during the layer's grow, swipe both ways quickly): state machines ignore input that does not apply to the current state. Pinned in Task 8 (`heroNav` reducer tests) and Task 11 (`layerReducer` tests).
5. **Deep links and history** (`/#reading` on first load, Back from a layer, `/work` then "the cut"): pinned in Task 5 (`introMode`) and Task 11 (`layerFromHash`).

## How this plan is executed

- **Branches:** `main` is never touched. `redesign/home` is the integration branch. Each part (R24 to R30) is one branch and one PR, stacked: `redesign/r24-foundations` starts from `redesign/home`, `redesign/r25-hero` from `redesign/r24-foundations`, and so on. Each PR targets the previous part's branch. Nobody but Aditya merges. After R30 the controller opens the final PR from `redesign/home` to `main`.
- **Implementers** do the tasks and commit. They do not push or open PRs.
- **The controller** (the session running this plan) does Task 0, reviews each task, and at the end of each part pushes the branch, takes screenshots, and opens the PR with `gh pr create --base <previous branch>`. Screenshots go in `docs/redesign/screenshots/r<NN>-*.jpg` in that part's last commit and are linked from the PR body. Never screenshot the video wall or detail view for the repo (thumbnails).
- **Visual checks:** run the dev server with `COREPACK_HOME="$HOME/.cache/corepack-alt" yarn dev --port 5178 --strictPort` and compare against the mockup served with `python3 -m http.server 5181 --directory docs/redesign/mockups`. The frame sampler in Task 17 measures smoothness.

---

## Part R24: foundations

### Task 0: Publish the repo (controller only)

- [ ] **Step 0:** Rewrite every existing commit's author and committer email to `257250329+fragtac0@users.noreply.github.com` (`git filter-branch --env-filter ... -- --all`), set `git config user.email 257250329+fragtac0@users.noreply.github.com` locally, and confirm `git log --all --format='%ae %ce' | sort -u` shows only the no-reply address.
- [ ] **Step 1:** Create the repo and push: `gh repo create fragtac0/fragtaco-portfolio --public --source . --remote origin`, then `git push -u origin main` and `git push -u origin redesign/home`.
- [ ] **Step 2:** No PR for `redesign/home` yet; it is the integration branch.
- [ ] **Step 3:** `git checkout -b redesign/r24-foundations`.

### Task 1: Test harness and content schemas

**Files:**
- Modify: `package.json` (add `vitest` dev dependency; scripts `"test": "vitest run"`, `"test:watch": "vitest"`)
- Create: `vitest.config.ts` (environment `node`, include `app/**/*.test.ts` and `scripts/**/*.test.ts`)
- Modify: `app/content/schemas.ts`, `app/types.ts`
- Create: `content/site/books.json`
- Modify: `content/site/home.json`
- Test: `app/content/schemas.test.ts`

**Interfaces:**
- Produces (in `app/types.ts`):
  ```ts
  export type BookStyle = "plain" | "band" | "block";
  export interface SiteBook { id: string; title: string; author: string; pages: number; isbn: string; heightIn: number; aspect: number; spine: string; style: BookStyle; note: string }
  export interface SiteVideo { id: string; title: string; channel: string; channelUrl: string; subscribers: string | null; thumb: "sd" | "hq" }
  export interface SiteVideosFile { playlistId: string; syncedAt: string; items: SiteVideo[] }
  export interface SiteCreditsFact { label: string; value: string }
  // SiteCredits gains: role: string; note: string; facts: SiteCreditsFact[]
  // SiteHomeContent becomes: { hero: { name: string; roles: string }; about: { title: string; who: string[]; paragraphs: string[] }; credits: SiteCredits }
  ```
- Produces (in `app/content/schemas.ts`): `BooksSectionSchema` (`{ items: SiteBook[] }`, min 1), `VideosFileSchema`, and the updated `HomeContentSchema`. `spine` must match `/^#[0-9a-f]{6}$/i`; `isbn` must match `/^\d{13}$/`; `heightIn` between 4 and 16; `aspect` between 0.4 and 1.2; video `id` must match `/^[A-Za-z0-9_-]{11}$/`; `subscribers` matches `/^[\d.,]+[KMB]?$/` or is null.

- [ ] **Step 1: Write the failing tests** in `app/content/schemas.test.ts`:
  - `content/site/books.json` parses with `BooksSectionSchema`, has 14 items, and the ids are unique.
  - `content/site/home.json` parses with `HomeContentSchema`; `hero.roles === "Creative Editor - Side Quests Maxxer"`; `about.paragraphs.length === 4`; no string anywhere in the file contains `—`.
  - `BooksSectionSchema` rejects a book with `spine: "red"` and one with `isbn: "123"`.
  - `VideosFileSchema` accepts `{ playlistId: "PLV4vaojDpwnw", syncedAt: "2026-11-02T00:00:00.000Z", items: [{ id: "GrtKxfATyTw", title: "t", channel: "c", channelUrl: "https://www.youtube.com/@c", subscribers: "158K", thumb: "sd" }] }` and rejects the same item with `id: "short"`.
- [ ] **Step 2:** Run `yarn test`. Expected: FAIL (schemas and files missing).
- [ ] **Step 3:** Add vitest and the config. Write `content/site/books.json` from the mockup's `DATA.BOOKS` (same order; `id` is a kebab-case slug of the title; `heightIn` from the 5th column; `note` is `"Placeholder for one or two lines on why this book stays with you."`). Rewrite `content/site/home.json`: `hero: { name: "Aditya Bhoir", roles: "Creative Editor - Side Quests Maxxer" }`; `about: { title: "the cut", who: ["Aditya Bhoir, also FragTaco.", "Creative Editor, Mumbai."], paragraphs: [the four paragraphs from the mockup's intro card, verbatim] }`; `credits`: keep `name`, `image`, `links`; `blurb` becomes the mockup's blurb ("This site began as a fork of ohsh.in, built by Ohshin and rebuilt for the cutting room."); add `role: "Site architect, original build"`, `note` (the mockup's placeholder sentence) and `facts` (the four rows of the mockup's definition list). Update the schemas and types.
- [ ] **Step 4:** Run `yarn test` and `yarn typecheck`. Expected: tests PASS. Typecheck will fail where the old `home.hero.title` / `facts` are used; leave those for Task 4 only if they are inside files Task 4 deletes, otherwise fix them now.
- [ ] **Step 5: Commit** `R24.1: test harness, books and home content schemas`.

### Task 2: Video sync command

**Files:**
- Create: `scripts/youtube.ts` (pure parsers), `scripts/sync-videos.ts` (I/O), `scripts/fixtures/playlist.json`, `scripts/fixtures/channel-header.html`, `scripts/youtube.test.ts`
- Create: `content/site/videos.json` (by running the command)
- Modify: `package.json` (script `"sync:videos": "vite-node scripts/sync-videos.ts"`; `vite-node` comes with vitest)

**Interfaces:**
- Produces (`scripts/youtube.ts`):
  - `extractInitialData(html: string): unknown` (parses `var ytInitialData = {...};`; throws `Error("ytInitialData not found")`)
  - `parsePlaylist(data: unknown): Array<{ id: string; title: string; channel: string; channelUrl: string }>` (path in spec section 11; skips non-video lockups; `channelUrl` is `https://www.youtube.com` + `canonicalBaseUrl`)
  - `parseSubscribers(channelHtml: string): string | null` (first `"content":"X subscribers"` after `"pageHeaderViewModel"`, X matching `[\d.,]+[KMB]?`)
  - `diffVideos(prev: SiteVideo[], next: SiteVideo[]): { added: number; removed: number; changed: number }`
- Produces: `content/site/videos.json` valid under `VideosFileSchema` (Task 1).

- [ ] **Step 1: Make the fixtures.** Fetch `https://www.youtube.com/playlist?list=PLV4vaojDpwnw` once (English `Accept-Language`, desktop Chrome user agent), extract `ytInitialData`, and save a trimmed copy to `scripts/fixtures/playlist.json` keeping only the path down to the first 3 lockups plus one non-video item you add by hand (`contentType: "LOCKUP_CONTENT_TYPE_PLAYLIST"`). Strip every `contentImage` and every URL containing `ytimg` from the fixture. For `channel-header.html`, write by hand a small HTML string containing a featured channel's `"content":"9.9M subscribers"` before `"pageHeaderViewModel"` and `"content":"158K subscribers"` after it.
- [ ] **Step 2: Write the failing tests** in `scripts/youtube.test.ts`:
  - `parsePlaylist(fixture)` returns 3 items; the first is `{ id: "GrtKxfATyTw", title: "Every Type of Mimicry Explained", channel: "daninblue", channelUrl: "https://www.youtube.com/@daninblue" }`.
  - `parseSubscribers(channelHeader) === "158K"` (not `"9.9M"`); returns `null` for `"<html></html>"`.
  - `extractInitialData("<html>")` throws `ytInitialData not found`.
  - `diffVideos` counts one added, one removed and one changed (title differs) correctly on a hand-built pair.
- [ ] **Step 3:** Run `yarn test`. Expected: FAIL (module missing).
- [ ] **Step 4:** Implement `scripts/youtube.ts`, then `scripts/sync-videos.ts`: fetch the playlist (exit 1 and leave the file untouched on failure), fetch each distinct channel page at most 4 at a time (on failure keep the previous `subscribers` for that channel and print a warning), `HEAD https://i.ytimg.com/vi/{id}/sddefault.jpg` per video (`thumb: "hq"` when not 200), validate with `VideosFileSchema`, write `content/site/videos.json` with 2-space indent and a trailing newline, print the `diffVideos` summary.
- [ ] **Step 5:** Run `yarn test` (PASS), then `COREPACK_HOME="$HOME/.cache/corepack-alt" yarn sync:videos`. Expected: about 52 videos written, every item has a channel URL, at most a few `subscribers: null`.
- [ ] **Step 6: Commit** `R24.2: video sync command and videos.json`.

### Task 3: Loaders

**Files:**
- Modify: `app/content/site-content.server.ts` (add `getBooks(): Promise<SiteBook[]>` and `getVideos(): Promise<SiteVideosFile>`, both with `ensureUniqueBy` on `id`), `app/content/loaders.server.ts`
- Test: `app/content/loaders.test.ts`

**Interfaces:**
- Produces: `getHomePageContent(): Promise<{ home: SiteHomeContent; heroPaintings: SiteHeroPainting[]; books: SiteBook[]; videos: SiteVideo[]; navigationItems: SiteNavigationItem[]; socialLinks: SiteSocialLink[] }>`. `facts` is no longer returned.

- [ ] **Step 1: Write the failing test:** `getHomePageContent()` resolves with 14 books, at least 40 videos, at least 20 paintings, and no `facts` key.
- [ ] **Step 2:** Run `yarn test`. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `yarn test`. Expected: PASS.
- [ ] **Step 5: Commit** `R24.3: home loader returns books and videos`.

### Task 4: Assets, fonts, and removing the old about section

**Files:**
- Create: `app/components/home/hero/fragtaco-lockup.svg` (copy of `docs/redesign/assets/fragtaco-lockup.svg`), `public/portraits/aditya.jpg` (copy of `docs/redesign/mockups/assets/aditya.jpg`), `public/paintings/1600/*.jpg` and `public/paintings/2560/*.jpg` (for every non-missing painting: `sips -Z 1600 -s formatOptions 82` and `sips -Z 2560 -s formatOptions 82` into those folders), `scripts/make-painting-sizes.sh` (the two sips loops, so new paintings get the same treatment)
- Modify: `app/root.tsx` (Google Fonts URL adds `family=Space+Mono:ital,wght@0,400;0,700;1,400`), `tailwind.config.ts` (`fontFamily.space: ['"Space Mono"', "monospace"]`), `app/routes/_index.tsx`
- Delete: `app/components/home/about-section.tsx`, `fact-shuffler.tsx`, `pill-physics.tsx`, `credits-card.tsx`; the `[data-dragging]` rule in `app/styles/tailwind.css`; `matter-js` and `@types/matter-js` from `package.json`; `aboutProfileTags` and `surfaces.aboutHeader`, `aboutFooterCard`, `factCard` from `app/config/ui.ts` if nothing else uses them (check `/work`).
- Create: `app/components/home/home-page.tsx`

**Interfaces:**
- Produces: `export default function HomePage(props: { home: SiteHomeContent; heroPaintings: SiteHeroPainting[]; books: SiteBook[]; videos: SiteVideo[]; navigationItems: SiteNavigationItem[]; socialLinks: SiteSocialLink[] }): JSX.Element`. For now it renders the existing `HeroSection` (with `title={home.hero.name}`, `subtitle={home.hero.roles}`) and `SiteNav`. Later parts replace its insides.
- `_index.tsx` renders `<HomePage {...data} />` and nothing else.

- [ ] **Step 1:** Make the changes. Run `yarn typecheck`, `yarn lint`, `yarn build`. Expected: all PASS, and `grep -r "matter" app package.json` finds nothing.
- [ ] **Step 2:** Run the dev server; `/` shows the old hero and the dock with no console errors; `/work` is unchanged.
- [ ] **Step 3: Commit** `R24.4: logo, portrait and Space Mono; old about section removed`.
- [ ] **Step 4 (controller):** push, PR `R24: foundations` against `redesign/home`.

---

## Part R25: hero and loader

### Task 5: Hero logic modules

**Files:**
- Create: `app/lib/intro-session.ts`, `app/components/home/hero/painting-cycle.ts`, `app/components/home/hero/paint-gate.ts`, `app/components/home/hero/loader-timeline.ts`
- Test: `app/lib/intro-session.test.ts`, `app/components/home/hero/painting-cycle.test.ts`, `app/components/home/hero/paint-gate.test.ts`, `app/components/home/hero/loader-timeline.test.ts`

**Interfaces:**
- `intro-session.ts`: `INTRO_KEY = "ft:intro-seen"`; `DEEP_LINKS = ["#about", "#reading", "#watching"]`; `introMode(s: { seen: boolean; hash: string; reducedMotion: boolean }): "play" | "skip"`; `INTRO_HEAD_SCRIPT: string` (an inline script that adds `intro` to `<html>` exactly when `introMode` would return `"play"`, wrapped in try/catch so blocked storage means "play").
- `painting-cycle.ts`: `parseFocal(focal: string): [number, number]`; `pickFirst<T extends { id: string }>(items: T[], recent: string[], random: () => number): T`; `makeOrder(length: number, first: number, random: () => number): number[]`; `nextDelayMs(random: () => number): number`; `paintingSrc(file: string, viewportWidth: number, dpr: number): string` (`/paintings/1600/{file}` when `viewportWidth * min(dpr, 1.5) <= 1400`, else `/paintings/2560/{file}`); `RECENT_KEY = "heroRecentPaintings"`, `RECENT_LIMIT = 3`.
- `paint-gate.ts`: `paintStep(s: { pageVisible: boolean; heroOn: boolean; layerOpen: boolean; cardOpen: boolean; active: boolean; sinceLastDraw: number }): "park" | "wait" | "draw"`.
- `loader-timeline.ts`: `LOADER` constants in ms: `{ grow: 60, lettersIn: 160, letterStep: 58, lettersOut: 2000, letterOutStep: 24, logo: 2120, logoFirstLetter: 200, logoLetterStep: 80, reveal: 2800, revealMs: 2000, nameSmall: 4050, roles: 4300, done: 4800 }` and `loaderSchedule(name: string): Array<{ at: number; step: string; index?: number }>` sorted by `at`.

- [ ] **Step 1: Write the failing tests:**
  - `introMode`: `{ seen: false, hash: "", reducedMotion: false }` → `"play"`; seen → `"skip"`; reduced motion → `"skip"`; each of `#about`, `#reading`, `#watching` → `"skip"`; `#other` → `"play"`.
  - `INTRO_HEAD_SCRIPT` run with `new Function("document", "sessionStorage", "location", "matchMedia", INTRO_HEAD_SCRIPT)` against fakes adds the class for the "play" case, not for the "skip" cases, and adds it when `sessionStorage.getItem` throws.
  - `parseFocal("50% 30%")` → `[0.5, 0.3]`; `parseFocal("bogus")` → `[0.5, 0.5]`.
  - `pickFirst` with `recent` holding two of three ids returns the third for any `random`; when all are recent it picks from all.
  - `makeOrder(5, 3, r)` is a permutation of 0..4 starting with 3.
  - `nextDelayMs(() => 0) === 15000`, `nextDelayMs(() => 0.999)` is under 20000.
  - `paintingSrc("a.jpg", 375, 3) === "/paintings/1600/a.jpg"`; `paintingSrc("a.jpg", 1440, 2) === "/paintings/2560/a.jpg"`.
  - `paintStep`: tab hidden → park; hero off → park; layer open → park; card open and not active → park; card open and active → draw; idle and `sinceLastDraw` 20 → wait; idle and 40 → draw; active and 5 → draw.
  - `loaderSchedule("Aditya Bhoir")` has 12 `letterIn` steps, the last `done` step at 4800, and is sorted.
- [ ] **Step 2:** Run `yarn test`. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `yarn test`. Expected: PASS.
- [ ] **Step 5: Commit** `R25.1: hero logic: intro session, painting cycle, paint gate, loader timeline`.

### Task 6: Paint engine

**Files:**
- Create: `app/components/home/hero/paint-engine.ts`

**Interfaces:**
- Produces: `createPaint(canvas: HTMLCanvasElement, opts: { reducedMotion: boolean }): PaintEngine | null` (null without WebGL), with
  ```ts
  interface PaintMeta { focal: [number, number]; zoom?: number }
  interface PaintEngine {
    black(): void;
    reveal(img: HTMLImageElement, meta: PaintMeta, ms: number, done?: () => void): void;
    swap(img: HTMLImageElement, meta: PaintMeta, ms: number, done?: () => void): void;
    setBlur(v: 0 | 1): void;
    busy(): boolean; moving(): boolean;
    pause(now: number): void; resume(now: number): void;
    draw(now: number): void;
    dispose(): void; // deletes textures, buffers and the program, and calls WEBGL_lose_context
  }
  ```
- Port `createPaint` (mockup 488-598) exactly: shaders, `soft()`, `finish()` (dot screen and grain), Ken Burns (`zoomOf`, 21 s, 7%), sweep easing, blur easing `1 - exp(-dt * 6)`, DPR cap 1.5, mipmaps only on WebGL2, highp in both shaders, link-status check that logs the info log.

- [ ] **Step 1:** Port it. Run `yarn typecheck` and `yarn lint`. Expected: PASS.
- [ ] **Step 2:** Verify in Task 7 (it has no visible surface yet).
- [ ] **Step 3: Commit** `R25.2: painting shader engine`.

### Task 7: Hero component and loader

**Files:**
- Create: `app/components/home/hero/hero.tsx`, `app/components/home/hero/lockup.tsx`, `app/components/home/home.css` (the mockup CSS that Tailwind cannot express readably: `.name-big` letters, logo `.gw`/`.gl` transitions, the caption swap, edge glows, `html.intro`, the texture layers `--dots` and `--grain`)
- Modify: `app/root.tsx` (render `<script dangerouslySetInnerHTML={{ __html: INTRO_HEAD_SCRIPT }} />` first in `<head>`), `app/components/home/home-page.tsx` (render `Hero` instead of `HeroSection`)
- Delete: `app/components/home/hero-section.tsx`, `app/components/react-bits/stagger-text.tsx` if unused

**Interfaces:**
- Consumes: Task 5 modules, Task 6 `createPaint`.
- Produces: `Hero(props: { name: string; roles: string; paintings: SiteHeroPainting[]; softened: boolean; onReady: () => void }): JSX.Element` (`softened` blurs and fades the lockup while a card is open), where `onReady` fires once at `LOADER.done` (or immediately when the intro is skipped). It exposes the engine through `HeroHandle` via `forwardRef`: `{ setBlur(v: 0 | 1): void; setParked(reason: "card" | "layer", on: boolean): void }`.
- `Lockup` imports the SVG with `?raw` and injects its inner markup; the loader adds and removes the `in`/`reset` classes and per-group `transition-delay` exactly as `playLoader` does.

- [ ] **Step 1:** Port the hero markup (mockup 298-317), the loader (`playLoader`), the paint loop (`requestAnimationFrame` loop using `paintStep`), the cycle (`nextPainting`, `preloadNext`, `scheduleNext`, `setCaption`) and the caption and cue. Paintings load from `/paintings/{1600|2560}/{file}` (`paintingSrc` below). A failed image load skips to the next painting. The name and logo do not wait for the first painting: the reveal step waits for it (at most 8 s, then the next painting in the order), and every later step shifts by the wait. All timers and the loop are cleared on unmount; `dispose()` is called. When the intro is skipped, render the final state directly (name, logo, roles, caption visible; painting revealed with `reveal(img, meta, 0)`). Set `sessionStorage[INTRO_KEY] = "1"` when the loader finishes. Remove `intro` from `<html>` at `LOADER.done`.
- [ ] **Step 2:** Run typecheck, lint, test, build. Expected: PASS.
- [ ] **Step 3: Visual check** against the mockup at 1440x900 and 375x812: the loader sequence and timings match; scrolling is impossible until 4.8 s; nothing below the hero shows before then; a second load in the same tab skips the loader; `/#reading` skips it; the caption sits above the dock under 1180 px; the logo glow and the frag outline match. No console errors.
- [ ] **Step 4: Commit** `R25.3: hero and loader`.
- [ ] **Step 5 (controller):** screenshots `r25-hero-desktop.jpg`, `r25-hero-phone.jpg`; push; PR `R25: hero and loader` against `redesign/r24-foundations`.

---

## Part R26: cards, gestures and dock

### Task 8: Card and navigation logic

**Files:**
- Create: `app/components/home/cards/card-pose.ts`, `app/components/home/cards/hero-nav.ts`
- Test: `app/components/home/cards/card-pose.test.ts`, `app/components/home/cards/hero-nav.test.ts`

**Interfaces:**
- `card-pose.ts`: `type Side = "left" | "right"`; `type Mode = "hidden" | "rest" | "open"`; `restScale(vw: number): number` (0.5 under 700, else 0.56); `cardMargin(vw: number, width: number): number`; `cardPose(p: { side: Side; mode: Mode; vw: number; width: number; rail: number; hot: boolean }): { x: number; s: number }` (mockup `pose`, 667-742); `dragProgress(dx: number, width: number, sign: 1 | -1): number`; `SETTLE_AT = 0.3`.
- `hero-nav.ts`: `type NavState = "hidden" | "hero" | "left" | "right"`; `type NavInput = { kind: "show" } | { kind: "hide" } | { kind: "key"; key: "ArrowLeft" | "ArrowRight" | "Escape" } | { kind: "swipe"; dir: "left" | "right" } | { kind: "go"; to: "hero" | "left" | "right" } | { kind: "toggle"; side: "left" | "right" }`; `heroNav(state: NavState, input: NavInput, ctx: { heroVisible: boolean; layerOpen: boolean }): NavState`.

- [ ] **Step 1: Write the failing tests:**
  - `cardPose`: right/rest at vw 1440, width 778, rail 100, not hot → `{ x: 1440 - 56, s: 0.56 }`; hot moves it 14 px further in; right/open → `{ x: 1440 - 778 - 64.8, s: 1 }`; left/open at vw 375, width 315 → `{ x: 30, s: 1 }` (centred); hidden is off screen on both sides.
  - `heroNav`: from `hero`, ArrowRight → `right`, ArrowLeft → `left`; from `right`, ArrowLeft → `hero` and Escape → `hero`; from `right`, ArrowRight → `right`; any input while `hidden` except `show` → `hidden`; any key while `layerOpen` → unchanged; any key while `!heroVisible` → unchanged; swipe `left` (finger moves left) from `hero` → `right`; `toggle right` from `right` → `hero`.
- [ ] **Step 2:** Run tests. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run tests. Expected: PASS.
- [ ] **Step 5: Commit** `R26.1: card poses and hero navigation state`.

### Task 9: The cards

**Files:**
- Create: `app/components/home/cards/hero-cards.tsx`, `app/components/home/cards/intro-card.tsx`, `app/components/home/cards/credits-card.tsx`, `app/components/home/cards/use-card-gestures.ts`
- Modify: `app/components/home/home-page.tsx`, `app/components/home/home.css`

**Interfaces:**
- Consumes: Task 8, `HeroHandle` (Task 7).
- Produces: `HeroCards(props: { about: SiteHomeContent["about"]; credits: SiteCredits; nav: NavState; dispatch: (i: NavInput) => void })`. `HomePage` owns `const [nav, dispatch]` (a `useReducer` over `heroNav`). When `nav` changes it calls `heroHandle.setBlur(open ? 1 : 0)` and `heroHandle.setParked("card", open)`, and passes `softened={open}` to `Hero`, where `open` is `nav === "left" || nav === "right"`.

- [ ] **Step 1:** Port the card markup (mockup 318-358) and `Cards` (667-742): transforms applied directly to the elements (no React state per frame during a drag), keyboard (window `keydown`), trackpad (`wheel` on the hero with `deltaX` dominant, debounced as the mockup does), touch drag with the card following the finger, scrim click, Esc, focus into `.card-scroll` 500 ms after opening and back to the rail on close, `overscroll-behavior: contain` inside the cards, page scroll blocked while a card is open. Intro card: the two-column layout and widths from spec 8.3; portrait `/portraits/aditya.jpg`; "See the reel" links to `/work`. Credits card: `credits.image`, `credits.role`, `credits.blurb`, `credits.note` as the placeholder, `credits.facts` as the definition list, `credits.links`. Recompute poses on `resize`.
- [ ] **Step 2:** Run all checks. Expected: PASS.
- [ ] **Step 3: Visual check** at 1440x900, 1024x768 and 375x812 against the mockup: rest peeks, open sizes, the two-column intro card, swipe on touch emulation, arrow keys, Esc, scrim click, rotation (resize) with a card open.
- [ ] **Step 4: Commit** `R26.2: intro and credits cards with gestures`.

### Task 10: Dock changes

**Files:**
- Modify: `app/components/site-nav.tsx`, `app/components/home/home-page.tsx`

**Interfaces:**
- `SiteNav` gains optional props `home?: { revealed: boolean; hidden: boolean; aboutOpen: boolean; onAbout: () => void }`. On the home page: the dock stays down until `revealed`; it is hidden while `hidden` (the layer is open); "the cut" calls `onAbout` instead of scrolling (`HomePage` scrolls to the top if needed, waits 520 ms when it scrolled, then dispatches `{ kind: "toggle", side: "right" }`) and is active while `aboutOpen`. Without `home`, behaviour on `/work` is unchanged. Arriving at `/#about` opens the intro card (via `introMode` skip plus a dispatch after mount).

- [ ] **Step 1:** Implement. Run all checks. Expected: PASS.
- [ ] **Step 2: Visual check:** the dock rises at 4.8 s with the cards; "the cut" toggles the intro card from the top and from the blocks; from `/work`, "the cut" lands on `/` with the intro card open and no loader.
- [ ] **Step 3: Commit** `R26.3: dock opens the intro card`.
- [ ] **Step 4 (controller):** screenshots `r26-intro-card-desktop.jpg`, `r26-credits-card-phone.jpg`; push; PR against `redesign/r25-hero`.

---

## Part R27: blocks and the layer

### Task 11: Layer logic and the layer

**Files:**
- Create: `app/components/home/layer/layer-state.ts`, `app/components/home/layer/interest-layer.tsx`
- Test: `app/components/home/layer/layer-state.test.ts`

**Interfaces:**
- `layer-state.ts`: `type LayerKind = "reading" | "watching"`; `layerFromHash(hash: string): LayerKind | null`; `type LayerState = { kind: LayerKind | null; phase: "closed" | "growing" | "open" | "shrinking" }`; `layerReducer(s: LayerState, a: { type: "open"; kind: LayerKind } | { type: "grown" } | { type: "close" } | { type: "shrunk" }): LayerState`; `escTarget(s: { bookOpen: boolean; videoOpen: boolean; layer: LayerState }): "book" | "video" | "layer" | null`; `GROW_MS = 660`, `SCENE_DELAY_MS = 680`.
- `InterestLayer(props: { state: LayerState; from: HTMLElement | null; title: string; meta: string; onClose: () => void; children: ReactNode })`. The scene inside is told to start when the phase becomes `open` and to stop on `close`.

- [ ] **Step 1: Write the failing tests:** `layerFromHash("#reading") === "reading"`, `"#x"` → null; `open` while `growing` is ignored; `close` while `closed` is ignored; `grown` moves `growing` to `open`; `escTarget` returns `"book"` before `"layer"`, `"video"` before `"layer"`, and `null` when closed.
- [ ] **Step 2:** Run tests. Expected: FAIL.
- [ ] **Step 3:** Implement the logic, then port `XP` (795-834) and the layer markup and CSS (401-432, 204-239): clip-path grow from the block's rect with `round 44px 20px 44px 20px`, `pushState` on open, `popstate` closes, Esc follows `escTarget`, focus trap, `html.locked`, the hero told `setParked("layer", true)`, the dock hidden, focus returned to the block on close.
- [ ] **Step 4:** Run all checks. Expected: PASS.
- [ ] **Step 5: Commit** `R27.1: the expanding layer`.

### Task 12: The two blocks

**Files:**
- Create: `app/components/home/blocks/interest-blocks.tsx`
- Modify: `app/components/home/home-page.tsx`, `app/components/home/home.css`

**Interfaces:**
- Produces: `InterestBlocks(props: { books: SiteBook[]; videos: SiteVideo[]; onOpen: (kind: LayerKind, el: HTMLElement) => void; onNear: (kind: LayerKind) => void })`. `onNear` fires once per kind when the block comes within 240 px (later parts hook `Shelf.prepare` and `Wall.prepare` to it).

- [ ] **Step 1:** Port the blocks markup (360-385), CSS (165-203) and script (766-793): mini shelf spines from `books` (width `14 + pages * 0.055`, height `heightIn * 21`, ink chosen by spine luminance), mini wall columns from `videos` using `mqdefault.jpg`, `idle` class off screen, the textured section background, "My Interests" target id `below`. The layer opens with an empty placeholder scene for now. Deep link `/#reading` and `/#watching` open the layer after mount.
- [ ] **Step 2:** Run all checks. Expected: PASS.
- [ ] **Step 3: Visual check:** blocks side by side above 860 px, stacked below; the button never covers a preview; the layer grows from each block and shrinks back; Back and Esc close; deep links open.
- [ ] **Step 4: Commit** `R27.2: My Interests blocks`.
- [ ] **Step 5 (controller):** screenshot `r27-blocks-desktop.jpg` (blur the mini wall or crop it out); push; PR against `redesign/r26-cards`.

---

## Part R28: the reading shelf

### Task 13: Shelf math

**Files:**
- Create: `app/components/home/reading/shelf-math.ts`
- Test: `app/components/home/reading/shelf-math.test.ts`

**Interfaces:**
- `INCH = 0.17`; `FRONT = 0.55`; `WALLZ = FRONT - 1.4`; `DROP = 1.5`; `STAG = 0.09`; `introSeconds(count: number): number` (`0.25 + STAG * (count - 1) + DROP`); `bookSize(b: Pick<SiteBook, "heightIn" | "aspect" | "pages">): { H: number; W: number; T: number }` (`H = heightIn * INCH`, `W = H * aspect`, `T = 0.035 + pages * 0.00048`); `dropProgress(elapsed: number, order: number): number` (clamped 0..1); `spring(o: Record<string, number>, key: string, to: number, w: number, dt: number): boolean` (mockup's critically damped spring; returns whether still moving); `fitCamera(p: { fovDeg: number; aspect: number; span: number }): { dist: number; maxX: number }` (`needH = 3.05`, `needW = span + 0.9`, the mockup's formula); `CAMERA = { lookY: 0.88, lift: 0.1, tilt: 0.09, dollyFrom: 1.12, dollyS: 2.6 }`.

- [ ] **Step 1: Write the failing tests:** `introSeconds(14)` ≈ 2.92; `bookSize` for the 11 in, 0.73, 176-page book; `dropProgress(0, 0) === 0`, `dropProgress(10, 13) === 1`; `spring` from 0 to 1 at w 9, dt 1/60 never exceeds 1, reaches 1 within 1.2 s of steps and then returns false; `fitCamera({ fovDeg: 26, aspect: 1.6, span: 1.6 }).dist` ≥ the distance that fits 3.05 units of height; `maxX` is 0 when the shelf fits and positive when `aspect` is 0.46.
- [ ] **Step 2:** Run tests. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run tests. Expected: PASS.
- [ ] **Step 5: Commit** `R28.1: shelf math`.

### Task 14: Shelf engine and reading scene

**Files:**
- Modify: `package.json` (add `three@0.169.0`, `@types/three@0.169.0`)
- Create: `app/components/home/reading/shelf-canvases.ts` (spine, cover, back, top, fore, wood, blob, soft-rect, band canvases), `app/components/home/reading/shelf-engine.ts`, `app/components/home/reading/reading-scene.tsx`

**Interfaces:**
- Consumes: Task 13.
- Produces: `createShelf(els: { canvas: HTMLCanvasElement; blur: HTMLCanvasElement; dim: HTMLElement; info: HTMLElement; hint: HTMLElement }, books: SiteBook[], opts: { fine: boolean; reducedMotion: boolean }): ShelfEngine` with `{ prepare(): Promise<void>; start(): Promise<void>; stop(): void; hasOpen(): boolean; closeBook(): void; focusNext(dir: 1 | -1): void; openFocused(): void; dispose(): void }`. `ReadingScene(props: { books: SiteBook[]; active: boolean; onEngine: (e: ShelfEngine) => void })`.

- [ ] **Step 1:** Port `Shelf` (1049-1323) with the v4 changes exactly (framing, drop-in, springs, late cover queue). Covers load from Open Library at runtime as in the mockup. `prepare()` is called from `onNear("reading")` in idle time. Keyboard: ← and → move a focus highlight along the books (the hover lift), Enter opens, Esc closes (through `escTarget`). Add a visually hidden list of the books for screen readers. Reduced motion: no drop-in (`dropProgress` treated as 1), springs settle immediately. `dispose()` frees geometries, materials, textures and the renderer.
- [ ] **Step 2:** Run all checks; `yarn build` output shows three.js in its own chunk, not in the route's entry chunk.
- [ ] **Step 3: Visual and timing check** at 1440x900 and 375x812: every book fully visible below the header; the drop-in takes about 2.9 s; hover and open ease in and out; open book and note centred as a pair; frame sampler (Task 17 snippet, run by hand here) shows no frame over 20 ms on this machine through opening and the drop-in.
- [ ] **Step 4: Commit** `R28.2: the reading shelf`.
- [ ] **Step 5 (controller):** screenshots `r28-shelf.jpg`, `r28-book-open.jpg`; push; PR against `redesign/r27-blocks`.

---

## Part R29: the watching wall

### Task 15: Wall math

**Files:**
- Create: `app/components/home/watching/wall-math.ts`
- Test: `app/components/home/watching/wall-math.test.ts`

**Interfaces:**
- `SPEED = 7`; `tileSize(vw: number): { cw: number; ch: number; gap: number }` (`cw = vw < 700 ? vw / 2.15 : clamp(vw / 5.2, 230, 380)`, `ch = cw * 9 / 16`, `gap = round(cw * 0.075)`); `columnOffset(t: number, cx: number): number` (`t * SPEED * (cx odd ? -0.72 : 1) + cx * 53`); `atlasLayout(count: number, small: boolean): { cw: number; ch: number; aw: number; ah: number; cells: Array<{ x: number; y: number }> }` (512x288 cells in 4096x2048, or 256x144 in 2048x1024 when small); `thumbUrl(v: Pick<SiteVideo, "id" | "thumb">, size: "sd" | "mq"): string`; `focusWeight(dx: number, dy: number, pitchX: number): number` (`exp(-(dx² + dy²) / (2 * (1.3 * pitchX)²))`); `tileAt(px: number, py: number, grid: { pitchX: number; pitchY: number; offsets: number[] }): { col: number; row: number }` (undisplaced grid, gaps included).

- [ ] **Step 1: Write the failing tests:** `tileSize(1440).cw` ≈ 276.9, `tileSize(375).cw` ≈ 174.4; odd columns drift opposite at 0.72 speed; `atlasLayout(51, false)` has 51 cells, all inside 4096x2048; `thumbUrl({ id: "abc12345678", thumb: "hq" }, "sd")` ends `/hqdefault.jpg`; `focusWeight(0, 0, 300) === 1` and is under 0.05 at 3 pitches; `tileAt` maps a point in a gap to the nearest tile.
- [ ] **Step 2:** Run tests. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run tests. Expected: PASS.
- [ ] **Step 5: Commit** `R29.1: wall math`.

### Task 16: Wall engine, watching scene and video detail

**Files:**
- Create: `app/components/home/watching/wall-engine.ts`, `app/components/home/watching/watching-scene.tsx`, `app/components/home/watching/video-detail.tsx`

**Interfaces:**
- Consumes: Task 15.
- Produces: `createWall(els: { canvas: HTMLCanvasElement; chip: HTMLElement }, videos: SiteVideo[], opts: { fine: boolean; reducedMotion: boolean; onPick: (index: number, rect: DOMRect, key: string) => void }): WallEngine` with `{ prepare(): void; start(): void; stop(): void; freeze(key?: string): void; thaw(): void; hold(v: boolean): void; rectOf(key: string): DOMRect | null; focusNext(dx: number, dy: number): void; openFocused(): void; dispose(): void }`. `VideoDetail(props: { video: SiteVideo | null; fromRect: DOMRect | null; onClose: () => void; wall: WallEngine })`.

- [ ] **Step 1:** Port `Wall` (836-1019) and `VOV` (1021-1047) with their markup and CSS. The faint blur stays on (no toggle; the `toggleBlur` review hook is not ported). "Watch" is `<a href="https://www.youtube.com/watch?v={id}" target="_blank" rel="noopener noreferrer">Watch</a>`. Subscribers line reads `{subscribers} subscribers`, empty when null. The detail view closes on resize. On touch a tap opens the video straight away (no focus or chip), as v4 does. Keyboard: arrows move focus over tiles, Enter opens, Esc closes the detail then the layer. Visually hidden list of videos with links. Reduced motion: no drift, FLIP replaced by a fade.
- [ ] **Step 2:** Run all checks.
- [ ] **Step 3: Visual and timing check** at 1440x900 and 375x812: no 404s in the console; focus grows a flat tile with an orange glow and a lift shadow; neighbours part; chip under the tile; the detail view layout (channel left, subscribers right, title, Watch) and the fly-back into the grid; frame sampler shows no frame over 20 ms while drifting and sweeping.
- [ ] **Step 4: Commit** `R29.2: the watching wall and video detail`.
- [ ] **Step 5 (controller):** no wall screenshots in the repo; describe the checks in the PR body instead; push; PR against `redesign/r28-shelf`.

---

## Part R30: accessibility, reduced motion, fallbacks, performance

### Task 17: Finish

**Files:**
- Create: `scripts/perf/sample-frames.js` (a snippet to paste into the browser console: `sampleFrames(ms: number): Promise<{ n: number; avg: number; p95: number; max: number; over20: number }>`, the same `requestAnimationFrame` sampler used to measure v3 and v4)
- Create: `app/lib/webgl-support.ts` (`hasWebGL(): boolean`, cached)
- Modify: the hero, reading and watching components for the fallbacks; `docs/redesign/feedback-log.md` (a "Build" section with one line per part and the measured table); `docs/redesign/README.md`

- [ ] **Step 1:** Fallbacks without WebGL (spec 8.10): hero `<img>` with a CSS crossfade; reading as a grid of covers with titles; watching as a static grid with the same detail view. Check by forcing `hasWebGL()` to return false.
- [ ] **Step 2:** Reduced motion end to end (spec 8.10), checked with the browser's reduced-motion emulation.
- [ ] **Step 3:** Accessibility pass: keyboard-only walkthrough of hero, cards, blocks, shelf, wall and detail; visible focus everywhere; `yarn lint` (jsx-a11y) clean.
- [ ] **Step 4:** Measure every scenario in spec section 9 at 1440x900 with the sampler and record the table in the feedback log. Expected: average about 8.3 ms at 120 Hz, no frame over 20 ms except one during a painting decode.
- [ ] **Step 5:** Run all checks. Commit `R30.1: fallbacks, reduced motion, accessibility and performance pass`.
- [ ] **Step 6 (controller):** push; PR against `redesign/r29-wall` with the measured table and a checklist for Aditya: mid-range Android phone and integrated-graphics laptop, each scenario smooth (reach the dev server from the phone with `yarn dev --host`). Then open the final PR from `redesign/home` to `main`.
