// The resilience cases of security.mjs: the page paths that are not a normal visit, each at both sizes, on the production build.
//   404       a first load of an address the site does not have: the error page shows, with the headers of a document and no script without
//             the nonce (Remix's default 404 page wrote one inline script, which the policy blocked and reported on every 404).
//   extension an element inserted at the start of <body> before the page's scripts run, as a browser extension's content script does: React 18
//             then finds the server's markup different, throws away its adoption and renders the whole root in the browser. That path makes
//             script elements through innerHTML, which Trusted Types refuses when it is enforced (the page went blank: ruling R134).
//   failed    a page change whose data request answers 500: the root error page shows, and a later page change recovers the page.
// A case passes when the page is not blank, the expected text shows, and no ENFORCED violation happened. `report-only` Trusted Types events are
// recorded (they are what the report-only header exists to show), not failed, and so are the console errors and exceptions React itself raises
// for the mismatch.
import { open } from "./security-walk.mjs";
import { sleep } from "./chrome-lite.mjs";

const PLAIN = "document.body ? document.body.innerText.length : -1";
const STATE = `({ body: !!document.body, bodyChildren: document.body ? document.body.children.length : -1, textLen: ${PLAIN}, h1: document.querySelector("h1")?.textContent ?? null, probe: !!document.getElementById("ext-probe"), path: location.pathname })`;
const EXTENSION = `(() => {
  const put = () => { if (document.body && !document.getElementById("ext-probe")) { const s = document.createElement("span"); s.id = "ext-probe"; document.body.prepend(s); return true; } return false; };
  if (!put()) { const mo = new MutationObserver(() => { if (put()) mo.disconnect(); }); mo.observe(document, { childList: true, subtree: true }); }
})();`;

/** What a snapshot says, in the form the record keeps: each kind of event once with its count. */
function summarize(snap) {
  const count = (list, key) => Object.entries(list.reduce((m, x) => ((m[key(x)] = (m[key(x)] ?? 0) + 1), m), {})).map(([what, n]) => ({ what, n }));
  return {
    enforced: snap.violations.filter((v) => v.disposition === "enforce").map((v) => ({ directive: v.effective, sample: v.sample, blocked: v.blocked })),
    reportOnly: count(snap.violations.filter((v) => v.disposition !== "enforce"), (v) => `${v.effective} | ${v.sample}`),
    consoleErrors: count(snap.consoleErrors, (e) => e.slice(0, 120)),
    exceptions: count(snap.exceptions, (e) => e.slice(0, 120)),
    bad: snap.bad.map((b) => `${b.status || b.failed} ${b.url}`),
  };
}

async function control(base, size, route) {
  const w = await open(size, base, { introSeen: true });
  try {
    await w.c.send("Page.navigate", { url: base + route });
    await sleep(route === "/" ? 8000 : 6000);
    return await w.ev(STATE);
  } finally {
    await w.c.close();
  }
}

/** Runs the three cases for one size. Returns { cases: [...], failures: [...] }. */
export async function walkResilience(base, size) {
  const cases = [];
  const failures = [];
  const judge = (name, state, snap, checks) => {
    const events = summarize(snap);
    const row = { case: name, size: size.name, state, events };
    for (const [ok, why] of checks) if (!ok) failures.push(`${name} ${size.name}: ${why} (state ${JSON.stringify(state)})`);
    if (events.enforced.length) failures.push(`${name} ${size.name}: ${events.enforced.length} enforced securitypolicyviolation event(s): ${JSON.stringify(events.enforced.slice(0, 3))}`);
    cases.push(row);
  };

  // 1. a 404 on a first load
  {
    const w = await open(size, base, { introSeen: true });
    try {
      await w.c.send("Page.navigate", { url: `${base}/nope` });
      await sleep(5000);
      const state = await w.ev(STATE);
      const snap = w.events.snapshot();
      const doc = snap.docs.find((d) => d.type === "Document");
      judge("404 first load", { ...state, documentStatus: doc?.status }, snap, [
        [state.body, "the page is blank"],
        [state.h1 === "404 Not Found", `the error page does not show (h1: ${state.h1})`],
        [doc?.status === 404, `the document status is ${doc?.status}, wanted 404`],
        [snap.violations.length === 0, `${snap.violations.length} securitypolicyviolation event(s): the 404 page must break no policy, report-only included`],
      ]);
    } finally {
      await w.c.close();
    }
  }

  // 2. an element put into the page before hydration, on the home page and on a plain one
  for (const route of ["/", "/experience"]) {
    const plain = await control(base, size, route);
    const w = await open(size, base, { introSeen: true });
    try {
      await w.c.send("Page.addScriptToEvaluateOnNewDocument", { source: EXTENSION });
      await w.c.send("Page.navigate", { url: base + route });
      await sleep(route === "/" ? 8000 : 6000);
      const state = await w.ev(STATE);
      const snap = w.events.snapshot();
      judge(`element before hydration on ${route}`, { ...state, plainTextLen: plain.textLen, plainBodyChildren: plain.bodyChildren }, snap, [
        [state.body, "the page is blank (document.body is gone)"],
        [state.textLen >= plain.textLen * 0.8, `the page lost its text (${state.textLen} against ${plain.textLen} without the element)`],
        [state.bodyChildren >= plain.bodyChildren * 0.8, `the page lost its elements (${state.bodyChildren} against ${plain.bodyChildren})`],
      ]);
    } finally {
      await w.c.close();
    }
  }

  // 3. a page change whose data request fails, then a change that recovers
  {
    const plain = await control(base, size, "/experience");
    const w = await open(size, base, { introSeen: true });
    try {
      let failing = true;
      await w.c.send("Fetch.enable", { patterns: [{ urlPattern: "*_data=*", requestStage: "Request" }] });
      w.c.on("Fetch.requestPaused", (p) => {
        if (failing) w.c.send("Fetch.fulfillRequest", { requestId: p.requestId, responseCode: 500, responseHeaders: [{ name: "Content-Type", value: "text/plain" }], body: Buffer.from("boom").toString("base64") }).catch(() => {});
        else w.c.send("Fetch.continueRequest", { requestId: p.requestId }).catch(() => {});
      });
      await w.c.send("Page.navigate", { url: `${base}/experience` });
      await sleep(7000);
      await w.ev(`(window.__remixRouter.navigate("/work/long-form"), 1)`);
      await sleep(4000);
      const during = await w.ev(STATE);
      failing = false;
      await w.ev(`(window.__remixRouter.navigate("/experience"), 1)`);
      await sleep(4000);
      const after = await w.ev(STATE);
      const snap = w.events.snapshot();
      judge("page change whose data request fails (500)", { during, after, plainTextLen: plain.textLen }, snap, [
        [during.body, "the page is blank during the error"],
        [during.h1 === "Application Error", `the error page does not show (h1: ${during.h1})`],
        [after.body && after.path === "/experience" && after.h1 !== "Application Error", "the page did not recover on the next page change"],
        [after.textLen >= plain.textLen * 0.8, `the recovered page lost its text (${after.textLen} against ${plain.textLen})`],
      ]);
    } finally {
      await w.c.close();
    }
  }
  return { cases, failures };
}
