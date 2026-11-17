# The Modern Web Pass (Tasks 33 to 36) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Before the release, the site is measured, its fonts come from its own origin, it sends an enforced set of security headers proven clean by an automated run, its measured slow spots are fixed, and its legacy patterns are replaced, with no change in the look.

**Architecture:** Four tasks in order on one branch. Task 33 measures and moves the fonts (so the content policy of Task 34 can be tight). Task 34 adds the headers, the nonce-based content policy, the report endpoint and the endpoint check, and writes the security report. Task 35 fixes what the baseline shows and measures again. Task 36 modernizes. Every task ends with a report that names each Modern Web Guidance guide that shaped a change.

**Tech Stack:** Remix 2.17 (Vite 6, `@vercel/remix` preset), React 18, TypeScript strict, vitest, the CDP audit harness (`scripts/audit/cdp.mjs`, read `scripts/audit/README.md`) against the production build, Vercel (`vercel.json` for static files' headers).

**Spec:** `docs/superpowers/specs/2026-11-17-modern-web-pass-design.md` (read it first; its section 2 is the state of the site, its "not done" lists are binding).

## Global Constraints

- Branch `r7/r59-web-pass`, cut from `r7/r58-edge-look` after Task 32; commits `R59.1`, `R59.2`, ... by explicit paths (never `git add -A` or `commit -a`); never amend or force-push; never push to `main`; never `vercel deploy --prod`.
- The look and the motion do not change. Each task that touches what a visitor sees takes pictures of the five pages before its first change and after its last at 1440 by 900, 390 by 844 and 320 by 568 (generated tiles; real thumbnails only into `docs/redesign/compare/local/`) and the controller looks at them side by side.
- The guides are read with `npx -y modern-web-guidance@latest search "<2 to 5 words>" --skill-version 2026_11_09-5bcc021b` and `npx -y modern-web-guidance@latest retrieve "<id>"`. A change that follows a guide is listed in the task's report as: the guide's id, a short quote of the rule from the retrieved text (never from memory), what was changed. A feature that is not Baseline widely available keeps the fallback its guide gives.
- Round 7's gates hold after every task: `yarn typecheck`, `yarn lint`, `yarn vitest run`, `yarn build`, `page-change.json`, `page-change-hook.json`, `page-change-phone.json` (no frame over 34 ms), `arrival.json`, the glass cost gate's limits (450 ms and 300 ms). Timed runs hold the lock (`lanes-common.md`).
- No address of a Vercel preview, no email address and no token in any tracked file, commit message or pull request. No thumbnails or covers in tracked files. No test or app code reads `docs/`. No em or en dashes in visible copy.
- yarn runs with `COREPACK_HOME="$HOME/.cache/corepack-alt"`. New packages are added with `yarn add` at an exact version and their licence is named in the report.
- Records of this pass go to `docs/redesign/compare/web-pass/`.

## Review Focus

- A visitor whose browser blocks or lacks a feature the policy names (an old Safari without Trusted Types, a browser extension that injects a script): the page still works; the extension's script is blocked and reported, the site's own are not.
- A client-side move to the home page from another page (React creates the intro script element in the browser) under the enforced policy: no violation, no error, the intro does not replay wrongly.
- A font file that fails to load or loads late: the page shows its fallback face and nothing is hidden for more than the swap period; the shelf's spine labels still draw (`shelf-fonts-cold.json`, `shelf-fonts-late.json`).
- A request to `/api/page-view` from another site, with no `Sec-Fetch-Site` header, with a huge `source`: rejected, counted, and cut to the known list, in that order.
- A report sent to `/api/csp-report` that is too large, of the wrong type, or holds an address with a query string: refused, refused, and logged without the query.

Each has its test in the task that owns the code.

---

### Task 33: the baseline, and the fonts on the site's own origin

**Files:**
- Create: `scripts/audit/web-vitals.mjs`, `docs/redesign/compare/web-pass/baseline.json`, `app/styles/fonts.ts` (the list of font stylesheets and the preloaded files), `app/styles/fonts.test.ts`
- Modify: `app/root.tsx` (links), `app/components/spine-fonts.tsx` and its test, `package.json`, `yarn.lock`, `scripts/audit/fonts.json` and the two shelf font audits if they name Google's origins
- Docs: `docs/redesign/README.md` (the fonts' lines), `docs/redesign/changes-2026-11.md` (a row)

**Interfaces:**
- Produces: `web-vitals.mjs` run as `BASE=http://localhost:5180 node scripts/audit/web-vitals.mjs <out.json>`; for each page in `["/", "/work", "/work/long-form", "/work/short-form", "/experience"]` and each size in `[1440x900, 390x844]`, with a cold cache: `{ page, size, lcpMs, lcpElement, cls, tbtMs, longFrames: [{ startMs, durationMs, scripts: [{ url, fn, ms }] }], requests: { byOrigin: { [origin]: { count, bytes } }, byType: { [type]: { count, bytes } } }, bfcache: { restored: boolean, reasons: string[] }, loadAverage }`. Three runs per case; the record keeps all three and the median.
- Produces: `app/styles/fonts.ts`: `INTERFACE_FONT_SHEETS: string[]` and `SPINE_FONT_SHEETS: string[]` (hashed URLs from `?url` imports of the Fontsource stylesheets), `FONT_PRELOADS: Record<string, string[]>` (route id to at most two woff2 URLs).

- [ ] **Step 1: Pictures and numbers before.** Serve the build of the branch's tip on 5180. Take the before pictures (Global Constraints). Write `web-vitals.mjs` with the harness and record `baseline.json` under the lock. Also record which font files each page's first screen uses (the `document.fonts` entries with status `loaded` at LCP time, and the families of the LCP element and the headings): this decides the preloads.

- [ ] **Step 2: Write the failing tests.**

```ts
// fonts.test.ts
it("no page asks another origin for a font or a stylesheet", () => {
  for (const href of [...INTERFACE_FONT_SHEETS, ...SPINE_FONT_SHEETS]) expect(href.startsWith("/")).toBe(true);
});
it("at most two font files are preloaded for a page", () => {
  for (const files of Object.values(FONT_PRELOADS)) expect(files.length).toBeLessThanOrEqual(2);
});
```

In `spine-fonts.test.ts`: the spine stylesheets are linked with `media="print"` and `data-spine-fonts`, and a `<noscript>` copy without the media; no link's `href` holds `fonts.googleapis.com`. In a root test (or the existing one): `links()` holds no `preconnect` and no `https://` stylesheet.

- [ ] **Step 3: Implement.** Add the Fontsource packages for the eleven families with exactly the axes and styles today's two Google stylesheets ask for (read both URLs in `app/root.tsx` and `spine-fonts.tsx`: Doto 400 to 900; IBM Plex Mono 400, 500, 600; Lora 500, 600, 700; Space Mono 400, 700 and 400 italic; Tektur 500 to 800; Archivo with its width and weight axes, upright and italic; Bodoni Moda and Newsreader with optical size and weight, upright and italic; Space Grotesk 300 to 700; Unbounded 300 to 900; Young Serif 400). `font-display: swap` as today. Import each stylesheet with `?url` in `fonts.ts`; link them from `root.tsx` and `spine-fonts.tsx`; drop the two preconnects. Preload the files step 1 found, with `as="font"`, `type="font/woff2"`, `crossOrigin="anonymous"`.

- [ ] **Step 4: The look is the same.** Measure the bounding boxes of every heading, the dock's labels, the hero's lockup lines and three spine labels on each page before and after (fonts loaded, `document.fonts.ready`): equal to the pixel at all three sizes. A difference means a wrong axis, style or subset: fix it, do not accept it. Take the after pictures. Run `fonts.json`, `shelf-fonts-cold.json`, `shelf-fonts-late.json`.

- [ ] **Step 5: Numbers after.** Run `web-vitals.mjs` again to `docs/redesign/compare/web-pass/after-fonts.json`: no request to `fonts.googleapis.com` or `fonts.gstatic.com` on any page; LCP and CLS not worse than the baseline's median by more than the spread of its three runs. If a preload makes LCP worse, take that preload out.

- [ ] **Step 6: Gates, docs, commit** (`R59.1: the baseline of the web pass; the fonts are served from the site ...`). The report names the packages, versions and licences, the guides used (`performance`, and any font guide retrieved), and the numbers before and after.

---

### Task 34: security

**Files:**
- Create: `app/lib/security-headers.server.ts`, `app/lib/security-headers.server.test.ts`, `app/lib/nonce.tsx`, `app/routes/api.csp-report.ts`, `app/routes/api.csp-report.test.ts`, `app/lib/same-site.server.ts`, `app/lib/same-site.server.test.ts`, `vercel.json`, `scripts/audit/security.mjs`, `docs/redesign/compare/web-pass/security.json`, `docs/redesign/security-audit-2026-11.md`
- Modify: `app/entry.server.tsx`, `app/root.tsx`, `app/routes/api.page-view.ts` (and its test, or a new one), `app/components/home/hero/lockup.tsx`, the five link sites that open a new tab, the picture loaders that ask YouTube and Open Library (`wall-thumbs.ts`, `shelf-covers.ts`, `gallery-atlas.ts`, `video-wall.tsx`), `package.json`, `yarn.lock`
- Docs: `docs/redesign/README.md`, `docs/redesign/changes-2026-11.md`

**Interfaces:**
- `security-headers.server.ts`: `makeNonce(): string` (16 random bytes, base64); `contentPolicy(nonce: string, opts: { reportOnlyTrustedTypes: boolean }): { enforced: string; reportOnly: string | null }`; `documentHeaders(nonce: string): Record<string, string>` (every header of the spec's 4.2.1 and 4.2.2 for an HTML response, with `Reporting-Endpoints: csp="/api/csp-report"`); `IMG_ORIGINS` and `CONNECT_ORIGINS` (exact lists, from the audit of step 1).
- `nonce.tsx`: `NonceProvider`, `useNonce(): string | undefined` (a React context; the server wraps `<RemixServer>` in it; in the browser it is undefined).
- `same-site.server.ts`: `isOwnRequest(request: Request): boolean` (true when `Sec-Fetch-Site` is `same-origin` or `none`; false when it is `cross-site` or `same-site`; when the header is absent, true only if `Origin` is absent or its host equals the request's host).
- `api.csp-report.ts`: `action` answers 204 for a POST of `application/csp-report` or `application/reports+json` up to 8192 bytes, logging `console.warn("csp-report", JSON.stringify(cleaned))` where every URL field has its query and fragment removed and the whole line is at most 2000 characters; 413 for larger; 415 for other types; 405 for other methods.

- [ ] **Step 1: Inventory.** With the harness on the production build, record for every page, both home boxes opened, the wall and the shelf played, every page change: every request's origin and type, every inline script in the server's HTML, every use of an HTML sink at run time (run once with `Content-Security-Policy-Report-Only: require-trusted-types-for 'script'` injected through the harness and collect `securitypolicyviolation` events with their samples), and every browser feature asked for. Write it to `security.json` under `inventory`. Run `yarn audit` and group it as the spec's 4.2.7 says.

- [ ] **Step 2: Write the failing tests.**

```ts
// security-headers.server.test.ts
const h = documentHeaders("abc123");
expect(h["Content-Security-Policy"]).toContain("script-src 'nonce-abc123' 'strict-dynamic' 'report-sample'");
for (const d of ["default-src 'self'", "object-src 'none'", "base-uri 'none'", "frame-ancestors 'none'", "form-action 'self'", "font-src 'self'", "report-to csp"])
  expect(h["Content-Security-Policy"]).toContain(d);
expect(h["Content-Security-Policy"]).not.toMatch(/script-src[^;]*(unsafe-inline|unsafe-eval|https:)/);
expect(h["X-Content-Type-Options"]).toBe("nosniff");
expect(h["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
expect(h["X-Frame-Options"]).toBe("DENY");
expect(h["Cross-Origin-Opener-Policy"]).toBe("same-origin-allow-popups");
expect(h["Strict-Transport-Security"]).toBe("max-age=63072000; includeSubDomains; preload");
expect(h["Permissions-Policy"]).toMatch(/camera=\(\).*geolocation=\(\).*microphone=\(\)/);
expect(makeNonce()).not.toBe(makeNonce());
expect(atob(makeNonce()).length).toBe(16);
```

```ts
// same-site.server.test.ts
const req = (headers: Record<string, string>) => new Request("https://site.test/api/page-view", { method: "POST", headers });
expect(isOwnRequest(req({ "Sec-Fetch-Site": "same-origin" }))).toBe(true);
expect(isOwnRequest(req({ "Sec-Fetch-Site": "cross-site" }))).toBe(false);
expect(isOwnRequest(req({ "Sec-Fetch-Site": "same-site" }))).toBe(false);
expect(isOwnRequest(req({ Origin: "https://evil.test" }))).toBe(false);
expect(isOwnRequest(req({ Origin: "https://site.test" }))).toBe(true);
expect(isOwnRequest(req({}))).toBe(true);
```

`api.page-view`: a cross-site POST answers 403 and `incrementPageView` is not called (mock it); the response carries `Vary: Sec-Fetch-Dest, Sec-Fetch-Mode, Sec-Fetch-Site`. `api.csp-report`: the five cases of its interface, and a report whose `document-uri` is `https://site.test/work?source=x#y` is logged as `https://site.test/work`.

- [ ] **Step 3: Implement the headers and the nonce.** `entry.server.tsx` makes the nonce, sets `documentHeaders(nonce)` on the response in production only (`process.env.NODE_ENV === "production"`), wraps `<RemixServer>` in `NonceProvider` and passes `nonce` to `renderToPipeableStream`. `root.tsx` reads `useNonce()` for the intro script, `<ScrollRestoration>` and `<Scripts>`. The data responses and the two endpoints get `X-Content-Type-Options`, `Cross-Origin-Resource-Policy: same-origin` and `Referrer-Policy` (Remix's `handleDataRequest` export in `entry.server.tsx`, and the endpoints' own headers). `vercel.json` gives every static path `X-Content-Type-Options: nosniff`, the font and picture folders `Cross-Origin-Resource-Policy: same-origin`, and nothing that changes caching (that is Task 35).

- [ ] **Step 4: Trusted Types.** The logo's inner SVG becomes JSX (its picture before and after is the same to the pixel). Then, from step 1's violations: if the only remaining writer is React making a script element, register in `entry.client.tsx`, before hydration, a policy named `default` whose `createHTML` returns its input only when it is exactly the string React writes for a script element, and throws otherwise; allow it with `trusted-types default`. Run the whole inventory again with the directive enforced. Clean: `contentPolicy` enforces it. Not clean after one round of fixes: it goes in the `Content-Security-Policy-Report-Only` header instead, and the violations go in the report for the owner.

- [ ] **Step 5: The rest.** `api.page-view` checks `isOwnRequest` first. `rel="noopener noreferrer"` on the two links that have only `noreferrer`. `referrerPolicy = "no-referrer"` on the YouTube and Open Library picture loads; run `live-thumbs.json`, `gallery.json` and the shelf cover audit: every texture still loads (if a host refuses a request without a referrer, leave that loader as it was and say so). Dependency upgrades of the spec's 4.2.7, one commit of their own, then the full gates.

- [ ] **Step 6: The proof.** `scripts/audit/security.mjs` (`BASE=http://localhost:5180 node scripts/audit/security.mjs <out.json>`): for every page at 1440 by 900 and 390 by 844 it checks each header of step 2 on the document, on a `?_data` response, on one file under `/assets/` and one under `/paintings/` (the static ones are checked against `vercel.json` by reading the file, since `remix-serve` does not apply it; say so in the record); then loads the page, opens both home boxes, plays the wall and the shelf, runs every page change both ways, and fails on any `securitypolicyviolation` event (enforced or report-only), any console error, any failed picture or font request. Also: a cross-site POST to `/api/page-view` answers 403; a second document response has a different nonce; the HTML's every `<script>` carries the response's nonce. Record to `security.json`.

- [ ] **Step 7: Pictures after, gates, the report, commit** (`R59.2: security headers, an enforced content policy with a nonce ...`). `docs/redesign/security-audit-2026-11.md` as the spec's 4.2.9: a table of findings (what, evidence, risk in a sentence, done or left and why), the header set as sent, the advisories left open, and "only you can do this" (Vercel settings, the Upstash token, a custom domain). Plain words; no address of a preview.

---

### Task 35: performance

**Files:**
- Modify: `vercel.json` (cache lifetimes), `app/components/page-view-tracker.tsx` and its test, whatever the baseline's long frames point at
- Create: `docs/redesign/compare/web-pass/after.json`, `docs/redesign/performance-2026-11.md`
- Docs: `docs/redesign/README.md`, `docs/redesign/changes-2026-11.md`

**Interfaces:**
- Consumes: `web-vitals.mjs` and `baseline.json` from Task 33.
- Produces: a helper `yieldToMain(): Promise<void>` in `app/lib/yield.ts` (`scheduler.yield()` when present, else a `setTimeout` of 0 in a promise) if step 3 needs one; its test covers both branches.

- [ ] **Step 1: Rank.** From `baseline.json` and `after-fonts.json`, list every long frame of the first five seconds with its script and function, every page whose LCP is over 2.5 s or CLS over 0.1 on either size, every page not restored from the back/forward cache with its reason, and the largest requests of each page's first screen. The list, ranked by time lost, goes at the top of `performance-2026-11.md`. Anything the spec's "not done" list names stays out.

- [ ] **Step 2: Cache lifetimes.** `vercel.json`: `/paintings/(.*)`, `/mars/(.*)`, `/grounds/(.*)`, `/portraits/(.*)`, `/stack/(.*)` get `Cache-Control: public, max-age=86400, stale-while-revalidate=604800`. A test reads `vercel.json` and asserts these five sources, that no rule touches `/assets/`, and that the file is valid against the header names of Task 34.

- [ ] **Step 3: Long frames.** For each ranked long frame that is the site's own work: cut it into turns with `yieldToMain()` under a 50 ms deadline, or move it later, without changing what the visitor sees or when (the arrival rules hold: nothing may appear after a reveal). Measure the same case before and after; keep the change only if the frame is gone or under 50 ms and no gate moves.

- [ ] **Step 4: The counter's request** is sent after the page is idle (`requestIdleCallback` with a 2 s timeout, falling back to a `setTimeout`) with `priority: "low"` and `keepalive: true`; a test asserts the options and that one request is sent per route key.

- [ ] **Step 5: The back/forward cache and anything else ranked**, one change at a time, each measured.

- [ ] **Step 6: Numbers after** (`after.json`, three runs, under the lock, with the load average), the before/after table in `performance-2026-11.md` (page, size, LCP, CLS, blocking time, bytes; the changes made; the changes tried and taken out; what was measured and left, with the reason), pictures after, gates, commit (`R59.3: ...`).

---

### Task 36: modernize

**Files:**
- Modify: `app/components/home/reading/shelf-spine-fonts.ts`, `tsconfig.json` (`lib` to ES2024), `package.json` (`engines`), and what the sweep finds
- Create: `docs/redesign/modernize-2026-11.md`
- Docs: `docs/redesign/changes-2026-11.md`

- [ ] **Step 1: The scan.** `npx -y modern-web-guidance@latest legacy-scan app --json` and the same for `scripts`. Check each finding against its `keepWhen` and `dropWhen`. Known from 17 November: the Enter handler in `wall-input.ts` is on a canvas (dropped: not a text field); the deferred promise in `shelf-spine-fonts.ts` is kept as a finding once `lib` is ES2024.

- [ ] **Step 2: The sweep.** Retrieve `js`, `css`, `html` and `motion`. For each rule that names a legacy pattern, search `app/` and `scripts/` for it and write one line in `modernize-2026-11.md`: the guide's id, the pattern, the files hit (or none), and the decision (changed, or left and why). A hit is changed only when the replacement is Baseline widely available or its guide's fallback is kept, the behaviour and the look are the same, and a test covers the code or one is added first.

- [ ] **Step 3: Change, one guide at a time**, with its tests green before the next. `Promise.withResolvers()` in `shelf-spine-fonts.ts` (its existing tests are the proof). `engines.node` and the Vercel project's Node version agree on a version the build and all tests pass on locally and in a preview build; the report says which and why.

- [ ] **Step 4: The scan again** on the changed files (a kept exception still shows; that is expected and listed), pictures after, gates, commit (`R59.4: ...`).

- [ ] **Step 5: Close the pass.** `docs/redesign/feedback-log.md`: a section "The modern web pass: final status" (what was done under each of his three asks, the numbers before and after, what was left and why, what only he can do), and the three reports linked from `docs/redesign/README.md`. Serve the final build on 5180.
