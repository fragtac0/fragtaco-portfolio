// Drive a headless Chrome over the DevTools protocol: run a list of steps
// (navigate, wait, eval, key, click, shot) and print each eval result.
// usage: BASE=http://localhost:5178 node scripts/audit/cdp.mjs <steps.json> <outdir>
// Step keys: size, dpr, mobile, touch, reduce, net {kbps, latency}, nocache, cpu, init, go, wait, key (+vk), mdrag [x0,y0,x1,y1,n] (mouse), wheel [x,y,dx,dy,n],
// click, move, sweep, tap, drag, eval (+label), shot, requests ({match} + label: the hosts requested since the last such step), sample ({grid:[cols,rows]} + label: photographs the page and prints the share of pixels
// darker than #2a2826, the share of orange-hued pixels and the average colour on a grid; see PIXEL_SAMPLER below). "{{BASE}}" in a steps file is replaced by $BASE.
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const [stepsFile, outDir] = process.argv.slice(2);
const BASE = process.env.BASE ?? "http://localhost:5178";
const steps = JSON.parse(readFileSync(stepsFile, "utf8").replaceAll("{{BASE}}", BASE));
mkdirSync(outDir, { recursive: true });
const port = 9333 + Math.floor(Math.random() * 400);
const chrome = spawn("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", [
  "--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${outDir}/profile`,
  "--no-first-run", "--hide-scrollbars", "--window-size=1440,900",
  // opt-in: CHROME_FLAGS="--enable-unsafe-webgpu --enable-features=Vulkan" (see scripts/audit/README.md, the ground)
  ...(process.env.CHROME_FLAGS ? process.env.CHROME_FLAGS.split(/\s+/).filter(Boolean) : []),
  "about:blank",
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
const requested = []; // every request the page made since the last `requests` step
ws.addEventListener("message", e => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } else if (m.method === "Network.requestWillBeSent") requested.push(m.params.request.url); });
const send = (method, params = {}) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });

