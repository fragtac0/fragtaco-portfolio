// Web vitals of every page, cold cache, three runs per page and size (the baseline and the "after" records of the modern web pass).
// usage: BASE=http://localhost:5180 node scripts/audit/web-vitals.mjs <out.json> [runs=3] [pages=/,/work,...]
// Per run: LCP (and its element, and the font files drawn by then), CLS, total blocking time (long tasks after first paint inside the first five
// seconds), the long animation frames of the first five seconds with the scripts that ran in them, requests and bytes by origin and by type (every
// http(s) request until SETTLE_MS, 5.6 s, counted before the back/forward round trip), whether the page comes back from the back/forward cache
// (and why not), and the machine's load average. Hold the timing lock (lanes-common.md) for the numbers to mean anything.
import { writeFileSync } from "node:fs";
import { loadavg } from "node:os";
import { launch, sleep } from "./chrome-lite.mjs";

const BASE = process.env.BASE ?? "http://localhost:5180";
const [out, runsArg, pagesArg] = process.argv.slice(2);
const RUNS = Number(runsArg ?? 3);
const PAGES = pagesArg ? pagesArg.split(",") : ["/", "/work", "/work/long-form", "/work/short-form", "/experience"];
const ALL_SIZES = [
  { name: "1440x900", width: 1440, height: 900, dpr: 1, mobile: false },
  { name: "390x844", width: 390, height: 844, dpr: 1, mobile: true },
];
const SIZES = process.env.SIZES_ONLY ? ALL_SIZES.filter((x) => x.name === process.env.SIZES_ONLY) : ALL_SIZES;
const WINDOW_MS = 5000; // "the first five seconds"
const SETTLE_MS = Number(process.env.SETTLE_MS ?? 5600);
// THROTTLE=1: a slow network (150 ms round trip, 1.6 Mbit/s down), where what a preload or a request chain costs becomes visible.
const THROTTLE = process.env.THROTTLE === "1";
// SIZES_ONLY=1440x900: only that size
// CPU=4: the page runs on a CPU four times slower (a phone-class device; the gates of round 7 use it), so work that is 20 ms here shows as 80 ms.
const CPU = Number(process.env.CPU ?? 1);

// Runs in the page before any of its own scripts.
const OBSERVE = `(() => {
  const w = (window.__wv = { lcp: null, lcpElement: null, lcpUrl: null, fontsAtLcp: [], cls: 0, fcp: null, tasks: [], frames: [] });
  const describe = (el) => (el ? el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") + (typeof el.className === "string" && el.className ? "." + el.className.trim().split(/\\s+/).slice(0, 2).join(".") : "") : null);
  const observe = (type, fn) => { try { new PerformanceObserver((l) => l.getEntries().forEach(fn)).observe({ type, buffered: true }); } catch (e) { /* not supported */ } };
  observe("largest-contentful-paint", (e) => {
    w.lcp = e.startTime; w.lcpElement = describe(e.element); w.lcpUrl = e.url || null;
    w.lcpFamily = e.element ? getComputedStyle(e.element).fontFamily : null;
    w.fontsAtLcp = [...document.fonts].filter((f) => f.status === "loaded").map((f) => [f.family, f.weight, f.style, f.unicodeRange.slice(0, 48)].join("|"));
  });
  observe("layout-shift", (e) => { if (!e.hadRecentInput) w.cls += e.value; });
  observe("paint", (e) => { if (e.name === "first-contentful-paint") w.fcp = e.startTime; });
  observe("longtask", (e) => w.tasks.push([e.startTime, e.duration]));
  observe("long-animation-frame", (e) =>
    w.frames.push({
      startMs: Math.round(e.startTime), durationMs: Math.round(e.duration), blockingMs: Math.round(e.blockingDuration || 0),
      scripts: e.scripts.map((s) => ({ url: s.sourceURL || s.invoker || "", fn: s.sourceFunctionName || s.invoker || "", ms: Math.round(s.duration) })),
    }));
})()`;

const READ = `(() => {
  const w = window.__wv;
  const fams = (sel) => [...new Set([...document.querySelectorAll(sel)].map((e) => getComputedStyle(e).fontFamily))];
  return { ...w, headingFamilies: fams("h1,h2,h3"), bodyFamily: getComputedStyle(document.body).fontFamily,
    fontsLoadedNow: [...document.fonts].filter((f) => f.status === "loaded").length, fontsReady: document.fonts.status };
})()`;

const median = (a) => {
  if (!a.length) return null; // no run had the value (a run with no LCP entry is left out, not counted as 0)
  const s = [...a].sort((x, y) => x - y);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};
const round = (n, d = 1) => (n == null ? null : Math.round(n * 10 ** d) / 10 ** d);
const bump = (map, key, bytes) => {
  const e = (map[key] ??= { count: 0, bytes: 0 });
  e.count += 1;
  e.bytes += bytes;
};

