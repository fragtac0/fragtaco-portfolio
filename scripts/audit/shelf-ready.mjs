// How long a visitor looks at the reading box's dark ground before the shelf draws (the web pass, Task 35 fix round: BOOKS_PER_STEP).
// usage: BUILDS="base=http://localhost:5184,after=http://localhost:5180" node scripts/audit/shelf-ready.mjs <out.json> [rounds=6]
//   SCENARIO=first|change   first: load the home cold; change: load /work, then take the dock's link to the home (a page change)
//   SIZE=1440x900[@dpr]     a width under 700 is the phone profile (touch)      CPU=4      the page runs on a CPU 4 times slower
//   SCROLL_AT=500,1000,1500 ms after the load's start (first) or after the click (change) at which the box is scrolled into view
// Per run: a cold browser, the audit hook of use-scene-engines.ts (when the shelf was asked to prepare and was built), a recorder on every
// animation frame (the box's place, the frame gaps), a MutationObserver on `data-drawn` (the box's first live draw) and the long
// animation frames. It reports the time from the box coming on screen to its first live draw (`waitMs`; 0 when it was already drawn,
// `readyFirst`), the frames over 34 ms from the box's arrival to 300 ms after its draw, and the longest one. `waitMs` over 400 ms is a click
// the open gate would have turned into the plain grid (layer/open-gate.ts READY_WAIT_MS). Builds are alternated (the order flips each
// round) so a drift of the machine hits both. Hold the timing lock for numbers that mean anything.
import { writeFileSync } from "node:fs";
import { loadavg } from "node:os";
import { launch, sleep } from "./chrome-lite.mjs";

const [out, roundsArg = "6"] = process.argv.slice(2);
if (!out || !process.env.BUILDS) {
  console.error('usage: BUILDS="base=http://localhost:5184,after=http://localhost:5180" node scripts/audit/shelf-ready.mjs <out.json> [rounds]');
  process.exit(1);
}
const builds = process.env.BUILDS.split(",").map((s) => s.split("=")).map(([name, url]) => ({ name, url }));
const SCENARIO = process.env.SCENARIO ?? "first";
const sizeArg = process.env.SIZE ?? "1440x900";
const [wh, dprArg] = sizeArg.split("@");
const [width, height] = wh.split("x").map(Number);
const dpr = Number(dprArg ?? 1);
const mobile = width < 700;
const CPU = Number(process.env.CPU ?? 1);
const SCROLLS = (process.env.SCROLL_AT ?? "1000").split(",").map(Number);
const ROUNDS = Number(roundsArg);
const SETTLE = Number(process.env.SETTLE_MS ?? 2500); // change: how long /work is left to settle before the click

const REC = `(() => {
  try { sessionStorage.setItem("ft:debug-engines", "1"); } catch (e) {}
  const r = (window.__sr = { gaps: [], frames: [], drawn: null, onScreen: null, scrollAt: null, prep: {} });
  const scene = () => document.querySelector('.box-scene[data-kind="reading"]');
  const box = () => scene()?.closest(".blk-box") ?? scene();
  new MutationObserver((list) => { for (const m of list) { const t = m.target; if (t.dataset && t.dataset.kind === "reading" && t.hasAttribute("data-drawn")) r.drawn ??= performance.now(); } })
    .observe(document, { subtree: true, attributes: true, attributeFilter: ["data-drawn"] });
  let last = performance.now();
  const tick = (t) => {
    if (t - last > 34) r.gaps.push([Math.round(last), Math.round(t - last)]);
    last = t;
    if (r.scrollAt !== null && r.onScreen === null) { const b = box(); if (b) { const q = b.getBoundingClientRect(); if (q.bottom > 0 && q.top < innerHeight) r.onScreen = t; } }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  window.__scrollBox = () => { // the box into view, once it exists
    const go = () => { const b = box(); if (!b) return void requestAnimationFrame(go); b.scrollIntoView({ block: "center", behavior: "instant" }); r.scrollAt = performance.now(); };
    go();
  };
  try { new PerformanceObserver((l) => l.getEntries().forEach((e) => r.frames.push([Math.round(e.startTime), Math.round(e.duration), Math.round(e.blockingDuration || 0)]))).observe({ type: "long-animation-frame", buffered: true }); } catch (e) {}
  let v;
  Object.defineProperty(window, "__ftEngines", { configurable: true, get: () => v,
    set: (e) => { v = e; const o = e && e.shelf; if (!o || !o.prepare) return; const orig = o.prepare.bind(o);
      o.prepare = () => { r.prep.calledMs ??= Math.round(performance.now()); const p = orig(); p.then(() => (r.prep.doneMs ??= Math.round(performance.now()))); return p; }; } });
})()`;

