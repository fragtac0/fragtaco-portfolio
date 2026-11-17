// Where a first load spends its main-thread time (the web pass's step "rank the long frames", Task 35).
// usage: BASE=http://localhost:5180 node scripts/audit/long-frames.mjs <page> <size WxH[@dpr]> [runs=3] [out.json]
// Per run: a cold browser loads the page with a Chrome trace (timeline + the JavaScript sampler) and a requestAnimationFrame recorder
// in the page; the record holds every main-thread task over 50 ms in the first five seconds with what it was made of (by trace event
// name, by script file and by function from the sampler) and every rAF gap over 34 ms. CPU is not throttled unless CPU=4 is set.
// The sampler slows the page, so a task's length is read from a second run without it (PROFILE=0): `tasksOverMin` is the count
// by the plain trace. Hold the timing lock for numbers that mean anything.
import { writeFileSync } from "node:fs";
import { loadavg } from "node:os";
import { launch, sleep } from "./chrome-lite.mjs";

const BASE = process.env.BASE ?? "http://localhost:5180";
const [page = "/", sizeArg = "1440x900", runsArg = "3", out] = process.argv.slice(2);
const [wh, dprArg] = sizeArg.split("@");
const [width, height] = wh.split("x").map(Number);
const dpr = Number(dprArg ?? 1);
const mobile = width < 700;
const RUNS = Number(runsArg);
const PROFILE = process.env.PROFILE !== "0";
const CPU = Number(process.env.CPU ?? 1);
const WINDOW_MS = Number(process.env.WINDOW_MS ?? 5000);
const MIN_TASK_MS = Number(process.env.MIN_TASK_MS ?? 50); // MIN_TASK_MS=15 lists the shorter tasks that add up to a long frame

const REC = `(() => {
  const r = (window.__lf = { gaps: [], frames: [], t0: performance.now() });
  let last = performance.now();
  const tick = (t) => { if (t - last > 34) r.gaps.push([Math.round(last), Math.round(t - last)]); last = t; requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  try { new PerformanceObserver((l) => l.getEntries().forEach((e) => r.frames.push({ s: Math.round(e.startTime), d: Math.round(e.duration), b: Math.round(e.blockingDuration || 0),
    scripts: e.scripts.map((s) => [s.sourceURL || s.invoker, s.sourceFunctionName || s.invoker, Math.round(s.duration), s.invokerType]) }))).observe({ type: "long-animation-frame", buffered: true }); } catch (e) {}
})()`;

const short = (u) => (u || "").replace(/^https?:\/\/[^/]+/, "").replace(/\?.*$/, "").slice(-60);

