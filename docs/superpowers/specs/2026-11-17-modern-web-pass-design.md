# The modern web pass (design)

Date: 2026-11-17. Follows round 7 (Tasks 1 to 32). Four tasks (33 to 36), each with one Opus review, on the branch `r7/r59-web-pass` cut from `r7/r58-edge-look`.

## 1. What the owner asked for

On 16 November: "Modern Web Guidance. I have installed this skill - once you are done, make sure you: Modernize legacy code. Perform a security audit of my site and suggest improvements. Improve performance. Using that skill".

On 17 November (structured answers): the pass is done before the release, in one push ("All together"), so the security fixes are applied on the coordinator's judgment and reported to him; the site then goes to `main` and the public link is made live.

The standing rule holds: polish must not change the look. Every change in this pass is checked against pictures of the site before it.

## 2. What the site is today (read from the code on 17 November)

- Remix 2.17 on Vercel (`@vercel/remix` preset), React 18, Node 22. Five pages (`/`, `/work`, `/work/long-form`, `/work/short-form`, `/experience`; `/timeline` redirects) and one endpoint, `POST /api/page-view`, which adds one to a counter in Upstash Redis.
- No sign-in, no cookies, no forms, no user-written content. Content comes from JSON files in the repo.
- **No security headers are set anywhere** (no `vercel.json`, nothing in `entry.server.tsx`). Vercel adds HSTS on its own domain.
- Two HTML sinks, both fed by constants in the code: the intro script in `<head>` (`app/root.tsx`) and the logo's inner SVG (`app/components/home/hero/lockup.tsx`).
- Third parties loaded by a visitor's browser: Google Fonts (two stylesheets and their font files: five interface families, six book-spine families), YouTube thumbnails (`i.ytimg.com`) and Open Library covers (`covers.openlibrary.org`) as pictures and WebGL textures. Links out to YouTube, Instagram, X, GitHub, Gmail, NASA and USGS.
- `POST /api/page-view` accepts a request from any site.
- The public repository's history holds no secret (searched for the Upstash address, key patterns and env files). The Gmail address in `content/` is the site's public contact, by his earlier decision.
- `yarn audit` lists 211 advisory paths; most are in build and test tools. The ones that reach the running site: `@remix-run/server-runtime` (denial of service, fixed in 2.17.5), `@remix-run/router` (open redirect on `//` paths, fixed in 1.23.3), `undici` and `turbo-stream` through Remix, `zod` (fixed in 4.6.6).
- Performance is already worked on: the hero painting is preloaded from the HTML at high priority in WebP at two sizes, route code is split (three.js is its own 684 KB chunk), the dock prefetches the other pages, the spine fonts' stylesheet does not block the first paint. What is left to find is measured in Task 33, not guessed here.
- The legacy scan of `app/` (which covers about a fifth of the guides) found two patterns: an Enter key handler on the video wall's canvas (not a text field, so the rule does not apply) and one hand-made deferred promise (`Promise.withResolvers` fits once the TypeScript `lib` is ES2024).

## 3. Approaches

| Approach | What it is | Trade-off |
|---|---|---|
| A. Report only | Write the three reports, change nothing | No risk to the look; but he asked for the fixes to be applied, and the site would go live with no security headers |
| B. Measured, enforced, verified (chosen) | Measure first; apply what the guides call for where the site has the pattern; enforce the security policies in the same pass, each one proven by an automated run over every page and page change with zero violations; measure again | More work per change; a policy that cannot be proven clean ships in report-only form and is listed for him |
| C. Everything the guides list | Adopt every newer API the guides describe (speculation rules, service worker, cross-origin isolation, Trusted Types everywhere) | Several do not fit (the guide itself says speculation rules are not for single-page navigation; isolation is only for shared memory); risk to the look for no gain |

B is chosen. It is what "All together" and "on my judgment" ask for, and it keeps the rule that nothing is switched on blind.

## 4. The design

### 4.1 Task 33: measure, then the fonts on the site's own origin

