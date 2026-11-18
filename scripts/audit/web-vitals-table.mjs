// Merges single-run records of web-vitals.mjs into the record files of the performance doc and prints its tables (Task 35 fix round).
// usage: node scripts/audit/web-vitals-table.mjs <dir of runs> <outdir> <before build name> <after build name>
// The runs are named `<build>-<width>-cpu<N>-<page slug>-<round>.json` (one `web-vitals.mjs <out> 1 <page>` run each, builds alternated, see
// the loop in docs/redesign/performance-2026-11.md). It writes `<outdir>/before-r59-3c[-cpu4].json` and `after-r59-3c[-cpu4].json` in the schema of
// web-vitals.mjs, then prints the markdown tables to stdout: per page and size the LCP (median and spread), CLS, blocking time, bytes by origin
// (site / YouTube / covers: Open Library and the archive.org hosts it redirects to), the http(s) requests of the load, and the largest requests
// of each page's first screen. KB are 1024 bytes of the encoded size, medians of the runs.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";

const [dir, outDir, beforeName, afterName] = process.argv.slice(2);
if (!dir || !outDir || !beforeName || !afterName) {
  console.error("usage: node scripts/audit/web-vitals-table.mjs <dir of runs> <outdir> <before build name> <after build name>");
  process.exit(1);
}
const PAGES = [
  ["/", "_"],
  ["/work", "_work"],
  ["/work/long-form", "_work_long-form"],
  ["/work/short-form", "_work_short-form"],
  ["/experience", "_experience"],
];
const SIZES = [
  ["1440x900", "1440"],
  ["390x844", "390"],
];

const med = (a) => {
  const s = a.filter((x) => x != null).sort((x, y) => x - y);
  if (!s.length) return null;
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};
const kb = (n) => Math.round(n / 1024);
const files = readdirSync(dir);

function runsOf(build, width, cpu, slug) {
  const re = new RegExp(`^${build}-${width}-cpu${cpu}-${slug.replace(/[-/]/g, "\\$&")}-(\\d+)\\.json$`);
  return files
    .map((f) => ({ f, m: f.match(re) }))
    .filter((x) => x.m)
    .sort((a, b) => Number(a.m[1]) - Number(b.m[1]))
    .map((x) => JSON.parse(readFileSync(`${dir}/${x.f}`, "utf8")))
    .map((j) => ({ run: j.results[0].runs[0], meta: j }));
}

function bytesBy(run) {
  let site = 0, yt = 0, covers = 0;
  for (const [origin, v] of Object.entries(run.requests.byOrigin)) {
    if (origin.startsWith("http://localhost")) site += v.bytes;
    else if (origin === "https://i.ytimg.com") yt += v.bytes;
    else if (origin === "https://covers.openlibrary.org" || origin.endsWith(".archive.org")) covers += v.bytes;
  }
  return { site, yt, covers };
}

const summary = {};
for (const cpu of [1, 4]) {
  for (const [name, label] of [[beforeName, "before"], [afterName, "after"]]) {
    const results = [];
    let any;
    for (const [size, width] of SIZES) {
      for (const [page, slug] of PAGES) {
        const rs = runsOf(name, width, cpu, slug);
        if (!rs.length) continue;
        any = rs[0].meta;
        const runs = rs.map((x) => x.run);
        const lcp = runs.map((r) => r.lcpMs).filter((x) => x != null);
        results.push({
          page, size, runs,
          median: { lcpMs: med(lcp), cls: med(runs.map((r) => r.cls)), tbtMs: med(runs.map((r) => r.tbtMs)) },
          spread: { lcpMs: [Math.min(...lcp), Math.max(...lcp)], cls: [Math.min(...runs.map((r) => r.cls)), Math.max(...runs.map((r) => r.cls))], tbtMs: [Math.min(...runs.map((r) => r.tbtMs)), Math.max(...runs.map((r) => r.tbtMs))] },
        });
        (summary[`${cpu}|${size}|${page}`] ??= {})[label] = { runs, lcp, median: med(lcp) };
      }
    }
    if (any) {
      const file = `${outDir}/${label}-r59-3c${cpu === 4 ? "-cpu4" : ""}.json`;
      writeFileSync(file, JSON.stringify({ base: any.base, chrome: any.chrome, runsPerCase: results[0].runs.length, throttle: any.throttle, cpu: cpu === 1 ? "none" : "4x slower", windowMs: any.windowMs, build: name, results }, null, 1));
    }
  }
}

for (const cpu of [1, 4]) {
  console.log(`\n#### CPU ${cpu === 1 ? "1x (this machine)" : "4x slower CPU"}\n`);
  console.log("| Page | Size | LCP before (ms, spread) | LCP after | CLS | Blocking time before to after (ms) | Bytes before to after (KB): site / YouTube / covers | Requests (http and https, before to after) |");
  console.log("| --- | --- | --- | --- | --- | --- | --- | --- |");
  for (const [size] of SIZES) {
    for (const [page] of PAGES) {
      const e = summary[`${cpu}|${size}|${page}`];
      if (!e?.before || !e?.after) continue;
      const b = e.before.runs, a = e.after.runs;
      const sp = (v) => `${Math.min(...v)} to ${Math.max(...v)}`;
      const by = (runs) => { const x = runs.map(bytesBy); return `${kb(med(x.map((y) => y.site)))} / ${kb(med(x.map((y) => y.yt)))} / ${kb(med(x.map((y) => y.covers)))}`; };
      console.log(`| ${page} | ${size} | ${e.before.median} (${sp(e.before.lcp)}) | ${e.after.median} (${sp(e.after.lcp)}) | ${med(b.map((r) => r.cls))} to ${med(a.map((r) => r.cls))} | ${med(b.map((r) => r.tbtMs))} to ${med(a.map((r) => r.tbtMs))} (after spread ${sp(a.map((r) => r.tbtMs))}) | ${by(b)} to ${by(a)} | ${med(b.map((r) => r.requests.total))} to ${med(a.map((r) => r.requests.total))} |`);
    }
  }
}

// the largest requests of each page's first screen (the first run of the after build at 1x: the same pictures every run, the home's hero painting excepted)
console.log("\n#### Largest requests of each page's load until 5.6 s (after build, 1x CPU, the run with the median LCP)\n");
console.log("| Page | Size | Six largest (KB, origin and path) |");
console.log("| --- | --- | --- |");
for (const [size] of SIZES) {
  for (const [page] of PAGES) {
    const e = summary[`1|${size}|${page}`]?.after;
    if (!e) continue;
    const sorted = [...e.runs].sort((x, y) => x.lcpMs - y.lcpMs);
    const run = sorted[Math.floor((sorted.length - 1) / 2)];
    console.log(`| ${page} | ${size} | ${run.requests.largest.map((r) => `${kb(r.bytes)} ${r.url.replace(/^https?:\/\//, "")}`).join("; ")} |`);
  }
}
