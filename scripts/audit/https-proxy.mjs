// A small HTTPS front for a local server, with a certificate made on the spot (openssl, valid two days, thrown away with the folder):
// browsers send the Reporting API's reports only from a page served over HTTPS, and a local build on http://localhost is not. Used by security.mjs for the
// report round trip; Chrome must be started with --ignore-certificate-errors to trust the certificate (the probe's browser is).
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import http from "node:http";
import https from "node:https";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** Starts the proxy on a free port in front of `target` (an http address); resolves with { base, close }. */
export async function startHttpsProxy(target) {
  const dir = mkdtempSync(join(process.env.AUDIT_TMP ?? tmpdir(), "https-proxy-"));
  execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", join(dir, "key.pem"), "-out", join(dir, "cert.pem"), "-days", "2", "-subj", "/CN=localhost", "-addext", "subjectAltName=DNS:localhost,IP:127.0.0.1"], { stdio: "ignore" });
  const t = new URL(target);
  const server = https.createServer({ key: readFileSync(join(dir, "key.pem")), cert: readFileSync(join(dir, "cert.pem")) }, (req, res) => {
    const up = http.request({ host: t.hostname, port: t.port, path: req.url, method: req.method, headers: req.headers }, (r) => {
      res.writeHead(r.statusCode ?? 502, r.headers);
      r.pipe(res);
    });
    up.on("error", () => {
      res.writeHead(502);
      res.end();
    });
    req.pipe(up);
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const port = server.address().port;
  return {
    base: `https://localhost:${port}`,
    close: () => {
      server.close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}
