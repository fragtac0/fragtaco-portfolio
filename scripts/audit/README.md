# Audit tools

Headless Chrome, driven over the DevTools protocol, for screenshots and measurements. Used for the 11 November 2026 audit and for the before and after comparison. The in-app browser pane does not animate while its window is hidden; this does.

```bash
# against the dev server (default) or any URL
BASE=http://localhost:5178 node scripts/audit/cdp.mjs scripts/audit/capture-desktop.json /tmp/out
BASE=https://fragtaco-portfolio.vercel.app node scripts/audit/cdp.mjs scripts/audit/capture-phone.json /tmp/out-phone
# contact sheet from some of the shots
scripts/audit/sheet.sh /tmp/out sheet-loader 4 480 300 load-0500 load-1200 load-2100 load-2800
```

- A steps file is a JSON list. Each step may set the screen (`size`, `dpr`, `mobile`, `touch`), emulate (`reduce`, `net`, `nocache`, `cpu`), navigate (`go`), `wait`, send input (`key`, `click`, `move`, `sweep`, `tap`, `drag`), run code in the page (`eval`, printed with its `label`) and take a screenshot (`shot`).
- Headless screenshots can lag one frame behind. Take a throwaway shot first (the `-warm` names) and use the one after it.
- Each run uses a fresh browser profile in the output folder, so nothing is cached.
- Shots whose names start with `local-` show YouTube thumbnails or book covers. Never commit those; they belong in `docs/redesign/compare/local/`, which git ignores.
- Step files named in the plan that are not here yet (`shelf.json`, `wall.json`, `history.json`, `nav.json`, `fonts.json`, `loader-throttled.json`, `shelf-cold.json`) are written by whoever runs that check, following the same pattern, and committed with the task.

Frame timing inside a step: evaluate a promise that samples `requestAnimationFrame` gaps for a few seconds and resolves with the worst gap and how many were over 20 ms.

- Headless Chrome does not advance timers or CSS transitions while the page is idle between steps (nothing animating). State that depends on a timer (a layer closing, a hint fading) must be read with an `eval` that polls inside the page (a `setInterval` promise), not after a plain `wait`.
- `page-change.json` (written by `make-page-change.mjs`, edit the generator and rerun it) measures a page change: home to work, back, and home to work again at 1440 by 900, dpr 2, CPU 4 times slower. A recorder started in the page before each click reads every animation frame gap from the click until 1 s after the path changes, and long-animation-frame entries say which script caused a long one. Needs the production build on :5180.