await send("Page.enable"); await send("Runtime.enable"); await send("Network.enable");
// Runs inside the page on a PNG screenshot: darker = luma under that of #2a2826; orange = hue 5 to 45 degrees,
// HSV saturation 0.45 or more and value 0.16 or more (bright enough to read as a colour, not just a warm black).
const PIXEL_SAMPLER = (b64, cols, rows) => `(async()=>{
  const cols = ${cols}, rows = ${rows};
  const bmp = await createImageBitmap(await (await fetch("data:image/png;base64,${b64}")).blob());
  const c = new OffscreenCanvas(bmp.width, bmp.height), x = c.getContext("2d", { willReadFrequently: true });
  x.drawImage(bmp, 0, 0); const { data, width, height } = x.getImageData(0, 0, bmp.width, bmp.height);
  const limit = 0.2126 * 42 + 0.7152 * 40 + 0.0722 * 38; let dark = 0, strict = 0, orange = 0, orangeLoose = 0, maxL = 0;
  const acc = Array.from({ length: cols * rows }, () => [0, 0, 0, 0]);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const r = data[i], g = data[i + 1], b = data[i + 2], l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    if (l < limit) dark++; if (r <= 42 && g <= 40 && b <= 38) strict++; if (l > maxL) maxL = l;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn, sat = mx ? d / mx : 0;
    let h = 0; if (d) h = mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60;
    if (h >= 5 && h <= 45 && sat >= 0.45) { if (mx >= 0.16 * 255) orange++; if (mx >= 0.08 * 255) orangeLoose++; }
    const cx = Math.min(cols - 1, Math.floor((p % width) / width * cols)), cy = Math.min(rows - 1, Math.floor(Math.floor(p / width) / height * rows)), a = acc[cy * cols + cx];
    a[0] += r; a[1] += g; a[2] += b; a[3]++;
  }
  const n = width * height, f = v => Math.round(v / n * 10000) / 100;
  return JSON.stringify({ size: [width, height], darkerThan2a2826: f(dark), strictChannels: f(strict), orange: f(orange), orangeLoose: f(orangeLoose), maxLuma: Math.round(maxL),
    grid: acc.map(a => a.slice(0, 3).map(v => Math.round(v / a[3])).join(",")) });
})()`;
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
  if (s.key) for (const type of ["keyDown", "keyUp"]) {
    // Enter and Space need their text on the keyDown, or a focused button never activates
    const text = type === "keyDown" ? (s.key === "Enter" ? "\r" : s.key === " " ? " " : undefined) : undefined;
    await send("Input.dispatchKeyEvent", { type, key: s.key, code: s.key, windowsVirtualKeyCode: s.vk ?? 0, ...(text ? { text } : {}) });
  }
  if (s.click) for (const type of ["mouseMoved", "mousePressed", "mouseReleased"]) await send("Input.dispatchMouseEvent", { type, x: s.click[0], y: s.click[1], button: "left", clickCount: 1 });
  if (s.move) await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: s.move[0], y: s.move[1] });
  if (s.sweep) { const [x0, y0, x1, y1, n] = s.sweep; for (let i = 0; i <= n; i++) { await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: x0 + (x1 - x0) * i / n, y: y0 + (y1 - y0) * i / n }); await sleep(16); } }
  if (s.tap) { const tp = [{ x: s.tap[0], y: s.tap[1] }]; await send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: tp }); await sleep(60); await send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }); }
  if (s.drag) { const [x0, y0, x1, y1, n] = s.drag; await send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: x0, y: y0 }] }); for (let i = 1; i <= n; i++) { await send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x0 + (x1 - x0) * i / n, y: y0 + (y1 - y0) * i / n }] }); await sleep(16); } await send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }); }
  if (s.mdrag) { const [x0, y0, x1, y1, n] = s.mdrag; await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: x0, y: y0 }); await send("Input.dispatchMouseEvent", { type: "mousePressed", x: x0, y: y0, button: "left", buttons: 1, clickCount: 1 }); for (let i = 1; i <= n; i++) { await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: x0 + (x1 - x0) * i / n, y: y0 + (y1 - y0) * i / n, button: "left", buttons: 1 }); await sleep(16); } await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: x1, y: y1, button: "left", buttons: 0, clickCount: 1 }); }
  if (s.wheel) { const [x, y, dx, dy, n] = s.wheel; for (let i = 0; i < (n ?? 1); i++) { await send("Input.dispatchMouseEvent", { type: "mouseWheel", x, y, deltaX: dx, deltaY: dy }); await sleep(16); } }
  if (s.eval) {
    const r = await send("Runtime.evaluate", { expression: s.eval, awaitPromise: true, returnByValue: true });
    console.log(JSON.stringify({ step: s.label ?? "eval", value: r.result?.result?.value ?? r.result?.exceptionDetails?.exception?.description }));
  }
  if (s.requests) {
    // the hosts every request since the last `requests` step went to (data: and blob: urls left out), and the urls that contain s.requests.match
    const urls = requested.splice(0).filter(u => !/^(data|blob):/.test(u));
    const hosts = [...new Set(urls.map(u => { try { return new URL(u).host; } catch { return u; } }))];
    console.log(JSON.stringify({ step: s.label ?? "requests", hosts, total: urls.length, matching: s.requests.match ? urls.filter(u => u.includes(s.requests.match)).map(u => u.replace(/^https?:\/\/[^/]+/, "")) : undefined }));
  }
  if (s.sample) {
    const [cols, rows] = s.sample.grid ?? [8, 5];
    const png = await send("Page.captureScreenshot", { format: "png" });
    const r = await send("Runtime.evaluate", { expression: PIXEL_SAMPLER(png.result.data, cols, rows), awaitPromise: true, returnByValue: true });
    console.log(JSON.stringify({ step: s.label ?? "sample", value: r.result?.result?.value ?? r.result?.exceptionDetails?.exception?.description }));
  }
  if (s.shot) {
    const r = await send("Page.captureScreenshot", { format: "jpeg", quality: 85 });
    writeFileSync(`${outDir}/${s.shot}.jpg`, Buffer.from(r.result.data, "base64"));
    console.log(JSON.stringify({ step: "shot", file: `${outDir}/${s.shot}.jpg` }));
  }
}
ws.close(); chrome.kill();
