// The security proof of the modern web pass, on the production build.
//   BASE=http://localhost:5180 node scripts/audit/security.mjs <out.json>                 the proof (the build's own headers, nothing injected)
//   BASE=http://localhost:5180 MODE=inventory node scripts/audit/security.mjs <out.json>  the inventory: Trusted Types injected report-only
//   HEADERS_ONLY=1 ...                                                                    only the header, endpoint and static-file checks (a quick negative test against another build)
// The proof, for every page at 1440 by 900 and 390 by 844: each header on the document, on a `?_data` response, on the counter endpoint and
// on the report endpoint; the static files (one font and one script under /assets/, one picture of each public folder) are checked against
// vercel.json by reading it, because remix-serve does not apply it (the preview deploy shows the real thing). Then a cold browser loads the
// page and uses it (both home boxes by button and by deep link, a book and a video opened, the wall and the shelf panned), and one browser per
// size runs every page change both ways and Back and Forward. It fails on any `securitypolicyviolation` event (enforced or report-only),
// any console error or exception, any request that failed or answered 4xx/5xx, a cross-site POST that is not refused with 403, a second
// document with the same nonce, and any script element of the HTML without the response's nonce. Then the resilience cases
// (security-resilience.mjs): a 404 first load, an element inserted into <body> before hydration, and a page change whose data request
// fails (500); in those the page must not go blank and the error page must show; report-only Trusted Types events are recorded, not
// failed, and enforced violations fail. Trusted Types ships report-only (R134), so the header check expects it in Content-Security-Policy-Report-Only.
import { writeFileSync, existsSync } from "node:fs";
import { loadavg } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { PAGES, SIZES, startReportProbe, walkChanges, walkPage } from "./security-walk.mjs";
import { walkResilience } from "./security-resilience.mjs";
import { dataChecks, documentChecks, pageViewChecks, run, sampleFiles, staticHeaders } from "./security-checks.mjs";
import { scanSource } from "./security-scan.mjs";
import { startHttpsProxy } from "./https-proxy.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const BASE = process.env.BASE ?? "http://localhost:5180";
const MODE = process.env.MODE ?? "proof";
const [out] = process.argv.slice(2);
if (!out) throw new Error("usage: node scripts/audit/security.mjs <out.json>");
const TT_ENFORCED = process.env.TT_ENFORCED === "1"; // Trusted Types ships report-only (ruling R134); TT_ENFORCED=1 checks a build that enforces it
const INJECT = "require-trusted-types-for 'script'";

const failures = [];
const fail = (what) => {
  failures.push(what);
  console.error("FAIL", what);
};
const headersOf = (res) => Object.fromEntries([...res.headers].map(([k, v]) => [k.toLowerCase(), v]));

async function getDoc(path, init = {}) {
  // redirects are followed: remix-serve answers /work with a 301 to /work/ (a folder of that name is in public/), the page is the answer after it
  const res = await fetch(BASE + path, init);
  return { res, text: await res.text(), headers: headersOf(res), redirected: res.redirected };
}
const nonceOf = (csp) => /'nonce-([^']+)'/.exec(csp ?? "")?.[1] ?? null;

/** Every <script> of the HTML, with whether it carries the nonce of the response's own policy. */
function scriptTags(html, nonce) {
  return [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)].map((m) => ({
    src: /\bsrc="([^"]*)"/.exec(m[1])?.[1] ?? null,
    type: /\btype="([^"]*)"/.exec(m[1])?.[1] ?? "classic",
    nonceOk: nonce !== null && new RegExp(`\\bnonce="${nonce.replace(/[+/=]/g, "\\$&")}"`).test(m[1]),
    inline: !/\bsrc=/.test(m[1]),
    sample: m[2].slice(0, 40),
  }));
}

