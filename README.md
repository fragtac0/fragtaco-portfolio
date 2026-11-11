# FragTaco portfolio

The personal site of Aditya Bhoir (FragTaco), a creative editor in Mumbai. It is a Remix and React app, deployed on Vercel.

The home page is one scene: a public-domain painting that changes every 10 seconds, the FragTaco logo over it, two cards (credits on the left, about on the right) that slide in from the edges, and two blocks below the hero. One opens a 3D bookshelf (reading), the other a wall of videos (watching). A dock at the bottom links home and work.

## Pages

| Route | What it is |
| --- | --- |
| `/` | The home page: loader (once per session), hero, cards, the reading and watching layers. `/#reading` and `/#watching` open a layer directly. |
| `/work` | The work page: an introduction on a dark ground for now. The rotating rings (tools, long form, short form, clients) are being built; see `docs/redesign/`. |
| `/api/page-view` | POST only. Counts a page view in Upstash Redis. |

## Run, test and check

Needs Node 22 and Yarn 1 (`corepack enable` picks the right Yarn from `package.json`).

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

Timing and animation should be judged on the production build (`yarn build`, then `yarn start`), not the dev server.

Environment: copy `.env.example` to `.env.local`. `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are only for the page-view counter; without them the counter shows its baseline and nothing else changes.

## Deploy

The site is on Vercel. Pushing a branch gives a preview deployment, and that is how changes are reviewed. Never run `vercel --prod` (or promote a preview) without the owner's go-ahead. The public review copy is https://fragtaco-portfolio.vercel.app; it is not the live site.

## Content

Everything the pages show comes from files, so most edits need no code.

| What | Where |
| --- | --- |
| Name, roles line, the about card and the credits card | `content/site/home.json` |
| Books on the shelf (title, author, ISBN, size, spine colour, note) | `content/site/books.json` |
| Videos on the wall and channel subscriber counts | `content/site/videos.json`, written by `yarn sync:videos` (do not edit by hand) |
| Hero paintings (title, artist, year, blurred placeholder) | `content/site/hero-paintings.json`; the pictures are in `public/paintings/` |
| The work page (intro, tools, long and short videos, clients; placeholders for now) | `content/site/work.json` |
| Reach out, navigation, social links | the other files in `content/site/`; fields and rules are in [content/README.md](content/README.md) |

Invalid content fails when it is loaded and in the tests (`app/content/schemas.ts`).

### Videos: `yarn sync:videos`

Reads the YouTube playlist and each channel's page (no API key) and rewrites `content/site/videos.json`: titles, channels, thumbnails and subscriber counts. It never stops for one bad entry (it warns and skips it), keeps the previous value when a check fails, and writes the file atomically. Run it, look at the diff, commit `videos.json`.

### Paintings: `yarn paintings`

Re-encodes the originals in `public/paintings/` into the 1600 px and 2560 px WebP and JPEG copies the site loads, and writes each painting's blurred placeholder into `hero-paintings.json`. To add a painting: put the original in `public/paintings/`, add its entry to `hero-paintings.json`, run `yarn paintings`. It exits non-zero if a file is over its size cap.

## Audit and performance tools

- `scripts/audit/`: headless Chrome driven over the DevTools protocol, for screenshots, frame timing and load numbers. A run is a JSON steps file, for example, after `yarn build`, serve the production build with `PORT=5180 npx remix-serve build/server/nodejs-*/index.js` and run `BASE=http://localhost:5180 node scripts/audit/cdp.mjs scripts/audit/measure.json /tmp/out` (`BASE` names that server). Use the production build: `yarn dev` does not hydrate in headless Chrome. How it works, and the quirks of headless timers, are in [scripts/audit/README.md](scripts/audit/README.md).
- `scripts/perf/sample-frames.js`: a snippet to paste into the DevTools console. `await sampleFrames(5000)` resolves `{ n, avg, p95, max, over20 }` for the frames drawn in those 5 seconds. Use it on a phone or a slow laptop through remote debugging.

## The redesign docs

`docs/redesign/` holds the running log of feedback and decisions, the audit, the list of changes and the mockups. Start with [docs/redesign/README.md](docs/redesign/README.md).

## Note on `@vercel/remix`

`yarn install` prints peer-version warnings for `@vercel/remix` 2.16.7 against Remix 2.17.4. They are harmless: the build, the tests and the deployments all work. It is left as it is (audit item K-10) and should be revisited when a `@vercel/remix` preset for Remix 2.17 exists.
