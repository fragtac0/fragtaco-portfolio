# Security audit, November 2026

The security part of the modern web pass (Task 34). Written for the owner: plain words, what was found, what was done, what is left and what only you can do. The proof is a script that anyone can run again, `scripts/audit/security.mjs`; its record is `docs/redesign/compare/web-pass/security.json` (the inventory before any change, and the proof after).

## What the site is, for a security reader

Five pages and one counter. No sign-in, no cookies, no forms, nothing a visitor types in, no content from visitors. The text comes from files in the repository. The one write the site makes is "add one" to a number in Upstash Redis, through `POST /api/page-view`. The only things from other companies that a visitor's browser loads are pictures: YouTube thumbnails (`i.ytimg.com`) and Open Library book covers (`covers.openlibrary.org`, which answers with a redirect to the Internet Archive: `archive.org` and its `ia<number>.us.archive.org` hosts). Since the fonts task (R59.1) the fonts come from the site itself, so no script, stylesheet or font comes from anyone else.

## What the inventory found (before any change)

Run on the production build with a cold browser per page, at 1440 by 900 and 390 by 844: every page, both home boxes opened (by their button and by their deep link), a book and a video opened, the wall and the shelf panned, and all 20 page changes (every page to every other page) plus Back and Forward. 4,068 requests in all.

- Requests to other origins: pictures only (`Image` type): `i.ytimg.com` 1,127, `covers.openlibrary.org` 168, `archive.org` and its subdomains 208. No script, stylesheet, font, fetch or XHR leaves the site. So the policy needs picture origins and nothing else.
- Inline scripts in the server's HTML: the home page has four (the loader's head script, Remix's scroll-restoration script, the `window.__remixContext` data and the module script that starts the app), the other pages three (without the loader's). No inline event handlers.
- Writes of HTML or script text from the browser (found by injecting `require-trusted-types-for 'script'` in report-only form into every document and collecting every report): exactly three, all when a visitor arrives at the home page by a page change, because that is when React builds the page's elements in the browser: the intro script element, its text, and the logo's inner SVG. A first load of any page, and every other page change, wrote none.
- Browser features asked for: none that need a permission. Only canvas and WebGL (2d, webgl, webgl2) and the page's own session and local storage.
- Source: two uses of `dangerouslySetInnerHTML` (the intro script and the logo), no `innerHTML`, `eval`, `document.write`, workers or other HTML sinks.

## Findings