function analyse(events, navStartTs) {
  // the renderer that loaded the page (a cold browser starts one for about:blank first): the process that saw the page's navigationStart
  const navEv = events.find((e) => e.name === "navigationStart" && e.ts === navStartTs);
  const main = events.find((e) => e.name === "thread_name" && e.args?.name === "CrRendererMain" && e.pid === navEv?.pid);
  const pid = main?.pid;
  const tid = main?.tid;
  const onMain = events.filter((e) => e.pid === pid && e.tid === tid && e.ph === "X");
  const tasks = onMain.filter((e) => e.name === "ThreadControllerImpl::RunTask" && e.dur >= MIN_TASK_MS * 1000 && (e.ts - navStartTs) / 1000 <= WINDOW_MS);
  const report = [];
  for (const t of tasks) {
    const end = t.ts + t.dur;
    const inside = onMain.filter((e) => e !== t && e.ts >= t.ts && e.ts + e.dur <= end && e.name !== "ThreadControllerImpl::RunTask");
    const byName = {};
    for (const e of inside) {
      // top-level children only: skip an event nested in another of the same list to avoid double counting
      if (inside.some((p) => p !== e && p.ts <= e.ts && p.ts + p.dur >= e.ts + e.dur && p.dur > e.dur && p.name !== "FunctionCall" && p.name !== "v8.run" && p.name !== "EvaluateScript")) continue;
      byName[e.name] = (byName[e.name] ?? 0) + e.dur / 1000;
    }
    const scripts = {};
    for (const e of inside.filter((x) => x.name === "FunctionCall" || x.name === "EvaluateScript" || x.name === "v8.compile" || x.name === "v8.run")) {
      const u = short(e.args?.data?.url ?? e.args?.data?.fileName ?? "");
      if (u) scripts[`${e.name} ${u}`] = (scripts[`${e.name} ${u}`] ?? 0) + e.dur / 1000;
    }
    const top = (o, n = 8) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => `${k} ${v.toFixed(1)}`);
    report.push({ startMs: Math.round((t.ts - navStartTs) / 1000), durMs: Math.round(t.dur / 1000), byEvent: top(byName, 10), byScript: top(scripts) });
  }
  // sampler: self time by function inside each long task
  const chunks = events.filter((e) => e.name === "ProfileChunk" && e.pid === pid);
  const nodes = new Map();
  for (const c of chunks) for (const n of c.args?.data?.cpuProfile?.nodes ?? []) nodes.set(n.id, n);
  const perTask = tasks.map(() => ({}));
  for (const c of chunks) {
    const cp = c.args?.data?.cpuProfile;
    const dt = c.args?.data?.timeDeltas ?? [];
    let ts = c.args?.data?.startTime ?? c.ts;
    (cp?.samples ?? []).forEach((id, i) => {
      ts += dt[i] ?? 0;
      const k = tasks.findIndex((t) => ts >= t.ts && ts <= t.ts + t.dur);
      if (k < 0) return;
      const cf = nodes.get(id)?.callFrame;
      if (!cf) return;
      const key = `${cf.functionName || "(anon)"} ${short(cf.url)}:${cf.lineNumber}:${cf.columnNumber}`;
      perTask[k][key] = (perTask[k][key] ?? 0) + (dt[i] ?? 0) / 1000;
    });
  }
  const topN = Number(process.env.TOP_FUNCTIONS ?? 8);
  report.forEach((r, k) => (r.topFunctions = Object.entries(perTask[k]).sort((x, y) => y[1] - x[1]).slice(0, topN).map(([n, v]) => `${n} ${v.toFixed(1)}`)));
  return { tasks: report, tasksOverMin: tasks.length };
}

// ENGINES=1: also read when the two home scenes were asked to prepare, when they were built and when each box first drew its live scene (`drawn`) (the audit hook of use-scene-engines.ts, wrapped as it is set)
const ENGINES = process.env.ENGINES === "1";
const ENGINE_HOOK = `(() => {
  try { sessionStorage.setItem("ft:debug-engines", "1"); } catch (e) {}
  const log = (window.__prep = {});
  // when each home box first drew its live scene (the attribute data-drawn on its .box-scene): when the box's picture is the live one
  new MutationObserver((list) => { for (const m of list) { const t = m.target; if (t.hasAttribute && t.hasAttribute("data-drawn") && t.dataset && t.dataset.kind) ((log.drawn ??= {})[t.dataset.kind] ??= Math.round(performance.now())); } })
    .observe(document, { subtree: true, attributes: true, attributeFilter: ["data-drawn"] });
  let v;
  Object.defineProperty(window, "__ftEngines", { configurable: true,
    get: () => v,
    set: (e) => { v = e; for (const k of ["shelf", "wall"]) { const o = e && e[k]; if (!o || !o.prepare) continue; const orig = o.prepare.bind(o);
      o.prepare = () => { log[k] ??= { calledMs: Math.round(performance.now()) }; const p = orig(); if (!log[k].doneMs) p.then(() => (log[k].doneMs ??= Math.round(performance.now()))); return p; }; } } });
})()`;