async function headerChecks() {
  const rows = [];
  for (const page of PAGES) {
    const a = await getDoc(page);
    const b = await getDoc(page);
    const csp = a.headers["content-security-policy"];
    const checks = run(documentChecks({ trustedTypesEnforced: TT_ENFORCED }), a.headers);
    for (const c of checks) if (!c.ok) fail(`${page} document header ${c.header}: wanted ${c.want}, got ${c.got}`);
    const n1 = nonceOf(csp);
    const n2 = nonceOf(b.headers["content-security-policy"]);
    if (!n1 || n1 === n2) fail(`${page}: the nonce is missing or the same in two responses`);
    const scripts = scriptTags(a.text, n1);
    for (const s of scripts) if (!s.nonceOk) fail(`${page}: a script without the response's nonce (${s.src ?? s.sample})`);
    // the data response of the page's own route (Remix's `?_data=`), asked the way the client asks: same-origin fetch
    const routeId = page === "/" ? "routes/_index" : page === "/experience" ? "routes/experience" : page === "/work" ? "routes/work._index" : page === "/work/long-form" ? "routes/work.long-form" : "routes/work.short-form";
    const d = await getDoc(`${page === "/" ? "/" : page}?_data=${encodeURIComponent(routeId)}`, { headers: { "Sec-Fetch-Site": "same-origin" } });
    const dc = run(dataChecks, d.headers);
    for (const c of dc) if (!c.ok) fail(`${page} data header ${c.header}: wanted ${c.want}, got ${c.got}`);
    rows.push({ page, status: a.res.status, redirected: a.redirected, nonceDiffersBetweenResponses: !!n1 && n1 !== n2, scripts, document: checks, data: { status: d.res.status, checks: dc }, csp, cspReportOnly: a.headers["content-security-policy-report-only"] ?? null });
  }
  // the error page is a document too (a 404 is what a crawler meets most): the same headers, a nonce of its own, and every script carries it
  for (const page of ["/nope", "/work/nope"]) {
    const a = await getDoc(page);
    const b = await getDoc(page);
    const checks = run(documentChecks({ trustedTypesEnforced: TT_ENFORCED }), a.headers);
    for (const c of checks) if (!c.ok) fail(`${page} (404) document header ${c.header}: wanted ${c.want}, got ${c.got}`);
    if (a.res.status !== 404) fail(`${page} answered ${a.res.status}, wanted 404`);
    const n1 = nonceOf(a.headers["content-security-policy"]);
    if (!n1 || n1 === nonceOf(b.headers["content-security-policy"])) fail(`${page} (404): the nonce is missing or the same in two responses`);
    const scripts = scriptTags(a.text, n1);
    for (const s of scripts) if (!s.nonceOk) fail(`${page} (404): a script without the response's nonce (${s.src ?? s.sample})`);
    if (scripts.some((s) => /Hey developer/.test(s.sample))) fail(`${page} (404): Remix's default error page script is back`);
    rows.push({ page, status: a.res.status, nonceDiffersBetweenResponses: !!n1 && n1 !== nonceOf(b.headers["content-security-policy"]), scripts, document: checks });
  }
  return rows;
}

async function endpointChecks() {
  const rows = [];
  const own = { "Sec-Fetch-Site": "same-origin" };
  const cross = await fetch(`${BASE}/api/page-view?source=organic`, { method: "POST", headers: { "Sec-Fetch-Site": "cross-site" } });
  const crossOrigin = await fetch(`${BASE}/api/page-view?source=organic`, { method: "POST", headers: { Origin: "https://evil.example" } });
  const same = await fetch(`${BASE}/api/page-view?source=organic`, { method: "POST", headers: own });
  const crossHeaders = headersOf(cross);
  const checks = run(pageViewChecks, headersOf(same));
  if (cross.status !== 403) fail(`a cross-site POST to /api/page-view answered ${cross.status}, wanted 403`);
  if (crossOrigin.status !== 403) fail(`a POST with a foreign Origin and no Sec-Fetch-Site answered ${crossOrigin.status}, wanted 403`);
  if (same.status !== 200) fail(`a same-origin POST to /api/page-view answered ${same.status}, wanted 200`);
  for (const c of run(pageViewChecks, crossHeaders)) if (!c.ok) fail(`the 403 answer lacks ${c.header}`);
  for (const c of checks) if (!c.ok) fail(`/api/page-view header ${c.header}: wanted ${c.want}, got ${c.got}`);
  rows.push({ what: "page-view cross-site", status: cross.status }, { what: "page-view foreign Origin, no fetch metadata", status: crossOrigin.status }, { what: "page-view same-origin", status: same.status, checks });
  const post = (body, type) => fetch(`${BASE}/api/csp-report`, { method: "POST", headers: { "content-type": type, ...own }, body });
  const cases = [
    ["csp-report ok (application/csp-report)", await post(JSON.stringify({ "csp-report": { "document-uri": `${BASE}/work?source=x#y`, "violated-directive": "img-src" } }), "application/csp-report"), 204],
    ["csp-report ok (application/reports+json)", await post(JSON.stringify([{ type: "csp-violation", url: `${BASE}/work?source=x`, body: { documentURL: `${BASE}/work?a=b` } }]), "application/reports+json"), 204],
    ["csp-report too large", await post("x".repeat(9000), "application/csp-report"), 413],
    ["csp-report wrong type", await post("{}", "text/plain"), 415],
    ["csp-report GET", await fetch(`${BASE}/api/csp-report`), 405],
  ];
  for (const [what, res, want] of cases) {
    if (res.status !== want) fail(`${what}: answered ${res.status}, wanted ${want}`);
    rows.push({ what, status: res.status, want });
  }
  return rows;
}

function staticChecks() {
  const cfg = join(ROOT, "vercel.json");
  if (!existsSync(cfg)) return fail("vercel.json is missing"), [];
  const files = sampleFiles(ROOT);
  const rows = [];
  for (const [kind, path] of Object.entries(files)) {
    const h = staticHeaders(cfg, path);
    const want = [["x-content-type-options", "nosniff"], ...(kind === "work" ? [] : [["cross-origin-resource-policy", "same-origin"]])];
    for (const [k, v] of want) if (h[k] !== v) fail(`vercel.json gives ${path} ${k}: ${h[k] ?? "(nothing)"}, wanted ${v}`);
    rows.push({ kind, path, from: "vercel.json (read, not served: remix-serve does not apply it)", headers: h });
  }
  return rows;
}

