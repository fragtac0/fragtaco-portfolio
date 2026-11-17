// The browser walks of security.mjs: one cold browser per page and size that loads the page and uses everything on it (both home boxes
// opened by their button and by their deep link, a book and a video opened, the wall and the shelf panned, a home card opened), and one
// browser per size that runs every page change, both ways, through the debug hook of the page-change audits and through Back and Forward.
// With `inject` set, the document responses are given a `Content-Security-Policy-Report-Only: <inject>` header on their way in (the
// inventory run of Trusted Types: no policy is enforced, every violation is only reported to the page).
import { launch, sleep } from "./chrome-lite.mjs";
import { COLLECT_INIT, collect } from "./security-events.mjs";

export const SIZES = [
  { name: "1440x900", width: 1440, height: 900, dpr: 1, mobile: false },
  { name: "390x844", width: 390, height: 844, dpr: 2, mobile: true },
];
export const PAGES = ["/", "/work", "/work/long-form", "/work/short-form", "/experience"];

const INIT = `try{sessionStorage.setItem('ft:debug-change','1')}catch(e){}`;
const INIT_SEEN = `try{sessionStorage.setItem('ft:intro-seen','1');sessionStorage.setItem('ft:debug-change','1')}catch(e){}`;

export async function open(size, base, { inject, introSeen }) {
  const c = await launch(size);
  const events = await collect(c, new URL(base).origin);
  await c.send("Page.addScriptToEvaluateOnNewDocument", { source: COLLECT_INIT + (introSeen ? INIT_SEEN : INIT) });
  if (inject) {
    await c.send("Fetch.enable", { patterns: [{ resourceType: "Document", requestStage: "Response" }] });
    // Fetch.continueResponse does not make Chrome read a changed policy header: the response is rebuilt (decoded body, its headers plus ours)
    c.on("Fetch.requestPaused", (p) => {
      if (!p.responseStatusCode) return void c.send("Fetch.continueRequest", { requestId: p.requestId }).catch(() => {});
      const headers = (p.responseHeaders ?? []).filter((h) => !["content-encoding", "content-length", "transfer-encoding"].includes(h.name.toLowerCase()));
      headers.push({ name: "Content-Security-Policy-Report-Only", value: inject });
      c.send("Fetch.getResponseBody", { requestId: p.requestId })
        .then((b) => c.send("Fetch.fulfillRequest", { requestId: p.requestId, responseCode: p.responseStatusCode, responseHeaders: headers, body: b.base64Encoded ? b.body : Buffer.from(b.body).toString("base64") }))
        .catch(() => c.send("Fetch.continueResponse", { requestId: p.requestId }).catch(() => {}));
    });
  }
  const go = async (url, ms = 6000) => {
    await c.send("Page.navigate", { url });
    await sleep(ms);
  };
  const mouse = (type, x, y, extra = {}) => c.send("Input.dispatchMouseEvent", { type, x, y, button: "left", buttons: type === "mouseReleased" ? 0 : 1, clickCount: 1, ...extra });
  const click = async (x, y) => {
    if (size.mobile) {
      await c.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
      await c.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    } else {
      await c.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
      await mouse("mousePressed", x, y);
      await mouse("mouseReleased", x, y);
    }
  };
  const drag = async (x0, y0, x1, y1, n = 12) => {
    if (size.mobile) {
      await c.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: x0, y: y0 }] });
      for (let i = 1; i <= n; i++) await c.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x0 + ((x1 - x0) * i) / n, y: y0 + ((y1 - y0) * i) / n }] });
      await c.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    } else {
      await c.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: x0, y: y0 });
      await mouse("mousePressed", x0, y0);
      for (let i = 1; i <= n; i++) await c.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: x0 + ((x1 - x0) * i) / n, y: y0 + ((y1 - y0) * i) / n, button: "left", buttons: 1 });
      await mouse("mouseReleased", x1, y1);
    }
  };
  const wheel = async (x, y, dx, dy, n = 6) => {
    for (let i = 0; i < n; i++) {
      await c.send("Input.dispatchMouseEvent", { type: "mouseWheel", x, y, deltaX: dx, deltaY: dy });
      await sleep(40);
    }
  };
  const move = (x, y) => c.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
  const key = async (k, vk) => {
    await c.send("Input.dispatchKeyEvent", { type: "keyDown", key: k, windowsVirtualKeyCode: vk, code: k });
    await c.send("Input.dispatchKeyEvent", { type: "keyUp", key: k, windowsVirtualKeyCode: vk, code: k });
  };
  const rect = (sel) => c.evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});if(!e)return null;const r=e.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2,w:r.width,h:r.height}})()`);
  const clickSel = async (sel) => {
    const r = await rect(sel);
    if (r) await click(r.x, r.y);
    return !!r;
  };
  const ev = (e) => c.evaluate(e);
  return { c, events, go, click, drag, wheel, move, key, rect, clickSel, ev, size };
}

/** Pans and clicks inside a full-screen box (the open shelf or wall) and leaves it by Escape. */
async function useOpenBox(w, pause) {
  const { width, height } = w.size;
  const cx = width / 2, cy = height / 2;
  await w.move(cx, cy);
  await w.drag(cx + 160, cy, cx - 160, cy, 14);
  await sleep(pause);
  await w.wheel(cx, cy, 120, 0, 6);
  await sleep(pause / 2);
  await w.click(cx, cy); // a book or a tile opens its detail
  await sleep(pause);
  await w.key("Escape", 27);
  await sleep(pause / 2);
  await w.click(cx - 200, cy - 100);
  await sleep(pause / 2);
  await w.key("Escape", 27);
  await sleep(pause / 2);
}

async function walkHome(w) {
  await w.go(`${w.base}/`, 9000); // the loader plays on a first visit (6.3 s)
  await w.ev(`document.getElementById("blkRead")?.scrollIntoView({block:"center",behavior:"instant"})`);
  await sleep(4000);
  if (await w.clickSel("[data-xp=reading]")) {
    await sleep(3500);
    await useOpenBox(w, 1200);
    await w.clickSel(".xp-close");
    await sleep(1800);
  }
  await w.ev(`document.getElementById("blkWatch")?.scrollIntoView({block:"center",behavior:"instant"})`);
  await sleep(4000);
  if (await w.clickSel("[data-xp=watching]")) {
    await sleep(3500);
    await useOpenBox(w, 1200);
    await w.clickSel(".xp-close");
    await sleep(1800);
  }
  // the two deep links open their box on load (no loader), a different code path
  for (const hash of ["#reading", "#watching"]) {
    await w.go(`${w.base}/${hash}`, 6000);
    await useOpenBox(w, 1000);
  }
  // a home card (the key opens the next one) and the dock
  await w.go(`${w.base}/`, 3000);
  await w.ev(`scrollTo({top:0,behavior:"instant"})`);
  await w.key("ArrowRight", 39);
  await sleep(1500);
  await w.key("Escape", 27);
  await sleep(800);
}

async function walkOther(w, route) {
  await w.go(`${w.base}${route}`, 7000);
  const { width, height } = w.size;
  await w.move(width / 2, height / 2);
  await w.wheel(width / 2, height / 2, 0, 300, 5);
  await sleep(1500);
  await w.drag(width * 0.7, height / 2, width * 0.3, height / 2, 12);
  await sleep(1500);
  await w.wheel(width / 2, height / 2, 200, 0, 5);
  await sleep(1500);
  await w.ev(`scrollTo({top:document.documentElement.scrollHeight,behavior:"instant"})`);
  await sleep(2500);
}

/** What the walk saw. With a policy injected in report-only form, a write it must report (the canary) proves the injection took; its report is not counted against the site. */
async function finish(w, opts) {
  if (opts.inject) await w.ev(`(()=>{try{document.createElement("div").innerHTML="<b>canary</b>"}catch(e){}})()`);
  await sleep(300);
  const snap = w.events.snapshot();
  if (opts.inject) {
    const i = snap.violations.findIndex((v) => v.sample?.includes("canary"));
    snap.canaryReported = i >= 0;
    if (i >= 0) snap.violations.splice(i, 1);
  }
  return snap;
}

/** One cold browser, one page, everything used on it. */
export async function walkPage(base, size, route, opts = {}) {
  const w = await open(size, base, opts);
  w.base = base;
  try {
    if (route === "/") await walkHome(w);
    else await walkOther(w, route);
    return { page: route, size: size.name, ...(await finish(w, opts)) };
  } finally {
    await w.c.close();
  }
}

/** An Euler circuit over every ordered pair of pages: each change both ways, chained, so each page is left and entered four times. */
export function changeCircuit(pages) {
  const left = new Map(pages.map((p) => [p, pages.filter((q) => q !== p)]));
  const stack = [pages[0]];
  const path = [];
  while (stack.length) {
    const v = stack[stack.length - 1];
    const next = left.get(v).pop();
    if (next === undefined) path.push(stack.pop());
    else stack.push(next);
  }
  return path.reverse();
}

const SETTLED = (to) => `new Promise((r) => { const t0 = performance.now(); const i = setInterval(() => { const ok = location.pathname === ${JSON.stringify(to)} && (window.__ftSettled ? window.__ftSettled() : true); if (ok || performance.now() - t0 > 12000) { clearInterval(i); r(ok); } }, 100); })`;

/** One cold browser per size: every page change both ways, then Back and Forward. */
export async function walkChanges(base, size, opts = {}) {
  const w = await open(size, base, { ...opts, introSeen: true });
  w.base = base;
  const steps = [];
  try {
    await w.go(`${base}/`, 7000);
    // the glass warms up in idle time; the change plays with its bend only after that
    await w.ev(`new Promise((r)=>{const t=setInterval(()=>{if(performance.getEntriesByName('glass-warm').length){clearInterval(t);r(1)}},100);setTimeout(()=>{clearInterval(t);r(0)},15000)})`);
    const route = changeCircuit(PAGES);
    for (let i = 1; i < route.length; i++) {
      await w.ev(`window.__ftChange(${JSON.stringify(route[i])})`);
      const ok = await w.ev(SETTLED(route[i]));
      // arriving at "/" by a page change: the loader must not run again (html.intro is only ever put there by the server's head script)
      const introClass = route[i] === "/" ? await w.ev(`document.documentElement.classList.contains("intro")`) : undefined;
      steps.push({ from: route[i - 1], to: route[i], settled: ok, ...(introClass === undefined ? {} : { introClass }) });
      await sleep(1200);
    }
    // Back and Forward: three steps each way through the history the changes built
    for (const dir of ["back", "back", "back", "forward", "forward", "forward"]) {
      const before = await w.ev("location.pathname");
      await w.ev(`history.${dir === "back" ? "back" : "forward"}()`);
      await sleep(4500);
      const after = await w.ev("location.pathname");
      steps.push({ history: dir, from: before, to: after, settled: before !== after });
    }
    return { size: size.name, changes: steps, ...(await finish(w, opts)) };
  } finally {
    await w.c.close();
  }
}

/**
 * The report round trip: a page that breaks its own policy on purpose (a picture from an origin the policy does not name), left open so the
 * browser can deliver its report. `done()` closes it and says whether the browser's report reached the server (read from the server's log).
 */
export async function startReportProbe(base, serverLog) {
  // the browser is told to trust the proxy's certificate (https-proxy.mjs); only this one browser is
  const flags = process.env.CHROME_FLAGS;
  process.env.CHROME_FLAGS = "--ignore-certificate-errors";
  const w = await open(SIZES[0], base, {});
  if (flags === undefined) delete process.env.CHROME_FLAGS;
  else process.env.CHROME_FLAGS = flags;
  await w.c.send("Page.navigate", { url: `${base}/experience` });
  await sleep(3000);
  await w.ev(`(()=>{const i=new Image();i.src="https://csp-probe.invalid/probe.png";document.body.appendChild(i);return 1})()`);
  return {
    async done(timeoutMs = 120000) {
      const { readFileSync } = await import("node:fs");
      let hit = null;
      const t0 = Date.now();
      while (!hit && Date.now() - t0 < timeoutMs) {
        try {
          hit = readFileSync(serverLog, "utf8").split("\n").find((l) => l.includes("csp-report") && l.includes("csp-probe.invalid")) ?? null;
        } catch {
          /* no log yet */
        }
        if (!hit) await sleep(3000);
      }
      const seen = w.events.snapshot().violations.filter((v) => String(v.blocked).includes("csp-probe.invalid"));
      await w.c.close();
      return { violationEvent: seen.length > 0, reached: !!hit, line: hit ? hit.slice(0, 500) : null, waitedMs: Date.now() - t0 };
    },
  };
}
