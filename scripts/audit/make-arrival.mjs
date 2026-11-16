// The frozen-frame check of a page change (R56, round 7 change-arrival spec 5.4): the arriving page is finished before it is uncovered.
//
//   BASE=http://localhost:5180 node scripts/audit/make-arrival.mjs run <outdir> [--sizes 1512x982@2,390x844@3] [--only name,name] [--json file] [--generated] [--blocked-only]
//   node scripts/audit/make-arrival.mjs steps          (writes scripts/audit/arrival.json: the review-focus steps, run with cdp.mjs; see its header in this file's STEPS)
//
// For each of the six changes (home to portfolio, portfolio to long form, to short form, to my experience, to home, and long form to portfolio) at each
// size, in a fresh headless Chrome: the change is run once to warm the pictures and the code (its numbers are kept as `cold`), then again and
// frozen at 99% of its time (F: the change's animations are paused at 2475 ms of the 2500, `--at`), photographed; ended (every animation finished) and photographed at
// once (E, with how many ms after the end); and photographed again 700 ms later (L). Pixels differ when their luma differs by more than 25 levels
// (the share of all pixels). The pass conditions are spec 5.4's:
//   - F against E under 0.5%;
//   - E against L under 0.5% outside the elements in resting motion (the rings, the wall's canvas: masked), and their first frame moves no
//     element by more than 2 px (the ring items are sampled every frame from the end); a coarse comparison (cells of 32 device pixels, mean luma)
//     of the masked boxes stands in for what the mask hides (a tile or ring that appears would show there);
//   - no layout-shift entry in the 2 s after the end; no element appears, disappears, changes size or swaps its picture between E and L (the DOM
//     is read at both, outside the rings and canvases); the dock's box is the same in F (the dock's view-transition group, read from its computed
//     style), E and L;
//   - from the click to the reveal's first frame: the hold (the `arrival-hold` to `arrival-go` marks of app/lib/page-change.ts) is at most 500 ms
//     (a timer's slack of 30 ms is allowed), warm, and with every picture blocked (image requests held and never answered: the cap holds, the change
//     ends, and what is late fades in).
// Timing-sensitive only in the click-to-reveal numbers: run it under the gate lock (see lanes-common.md in the build ledger). Pictures go to
// <outdir> (the work pages show YouTube thumbnails and book covers: use docs/redesign/compare/local/; `--generated` answers the thumbnail and cover hosts
// with plain generated pictures, so what is saved shows none of them and no network is used, for the pictures that may be tracked).
import { spawn } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import sharp from "sharp";

