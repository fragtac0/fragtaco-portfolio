// Drive a headless Chrome over the DevTools protocol: run a list of steps
// (navigate, wait, eval, key, click, shot) and print each eval result.
// usage: BASE=http://localhost:5178 node scripts/audit/cdp.mjs <steps.json> <outdir>
// Step keys: size, dpr, mobile, touch, reduce, net {kbps, latency}, nocache, cpu, init, go, wait, key (+vk),
// click, move, sweep, tap, drag, eval (+label), shot. "{{BASE}}" in a steps file is replaced by $BASE.
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const [stepsFile, outDir] = process.argv.slice(2);
const BASE = process.env.BASE ?? "http://localhost:5178";
const steps = JSON.parse(readFileSync(stepsFile, "utf8").replaceAll("{{BASE}}", BASE));
mkdirSync(outDir, { recursive: true });
const port = 9333 + Math.floor(Math.random() * 400);
const chrome = spawn("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", [
  "--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${outDir}/profile`,
  "--no-first-run", "--hide-scrollbars", "--window-size=1440,900", "about:blank",
], { stdio: "ignore" });
const sleep = ms => new Promise(r => setTimeout(r, ms));

let wsUrl;
for (let i = 0; i < 50 && !wsUrl; i++) {
  await sleep(200);
  try {
    const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    wsUrl = list.find(t => t.type === "page")?.webSocketDebuggerUrl;
  } catch { /* not up yet */ }
}
const ws = new WebSocket(wsUrl);
await new Promise(r => ws.addEventListener("open", r, { once: true }));
let id = 0; const pending = new Map();
ws.addEventListener("message", e => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
const send = (method, params = {}) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });

await send("Page.enable"); await send("Runtime.enable"); await send("Network.enable");
for (const s of steps) {
  if (s.size) await send("Emulation.setDeviceMetricsOverride", { width: s.size[0], height: s.size[1], deviceScaleFactor: s.dpr ?? 1, mobile: !!s.mobile });
  if (s.touch !== undefined) await send("Emulation.setTouchEmulationEnabled", { enabled: s.touch, maxTouchPoints: 5 });
  if (s.reduce !== undefined) await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: s.reduce ? "reduce" : "no-preference" }] });
  if (s.init) await send("Page.addScriptToEvaluateOnNewDocument", { source: s.init });
  if (s.net) await send("Network.emulateNetworkConditions", { offline: false, latency: s.net.latency ?? 0, downloadThroughput: (s.net.kbps ?? 0) * 125, uploadThroughput: (s.net.kbps ?? 0) * 125 });
  if (s.nocache !== undefined) await send("Network.setCacheDisabled", { cacheDisabled: s.nocache });
  if (s.cpu) await send("Emulation.setCPUThrottlingRate", { rate: s.cpu });
  if (s.go) { await send("Page.navigate", { url: s.go }); }
  if (s.wait) await sleep(s.wait);
  if (s.key) for (const type of ["keyDown", "keyUp"]) await send("Input.dispatchKeyEvent", { type, key: s.key, code: s.key, windowsVirtualKeyCode: s.vk ?? 0 });
  if (s.click) for (const type of ["mouseMoved", "mousePressed", "mouseReleased"]) await send("Input.dispatchMouseEvent", { type, x: s.click[0], y: s.click[1], button: "left", clickCount: 1 });
  if (s.move) await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: s.move[0], y: s.move[1] });
  if (s.sweep) { const [x0, y0, x1, y1, n] = s.sweep; for (let i = 0; i <= n; i++) { await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: x0 + (x1 - x0) * i / n, y: y0 + (y1 - y0) * i / n }); await sleep(16); } }
  if (s.tap) { const tp = [{ x: s.tap[0], y: s.tap[1] }]; await send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: tp }); await sleep(60); await send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }); }
  if (s.drag) { const [x0, y0, x1, y1, n] = s.drag; await send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: x0, y: y0 }] }); for (let i = 1; i <= n; i++) { await send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x0 + (x1 - x0) * i / n, y: y0 + (y1 - y0) * i / n }] }); await sleep(16); } await send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }); }
  if (s.eval) {
    const r = await send("Runtime.evaluate", { expression: s.eval, awaitPromise: true, returnByValue: true });
    console.log(JSON.stringify({ step: s.label ?? "eval", value: r.result?.result?.value ?? r.result?.exceptionDetails?.exception?.description }));
  }
  if (s.shot) {
    const r = await send("Page.captureScreenshot", { format: "jpeg", quality: 85 });
    writeFileSync(`${outDir}/${s.shot}.jpg`, Buffer.from(r.result.data, "base64"));
    console.log(JSON.stringify({ step: "shot", file: `${outDir}/${s.shot}.jpg` }));
  }
}
ws.close(); chrome.kill();