async function oneRun(url, scrollAt) {
  const c = await launch({ width, height, dpr, mobile });
  try {
    if (CPU > 1) await c.send("Emulation.setCPUThrottlingRate", { rate: CPU });
    await c.send("Page.addScriptToEvaluateOnNewDocument", { source: REC });
    const load = loadavg();
    let clickAt = 0;
    if (SCENARIO === "change") {
      await c.send("Page.navigate", { url: url + "/work" });
      await sleep(SETTLE);
      // the dock's link to the home: a client-side page change; the timer for the scroll starts with the click
      clickAt = await c.evaluate(`(() => { const a = document.querySelector('a[href="/"]'); const t = performance.now(); window.setTimeout(() => window.__scrollBox(), ${scrollAt}); a.click(); return t; })()`);
      await sleep(scrollAt + 4500);
    } else {
      await c.send("Page.addScriptToEvaluateOnNewDocument", { source: `window.setTimeout(() => window.__scrollBox(), ${scrollAt})` });
      await c.send("Page.navigate", { url: url + "/" });
      await sleep(scrollAt + 5500);
    }
    const r = JSON.parse(await c.evaluate("JSON.stringify(window.__sr)"));
    const onScreen = r.onScreen === null ? null : Math.round(r.onScreen);
    const drawn = r.drawn === null ? null : Math.round(r.drawn);
    const waitMs = onScreen === null || drawn === null ? null : Math.max(0, drawn - onScreen);
    const from = onScreen ?? 0;
    const to = drawn === null ? from + 3000 : Math.max(drawn, from) + 300;
    const win = r.gaps.filter(([t]) => t >= from - 50 && t <= to);
    const loaf = r.frames.filter(([s, d]) => s + d >= from && s <= to);
    return {
      scrollAtMs: Math.round(r.scrollAt - clickAt), onScreenMs: onScreen === null ? null : onScreen - Math.round(clickAt), drawnMs: drawn === null ? null : drawn - Math.round(clickAt),
      waitMs, readyFirst: drawn !== null && onScreen !== null && drawn <= onScreen,
      prepCalledMs: r.prep.calledMs === undefined ? null : r.prep.calledMs - Math.round(clickAt), prepDoneMs: r.prep.doneMs === undefined ? null : r.prep.doneMs - Math.round(clickAt),
      gapsOver34: win.length, maxGapMs: win.reduce((m, [, g]) => Math.max(m, g), 0), loafOver50: loaf.length, loafMaxMs: loaf.reduce((m, [, d]) => Math.max(m, d), 0), loafBlockMs: loaf.reduce((s, [, , b]) => s + b, 0),
      load1_5_15: load.map((x) => Math.round(x * 100) / 100),
    };
  } finally {
    await c.close();
  }
}

const med = (a) => { const s = a.filter((x) => x !== null).sort((x, y) => x - y); return s.length ? s[Math.floor((s.length - 1) / 2)] : null; };
const records = [];
for (const scrollAt of SCROLLS) {
  for (let round = 0; round < ROUNDS; round++) {
    const order = round % 2 ? [...builds].reverse() : builds;
    for (const b of order) {
      const r = await oneRun(b.url, scrollAt);
      records.push({ build: b.name, scenario: SCENARIO, size: sizeArg, cpu: CPU, scrollAt, round: round + 1, ...r });
      console.log(`${SCENARIO} ${sizeArg} cpu${CPU} scroll ${scrollAt} round ${round + 1} ${b.name}: on screen ${r.onScreenMs}, drawn ${r.drawnMs}, wait ${r.waitMs}${r.readyFirst ? " (ready first)" : ""}, prepare ${r.prepCalledMs}..${r.prepDoneMs}, gaps>34 ${r.gapsOver34} max ${r.maxGapMs}, LoAF ${r.loafOver50} max ${r.loafMaxMs}, load ${r.load1_5_15[0]}`);
    }
  }
}
console.log("\nsummary (median, min to max)");
for (const scrollAt of SCROLLS) {
  for (const b of builds) {
    const rs = records.filter((r) => r.build === b.name && r.scrollAt === scrollAt);
    const w = rs.map((r) => r.waitMs).filter((x) => x !== null);
    console.log(`scroll ${scrollAt} ${b.name}: wait ${med(rs.map((r) => r.waitMs))} (${Math.min(...w)} to ${Math.max(...w)}), ready first ${rs.filter((r) => r.readyFirst).length}/${rs.length}, wait over 400: ${w.filter((x) => x > 400).length}, drawn at ${med(rs.map((r) => r.drawnMs))}, prepare done ${med(rs.map((r) => r.prepDoneMs))}, gaps>34 median ${med(rs.map((r) => r.gapsOver34))} (max of runs ${Math.max(...rs.map((r) => r.gapsOver34))}), longest gap ${med(rs.map((r) => r.maxGapMs))} (${Math.max(...rs.map((r) => r.maxGapMs))}), LoAF max ${med(rs.map((r) => r.loafMaxMs))}`);
  }
}
writeFileSync(out, JSON.stringify({ builds, scenario: SCENARIO, size: sizeArg, cpu: CPU, scrollAts: SCROLLS, rounds: ROUNDS, records }, null, 1));
