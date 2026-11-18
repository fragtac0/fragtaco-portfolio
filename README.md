# FragTaco portfolio

The personal site of Aditya Bhoir (FragTaco), a creative editor in Mumbai. It is live at https://fragtaco-portfolio.vercel.app. It is a Remix and React app, deployed on Vercel, and every word and list on it comes from files in this repository.

The site has three pages:

- **Home (`/`).** One scene: a public-domain painting that changes every 10 seconds under the FragTaco logo, an About card and a Credits card that slide in from the edges, and two blocks below the hero. One opens a 3D bookshelf (what he is reading), the other a wall of videos (what he is watching).
- **My portfolio (`/work`, with `/work/long-form` and `/work/short-form`).** Rings of tool icons and video thumbnails turning round a short intro, and two flat walls with every long form and short form video.
- **My experience (`/experience`).** A map of Olympus Mons on Mars with a trail of nine milestones climbing it, in two states: Overview and My climb.

Moving between pages is one slow radial reveal from the centre of the screen. A dock at the bottom links home and work, with a second row on the work pages.

How it was designed and built, round by round, is in [the case study](docs/case-study.md).

## Routes

Every route is in `app/routes/`.

| Route | What it is |
| --- | --- |
| `/` | The home page: loader (once per session, on a direct landing), hero, cards, the reading and watching blocks. `/#reading` and `/#watching` open a block directly. |
| `/work` | My portfolio: the rings (`work._index.tsx`, inside the layout `work.tsx`, which loads the content for all three work addresses). |
| `/work/long-form` | The long form wall: 21 YouTube videos. |
| `/work/short-form` | The short form wall: 35 placeholders for now. |
| `/experience` | My experience, the Mars map. |
| `/timeline` | A permanent redirect (301) to `/experience`. |
| `/work?view=long`, `short`, `clients` | Permanent redirects to the new work addresses (older links). |
| `POST /api/page-view` | Counts a page view in Upstash Redis. Refuses a request that another site's browser makes (403). Other methods answer 405. |
| `POST /api/csp-report` | Takes content policy reports from the browser. Keeps nothing: one line per report goes to the server log with the query and fragment of every address cut off, and the answer is 204. |
| any other path | A 404 page. |

## Run, test and check

Needs Node 22 (`engines.node` is `22.x`) and Yarn 1 (`corepack enable` picks the right Yarn from `package.json`).

```bash
yarn install
yarn dev            # http://localhost:5173
yarn test           # vitest
yarn typecheck      # tsc --noEmit
yarn lint           # eslint, including jsx-a11y
yarn build          # production build
yarn start          # serve the build (run yarn build first)
yarn run check      # typecheck, lint and build in one go (plain `yarn check` is a Yarn built-in, not this script)
```

