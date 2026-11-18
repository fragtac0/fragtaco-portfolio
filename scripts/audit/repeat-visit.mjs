// What a second visit asks the network for (the cache lifetimes of vercel.json, Task 35): one browser loads a page, waits, then loads it again
// (a navigation, not a reload, so the HTTP cache is used the way a returning visitor's is), and the second load's requests are counted by how they
// reached the server (the proxy's log: scripts/audit/vercel-headers-proxy.mjs, which BASE must point at) and how it answered (200, or 304 for a file
// asked about again). A file the browser kept without asking does not reach the server at all.
// usage: BASE=http://localhost:5181 node scripts/audit/repeat-visit.mjs <out.json> [runs=3] [pages=/,/work,...]
import { writeFileSync } from "node:fs";
import { launch, sleep } from "./chrome-lite.mjs";

const BASE = process.env.BASE ?? "http://localhost:5180";
const [out, runsArg = "3", pagesArg] = process.argv.slice(2);
const PAGES = pagesArg ? pagesArg.split(",") : ["/", "/work", "/work/long-form", "/work/short-form", "/experience"];
const SETTLE_MS = Number(process.env.SETTLE_MS ?? 5600);
const SIZE = { width: 1440, height: 900, dpr: 1, mobile: false };

const getLog = async (clear) => (await fetch(`${BASE}/__log${clear ? "?clear" : ""}`)).json();

/** One visit: the proxy's log says what reached the server and how it answered (200, or 304 for a file asked about again). */
async function visit(c, page) {
  await getLog(true);
  await c.send("Page.navigate", { url: BASE + page });
  await sleep(SETTLE_MS);
  const log = await getLog(true);
  // what the picture folders cost the page, from its own resource timing: the time from asking to the first byte, summed (a file kept by the browser costs about 0)
  const timing = await c.evaluate(`(() => { const e = performance.getEntriesByType("resource").filter((r) => /\\/(paintings|mars|grounds|portraits|stack)\\//.test(r.name)); return { files: e.length, waitMs: Math.round(e.reduce((a, r) => a + Math.max(0, r.responseStart - r.startTime), 0)), lastEndMs: Math.round(Math.max(0, ...e.map((r) => r.responseEnd))) }; })()`);
  const byFolder = {};
  for (const [path, status] of log) {
    const f = path.split("/")[1] || "(page)";
    const e = (byFolder[f] ??= { fetched: 0, revalidated: 0 });
    e[status === 304 ? "revalidated" : "fetched"]++;
  }
  const folders = (names) => Object.entries(byFolder).filter(([k]) => names.includes(k)).reduce((a, [, v]) => a + v.fetched + v.revalidated, 0);
  return { serverRequests: log.length, revalidated: log.filter(([, s]) => s === 304).length, byFolder, pictureFolderRequests: folders(["paintings", "mars", "grounds", "portraits", "stack"]), pictureTiming: timing };
}

const results = [];
for (const page of PAGES) {
  const runs = [];
  for (let i = 0; i < Number(runsArg); i++) {
    const c = await launch(SIZE);
    try {
      const first = await visit(c, page);
      await c.send("Page.navigate", { url: "about:blank" }); // leave, then come back (the same address again would be a reload)
      await sleep(600);
      const second = await visit(c, page);
      runs.push({ first, second });
    } finally {
      await c.close();
    }
  }
  results.push({ page, runs });
  const second = runs.map((r) => r.second);
  console.log(`${page}: first visit ${runs.map((r) => r.first.serverRequests).join("/")} requests reach the server; second visit ${second.map((m) => m.serverRequests).join("/")}, of them ${second.map((m) => m.revalidated).join("/")} answered 304 and ${second.map((m) => m.pictureFolderRequests).join("/")} for the picture folders (waiting ${second.map((m) => m.pictureTiming.waitMs).join("/")} ms in all)`);
}
if (out) writeFileSync(out, JSON.stringify({ base: BASE.replace(/localhost:\d+/, "localhost"), settleMs: SETTLE_MS, results }, null, 1));
