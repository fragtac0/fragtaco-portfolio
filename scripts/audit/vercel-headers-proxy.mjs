// A local stand-in for what Vercel does to the files of `public/`, so a change to the `headers` of vercel.json can be measured here
// (remix-serve ignores vercel.json, and sends `immutable` for every static file, which Vercel does not).
// usage: node scripts/audit/vercel-headers-proxy.mjs <vercel.json> <port> [target=http://localhost:5180] [rttMs=0]
// For every static file (the upstream marks it immutable) outside /assets/ it answers Vercel's own default, `public, max-age=0, must-revalidate`
// (the file is asked for again on every visit and answered 304), then applies the `headers` rules of the given vercel.json on top, as Vercel does
// (a rule's headers are added; a later rule for the same header wins). /assets/ keeps the immutable year. `rttMs` waits that long before each
// answer, a round trip to a server far away, so what a 304 costs can be seen. Documents and endpoints pass through with the rules of the file
// applied too (the `/(.*)` rule's headers reach them, as on Vercel) but without the max-age change. "Static" is decided by the upstream's `immutable`
// header, not by the path: remix-serve sends it for the files it serves from public/ and build/client/, so if its defaults change this stand-in must follow.
import { readFileSync } from "node:fs";
import http from "node:http";
import { sourceRegExp } from "./security-checks.mjs";

const [file, portArg, target = "http://localhost:5180", rttArg = "0"] = process.argv.slice(2);
const rules = JSON.parse(readFileSync(file, "utf8")).headers ?? [];
const t = new URL(target);
const RTT = Number(rttArg);
// the same matcher the security checks use for the `source` of a rule (path-to-regexp forms `/x/(.*)` and `/(.*)`)
const matches = (source, path) => sourceRegExp(source).test(path);

const log = []; // GET /__log answers the requests seen since the last GET /__log?clear=1 as [path, status] pairs (repeat-visit.mjs reads it)
http
  .createServer((req, res) => {
    const path = new URL(req.url, target).pathname;
    if (path === "/__log") {
      const body = JSON.stringify(log);
      if (new URL(req.url, target).searchParams.has("clear")) log.length = 0;
      res.writeHead(200, { "content-type": "application/json" });
      res.end(body);
      return;
    }
    const up = http.request({ host: t.hostname, port: t.port, path: req.url, method: req.method, headers: req.headers }, (r) => {
      const headers = { ...r.headers };
      const isStatic = /immutable/.test(String(headers["cache-control"] ?? "")) && req.method === "GET";
      if (isStatic && !path.startsWith("/assets/")) headers["cache-control"] = "public, max-age=0, must-revalidate";
      for (const rule of rules) if (matches(rule.source, path)) for (const h of rule.headers) headers[h.key.toLowerCase()] = h.value;
      log.push([path, r.statusCode]);
      setTimeout(() => {
        res.writeHead(r.statusCode ?? 502, headers);
        r.pipe(res);
      }, RTT);
    });
    up.on("error", () => {
      res.writeHead(502);
      res.end();
    });
    req.pipe(up);
  })
  .listen(Number(portArg), "127.0.0.1", () => console.log(`vercel-headers-proxy on ${portArg} for ${target} with ${file}`));