`yarn install` prints warnings about versions that are pinned on purpose. `resolutions` in `package.json` pin `@remix-run/router` 1.23.4 and `react-router` and `react-router-dom` 6.30.6 (the security fixes that Remix's own exact pins hold back, see [docs/redesign/security-audit-2026-11.md](docs/redesign/security-audit-2026-11.md), "After the upgrade"), plus `qs` and the Vite copies used by the tests. Yarn warns that these are incompatible with what Remix asks for; the build and the tests pass with them. Remove a pin only when Remix itself asks for the fixed version.

Timing and animation should be judged on the production build (`yarn build`, then `yarn start`), not the dev server. The security headers are sent in production only (Vite's dev client writes inline scripts that a content policy would block).

Environment: copy `.env.example` to `.env.local`. `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are only for the page-view counter; without them the counter shows its baseline and nothing else changes (`app/lib/page-views.server.ts`). The Vercel project has no environment variables set as of the release, so the live counter runs at its baseline until the owner sets them.

## Security headers

Every HTML response, including the 404 and error pages, carries a set of security headers. They are set in three places:

| Where | What gets the headers |
| --- | --- |
| `app/lib/security-headers.server.ts`, applied in `app/entry.server.tsx` (production only) | Every document: a content policy with a new nonce for each response, `Strict-Transport-Security`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Cross-Origin-Opener-Policy`, `Cross-Origin-Resource-Policy`, `Permissions-Policy`, `Reporting-Endpoints`. |
| The same file's `INTERNAL_RESPONSE_HEADERS`, used by the two API routes and data responses | `X-Content-Type-Options`, `Cross-Origin-Resource-Policy`, `Referrer-Policy`. |
| `vercel.json` | The static files in `public/`: `X-Content-Type-Options: nosniff` on every path, `Cross-Origin-Resource-Policy: same-origin` on `/assets/` and the picture folders, and a day of cache on the picture folders (below). |

The content policy lets only scripts that carry the response's nonce run (and what they load, with `'strict-dynamic'`), no inline or eval scripts, fonts and fetches from the site only, and pictures from the site and three picture hosts. Trusted Types (`require-trusted-types-for 'script'`) is sent in `Content-Security-Policy-Report-Only`, not enforced; `TRUSTED_TYPES_ENFORCED` in the same file switches it. The reasons, every finding, the full header table and what only the owner can do are in [the security audit](docs/redesign/security-audit-2026-11.md). The proof is `scripts/audit/security.mjs`.

After a release, watch the server log for lines that start `csp-report`. A few from browser extensions are normal.

## Fonts and pictures

The eleven font families are served from the site's own origin: no request goes to Google's font servers. They come from the Fontsource packages (SIL Open Font License, see `public/font-licences.txt`). `yarn fonts` writes `app/styles/fonts-interface.css` and `app/styles/fonts-spine.css` from those packages; re-run it after changing one, and `app/styles/fonts-generated.test.ts` checks that the committed files match.

The only other origins a visitor's browser talks to are for pictures: YouTube thumbnails (`i.ytimg.com`) and Open Library book covers (`covers.openlibrary.org`, which redirects to the Internet Archive). They are listed in the content policy's `img-src` and are requested with no referrer.

The pictures in `public/paintings/`, `mars/`, `grounds/`, `portraits/` and `stack/` are served with `Cache-Control: public, max-age=86400, stale-while-revalidate=604800` (`vercel.json`). A picture changed in `public/` can show to a returning visitor up to a day late.

## Release and deploy

As observed on 18 November 2026, nothing deploys automatically from GitHub. A release is:

1. Merge the work to `main` through a pull request.
2. Deploy `main` to production with the Vercel CLI, only on the owner's go-ahead.
3. Check the live site: `/`, `/work` and `/experience` answer 200, an unknown path answers 404, and the security headers are present.

The release of 18 November 2026 (the redesign, merged as one commit on `main`, then deployed this way) is recorded at the end of [the feedback log](docs/redesign/feedback-log.md).

## Content

Everything the pages show comes from files, so most edits need no code.

| What | Where |
| --- | --- |
| Name, roles line, the about card and the credits card | `content/site/home.json` |
| Books on the shelf (title, author, ISBN, size, colour, optional picture of the spine, note) | `content/site/books.json` |
| Videos on the home wall and channel subscriber counts | `content/site/videos.json`, written by `yarn sync:videos` (do not edit by hand) |
| Hero paintings (title, artist, year, blurred placeholder) | `content/site/hero-paintings.json`; the pictures are in `public/paintings/` |
| The portfolio page (intro, tools, long and short form videos; clients are kept but hidden) | `content/site/work.json`; the long form list is written by `yarn sync:work` |
| My experience (the words, the moments, the Mars map's route and facts) | `content/site/experience.json` |
| Reach out, navigation, social links | the other files in `content/site/`; fields and rules are in [content/README.md](content/README.md) |

Invalid content fails when it is loaded and in the tests (`app/content/schemas.ts`).

### Videos: `yarn sync:videos`

Reads the YouTube playlist and each channel's page (no API key) and rewrites `content/site/videos.json`: titles, channels, thumbnails and subscriber counts. It never stops for one bad entry (it warns and skips it), keeps the previous value when a check fails, and writes the file atomically. Run it, look at the diff, commit `videos.json`.

### Work videos: `yarn sync:work`

Reads `scripts/work-sources.txt` (video ids, and channel handles for every long form upload of a channel) with yt-dlp and rewrites the long form list in `content/site/work.json`. Do not edit those entries by hand; the short form list is placeholders until real links arrive.

### Paintings: `yarn paintings`

Re-encodes the originals in `public/paintings/` into the 1600 px and 2560 px WebP and JPEG copies the site loads, and writes each painting's blurred placeholder into `hero-paintings.json`. To add a painting: put the original in `public/paintings/`, add its entry to `hero-paintings.json`, run `yarn paintings`. It exits non-zero if a file is over its size cap.

### The Mars pictures: `yarn mars`

Rebuilds `public/mars/` (the toned Viking relief in two sizes and the MOLA height picture) from NASA Mars Trek tiles. Only needed if the map's frame changes.

## Audit and performance tools

- `scripts/audit/`: headless Chrome driven over the DevTools protocol, for screenshots, frame timing, load numbers and the security proof. A run is a JSON steps file, for example, after `yarn build`, serve the production build with `PORT=5180 npx remix-serve build/server/nodejs-*/index.js` and run `BASE=http://localhost:5180 node scripts/audit/cdp.mjs scripts/audit/measure.json /tmp/out` (`BASE` names that server). Use the production build: `yarn dev` does not hydrate in headless Chrome. How it works, and the quirks of headless timers, are in [scripts/audit/README.md](scripts/audit/README.md).
- `scripts/perf/sample-frames.js`: a snippet to paste into the DevTools console. `await sampleFrames(5000)` resolves `{ n, avg, p95, max, over20 }` for the frames drawn in those 5 seconds. Use it on a phone or a slow laptop through remote debugging.

## How this was built

The site was redesigned in seven rounds of feedback between 1 and 17 November 2026, then given a modern web pass (fonts, security, performance, modernize) and released on 18 November. Each part was one pull request, built from a written spec and plan and reviewed before it was merged. [The case study](docs/case-study.md) tells the story: what was asked for, what was built, what was tried and taken out, and what is left for the owner. The record behind it is in [docs/redesign/](docs/redesign/README.md): the feedback log, the audits, the specs and plans, the mockups and the before and after pictures.

## Note on `@vercel/remix`

`yarn install` prints peer-version warnings for `@vercel/remix` 2.16.7-patch.1, whose peers are Remix 2.16.7, against Remix 2.17.5. They are harmless: the build, the tests and the deployments all work. It is left as it is (audit item K-10) and should be revisited when a `@vercel/remix` preset for Remix 2.17 exists.