const runs = [];
for (let i = 0; i < RUNS; i++) {
  const c = await launch({ width, height, dpr, mobile });
  const events = [];
  c.on("Tracing.dataCollected", (p) => events.push(...p.value));
  let done;
  const complete = new Promise((r) => (done = r));
  c.on("Tracing.tracingComplete", () => done());
  try {
    if (CPU > 1) await c.send("Emulation.setCPUThrottlingRate", { rate: CPU });
    // WARM=/a.html: load another page first (the browser's own first text layout, which costs 70 to 230 ms in a fresh profile, happens there)
    if (process.env.WARM) {
      await c.send("Page.navigate", { url: BASE + process.env.WARM });
      await sleep(1200);
    }
    // SESSION="ft:debug-stall=1000": sessionStorage keys set before the page's own scripts (the audit hooks of the app)
    if (process.env.SESSION) {
      const pairs = process.env.SESSION.split(",").map((kv) => kv.split("="));
      await c.send("Page.addScriptToEvaluateOnNewDocument", { source: `try{${pairs.map(([k, v]) => `sessionStorage.setItem(${JSON.stringify(k)},${JSON.stringify(v)})`).join(";")}}catch(e){}` });
    }
    await c.send("Page.addScriptToEvaluateOnNewDocument", { source: REC });
    if (ENGINES) await c.send("Page.addScriptToEvaluateOnNewDocument", { source: ENGINE_HOOK });
    const load = loadavg()[0];
    await c.send("Tracing.start", {
      categories: "devtools.timeline,v8.execute,blink.user_timing,toplevel" + (PROFILE ? ",disabled-by-default-v8.cpu_profiler" : "") + (process.env.EXTRA_CATEGORIES ? "," + process.env.EXTRA_CATEGORIES : ""),
      transferMode: "ReportEvents",
    });
    await c.send("Page.navigate", { url: BASE + page });
    await sleep(WINDOW_MS + 600);
    const rec = await c.evaluate("JSON.stringify(window.__lf)");
    await c.send("Tracing.end");
    await complete;
    const nav = events.find((e) => e.name === "navigationStart" && e.args?.data?.documentLoaderURL?.startsWith(BASE)) ?? events.find((e) => e.name === "navigationStart");
    const lf = JSON.parse(rec);
    if (process.env.DUMP) (await import("node:fs")).writeFileSync(process.env.DUMP, JSON.stringify(events));
    const a = analyse(events, nav?.ts ?? 0);
    const prep = ENGINES ? await c.evaluate("JSON.stringify(window.__prep)") : null;
    runs.push({ loadAverage: Math.round(load * 100) / 100, ...(prep ? { scenes: JSON.parse(prep) } : {}), ...a, rafGapsOver34: lf.gaps.filter(([t]) => t <= WINDOW_MS), loaf: lf.frames.filter((f) => f.s <= WINDOW_MS) });
    if (prep) console.log("  scenes (asked to prepare, built, drawn):", prep);
    console.log(`run ${i + 1}: ${a.tasksOverMin} tasks over ${MIN_TASK_MS} ms; rAF gaps over 34 ms: ${JSON.stringify(lf.gaps.filter(([t]) => t <= WINDOW_MS))}; LoAF ${lf.frames.filter((f) => f.s <= WINDOW_MS).map((f) => `${f.s}+${f.d}(${f.b})`).join(" ")}`);
    for (const t of a.tasks) console.log(`  task at ${t.startMs} ms, ${t.durMs} ms:`, t.byEvent.slice(0, 4).join(" | "), "\n    scripts:", t.byScript.join(" | "), t.topFunctions?.length ? "\n    sampler: " + t.topFunctions.join(" | ") : "");
  } finally {
    await c.close();
  }
}
if (out) writeFileSync(out, JSON.stringify({ base: BASE.replace(/localhost:\d+/, "localhost"), page, size: sizeArg, cpu: CPU, profile: PROFILE, windowMs: WINDOW_MS, runs }, null, 1));
