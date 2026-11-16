// The page change's cost gate (R56, round 7 change-arrival spec 4): what one warmed change from home to the portfolio page costs the
// browser's compositor threads. The R33 frame-gap gate measures the gaps between animation frames in a headless browser at 60 Hz on a quiet
// machine and cannot see this cost (every frame is still presented there; a 120 Hz screen has no headroom left).
//
//   BASE=http://localhost:5180 node scripts/audit/make-glass-cost.mjs <outdir> [--size 1512x982@2] [--runs 3] [--ready glass-warm] [--label text] [--json file] [--gpu-detail]
//
// Each run starts a fresh headless Chrome (a new profile), loads `/` at the size and pixel ratio, waits for the `--ready` mark (default
// `glass-warm`; a build before R56 has none: `--ready glass-bend-ready`), runs one change to /work and back to warm it, then traces one change to
// /work (categories toplevel, benchmark, viz, gpu, cc, blink.user_timing, __metadata) between two `performance.mark`s (`pc-start` when `data-change-kind`
// goes on <html>, `pc-end` when it comes off) and prints, for that window, the busy time of the top-level tasks on `Renderer/Compositor` and
// `GPU Process/VizCompositorThread`, and the counts of the `PipelineReporter` states (a frame is presented when its state is STATE_PRESENTED_ALL or
// _PARTIAL; STATE_DROPPED* is a frame that was not). The gate: compositor at most 450 ms, viz at most 300 ms, no dropped frame; `--json` writes the
// rows and the verdict. Every row also names the slices behind the GPU process's main thread (`CrGpuMain`) busy time (`gpuMainTop`: the five
// names with the most self time inside the window, and the self time split into waits (names with Backpressure, WaitFor, Wait, Sleep or Idle in them: the thread blocked on the display or on the GPU, not work) and work; `--gpu-detail` adds the GPU service and ANGLE categories to the trace so that the work inside
// a task has names, at some cost to the trace itself). Timing-sensitive: run it under the gate lock (see lanes-common.md in the build ledger).
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";