function judge(label, r) {
  if (r.violations.length) fail(`${label}: ${r.violations.length} securitypolicyviolation event(s): ${JSON.stringify(r.violations.slice(0, 3))}`);
  if (r.consoleErrors.length) fail(`${label}: console errors: ${JSON.stringify(r.consoleErrors.slice(0, 3))}`);
  if (r.exceptions.length) fail(`${label}: exceptions: ${JSON.stringify(r.exceptions.slice(0, 3))}`);
  if (r.bad.length) fail(`${label}: ${r.bad.length} request(s) failed or answered an error: ${JSON.stringify(r.bad.slice(0, 4))}`);
  const policyWarnings = r.logWarnings.filter((l) => /Permissions-Policy|Unrecognized feature|Content-Security-Policy|Reporting/i.test(l.text));
  if (policyWarnings.length) fail(`${label}: the browser warns about a header: ${JSON.stringify(policyWarnings.slice(0, 3))}`);
  if (r.logErrors.length) fail(`${label}: log errors: ${JSON.stringify(r.logErrors.slice(0, 3))}`);
  if (r.changes) for (const s of r.changes) if (!s.settled) fail(`${label}: a page change did not settle: ${JSON.stringify(s)}`);
  if (r.changes) for (const s of r.changes) if (s.introClass) fail(`${label}: the loader's lock (html.intro) came back on a page change to "/"`);
  if (MODE === "inventory" && r.canaryReported === false) fail(`${label}: the injected policy did not take (the canary was not reported)`);
}

const record = { mode: MODE, base: "the production build served by remix-serve (address not recorded)", at: new Date().toISOString(), loadAverage: loadavg().map((x) => +x.toFixed(2)) };
const inject = MODE === "inventory" ? INJECT : undefined;
if (MODE === "proof") {
  record.headers = await headerChecks();
  record.endpoints = await endpointChecks();
  record.staticFiles = staticChecks();
} else {
  record.sourceScan = scanSource(ROOT);
  record.inlineScripts = [];
  for (const page of PAGES) {
    const a = await getDoc(page);
    record.inlineScripts.push({ page, scripts: scriptTags(a.text, null).map(({ src, type, inline, sample }) => ({ src, type, inline, sample })) });
  }
}
// the report round trip needs the server's log (SERVER_LOG=<file>): the probe page breaks the policy on purpose and is left open while the walks run
// (over HTTPS: a browser sends reports only from a secure page, and http://localhost is not one for the Reporting API)
const proxy = MODE === "proof" && process.env.SERVER_LOG ? await startHttpsProxy(BASE) : null;
const probe = proxy ? await startReportProbe(proxy.base, process.env.SERVER_LOG) : null;
record.walks = [];
for (const size of process.env.HEADERS_ONLY ? [] : SIZES) {
  for (const page of PAGES) {
    const r = await walkPage(BASE, size, page, { inject });
    judge(`${page} ${size.name}`, r);
    record.walks.push(r);
    console.error(`${page} ${size.name}: ${r.requests} requests, ${r.violations.length} violations, ${r.consoleErrors.length + r.exceptions.length} errors, ${r.bad.length} bad`);
  }
  const r = await walkChanges(BASE, size, { inject });
  judge(`page changes ${size.name}`, r);
  record.walks.push({ page: "page changes", ...r });
  console.error(`changes ${size.name}: ${r.changes.length} steps, ${r.violations.length} violations, ${r.consoleErrors.length + r.exceptions.length} errors, ${r.bad.length} bad`);
}
if (MODE === "proof") {
  record.resilience = [];
  for (const size of process.env.HEADERS_ONLY ? [] : SIZES) {
    const r = await walkResilience(BASE, size);
    record.resilience.push(...r.cases);
    for (const f of r.failures) fail(f);
    for (const c of r.cases) console.error(`${c.case} ${c.size}: enforced ${c.events.enforced.length}, report-only ${c.events.reportOnly.reduce((n, e) => n + e.n, 0)} (${c.events.reportOnly.map((e) => e.what).join("; ").slice(0, 140)})`);
  }
}
if (probe) {
  record.reportRoundTrip = await probe.done();
  proxy.close();
  if (!record.reportRoundTrip.violationEvent) fail("the report probe's picture was not blocked");
  if (!record.reportRoundTrip.reached) fail("the browser's report of the probe did not reach /api/csp-report (not in the server log after 2 minutes)");
} else if (MODE === "proof") record.reportRoundTrip = "not run (no SERVER_LOG)";
record.failures = failures;
record.ok = failures.length === 0;
writeFileSync(out, JSON.stringify(record, null, 1) + "\n");
console.error(failures.length ? `${failures.length} FAILURE(S), record ${out}` : `ok, record ${out}`);
process.exit(failures.length && MODE === "proof" ? 1 : 0);
