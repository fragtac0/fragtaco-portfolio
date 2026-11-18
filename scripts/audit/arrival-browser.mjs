// The browser side of make-arrival.mjs (R56, round 7 change-arrival spec 5.4): one headless Chrome per run over the DevTools protocol, held (never answered)
// or generated picture requests, and the warm-up of a page.
import { spawn } from "node:child_process";
import { rmSync } from "node:fs";
import sharp from "sharp";
import { INIT } from "./arrival-page.mjs";

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function withBrowser(size, tag, outDir, fn) {
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

export async function arm(b, { blocked, generated }) {
  if (!generated && !blocked) return;
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

export async function goAndWarm(b, base, start) {
  await b.send("Page.navigate", { url: base + start });
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
