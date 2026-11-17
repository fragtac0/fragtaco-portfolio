// A small headless-Chrome driver for the audits that need their own event handling (web-vitals.mjs, text-boxes.mjs):
// one fresh profile (so a cold cache) and one page per call to `launch`, a promise-based `send`, and `on(method, fn)` for events.
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CHROME = process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Starts Chrome with an empty profile; resolves with { send, on, evaluate, close }. */
export async function launch({ width = 1440, height = 900, dpr = 1, mobile = false } = {}) {
  const dir = mkdtempSync(join(process.env.AUDIT_TMP ?? tmpdir(), "chrome-lite-"));
  const port = 9333 + Math.floor(Math.random() * 400);
  const chrome = spawn(
    CHROME,
    [
      "--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${dir}`, "--no-first-run",
      "--hide-scrollbars", `--window-size=${width},${height}`,
      // opt-in, as in cdp.mjs: CHROME_FLAGS="--ignore-certificate-errors" for a local HTTP/2 proxy with a self-made certificate
      ...(process.env.CHROME_FLAGS ? process.env.CHROME_FLAGS.split(/\s+/).filter(Boolean) : []),
      "about:blank",
    ],
    { stdio: "ignore" },
  );
  let wsUrl;
  for (let i = 0; i < 60 && !wsUrl; i++) {
    await sleep(200);
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      wsUrl = list.find((t) => t.type === "page")?.webSocketDebuggerUrl;
    } catch {
      /* not up yet */
    }
  }
  if (!wsUrl) {
    chrome.kill();
    throw new Error("Chrome did not start");
  }
  const ws = new WebSocket(wsUrl);
  await new Promise((r) => ws.addEventListener("open", r, { once: true }));
  let id = 0;
  const pending = new Map();
  const handlers = new Map();
  ws.addEventListener("message", (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) {
      pending.get(m.id)(m);
      pending.delete(m.id);
    } else if (m.method) for (const fn of handlers.get(m.method) ?? []) fn(m.params);
  });
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const i = ++id;
      const timer = setTimeout(() => {
        pending.delete(i);
        reject(new Error(`${method} did not answer in 60 s`));
      }, 60000);
      pending.set(i, (m) => {
        clearTimeout(timer);
        if (m.error) reject(new Error(`${method}: ${m.error.message}`));
        else resolve(m.result);
      });
      ws.send(JSON.stringify({ id: i, method, params }));
    });
  const on = (method, fn) => handlers.set(method, [...(handlers.get(method) ?? []), fn]);
  const evaluate = async (expression) => {
    const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? "evaluate failed");
    return r.result.value;
  };
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Network.enable");
  await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: dpr, mobile });
  if (mobile) await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
  const close = async () => {
    try {
      ws.close();
    } catch {
      /* closed */
    }
    const gone = new Promise((r) => chrome.once("exit", r));
    chrome.kill();
    await Promise.race([gone, sleep(3000)]);
    try {
      rmSync(dir, { recursive: true, force: true, maxRetries: 8, retryDelay: 250 });
    } catch {
      /* a profile left behind in the temp folder is harmless */
    }
  };
  return { send, on, evaluate, close };
}