const argv = process.argv.slice(2);
const outDir = argv[0];
if (!outDir || outDir.startsWith("--")) throw new Error("usage: make-glass-cost.mjs <outdir> [--size WxH@dpr] [--runs n] [--ready mark] [--label text] [--json file]");
const opt = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};
const [W, H, DPR] = opt("size", "1512x982@2").split(/[x@]/).map(Number);
const RUNS = Number(opt("runs", "3"));
const READY = opt("ready", "glass-warm");
const LABEL = opt("label", "");
const JSON_OUT = opt("json", "");
const GPU_DETAIL = argv.includes("--gpu-detail");
const CATEGORIES = ["toplevel", "benchmark", "viz", "gpu", "cc", "blink.user_timing", "__metadata", ...(GPU_DETAIL ? ["disabled-by-default-gpu.service", "gpu.angle", "disabled-by-default-skia.gpu"] : [])];
const BASE = process.env.BASE ?? "http://localhost:5180";
export const GATE = { rendererCompositorMs: 450, vizCompositorMs: 300 };
mkdirSync(outDir, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** One link click, with the start and the end of the change marked and the frames counted by animation frame. */
const CHANGE = (href, marked) => `(async () => {
  const a = [...document.querySelectorAll('a')].find((x) => x.getAttribute('href') === ${JSON.stringify(href)});
  if (!a) return { err: 'no link ' + ${JSON.stringify(href)} };
  const html = document.documentElement;
  let startAt = null, endAt = null, run = true, bend = '', frames = 0;
  const loop = (now) => {
    const k = html.dataset.changeKind;
    if (k && startAt === null) { startAt = now; ${marked ? "performance.mark('pc-start');" : ""} }
    if (k) bend = html.dataset.glass || bend;
    if (!k && startAt !== null && endAt === null) { endAt = now; ${marked ? "performance.mark('pc-end');" : ""} }
    if (startAt !== null && endAt === null) frames++;
    if (run) requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  a.click();
  await new Promise((r) => setTimeout(r, 3600));
  run = false;
  return { changeMs: Math.round((endAt ?? 0) - (startAt ?? 0)), rafFrames: frames, bend, glassAttr: html.dataset.glass ?? '', fallback: 'glassFallback' in html.dataset };
})()`;

async function oneRun(n) {
  const port = 9000 + Math.floor(Math.random() * 900);
  const profile = `${outDir}/profile-${n}`;
  rmSync(profile, { recursive: true, force: true });
  const chrome = spawn(
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    ["--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "--no-first-run", "--hide-scrollbars", `--window-size=${W},${H}`, "about:blank"],
    { stdio: "ignore" },
  );
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
    let events = [];
    let traceDone = null;
    ws.addEventListener("message", (e) => {
      const m = JSON.parse(e.data);
      if (m.id && pending.has(m.id)) {
        pending.get(m.id)(m);
        pending.delete(m.id);
      } else if (m.method === "Tracing.dataCollected") events.push(...m.params.value);
      else if (m.method === "Tracing.tracingComplete") traceDone?.();
    });
    const send = (method, params = {}) =>
      new Promise((r) => {
        const i = ++id;
        pending.set(i, r);
        ws.send(JSON.stringify({ id: i, method, params }));
      });
    const ev = async (expression) => {
      const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
      if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 400));
      return r.result?.result?.value;
    };
    await send("Page.enable");
    await send("Runtime.enable");
    await send("Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: DPR, mobile: false });
    await send("Page.addScriptToEvaluateOnNewDocument", { source: "try{sessionStorage.setItem('ft:intro-seen','1')}catch(e){}" });
    await send("Page.navigate", { url: `${BASE}/` });
    let warm = false;
    for (let i = 0; i < 120 && !warm; i++) {
      await sleep(250);
      try {
        warm = await ev(`performance.getEntriesByType('mark').some((m) => m.name === ${JSON.stringify(READY)})`);
      } catch {
        /* the page is still loading */
      }
    }
    if (!warm) return { run: n, error: `the ${READY} mark never came` };
    await sleep(800);
    await ev(CHANGE("/work", false)); // warm the change: there and back
    await sleep(500);
    await ev(CHANGE("/", false));
    await sleep(800);
    events = [];
    await send("Tracing.start", {
      transferMode: "ReportEvents",
      traceConfig: { recordMode: "recordAsMuchAsPossible", includedCategories: CATEGORIES },
    });
    const change = await ev(CHANGE("/work", true));
    const done = new Promise((r) => (traceDone = r));
    await send("Tracing.end");
    await done;
    const marks = events.filter((e) => e.name === "pc-start" || e.name === "pc-end");
    const t0 = marks.find((e) => e.name === "pc-start")?.ts;
    const t1 = marks.find((e) => e.name === "pc-end")?.ts;
    if (!t0 || !t1) return { run: n, error: "the change's marks are not in the trace", change };
    const threads = new Map();
    const procs = new Map();
    for (const e of events) {
      if (e.ph === "M" && e.name === "thread_name") threads.set(`${e.pid}:${e.tid}`, e.args.name);
      if (e.ph === "M" && e.name === "process_name") procs.set(e.pid, e.args.name);
    }
    const busy = {};
    for (const e of events) {
      if (e.ph !== "X" || !(e.cat || "").includes("toplevel") || e.ts < t0 || e.ts > t1) continue;
      if (!/RunTask|ThreadController/.test(e.name)) continue;
      const key = `${procs.get(e.pid) || "?"}/${threads.get(`${e.pid}:${e.tid}`) || "?"}`;
      busy[key] = (busy[key] || 0) + e.dur / 1000;
    }
    // the slices behind one thread's busy time: self time (a slice's duration less its children's) by name, the biggest few
    const WAIT = /Backpressure|WaitFor|::Wait|Sleep|Idle/;
    const slices = (threadKey, n = GPU_DETAIL ? 8 : 5) => {
      const own = events
        .filter((e) => e.ph === "X" && e.ts >= t0 && e.ts <= t1 && `${procs.get(e.pid) || "?"}/${threads.get(`${e.pid}:${e.tid}`) || "?"}` === threadKey)
        .sort((a, b) => a.ts - b.ts || b.dur - a.dur);
      const self = new Map();
      const stack = [];
      for (const e of own) {
        while (stack.length && stack[stack.length - 1].end <= e.ts) stack.pop();
        if (stack.length) stack[stack.length - 1].self -= e.dur;
        const node = { name: e.name, end: e.ts + e.dur, self: e.dur };
        stack.push(node);
        self.set(node, e.name);
      }
      const byName = {};
      for (const [node, name] of self) {
        byName[name] ??= { ms: 0, count: 0, maxMs: 0 };
        byName[name].ms += node.self / 1000;
        byName[name].count++;
        byName[name].maxMs = Math.max(byName[name].maxMs, node.self / 1000);
      }
      const all = Object.entries(byName);
      const sum = (rows) => Math.round(rows.reduce((t, [, v]) => t + v.ms, 0));
      return {
        selfMs: sum(all),
        waitMs: sum(all.filter(([name]) => WAIT.test(name))),
        workMs: sum(all.filter(([name]) => !WAIT.test(name))),
        top: all
          .sort((a, b) => b[1].ms - a[1].ms)
          .slice(0, n)
          .map(([name, v]) => ({ name, ms: Math.round(v.ms), count: v.count, maxMs: Math.round(v.maxMs) })),
      };
    };
    const gpuSlices = slices("GPU Process/CrGpuMain");
    const states = {};
    for (const e of events) {
      if (e.name !== "PipelineReporter" || e.ts < t0 || e.ts > t1) continue;
      const a = e.args?.chrome_frame_reporter ?? e.args?.frame_reporter ?? {};
      if (a.state) states[a.state] = (states[a.state] || 0) + 1;
    }
    const dropped = Object.entries(states).filter(([k]) => k.startsWith("STATE_DROPPED")).reduce((s, [, v]) => s + v, 0);
    const presented = Object.entries(states).filter(([k]) => k.startsWith("STATE_PRESENTED")).reduce((s, [, v]) => s + v, 0);
    const ms = (k) => Math.round(busy[k] ?? 0);
    const row = {
      run: n,
      windowMs: Math.round((t1 - t0) / 1000),
      rendererCompositorMs: ms("Renderer/Compositor"),
      vizCompositorMs: ms("GPU Process/VizCompositorThread"),
      gpuMainMs: ms("GPU Process/CrGpuMain"),
      rendererMainMs: ms("Renderer/CrRendererMain"),
      gpuMainSelfMs: gpuSlices.selfMs,
      gpuMainWaitMs: gpuSlices.waitMs,
      gpuMainWorkMs: gpuSlices.workMs,
      gpuMainTop: gpuSlices.top,
      presented,
      dropped,
      states,
      change,
    };
    row.pass =
      row.rendererCompositorMs <= GATE.rendererCompositorMs && row.vizCompositorMs <= GATE.vizCompositorMs && dropped === 0 && presented > 0 && change.bend === "bend";
    ws.close();
    return row;
  } finally {
    chrome.kill();
  }
}

const rows = [];
for (let n = 1; n <= RUNS; n++) {
  const row = await oneRun(n);
  rows.push(row);
  console.log(JSON.stringify(row));
}
const verdict = {
  label: LABEL,
  base: BASE,
  size: `${W}x${H}@${DPR}`,
  ready: READY,
  gate: GATE,
  runs: rows,
  pass: rows.length === RUNS && rows.every((r) => r.pass === true),
};
console.log(`${LABEL || "cost"} ${verdict.size}: ${verdict.pass ? "PASS" : "FAIL"} (renderer compositor ${rows.map((r) => r.rendererCompositorMs).join("/")} ms, viz ${rows.map((r) => r.vizCompositorMs).join("/")} ms, dropped ${rows.map((r) => r.dropped).join("/")})`);
if (JSON_OUT) writeFileSync(JSON_OUT, JSON.stringify(verdict, null, 1));
