// Drive a headless Chrome over the DevTools protocol: run a list of steps
// (navigate, wait, eval, key, click, shot) and print each eval result.
// usage: BASE=http://localhost:5178 node scripts/audit/cdp.mjs <steps.json> <outdir>
// Step keys: size, dpr, mobile, touch, reduce, net {kbps, latency}, nocache, cpu, init, go, wait, key (+vk), mdrag [x0,y0,x1,y1,n] (mouse; may be an expression), wheel [x,y,dx,dy,n],
// click, move, sweep, tap, drag (click, move and tap also take a string: an expression the page answers with [x, y]), eval (+label), shot, requests ({match} + label: the hosts requested since the last such step), sample ({grid:[cols,rows]} + label: photographs the page and prints the share of pixels
// darker than #2a2826, the share of orange-hued pixels and the average colour on a grid; see PIXEL_SAMPLER below),
// film ({ms, dark?, share?, rect?, keep?, at?} + label: the page runs `eval` first when given, then every frame the compositor produces for `ms` is photographed (a screencast); each is
// reduced to 48 by 30 cells (over the `rect` selector's box, read once the film is over, e.g. "#hero"; the whole frame without it) and a frame counts as bare when `share` (0.75) or more of its cells are darker than luma `dark` (20); prints the frame count, the longest gap between frames, `darkShareMax` (the largest share of dark cells in any frame), the box measured, the
// bare frames and `ok` (`flat`: a frame whose cells' luma spread is under that also counts as bare, a plain ground; `ats`: saves the frames nearest those times as <keep>-<ms>.jpg; `series`: prints [ms, spread, mean] of every frame); `keep` saves the darkest frame as <keep>.jpg and, with `at` (ms after the start), the frame nearest that time as <keep>-at.jpg; see FILM_LUMA below). "{{BASE}}" in a steps file is replaced by $BASE.
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
const castFrames = []; // screencast frames of the `film` step: every frame the compositor produced, not one in a while
ws.addEventListener("message", e => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } else if (m.method === "Network.requestWillBeSent") requested.push(m.params.request.url); else if (m.method === "Page.screencastFrame") { castFrames.push({ t: performance.now(), data: m.params.data }); ws.send(JSON.stringify({ id: ++id, method: "Page.screencastFrameAck", params: { sessionId: m.params.sessionId } })); } });
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
// Runs inside the page on a JPEG frame: the share of 48 by 30 cells whose luma is under `dark`, and the mean luma.
// `box` is {x, y, w, h} in CSS pixels (or null: the whole frame); the frame's scale to CSS pixels is read from the frame itself.
const FILM_LUMA = (b64, dark, box) => `(async()=>{const b=await createImageBitmap(await (await fetch("data:image/jpeg;base64,${b64}")).blob());const c=new OffscreenCanvas(48,30),x=c.getContext("2d");
  const bx=${JSON.stringify(box ?? null)},k=b.width/innerWidth;if(bx)x.drawImage(b,bx.x*k,bx.y*k,bx.w*k,bx.h*k,0,0,48,30);else x.drawImage(b,0,0,48,30);
  const d=x.getImageData(0,0,48,30).data;let under=0,sum=0,sq=0;for(let i=0;i<d.length;i+=4){const l=0.2126*d[i]+0.7152*d[i+1]+0.0722*d[i+2];sum+=l;sq+=l*l;if(l<${dark})under++}const m=sum/1440;return [under/1440,m,Math.sqrt(Math.max(0,sq/1440-m*m))]})()`;
async function runFilm(f, label) {
  const dark = f.dark ?? 20, share = f.share ?? 0.75;
  castFrames.length = 0;
  await send("Page.startScreencast", { format: "jpeg", quality: 40, everyNthFrame: 1 });
  const t0 = performance.now();
  if (f.eval) void send("Runtime.evaluate", { expression: f.eval, awaitPromise: true, returnByValue: true });
  await sleep(f.ms);
  await send("Page.stopScreencast");
  const frames = castFrames.splice(0);
  const rows = [];
  let box = null;
  if (f.rect) {
    const r = await send("Runtime.evaluate", { expression: `(()=>{const e=document.querySelector(${JSON.stringify(f.rect)});if(!e)return null;const r=e.getBoundingClientRect();const x=Math.max(0,r.left),y=Math.max(0,r.top),w=Math.min(innerWidth,r.right)-x,h=Math.min(innerHeight,r.bottom)-y;return w>0&&h>0?{x,y,w,h}:null})()`, returnByValue: true });
    box = r.result?.result?.value ?? null;
  }
  for (const fr of frames) { const v = (await send("Runtime.evaluate", { expression: FILM_LUMA(fr.data, dark, box), awaitPromise: true, returnByValue: true })).result?.result?.value ?? [1, 0]; rows.push({ at: Math.round(fr.t - t0), share: +v[0].toFixed(2), mean: +v[1].toFixed(1), std: +(v[2] ?? 99).toFixed(2), data: fr.data }); }
  const bare = rows.filter(r => r.share >= share || (f.flat != null && r.std < f.flat));
  let gap = 0; for (let i = 1; i < rows.length; i++) gap = Math.max(gap, rows[i].at - rows[i - 1].at);
  if (f.keep && rows.length) { const worst = rows.reduce((a, b) => (b.share > a.share ? b : a)); writeFileSync(`${outDir}/${f.keep}.jpg`, Buffer.from(worst.data, "base64")); }
  if (f.keep && f.at != null && rows.length) { const near = rows.reduce((a, b) => (Math.abs(b.at - f.at) < Math.abs(a.at - f.at) ? b : a)); writeFileSync(`${outDir}/${f.keep}-at.jpg`, Buffer.from(near.data, "base64")); }
  if (f.keep && f.ats) for (const a of f.ats) { const near = rows.reduce((p, b) => (Math.abs(b.at - a) < Math.abs(p.at - a) ? b : p)); writeFileSync(`${outDir}/${f.keep}-${String(a).padStart(4, "0")}.jpg`, Buffer.from(near.data, "base64")); }
  console.log(JSON.stringify({ step: label ?? "film", stdMin: rows.length ? Math.min(...rows.map(r => r.std)) : null, stdSeries: f.series ? rows.map(r => [r.at, r.std, r.mean]) : undefined, frames: rows.length, longestGapMs: gap, firstMs: rows[0]?.at, lastMs: rows.at(-1)?.at, darkShareMax: rows.length ? Math.max(...rows.map(r => r.share)) : null, box: box ? [Math.round(box.x), Math.round(box.y), Math.round(box.w), Math.round(box.h)] : (f.rect ? "not found: whole frame" : "whole frame"), bareFrames: bare.map(r => [r.at, r.share, r.mean, r.std]), ok: rows.length > 5 && bare.length === 0 }));
}
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
  // click, move and tap may be an expression (a string) that the page answers with [x, y]
  for (const k of ["click", "move", "tap", "mdrag"]) if (typeof s[k] === "string") s[k] = (await send("Runtime.evaluate", { expression: s[k], awaitPromise: true, returnByValue: true })).result?.result?.value;
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
  if (s.film) await runFilm(s.film, s.label);
  if (s.shot) {
    const r = await send("Page.captureScreenshot", { format: "jpeg", quality: 85 });
    writeFileSync(`${outDir}/${s.shot}.jpg`, Buffer.from(r.result.data, "base64"));
    console.log(JSON.stringify({ step: "shot", file: `${outDir}/${s.shot}.jpg` }));
  }
}
ws.close(); chrome.kill();