const argv = process.argv.slice(2);
const mode = argv[0];
if (mode === "steps") {
  writeSteps();
  process.exit(0);
}
if (mode !== "run" || !argv[1]) throw new Error("usage: make-arrival.mjs run <outdir> [--sizes WxH@dpr,...] [--only name,...] [--json file] [--generated] [--blocked-only] | make-arrival.mjs steps");
const outDir = argv[1];
const opt = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};
const SIZES = opt("sizes", "1512x982@2,390x844@3").split(",").map((s) => s.split(/[x@]/).map(Number));
const ONLY = opt("only", "").split(",").filter(Boolean);
const JSON_OUT = opt("json", "");
const GENERATED = argv.includes("--generated");
const FREEZE_AT = Number(opt("at", "2475")); // 99% of the 2500 ms
const BLOCKED_ONLY = argv.includes("--blocked-only");
const BASE = process.env.BASE ?? "http://localhost:5180";
mkdirSync(outDir, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const HEADER = "header[data-site-nav]";
const SCENARIOS = [
  { name: "home-to-portfolio", start: "/", link: `[...document.querySelectorAll('${HEADER} a')].find((a) => a.getAttribute('href') === '/work')` },
  { name: "portfolio-to-long-form", start: "/work", link: `document.querySelector('${HEADER} [data-work-tab="/work/long-form"]')` },
  { name: "portfolio-to-short-form", start: "/work", link: `document.querySelector('${HEADER} [data-work-tab="/work/short-form"]')` },
  { name: "portfolio-to-experience", start: "/work", link: `document.querySelector('${HEADER} [data-work-tab="/experience"]')` },
  { name: "portfolio-to-home", start: "/work", link: `[...document.querySelectorAll('${HEADER} a')].find((a) => a.getAttribute('href') === '/')` },
  { name: "long-form-to-portfolio", start: "/work/long-form", link: `[...document.querySelectorAll('a')].find((a) => a.getAttribute('href') === '/work' && !a.closest('header')) ?? [...document.querySelectorAll('${HEADER} a')].find((a) => a.getAttribute('href') === '/work')` },
];
// the parts of a page that are in resting motion once a change is over: their pixels are compared coarsely, their DOM is not compared
const RESTING = [".work-rings", ".wall-canvas-host", ".paint-host"];
const COARSE_MEAN_MAX = 1.5; // luma levels: the boxes of the wall and the painting (their pictures are the same drawn two ways) may not differ by more than this on average
const LUMA_STEP = 25;
const HOLD_CAP_MS = 500;
const HOLD_SLACK_MS = 30;

// ---- what runs in the page --------------------------------------------------------------------------------------------------------
const INIT = `try{sessionStorage.setItem('ft:intro-seen','1')}catch(e){}
window.__ls=[];
try{new PerformanceObserver(l=>{for(const e of l.getEntries())window.__ls.push({t:Math.round(e.startTime),v:+e.value.toFixed(5),input:e.hadRecentInput,src:(e.sources||[]).map(s=>s.node&&(s.node.nodeName+'.'+String(s.node.className).slice(0,30))).slice(0,3)})}).observe({type:'layout-shift',buffered:true})}catch(e){}`;

/** Clicks the link and freezes the change at 99% of its time (every animation paused); answers with the click's moment and the hold's marks. */
const FREEZE = (link) => `(async () => {
  const a = ${link};
  if (!a) return { err: 'no link' };
  const html = document.documentElement;
  const isChange = (x) => String(x.effect?.pseudoElement ?? '').startsWith('::view-transition');
  const clickAt = performance.now();
  performance.clearMarks('arrival-hold'); performance.clearMarks('arrival-go');
  a.click();
  return await new Promise((resolve) => {
    const loop = () => {
      const anims = document.getAnimations();
      const g = anims.find((x) => x.animationName === 'glass-p');
      if (g && typeof g.currentTime === 'number' && g.currentTime >= ${FREEZE_AT}) {
        for (const x of anims) { if (isChange(x)) { try { x.pause(); } catch {} } } // the change's own animations only: the page's (the rings held by data-still, the ground) run as they would
        resolve(read(clickAt, true, g.currentTime));
        return;
      }
      if (performance.now() - clickAt > 9000) { resolve({ err: 'timeout', kind: html.dataset.changeKind || '', hold: 'changeHold' in html.dataset, path: location.pathname }); return; }
      requestAnimationFrame(loop);
    };
    function read(clickAt, ok, at) {
      const m = (n) => performance.getEntriesByName(n).at(-1)?.startTime ?? null;
      return { ok, at: Math.round(at), clickAt, holdAt: m('arrival-hold'), goAt: m('arrival-go'), late: html.dataset.arrivalLate ?? '', path: location.pathname };
    }
    requestAnimationFrame(loop);
  });
})()`;

/** The dock's box: the live dock's rectangle, and (while the change is frozen) the dock's view-transition group, from its computed style. */
const DOCK_BOX = `(() => {
  const g = document.querySelector('[data-dock-glass]');
  const r = g?.getBoundingClientRect();
  const live = r ? { x: +r.x.toFixed(1), y: +r.y.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1) } : null;
  let group = null;
  try {
    const cs = getComputedStyle(document.documentElement, '::view-transition-group(site-dock)');
    if (cs.width && cs.width !== 'auto' && cs.width !== '') {
      const m = new DOMMatrixReadOnly(cs.transform === 'none' ? undefined : cs.transform);
      group = { x: +m.e.toFixed(1), y: +m.f.toFixed(1), w: +parseFloat(cs.width).toFixed(1), h: +parseFloat(cs.height).toFixed(1) };
    }
  } catch {}
  return { live, group, kind: document.documentElement.dataset.changeKind || '' };
})()`;

/** Ends the change (every animation finished), records the ring items' places for the frames after it, and answers when it was over. */
const END = `(async () => {
  const html = document.documentElement;
  const raf = window.requestAnimationFrame.bind(window); // the audit's own loops use this one: the page's are stalled below
  window.__rest = { frames: [] };
  const items = () => [...document.querySelectorAll('.work-ring-group li.work-item')].map((li) => { const r = li.getBoundingClientRect(); return [r.x, r.y]; });
  let overAt = null, run = true;
  const tick = (now) => {
    if (overAt === null && !html.dataset.changeKind) overAt = now;
    window.__rest.frames.push({ t: now, over: overAt !== null, items: items() });
    if (run && window.__rest.frames.length < 60) raf(tick);
  };
  const t0 = performance.now();
  const beforeItems = items();
  for (const x of document.getAnimations()) { if (String(x.effect?.pseudoElement ?? '').startsWith('::view-transition')) { try { x.finish(); } catch {} } }
  let n = 0;
  while (html.dataset.changeKind && n++ < 120) await new Promise((r) => raf(r));
  window.__endAt = performance.now();
  raf(tick);
  for (let i = 0; i < 4; i++) await new Promise((r) => raf(r)); // the first frames after the end are sampled (the ring items' places) before anything is stopped
  // the photograph of the end (E) takes a few hundred ms at 2x: stop the page where it is (its own animations paused, its animation-frame loops queued) so E is the page as it was in the
  // first frames, and start them again for L
  for (const x of document.getAnimations()) { try { x.pause(); } catch {} }
  window.__queued = []; window.__rafWas = window.requestAnimationFrame;
  window.requestAnimationFrame = (cb) => { window.__queued.push(cb); return 0; };
  const afterItems = items();
  let moved = 0; for (let i = 0; i < Math.min(beforeItems.length, afterItems.length); i++) moved = Math.max(moved, Math.hypot(beforeItems[i][0] - afterItems[i][0], beforeItems[i][1] - afterItems[i][1]));
  return { kind: html.dataset.changeKind || 'none', overMs: Math.round(window.__endAt - t0), ringItemsMovedFreezeToEndPx: +moved.toFixed(2), items: beforeItems.length };
})()`;

const RING_ANIM = `(() => { const a = document.getAnimations().filter((x) => ['work-spin', 'work-unspin'].includes(x.animationName)); return { n: a.length, t: a.slice(0, 3).map((x) => [x.animationName, Math.round(x.currentTime ?? -1), x.playState, +x.playbackRate.toFixed(3)]) }; })()`;
const PLAY = `(() => { for (const x of document.getAnimations()) { try { x.play(); } catch {} } window.requestAnimationFrame = window.__rafWas; for (const cb of window.__queued.splice(0)) window.requestAnimationFrame(cb); return 1; })()`;

const REST_RESULT = `(() => {
  const f = (window.__rest?.frames ?? []).filter((x) => x.over);
  const step = (a, b) => { let m = 0; for (let i = 0; i < Math.min(a.length, b.length); i++) m = Math.max(m, Math.hypot(a[i][0] - b[i][0], a[i][1] - b[i][1])); return +m.toFixed(2); };
  const first3 = []; for (let i = 1; i < Math.min(f.length, 4); i++) first3.push(step(f[i - 1].items, f[i].items));
  return { frames: f.length, items: f[0]?.items.length ?? 0, firstFrameSteps: first3, maxFirstFramePx: first3.length ? Math.max(...first3) : null, driftOver700msPx: f.length > 2 ? step(f[0].items, f.at(-1).items) : null };
})()`;

/** Every element of the page outside the rings and the canvases, with the box, the opacity and (pictures) the source: compared between E and L. */
const SNAP = `(() => {
  const out = {};
  const skip = (el) => el.closest('.work-rings, .paint-host, canvas, svg, [data-glass-warm], script, style, noscript, head');
  const path = (el) => { const p = []; for (let e = el; e && e !== document.body; e = e.parentElement) p.push(e.tagName[0] + [...e.parentElement.children].indexOf(e)); return p.reverse().join('/'); };
  for (const el of document.body.querySelectorAll('*')) {
    if (skip(el)) continue;
    const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
    out[path(el)] = { n: el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0].slice(0, 28) : ''), x: r.x, y: r.y, w: r.width, h: r.height,
      op: +cs.opacity, shown: cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 0 && r.height > 0, src: el.tagName === 'IMG' ? el.currentSrc || el.src : undefined };
  }
  const items = [...document.querySelectorAll('.work-rings img')].map((i) => i.currentSrc || i.src);
  const wall = [...document.querySelectorAll('.wall-tile img')].map((i) => (i.currentSrc || i.src) + (i.hasAttribute('data-ready') ? '' : ' (not in)'));
  return { els: out, ringPictures: items, wallPictures: wall, drawn: !!document.querySelector('.wall-stage[data-drawn]') };
})()`;

const MASK_BOXES = `(() => { const out = []; for (const sel of ${JSON.stringify(RESTING)}) for (const el of document.querySelectorAll(sel)) { const r = el.getBoundingClientRect(); if (r.width > 0 && r.height > 0) out.push({ sel, x: r.x, y: r.y, w: r.width, h: r.height }); } return out; })()`;

// ---- the browser -------------------------------------------------------------------------------------------------------------------
async function withBrowser(size, tag, fn) {
  const [W, H, DPR] = size;
  const port = 9100 + Math.floor(Math.random() * 800);
  const profile = `${outDir}/profile-${tag}`;
  rmSync(profile, { recursive: true, force: true });
  const chrome = spawn("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", ["--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "--no-first-run", "--hide-scrollbars", `--window-size=${W},${H}`, "about:blank"], { stdio: "ignore" });
  try {
    let wsUrl;
    for (let i = 0; i < 50 && !wsUrl; i++) {
      await sleep(200);
      try {
        wsUrl = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((t) => t.type === "page")?.webSocketDebuggerUrl;
      } catch {
        /* not up yet */
      }
    }
    const ws = new WebSocket(wsUrl);
    await new Promise((r) => ws.addEventListener("open", r, { once: true }));
    let id = 0;
    const pending = new Map();
    let paused = null; // the Fetch handler of the run: held requests are simply never answered
    ws.addEventListener("message", (e) => {
      const m = JSON.parse(e.data);
      if (m.id && pending.has(m.id)) {
        pending.get(m.id)(m);
        pending.delete(m.id);
      } else if (m.method === "Fetch.requestPaused" && paused) paused(m.params, send);
    });
    // a call the page never answers gives up after 40 s (and says so), so one stuck change cannot hold the gate lock for ever
    const send = (method, params = {}) =>
      new Promise((r) => {
        const i = ++id;
        const timer = setTimeout(() => {
          pending.delete(i);
          console.error(`make-arrival: ${method} did not answer in 40 s`);
          r({ error: { message: "timeout" }, result: { result: { value: undefined }, exceptionDetails: { text: `timeout: ${method}` } } });
        }, 40000);
        pending.set(i, (m) => {
          clearTimeout(timer);
          r(m);
        });
        ws.send(JSON.stringify({ id: i, method, params }));
      });
    const ev = async (expression) => {
      const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
      if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 500));
      return r.result?.result?.value;
    };
    await send("Page.enable");
    await send("Runtime.enable");
    await send("Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: DPR, mobile: W < 700 });
    if (W < 700) await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
    await send("Page.addScriptToEvaluateOnNewDocument", { source: INIT });
    const setPaused = (handler) => {
      paused = handler;
    };
    return await fn({ send, ev, setPaused, shot: async () => Buffer.from((await send("Page.captureScreenshot", { format: "png", optimizeForSpeed: true })).result.data, "base64") });
  } finally {
    chrome.kill();
    await sleep(400);
    rmSync(profile, { recursive: true, force: true }); // the profile holds extension scripts that the repo's lint would read
  }
}

// plain generated pictures for the thumbnail and cover hosts (`--generated`): a flat colour that depends on the address, so tiles differ
async function generatedPicture(url) {
  let h = 7;
  for (const c of url) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const rgb = [60 + (h % 120), 60 + ((h >> 8) % 120), 60 + ((h >> 16) % 120)];
  const isCover = url.includes("openlibrary");
  return (await sharp({ create: { width: isCover ? 200 : 480, height: isCover ? 300 : 360, channels: 3, background: { r: rgb[0], g: rgb[1], b: rgb[2] } } }).png().toBuffer()).toString("base64");
}
const EXTERNAL = /i\.ytimg\.com|img\.youtube\.com|covers\.openlibrary\.org/;

async function arm(b, { blocked }) {
  if (!GENERATED && !blocked) return;
  await b.send("Network.enable");
  if (blocked) await b.send("Network.setCacheDisabled", { cacheDisabled: true });
  await b.send("Fetch.enable", { patterns: [{ urlPattern: "*", resourceType: "Image" }] });
  b.setPaused(async (p, send) => {
    if (blocked) return; // never answered: the picture does not come
    if (EXTERNAL.test(p.request.url)) {
      await send("Fetch.fulfillRequest", { requestId: p.requestId, responseCode: 200, responseHeaders: [{ name: "Content-Type", value: "image/png" }, { name: "Access-Control-Allow-Origin", value: "*" }], body: await generatedPicture(p.request.url) });
    } else await send("Fetch.continueRequest", { requestId: p.requestId });
  });
}

async function goAndWarm(b, start) {
  await b.send("Page.navigate", { url: BASE + start });
  for (let i = 0; i < 80; i++) {
    await sleep(250);
    try {
      if (await b.ev(`performance.getEntriesByType('mark').some((m) => m.name === 'glass-warm')`)) break;
    } catch {
      /* loading */
    }
  }
  await sleep(1500);
}

// ---- pixels ------------------------------------------------------------------------------------------------------------------------
async function luma(png) {
  const { data, info } = await sharp(png).greyscale().raw().toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height };
}
const share = (n, of) => +((100 * n) / Math.max(1, of)).toFixed(3);
/** The share of pixels that differ by more than LUMA_STEP, over everything and outside the masked boxes (device pixels), and the coarse difference inside them. */
function compare(a, b, masks) {
  const { w, h } = a;
  const inMask = new Uint8Array(w * h);
  for (const m of masks) for (let y = Math.max(0, m.y0); y < Math.min(h, m.y1); y++) inMask.fill(1, y * w + Math.max(0, m.x0), y * w + Math.min(w, m.x1));
  let all = 0, outside = 0, outsideCount = 0;
  for (let i = 0; i < w * h; i++) {
    const d = Math.abs(a.data[i] - b.data[i]) > LUMA_STEP;
    if (d) all++;
    if (!inMask[i]) {
      outsideCount++;
      if (d) outside++;
    }
  }
  const CELL = 32;
  let cells = 0, sum = 0, worst = 0;
  for (let cy = 0; cy < h; cy += CELL)
    for (let cx = 0; cx < w; cx += CELL) {
      let sa = 0, sb = 0, n = 0, masked = 0;
      for (let y = cy; y < Math.min(h, cy + CELL); y++)
        for (let x = cx; x < Math.min(w, cx + CELL); x++) {
          const i = y * w + x;
          sa += a.data[i];
          sb += b.data[i];
          n++;
          masked += inMask[i];
        }
      if (masked < n / 2) continue;
      const d = Math.abs(sa - sb) / n;
      cells++;
      sum += d;
      worst = Math.max(worst, d);
    }
  return { pct: share(all, w * h), pctOutside: share(outside, outsideCount), maskedCells: cells, maskedMeanDiff: cells ? +(sum / cells).toFixed(2) : 0, maskedWorstCell: +worst.toFixed(1) };
}

function domChanges(e, l) {
  const appeared = [], disappeared = [], resized = [], moved = [], swapped = [], faded = [];
  for (const [k, a] of Object.entries(e.els)) {
    const b = l.els[k];
    if (!b) {
      if (a.shown) disappeared.push(a.n);
      continue;
    }
    if (!a.shown && b.shown) appeared.push(b.n);
    else if (a.shown && !b.shown) disappeared.push(a.n);
    else if (a.shown && b.shown) {
      if (Math.abs(a.w - b.w) > 1 || Math.abs(a.h - b.h) > 1) resized.push(`${a.n} ${Math.round(a.w)}x${Math.round(a.h)}->${Math.round(b.w)}x${Math.round(b.h)}`);
      else if (Math.abs(a.x - b.x) > 1 || Math.abs(a.y - b.y) > 1) moved.push(a.n);
      if (Math.abs(a.op - b.op) > 0.3) faded.push(`${a.n} ${a.op}->${b.op}`);
      if (a.src !== b.src) swapped.push(a.n);
    }
  }
  for (const [k, b] of Object.entries(l.els)) if (!e.els[k] && b.shown) appeared.push(b.n);
  const ringsSwapped = e.ringPictures.length !== l.ringPictures.length || e.ringPictures.some((s, i) => s !== l.ringPictures[i]);
  const wallSwapped = e.wallPictures.length !== l.wallPictures.length || e.wallPictures.some((s, i) => s !== l.wallPictures[i]);
  return { appeared, disappeared, resized, moved, swapped, faded, ringsSwapped, wallSwapped, wallDrawnAtE: e.drawn, wallDrawnAtL: l.drawn };
}

const sameBox = (p, q) => !!p && !!q && Math.abs(p.x - q.x) <= 1 && Math.abs(p.y - q.y) <= 1 && Math.abs(p.w - q.w) <= 1 && Math.abs(p.h - q.h) <= 1;

// ---- one change --------------------------------------------------------------------------------------------------------------------
async function runChange(b, s, { photos, tag, blocked }) {
  await goAndWarm(b, s.start);
  if (blocked) await arm(b, { blocked: true });
  const f = await b.ev(FREEZE(s.link));
  if (f?.err) return { err: f };
  const holdMs = f.holdAt !== null && f.goAt !== null ? Math.round(f.goAt - f.holdAt) : null;
  const row = {
    clickToHoldMs: f.holdAt !== null ? Math.round(f.holdAt - f.clickAt) : null,
    holdMs,
    clickToRevealMs: f.goAt !== null ? Math.round(f.goAt - f.clickAt) : null,
    lateAtReveal: f.late,
    frozenAtMs: f.at,
  };
  if (!photos) {
    // the change has to end for the next run: finish it and let it settle
    await b.ev(END);
    await sleep(600);
    return row;
  }
  await sleep(150);
  const fDock = await b.ev(DOCK_BOX);
  const fAnim = await b.ev(RING_ANIM);
  const fPng = await b.shot();
  const masks = (await b.ev(MASK_BOXES)).map((m) => ({ ...m }));
  const t0 = Date.now();
  const end = await b.ev(END);
  const ePng = await b.shot();
  const endToShotMs = Date.now() - t0;
  const eDock = await b.ev(DOCK_BOX);
  const eAnim = await b.ev(RING_ANIM);
  const eSnap = await b.ev(SNAP);
  await b.ev(PLAY);
  await sleep(700);
  const lPng = await b.shot();
  if (process.env.ARRIVAL_DEBUG) console.error('L shot done');
  const lDock = await b.ev(DOCK_BOX);
  const lSnap = await b.ev(SNAP);
  const rest = await b.ev(REST_RESULT);
  await sleep(1400);
  const shifts = await b.ev(`(() => window.__ls.filter((e) => !e.input && e.t >= window.__endAt - 50 && e.t <= window.__endAt + 2000))()`);
  const [fl, el, ll] = await Promise.all([luma(fPng), luma(ePng), luma(lPng)]);
  const dpr = fl.w / (await b.ev("innerWidth"));
  const maskDev = masks.map((m) => ({ x0: Math.floor(m.x * dpr), y0: Math.floor(m.y * dpr), x1: Math.ceil((m.x + m.w) * dpr), y1: Math.ceil((m.y + m.h) * dpr) }));
  const fe = compare(fl, el, []);
  const elc = compare(el, ll, maskDev);
  // the coarse comparison gates the wall's canvas (a tile that appears shows there); the rings' own DOM is compared (pictures, items) and their drift is reported
  const wallDev = maskDev.filter((_, i) => masks[i].sel !== ".work-rings");
  const wallCoarse = wallDev.length ? compare(el, ll, wallDev) : { maskedMeanDiff: 0, maskedWorstCell: 0 };
  const dom = domChanges(eSnap, lSnap);
  for (const [k, png] of [["F", fPng], ["E", ePng], ["L", lPng]]) await sharp(png).jpeg({ quality: 85 }).toFile(`${outDir}/${tag}-${k}.jpg`);
  await sharp({ create: { width: Math.round(fl.w / 3) * 3 + 20, height: Math.round(fl.h / 3), channels: 3, background: "#222" } })
    .composite(await Promise.all([fPng, ePng, lPng].map(async (png, i) => ({ input: await sharp(png).resize(Math.round(fl.w / 3)).jpeg({ quality: 80 }).toBuffer(), left: i * (Math.round(fl.w / 3) + 10), top: 0 }))))
    .jpeg({ quality: 82 })
    .toFile(`${outDir}/${tag}-FEL.jpg`);
  const dockSame = sameBox(fDock.group ?? fDock.live, eDock.live) && sameBox(eDock.live, lDock.live);
  Object.assign(row, {
    F_vs_E_pct: fe.pct,
    E_vs_L_pct: elc.pct,
    E_vs_L_outside_resting_pct: elc.pctOutside,
    resting_boxes_coarse_mean_diff: elc.maskedMeanDiff,
    wall_canvas_coarse_mean_diff: wallCoarse.maskedMeanDiff,
    resting_boxes_coarse_worst_cell: elc.maskedWorstCell,
    restingBoxes: masks.map((m) => m.sel),
    ringItemFirstFramePx: rest.maxFirstFramePx,
    ringItemsSampled: rest.items,
    ringDriftOver700msPx: rest.driftOver700msPx,
    layoutShifts: shifts.length,
    layoutShiftEntries: shifts,
    dock: { F: fDock.group ?? fDock.live, Flive: fDock.live, E: eDock.live, L: lDock.live, same: dockSame },
    domChanges: dom,
    endToShotMs,
    overMs: end.overMs,
    ringAnimations: { F: fAnim, E: eAnim },
    ringItemsMovedFreezeToEndPx: end.ringItemsMovedFreezeToEndPx,
  });
  const noDom = dom.appeared.length + dom.disappeared.length + dom.resized.length + dom.swapped.length === 0 && !dom.ringsSwapped && !dom.wallSwapped;
  row.pass = {
    F_vs_E: fe.pct < 0.5,
    E_vs_L_outside: elc.pctOutside < 0.5,
    resting_first_frame: rest.maxFirstFramePx === null || rest.maxFirstFramePx <= 2,
    layout_shift: shifts.length === 0,
    resting_coarse: wallCoarse.maskedMeanDiff < COARSE_MEAN_MAX,
    dom_unchanged: noDom,
    dock_same: dockSame,
    hold_cap: holdMs !== null && holdMs <= HOLD_CAP_MS + HOLD_SLACK_MS,
  };
  row.ok = Object.values(row.pass).every(Boolean);
  return row;
}

// ---- the run -----------------------------------------------------------------------------------------------------------------------
const results = [];
for (const size of SIZES) {
  const label = `${size[0]}x${size[1]}@${size[2]}`;
  for (const s of SCENARIOS) {
    if (ONLY.length && !ONLY.includes(s.name)) continue;
    const tag = `r56-${label}-${s.name}`;
    const rec = { name: s.name, size: label };
    try {
      if (!BLOCKED_ONLY) {
        rec.warm = await withBrowser(size, tag, async (b) => {
          await arm(b, { blocked: false });
          rec.first = await runChange(b, s, { photos: false, tag, blocked: false }); // the first run warms the pictures and the code
          return runChange(b, s, { photos: true, tag, blocked: false });
        });
      }
      // every picture blocked: image requests are held and never answered, nothing is cached
      rec.blocked = await withBrowser(size, `${tag}-blocked`, async (b) => {
        const row = await runChange(b, s, { photos: true, tag: `${tag}-blocked`, blocked: true });
        row.capHolds = row.holdMs !== null && row.holdMs <= HOLD_CAP_MS + HOLD_SLACK_MS;
        row.changeEnded = !row.err;
        return row;
      });
    } catch (error) {
      rec.error = String(error).slice(0, 400);
    }
    results.push(rec);
    const w = rec.warm;
    console.log(JSON.stringify({ name: s.name, size: label, ok: w?.ok, F_E: w?.F_vs_E_pct, E_L_outside: w?.E_vs_L_outside_resting_pct, shifts: w?.layoutShifts, dockSame: w?.dock?.same, holdMs: w?.holdMs, firstHoldMs: rec.first?.holdMs, blockedHoldMs: rec.blocked?.holdMs, blockedLate: rec.blocked?.lateAtReveal, fail: w ? Object.entries(w.pass ?? {}).filter(([, v]) => !v).map(([k]) => k) : undefined, error: rec.error }));
  }
}
const verdict = results.every((r) => !r.error && (BLOCKED_ONLY || r.warm?.ok) && r.blocked?.capHolds !== false && r.blocked && !r.blocked.err);
console.log(JSON.stringify({ verdict: verdict ? "PASS" : "FAIL", runs: results.length }));
if (JSON_OUT) writeFileSync(JSON_OUT, JSON.stringify({ what: "R56.2 frozen-frame check (round 7 change-arrival spec 5.4), from scripts/audit/make-arrival.mjs", date: new Date().toISOString().slice(0, 10), verdict, results }, null, 1));

// ---- arrival.json: the review-focus steps for cdp.mjs --------------------------------------------------------------------------------
function writeSteps() {
  const wait = (name, expr) => `await new Promise((res) => { const t0 = performance.now(); const id = setInterval(() => { if ((${expr}) || performance.now() - t0 > 6000) { clearInterval(id); res(); } }, 16); });`;
  const click = (sel) => `document.querySelector(${JSON.stringify(sel)}).click();`;
  const state = `({ path: location.pathname, kind: document.documentElement.dataset.changeKind ?? null, hold: 'changeHold' in document.documentElement.dataset, late: document.documentElement.dataset.arrivalLate ?? null, glass: document.documentElement.dataset.glass ?? null, busy: document.documentElement.dataset.changeBusy ?? null, focus: document.activeElement?.getAttribute('data-work-tab') || document.activeElement?.getAttribute('href') || document.activeElement?.tagName })`;
  const hang = (ms = 600000) => [".webp", ".jpg", ".jpeg", ".png", ".avif", ".svg", "i.ytimg.com", "covers.openlibrary"].map((match) => ({ match, delay: ms }));
  const wall = 'header[data-site-nav] [data-work-tab="/work/long-form"]';
  const steps = [
    { size: [1440, 900], dpr: 2, init: "try{sessionStorage.setItem('ft:intro-seen','1');sessionStorage.setItem('ft:debug-change','1')}catch(e){}", go: "{{BASE}}/work", wait: 6000 },
    // Review focus 1: a destination whose pictures never load. The reveal starts at the cap (500 ms), the change ends, nothing is left held, the late parts are named.
    { label: "RF1 arm: every picture held for ever (data-change-hold goes at the cap, not never)", intercept: hang() },
    { label: "RF1 pictures never load: hold length, late parts, the change ends", eval: `(async () => { const html = document.documentElement; ${click(wall)} const t0 = performance.now(); let holdOn = null, holdOff = null; await new Promise((res) => { const id = setInterval(() => { const h = 'changeHold' in html.dataset; if (h && holdOn === null) holdOn = performance.now() - t0; if (!h && holdOn !== null && holdOff === null) holdOff = performance.now() - t0; if ((holdOff !== null && !html.dataset.changeKind) || performance.now() - t0 > 9000) { clearInterval(id); res(); } }, 8); }); return { holdOnMs: Math.round(holdOn), holdOffMs: Math.round(holdOff), holdLengthMs: Math.round(holdOff - holdOn), ended: !html.dataset.changeKind, ...${state} }; })()` },
    { intercept: [], label: "RF1 disarm" },
    // Review focus 2: a press, Back, or a key during the hold. Each finishes or replaces the change; nothing stays held. The hold is made long by holding every picture.
    { label: "RF2 reload on the portfolio page", go: "{{BASE}}/work", wait: 4500 },
    { intercept: hang(), label: "RF2 arm" },
    { label: "RF2a a pointer press during the hold finishes the change at once and nothing is held", eval: `(async () => { const html = document.documentElement; ${click(wall)} ${wait("hold", "'changeHold' in html.dataset")} await new Promise((r) => setTimeout(r, 150)); const during = ${state}; window.__ftFinish && window.__ftFinish(); ${wait("over", "!html.dataset.changeKind")} await new Promise((r) => setTimeout(r, 700)); return { during, after: ${state} }; })()` },
    { intercept: [], label: "RF2 disarm" },
    { label: "RF2b Back during the hold ends the change at once, no second reveal", go: "{{BASE}}/work", wait: 4500 },
    { intercept: hang(), label: "RF2b arm" },
    { label: "RF2b Back", eval: `(async () => { const html = document.documentElement; ${click(wall)} ${wait("hold", "'changeHold' in html.dataset")} await new Promise((r) => setTimeout(r, 150)); const during = ${state}; history.back(); ${wait("over", "!html.dataset.changeKind && !('changeHold' in html.dataset)")} await new Promise((r) => setTimeout(r, 900)); return { during, after: ${state}, glassAnimations: document.getAnimations().filter((a) => a.animationName === 'glass-p').length }; })()` },
    { intercept: [], label: "RF2 disarm" },
    { label: "RF2c a second click on another link during the hold replaces the change, nothing stays held", go: "{{BASE}}/work", wait: 4500 },
    { intercept: hang(), label: "RF2c arm" },
    { label: "RF2c a second link", eval: `(async () => { const html = document.documentElement; ${click(wall)} ${wait("hold", "'changeHold' in html.dataset")} await new Promise((r) => setTimeout(r, 150)); const during = ${state}; window.__ftChange && window.__ftChange('/experience'); await new Promise((r) => setTimeout(r, 900)); window.__ftFinish && window.__ftFinish(); ${wait("over", "!html.dataset.changeKind")} await new Promise((r) => setTimeout(r, 700)); return { during, after: ${state} }; })()` },
    { intercept: [], label: "RF2 disarm" },
    // Review focus 5: focus in the dock's second row stays where it was across a change between two pages that both have the row.
    { label: "RF5 long form, the row's Short form link focused", go: "{{BASE}}/work/long-form", wait: 6000 },
    { label: "RF5 focus the row's Short form link and press Enter", eval: `(async () => { const a = document.querySelector('header[data-site-nav] [data-work-tab="/work/short-form"]'); a.focus(); window.__rf5 = { el: a, before: ${state} }; return window.__rf5.before; })()` },
    { key: "Enter" },
    { label: "RF5 after the change: the same link has focus (the dock is the same element), the row never closed", eval: `(async () => { const html = document.documentElement; await new Promise((res) => { const t0 = performance.now(); const id = setInterval(() => { if ((!html.dataset.changeKind && location.pathname === '/work/short-form') || performance.now() - t0 > 7000) { clearInterval(id); res(); } }, 50); }); const row = document.querySelector('.dock-row'); return { ...${state}, sameElement: document.activeElement === window.__rf5.el, rowPresent: !!row, rowOpacity: row && getComputedStyle(row).opacity, rowInert: row ? row.hasAttribute('inert') : null }; })()` },
    { label: "RF5 the row is in both pictures of a change: its box does not change across a change between two row pages", eval: `(async () => { const html = document.documentElement; const box = () => { const r = document.querySelector('[data-dock-glass]').getBoundingClientRect(); return [r.x, r.y, r.width, r.height].map((v) => Math.round(v * 10) / 10); }; const before = box(); const seen = new Set([before.join()]); document.querySelector('header[data-site-nav] [data-work-tab="/experience"]').click(); await new Promise((res) => { const t0 = performance.now(); const id = setInterval(() => { seen.add(box().join()); if ((!html.dataset.changeKind && location.pathname === '/experience') || performance.now() - t0 > 7000) { clearInterval(id); res(); } }, 16); }); return { before, after: box(), distinctBoxes: seen.size }; })()` },
  ];
  writeFileSync(new URL("./arrival.json", import.meta.url), JSON.stringify(steps, null, 1) + "\n");
  console.log("wrote scripts/audit/arrival.json");
}