async function oneRun(page, size) {
  const c = await launch(size);
  try {
    const reqs = new Map();
    let t0; // the first request is the document: its time is the page's time origin (to a few ms)
    const bfNotUsed = [];
    c.on("Network.requestWillBeSent", (p) => {
      t0 ??= p.timestamp;
      reqs.set(p.requestId, { url: p.request.url, type: p.type ?? "Other", bytes: 0, done: false, startMs: (p.timestamp - t0) * 1000, priority: p.request.initialPriority });
    });
    c.on("Network.responseReceived", (p) => {
      const r = reqs.get(p.requestId);
      if (r) r.type = p.type ?? r.type;
    });
    c.on("Network.loadingFinished", (p) => {
      const r = reqs.get(p.requestId);
      if (r) Object.assign(r, { bytes: p.encodedDataLength ?? 0, done: true, endMs: (p.timestamp - t0) * 1000 });
    });
    c.on("Network.loadingFailed", (p) => {
      const r = reqs.get(p.requestId);
      if (r) r.failed = p.errorText;
    });
    c.on("Page.backForwardCacheNotUsed", (p) => bfNotUsed.push(...(p.notRestoredExplanations ?? []).map((x) => x.reason)));
    if (CPU > 1) await c.send("Emulation.setCPUThrottlingRate", { rate: CPU });
    if (THROTTLE) await c.send("Network.emulateNetworkConditions", { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
    await c.send("Page.addScriptToEvaluateOnNewDocument", { source: OBSERVE });
    const load = loadavg()[0];
    const load3 = loadavg().map((x) => round(x, 2)); // the 1, 5 and 15 minute averages
    await c.send("Page.navigate", { url: BASE + page });
    await sleep(SETTLE_MS);
    const w = await c.evaluate(READ);
    const byOrigin = {};
    const byType = {};
    const failed = [];
    let total = 0; // the http(s) requests of the load, counted here, before the page is left and re-entered (a back/forward round trip adds its own)
    for (const r of reqs.values()) {
      if (!/^https?:/.test(r.url)) continue;
      total += 1;
      bump(byOrigin, new URL(r.url).origin, r.bytes);
      bump(byType, r.type, r.bytes);
      if (r.failed) failed.push(r.url.slice(0, 120) + " " + r.failed);
    }
    // the biggest requests of the load up to SETTLE_MS (5.6 s, so "the first five seconds" plus the settle: no request is cut by its start time), origin and path only, what the first screen is made of
    const largest = [...reqs.values()]
      .filter((r) => /^https?:/.test(r.url) && r.bytes > 0)
      .sort((x, y) => y.bytes - x.bytes)
      .slice(0, 6)
      .map((r) => ({ url: new URL(r.url).origin.replace(/localhost:\d+/, "localhost") + new URL(r.url).pathname.slice(0, 90), type: r.type, bytes: r.bytes, startMs: round(r.startMs), endMs: round(r.endMs) }));
    // the page-view counter: when its request left, how long it took and the priority the browser gave it
    const counterReq = [...reqs.values()].find((r) => r.url.includes("/api/page-view"));
    const counter = counterReq ? { startMs: round(counterReq.startMs), endMs: round(counterReq.endMs), priority: counterReq.priority } : null;
    const fontFiles = [...reqs.values()].filter((r) => r.type === "Font").map((r) => ({ file: new URL(r.url).pathname.split("/").pop(), origin: new URL(r.url).origin, bytes: r.bytes, startMs: round(r.startMs), endMs: round(r.endMs), beforeLcp: r.endMs != null && r.endMs <= w.lcp }));
    const tbt = w.tasks.filter(([s]) => s >= (w.fcp ?? 0) && s <= WINDOW_MS).reduce((a, [, d]) => a + Math.max(0, d - 50), 0);
    // The back/forward cache: leave for another document of the site, come back, and see whether this very page object is still there.
    await c.evaluate("window.__wvLeft = true");
    await c.send("Page.navigate", { url: BASE + "/__away" });
    await sleep(900);
    const hist = await c.send("Page.getNavigationHistory");
    await c.send("Page.navigateToHistoryEntry", { entryId: hist.entries[hist.currentIndex - 1].id });
    await sleep(1500);
    const restored = (await c.evaluate("window.__wvLeft === true")) === true;
    return {
      lcpMs: round(w.lcp), lcpElement: w.lcpElement, lcpUrl: w.lcpUrl, lcpFamily: w.lcpFamily, fcpMs: round(w.fcp),
      cls: round(w.cls, 4), tbtMs: round(tbt),
      longFrames: w.frames.filter((f) => f.startMs <= WINDOW_MS),
      fontsAtLcp: w.fontsAtLcp,
      fontFiles, headingFamilies: w.headingFamilies, bodyFamily: w.bodyFamily,
      requests: { byOrigin, byType, total, failed, largest },
      counter,
      bfcache: { restored, reasons: [...new Set(bfNotUsed)] },
      loadAverage: round(load, 2),
      load1_5_15: load3,
    };
  } finally {
    await c.close();
  }
}

const spread = (runs, key) => {
  const v = runs.map((r) => r[key]).filter((x) => x != null);
  return [Math.min(...v), Math.max(...v)];
};

const results = [];
for (const size of SIZES) {
  for (const page of PAGES) {
    const runs = [];
    for (let i = 0; i < RUNS; i++) runs.push(await oneRun(page, size));
    const med = { lcpMs: median(runs.map((r) => r.lcpMs).filter((x) => x != null)), cls: median(runs.map((r) => r.cls)), tbtMs: median(runs.map((r) => r.tbtMs)) };
    results.push({ page, size: size.name, dpr: size.dpr, mobile: size.mobile, runs, median: med, spread: { lcpMs: spread(runs, "lcpMs"), cls: spread(runs, "cls"), tbtMs: spread(runs, "tbtMs") } });
    console.log(`${size.name} ${page}: LCP ${med.lcpMs} ms (${runs.map((r) => r.lcpMs).join(", ")}) CLS ${med.cls} TBT ${med.tbtMs} bfcache ${runs.map((r) => r.bfcache.restored).join("/")} ${runs[0].lcpElement}`);
  }
}
writeFileSync(out, JSON.stringify({ base: BASE.replace(/localhost:\d+/, "localhost"), chrome: "headless, fresh profile per run", runsPerCase: RUNS, throttle: THROTTLE ? "150 ms, 1.6 Mbit/s" : "none", cpu: CPU === 1 ? "none" : `${CPU}x slower`, windowMs: WINDOW_MS, results }, null, 1));