1. **Baseline, recorded before any change** on the production build: for each of the five pages at 1440 by 900 and 390 by 844, cold cache: LCP (and its element), CLS, total blocking time and the long animation frames of the first five seconds, bytes and requests by origin and by type, whether the page comes back from the back/forward cache (and the reason if not). One script, `scripts/audit/web-vitals.mjs`, writes `docs/redesign/compare/web-pass/baseline.json`. The page-change gates of round 7 are the baseline for the animations.
2. **Fonts served from the site.** The eleven families come from Fontsource packages (the same open-licensed files Google serves), bundled by Vite with hashed names. The interface faces are linked as today's stylesheet was; the spine faces keep their non-blocking link (`media="print"` switched to `all`). The two Google origins and their `preconnect` links go. The one or two font files that the first screen of each page draws with are preloaded (`as="font"`, `type="font/woff2"`, `crossorigin`); no more than two per page.
3. **The look is unchanged**: pictures of every page before and after, with the fonts loaded, differ by nothing a person can see (text metrics checked by measuring the same headings' boxes before and after: equal to the pixel, or the family, axis or subset is wrong and is fixed).

Why: no third party sees every visitor, the render-blocking request to another origin goes, and the content policy of Task 34 can say `font-src 'self'`.

### 4.2 Task 34: security

1. **Headers on every response** (documents from `entry.server.tsx`; static files from `vercel.json`): `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` (what Vercel already sends for its domain; set by us so a custom domain gets it too), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` switching off every feature the site does not use (camera, microphone, geolocation, payment, usb, and the rest of the list the audit finds unused, plus `focus-without-user-activation=()` only if no page relies on it), `X-Frame-Options: DENY`, `Cross-Origin-Opener-Policy: same-origin-allow-popups`, `Cross-Origin-Resource-Policy: same-origin` on documents and the endpoint.
2. **An enforced content policy with a nonce made per request**: `default-src 'self'`; `script-src 'nonce-…' 'strict-dynamic' 'report-sample'`; `style-src 'self' 'unsafe-inline'` (the pages carry inline style attributes from the server render; scripts are the threat this policy is for); `img-src 'self' data: blob:` plus exactly the picture origins the audit records; `font-src 'self'`; `connect-src 'self'` plus exactly the origins the audit records for texture fetches; `object-src 'none'`; `base-uri 'none'`; `frame-ancestors 'none'`; `form-action 'self'`; `report-to` an endpoint of the site. The nonce reaches Remix's `<Scripts>`, `<ScrollRestoration>`, the intro script and React's own stream scripts. In development the policy is not sent (Vite's dev client needs inline scripts).
3. **A small report endpoint**, `POST /api/csp-report`: accepts bodies up to 8 KB of the two report content types, writes one line per report to the server log with query strings removed from every address, answers 204, stores nothing. It is what makes a regression visible after the release.
4. **Trusted Types**: the logo's inner SVG becomes plain JSX (one sink gone). The policy `require-trusted-types-for 'script'` is first run in report-only form through the whole audit. If the run is clean, or clean after a named default policy that lets through only the one fixed string React itself writes when it makes a script element, it is enforced. If not, it ships as report-only and is listed for him with the violations. No pass-through policy.
5. **The counter endpoint** rejects requests that come from another site (`Sec-Fetch-Site` when present, else `Origin` against the request's own host), before it touches Redis, with `Vary` on the three fetch-metadata headers. A direct request with neither header (a script) still counts: it is a vanity counter with no login to protect; said in the report.
6. **Links and third-party pictures**: every link that opens a new tab carries `rel="noopener noreferrer"`; pictures from YouTube and Open Library are requested with `referrerpolicy="no-referrer"` where that does not break the texture loads.
7. **Dependencies**: Remix to its latest 2.17 patch, Vite to its latest 6.4 patch, `zod` to 4.6.6 or later, and every other advisory that has a fix inside the major version already in use. Advisories left open are listed with why (build tool only, or no fix without a major upgrade).
8. **The proof**: `scripts/audit/security.mjs` loads every page on the production build with the policy enforced, opens both home boxes, plays the wall and the shelf, runs every page change both ways, and fails on any `securitypolicyviolation` event, any console error, any picture or font that did not load, or any missing header. Its record: `docs/redesign/compare/web-pass/security.json`.
9. **The report for him**, `docs/redesign/security-audit-2026-11.md`: each finding with its evidence, what was done, what was left and why, and what only he can do (Vercel project settings such as the deployment protection of previews, the Upstash token's scope, a custom domain's HSTS preload).

Not done, and why: cross-origin isolation (only needed for shared memory); a service worker (no offline case; adds a cache to get wrong); Subresource Integrity (no third-party script or stylesheet is left after Task 33).

### 4.3 Task 35: performance

Ranked by the baseline, not by a list. Known candidates:

1. **Cache lifetimes for the pictures in `public/`** (paintings, the Mars map, grounds, portraits, the stack icons): today they are revalidated on every visit. `vercel.json` gives them `public, max-age=86400, stale-while-revalidate=604800`. The hashed files under `/assets/` keep Vercel's one year, immutable.
2. **Long frames on first load**: every frame over 50 ms in the baseline's first five seconds is traced to its script; work that can be cut into turns yields with `scheduler.yield()` (with the `setTimeout` fallback for Safari), as the glass tiles already do in their own way. Task 20's review passed the home intro's first frames to this pass.
3. **The counter's request** leaves at low priority after the page is idle (`fetch` with `priority: "low"`, `keepalive` kept).
4. **The back/forward cache**: any page that the baseline shows is not restored is fixed if the reason is ours.
5. **Whatever the baseline shows that this list does not**: only with a measured gain, only without a change in the look.

Each change is measured before and after with the same script on the same machine under the timing lock; a change with no measured gain is taken out again. Round 7's page-change gates must hold. The record: `docs/redesign/compare/web-pass/after.json` and a short table in `docs/redesign/performance-2026-11.md`.

Not done, and why: speculation rules (the guide: not for single-page navigation; the dock already prefetches); splitting three.js further or loading it later (it would change when the hero and the boxes appear, which round 7 fixed on purpose) unless the baseline shows it holds back the first paint.

### 4.4 Task 36: modernize

1. The legacy scan's two findings: the Enter handler stays (a canvas, not a text field: the rule's own exception); the deferred promise becomes `Promise.withResolvers()` and the TypeScript `lib` moves to ES2024.
2. A sweep of `app/` and `scripts/` against the `js`, `css`, `html` and `motion` guides: each rule's legacy pattern is searched for; a hit is changed only if the replacement is Baseline widely available (or the guide's fallback is kept), behaviour and look are the same, and the tests still pass. Everything found is listed in `docs/redesign/modernize-2026-11.md`: changed, or left with the reason.
3. `engines.node` and the Vercel project's Node version are made to agree (the project file says 26, `package.json` says 22; the build must be run on the version that ships).
4. The scan is run again on the changed files.

Not in this pass: an accessibility audit (he did not ask for one; the accessibility guide is applied only to code this pass touches); a move from Remix 2 to React Router 7 (a migration, not a polish).

## 5. What must hold

- The look and the motion: before/after pictures of every page at 1440 by 900, 390 by 844 and 320 by 568, and the page-change sheet, show no difference a person can see.
- Round 7's gates: typecheck, lint, tests, build, the page-change frame gates and cost limits, the arrival rules.
- No address of a Vercel preview, no email, no thumbnails or covers in tracked files; no test or app code reads `docs/`.
- Every guide that shaped a change is named in the task's report with its id, so the hand-over can say which guide asked for what.

## 6. The coordinator's calls (he left the decisions to me)

- Enforce, do not only report, wherever the automated run is clean. Cost if wrong: a blocked picture or script on a browser or path the run did not cover; the report endpoint shows it and one header line turns it back to report-only.
- Fonts move to the site's own origin. Cost if wrong: about 300 to 600 KB more in the repo's build output; one commit to go back.
- Trusted Types may ship report-only. Cost: the strongest of the injection defences is watching, not blocking, on a site with no user-written content.
- No accessibility audit in this pass. Cost: listed for him as a possible next round.