| # | What | Evidence | Risk, in a sentence | Done or left |
| --- | --- | --- | --- | --- |
| S-1 | No security header on any response. | The inventory run: the document, data and static responses carry none (only Vercel's own HSTS on its domain). | A browser had no instruction to refuse framing, type guessing, leaky referrers or unused features. | Done: the header set below, from the server for documents and `vercel.json` for static files. |
| S-2 | No content policy: a script injected into a page would run. | Same run. | The site has no user-written content, so the chance is small, but a policy turns a mistake or a compromised dependency from "runs" into "blocked and reported". | Done and enforced: scripts only with a per-response nonce (and what they load, `'strict-dynamic'`), no `'unsafe-inline'` or `'unsafe-eval'`, no host list for scripts, `object-src 'none'`, `base-uri 'none'`, `frame-ancestors 'none'`, `form-action 'self'`, fonts and fetches from the site only, pictures from the site and the three picture origins above. Enforced only after the proof ran clean (below). |
| S-3 | Two writers of HTML into the page from the browser (the logo's inner SVG, the intro script's element). | The Trusted Types inventory: three reports, all on a page change to the home page. | The strongest defence against injection (Trusted Types) could not be switched on while they existed. | Done: the logo is now React elements made from the same SVG file (the markup and a screenshot of it are byte-identical to before: `scripts/audit/logo-compare.mjs`); the intro script is rendered by the server only and never again by the browser (React would make it inert anyway, and writing its text is what Trusted Types refuses). `require-trusted-types-for 'script'` is enforced, with no policy of the site's own (a pass-through policy would switch the protection off). |
| S-4 | `POST /api/page-view` accepted a request from any website. | Code read: no check. | Any page on the internet could make a visitor's browser raise your counter (the source is already cut to a known list, so the number of keys cannot grow). | Done: a request from another site (`Sec-Fetch-Site` `cross-site` or `same-site`, or an `Origin` that is not the site's own host when the browser sends no fetch metadata) is refused with 403 before anything is read or written, with `Vary: Sec-Fetch-Dest, Sec-Fetch-Mode, Sec-Fetch-Site`. Left on purpose: a direct request with neither header (a script, `curl`) still counts, because the counter is a vanity counter and a header can be faked outside a browser anyway. A limit on how often a script may call it needs a Vercel setting (below). |
| S-5 | No way to see a policy that blocks something it should not, after the release. | New. | A broken policy would fail silently for some visitors. | Done: `POST /api/csp-report` accepts the browser's reports (`application/csp-report` and `application/reports+json`, 8 KB at most), writes one line per report to the server log with every address's query and fragment cut off and the quoted policy (it holds the nonce) left out, answers 204 and stores nothing. Proved end to end: a page that breaks its policy on purpose, over HTTPS, delivered its report in 124 ms and the line reached the log. |
| S-6 | Pictures from YouTube and Open Library were requested with the page's address as the referrer. | Code read: the browser's default sent the page's origin. | The picture hosts learned which page of the site was open (the origin only, no path or query: the default policy already cut that). | Done: `referrerpolicy="no-referrer"` on every picture request to them (`<img>` elements and the loaders of the wall, the shelf and the gallery); the shelf and wall audits show every texture still loads (real covers drawn, the same requests and the same answers as before). |
| S-7 | Links that open a new tab. | Code read: three carried only `rel="noreferrer"`. | Modern browsers already imply `noopener` for `target="_blank"`; older ones let the new page reach back to the opener. | Done: all three (the dock's external links, the work items, the video wall) say `rel="noopener noreferrer"`, like the other three. |
| S-8 | Static files had no `nosniff` and no resource policy. | Same run. | A browser could guess a file's type; another site could embed the site's pictures and scripts. | Done: `vercel.json` gives every path `X-Content-Type-Options: nosniff` and the folders `/assets/` (scripts, styles, fonts), `/paintings/`, `/mars/`, `/grounds/`, `/portraits/` and `/stack/` `Cross-Origin-Resource-Policy: same-origin`. It changes no caching (the performance task does that). Proved by reading the file for each kind of path (remix-serve does not apply it); the controller proves it on a preview deploy. |
| S-9 | Dependencies with known advisories. | `yarn audit` on 17 November: 274 advisory paths (4 critical, 134 high, 114 moderate, 22 low) in 33 packages. | See the list of what reaches the running site, below. | Done where a fix exists inside the major version in use (one commit of its own, R59.2a); the rest is listed below with why. |
| S-10 | Secrets in the public repository's history. | Searched for the Upstash address, key patterns and env files (the spec's section 2): none. | None. | Nothing to do. The Gmail address in `content/` is the site's public contact, by your earlier decision. |

Left alone on purpose (the spec's "not done" list): cross-origin isolation (only needed for shared memory, and it would break the picture hosts); a service worker (no offline case, and it adds a cache to get wrong); Subresource Integrity (there is no third-party script or stylesheet left); `trusted-types` allowlist directive (the site creates no policy, and the directive would only block an extension's).

## The header set as sent

Documents (every HTML response, production only: Vite's development client needs inline scripts):

| Header | Value | What it does |
| --- | --- | --- |
| `Content-Security-Policy` | `default-src 'self'; script-src 'nonce-<new per response>' 'strict-dynamic' 'report-sample'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://i.ytimg.com https://covers.openlibrary.org https://archive.org https://*.archive.org; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'; require-trusted-types-for 'script'; report-to csp; report-uri /api/csp-report` | The policy above. `style-src` keeps `'unsafe-inline'` because the server's pages carry style attributes; the threat the policy is for is script. `data:` and `blob:` pictures are the glass's tiles and the WebP probe. |
| `Reporting-Endpoints` | `csp="/api/csp-report"` | Where `report-to csp` sends reports. |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` | HTTPS only, two years. Vercel sends it on its own domain; set here so a custom domain gets it too. |
| `X-Content-Type-Options` | `nosniff` | No type guessing. |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Other sites see the origin, never a path or query. |
| `X-Frame-Options` | `DENY` | Nobody frames the site (older browsers; the policy's `frame-ancestors` is the same rule). |
| `Cross-Origin-Opener-Policy` | `same-origin-allow-popups` | A window that opens the site cannot reach into it. |
| `Cross-Origin-Resource-Policy` | `same-origin` | Other sites cannot embed the page as a resource. |
| `Permissions-Policy` | `accelerometer=(), autoplay=(), bluetooth=(), browsing-topics=(), camera=(), compute-pressure=(), display-capture=(), encrypted-media=(), gamepad=(), geolocation=(), gyroscope=(), hid=(), identity-credentials-get=(), idle-detection=(), local-fonts=(), magnetometer=(), microphone=(), midi=(), otp-credentials=(), payment=(), picture-in-picture=(), publickey-credentials-create=(), publickey-credentials-get=(), screen-wake-lock=(), serial=(), speaker-selection=(), storage-access=(), usb=(), web-share=(), window-management=(), xr-spatial-tracking=()` | Every feature the inventory saw no use of, off. (`ambient-light-sensor` and `attribution-reporting` were taken out: the browser does not know them and warns.) `focus-without-user-activation` is not set: the site does move focus from scripts. |

Data responses (`?_data=`) and the two endpoints: `X-Content-Type-Options: nosniff`, `Cross-Origin-Resource-Policy: same-origin`, `Referrer-Policy: strict-origin-when-cross-origin`; `/api/page-view` adds `Vary: Sec-Fetch-Dest, Sec-Fetch-Mode, Sec-Fetch-Site`.

Static files (`vercel.json`): `X-Content-Type-Options: nosniff` on every path, `Cross-Origin-Resource-Policy: same-origin` on the six folders above.

## The proof

`BASE=http://localhost:5180 SERVER_LOG=<server log file> node scripts/audit/security.mjs <out.json>` on the production build, with the policy enforced and nothing injected: every page at 1440 by 900 and 390 by 844, cold, both home boxes by button and deep link, a book and a video opened, the wall and the shelf panned, all 20 page changes both ways and six steps of Back and Forward. Result: no `securitypolicyviolation` event (enforced or report-only), no console error or exception, no picture or font that failed to load, no browser warning about a header, every page change settled and the loader's lock never came back on a change to the home page; every header of the set on every document and data response; two responses, two nonces, and every `<script>` of every page carries its own response's nonce; a cross-site POST to `/api/page-view` answers 403 (as does one with a foreign `Origin` and no fetch metadata) and a same-origin one 200; the report endpoint answers 204, 204, 413, 415 and 405 to its five cases; the browser's own report of a deliberate violation reached the log. Run against the build from before the change it fails 107 checks, as it should. The proof ran twice with the same clean result: on the security commit (R59.2) and again on the dependency commit (R59.2a), which is the one recorded in `security.json` (`proof`; the first run's verdict is kept as `proofBeforeDependencyUpgrade`).

What the proof cannot see: remix-serve does not apply `vercel.json` (the static files are checked by reading it), and a local build is not Vercel: whatever Vercel adds to a preview page (its toolbar's script, for one) has no nonce and will be blocked and reported. The pass's controller checks a preview deploy for both.

## Dependencies

The advisories that reach the running site (not only the build or the tests), as found on 17 November:

| Package | Advisory | Fixed in | Status |
| --- | --- | --- | --- |
| `@remix-run/server-runtime` | denial of service through unbounded path expansion in the manifest endpoint (high); a possible CSRF on PUT, PATCH or DELETE document requests (low) | 2.17.5 | Fixed: Remix 2.17.5 |
| `@remix-run/router`, `react-router`, `react-router-dom` | open redirect on a path that starts with `//` (moderate); an open redirect that leads to XSS (6.30.6); an arbitrary constructor through server-render error data (7.x) | 1.23.3, 6.30.6 | Fixed for the redirects: `@remix-run/router` 1.23.4, `react-router` and `react-router-dom` 6.30.6 (pinned together). Left: the constructor-injection advisory on `react-router`, whose only fix is in 7.x (see below) |
| `turbo-stream` | denial of service through reflected input in single fetch (high) | 3.0.0 | Left: Remix 2.17.5 pins `turbo-stream` 2.4.1 and the fix is a new major. The advisory is about Remix's "single fetch", which this site does not switch on |
| `undici` | WebSocket and other denial of service (high, moderate, low) | 6.29.1 | Fixed: `undici` 6.29.1 |
| `zod` | memory exhaustion on oversized constrained collections (high) | 4.6.6 | Fixed: `zod` 4.6.7 |
| `@upstash/redis` | none listed | | Nothing to do |

Everything else was in tools that run on a developer's machine or in the build: Vite and its dev server, esbuild, PostCSS, `@remix-run/dev`'s helpers (tar, lodash, js-yaml, glob, minimatch, brace-expansion), vitest, ESLint and Babel. None of them is in the running site.

### After the upgrade

One commit of its own (R59.2a), inside the major versions already in use, with typecheck, lint, the tests, the build, the round 7 gates and the security proof run after it. `yarn audit` went from 274 advisory paths (4 critical, 134 high, 114 moderate, 22 low) to 60 (3 critical, 20 high, 35 moderate, 2 low).

What moved: Remix (`dev`, `node`, `react`, `serve`) 2.17.4 to 2.17.5; Vite 6.4.1 to 6.4.6 (the one the site builds with, and the one the tests use); `zod` 4.3.6 to 4.6.7; and, by re-resolving the lock file inside the ranges the packages already asked for (no range widened): `undici`, `postcss`, `body-parser`, `compression`, `morgan`, `proxy-addr`, `ws`, `lodash`, `js-yaml`, `valibot`, `postcss-selector-parser`, `brace-expansion`, `@babel/core`, `browserslist`, `baseline-browser-mapping`. Four pins in `package.json` (`resolutions`) force a fix that Remix's own exact pins would otherwise hold back: `@remix-run/router` 1.23.4, `react-router` and `react-router-dom` 6.30.6 (the same patch line, so the site never has two copies of the router), and `qs` 6.16.1 (the same major). Yarn warns that Remix asks for 6.30.4; the pin wins and the build and tests pass.

What is left open, and why (60 paths in 13 packages):

| Package | Where it is | Why it stays |
| --- | --- | --- |
| `tar` (critical, high, moderate), `toml` (high), `glob`, `estree-util-value-to-estree`, `esbuild` (0.17 and 0.21) | `@remix-run/dev`'s build helpers | Build tools; the fix is a new major (or, for esbuild, a new 0.x minor, which is a breaking change); never part of the running site. |
| `tinypool` (critical), `vitest`, `@vitest/mocker`, `vite` 5.4 (the copy the vanilla-extract helper of `@remix-run/dev` brings) | the test runner and a build helper | Tests and build only; the fixes are majors. |
| `minimatch` | ESLint's TypeScript helpers | Lint only; the fix is a new major. |
| `ajv` 8.6.3 | `@vercel/static-config`, which reads the Vercel config at build | Pinned exactly by that package; forcing it onto ESLint's copy broke ESLint, and a build-time schema check is not exposed to visitors. |
| `turbo-stream` 2.4.1 (high) | Remix's client and server data encoding | Pinned exactly by Remix 2.17.5; the fix is 3.x. The advisory is about "single fetch", which the site does not use. |
| `react-router` 6.30.6 (moderate) | Remix's router | The only fix is in 7.x, a migration the spec rules out of this pass. The advisory is about error data that the server sends in the page and the client then rebuilds; the site's pages carry no user-written data. |

## Only you can do this

These are settings in other companies' dashboards or decisions about the domain; nothing here was changed.

1. **Vercel: Deployment Protection for previews.** Turn on "Standard Protection" (Vercel Authentication) for preview deployments so a preview address is not readable by anyone who guesses or is sent it. Project settings, Deployment Protection.
2. **Vercel: a limit on `/api/page-view`.** The endpoint now refuses other sites' browsers but still counts a script. A rate limit rule (Project, Firewall, a rule on the path `/api/page-view` with a rate limit per IP) would cap that, if the count matters to you.
3. **Upstash: the token's reach.** The site's Redis token can do whatever the database allows. Make a Redis user (Upstash console, Access Control) that may only run `INCR` and `GET` on keys that start with `portfolio:page_views:`, use its token in the Vercel environment variables, and revoke the old one. Never put the token in the repository (it is not there now).
4. **Vercel: environment variables.** `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` should be set for Production and Preview only as needed, and the preview ones should point at a different database, so a preview cannot move the public counter.
5. **A custom domain, when you add one.** The header already carries `includeSubDomains; preload`. Submit the domain at hstspreload.org only when every subdomain you will ever use is served over HTTPS; the listing is hard to undo. The `*.vercel.app` domain is already covered by Vercel.
6. **Watch the report log after the release.** Reports appear in the Vercel runtime logs as lines that start with `csp-report`. A few from browser extensions are normal; a steady stream from a normal browser means the policy blocks something it should not. To go back to report-only, change `Content-Security-Policy` to `Content-Security-Policy-Report-Only` in `app/lib/security-headers.server.ts` (one line in `documentHeaders`) and redeploy.
