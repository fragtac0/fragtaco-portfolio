// What security.mjs expects of a response. These lists are written out here on purpose, apart from app/lib/security-headers.server.ts:
// an audit that read the app's own list would pass whatever the app sent.
import { readFileSync, readdirSync } from "node:fs";

const eq = (name, value) => ({ name, test: (h) => h[name.toLowerCase()] === value, want: value });
const has = (name, parts) => ({
  name,
  test: (h) => parts.every((p) => String(h[name.toLowerCase()] ?? "").includes(p)),
  want: `contains ${parts.join(" | ")}`,
});

/** The headers of an HTML response. `nonce` is read from the policy itself, so the check is that the policy has one. */
export function documentChecks({ trustedTypesEnforced }) {
  const csp = [
    "default-src 'self'", "'strict-dynamic'", "'report-sample'", "object-src 'none'", "base-uri 'none'", "frame-ancestors 'none'",
    "form-action 'self'", "font-src 'self'", "report-to csp", "report-uri /api/csp-report", "style-src 'self' 'unsafe-inline'",
  ];
  return [
    has("Content-Security-Policy", csp),
    {
      name: "Content-Security-Policy (script-src)",
      test: (h) => {
        const m = /script-src ([^;]*)/.exec(h["content-security-policy"] ?? "");
        return !!m && /^'nonce-[A-Za-z0-9+/=]{22,}' 'strict-dynamic' 'report-sample'$/.test(m[1].trim());
      },
      want: "script-src 'nonce-<16 random bytes>' 'strict-dynamic' 'report-sample' and nothing else (no unsafe-inline, unsafe-eval, https:)",
    },
    trustedTypesEnforced
      ? has("Content-Security-Policy", ["require-trusted-types-for 'script'"])
      : has("Content-Security-Policy-Report-Only", ["require-trusted-types-for 'script'"]),
    eq("X-Content-Type-Options", "nosniff"),
    eq("Referrer-Policy", "strict-origin-when-cross-origin"),
    eq("X-Frame-Options", "DENY"),
    eq("Cross-Origin-Opener-Policy", "same-origin-allow-popups"),
    eq("Cross-Origin-Resource-Policy", "same-origin"),
    eq("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload"),
    eq("Reporting-Endpoints", 'csp="/api/csp-report"'),
    has("Permissions-Policy", ["camera=()", "geolocation=()", "microphone=()", "payment=()", "usb=()"]),
  ];
}

/** The data responses (`?_data=`) and the two endpoints. */
export const dataChecks = [
  eq("X-Content-Type-Options", "nosniff"),
  eq("Cross-Origin-Resource-Policy", "same-origin"),
  eq("Referrer-Policy", "strict-origin-when-cross-origin"),
];
export const pageViewChecks = [
  ...dataChecks,
  has("Vary", ["Sec-Fetch-Dest", "Sec-Fetch-Mode", "Sec-Fetch-Site"]),
];

export function run(checks, headers) {
  const h = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  return checks.map((c) => ({ header: c.name, want: c.want, got: (h[c.name.split(" ")[0].toLowerCase()] ?? null), ok: c.test(h) }));
}

/** Vercel's `source` is path-to-regexp; the forms vercel.json uses are `/x/(.*)` and `/(.*)`. */
export function sourceRegExp(source) {
  return new RegExp("^" + source.replace(/[.+?^${}|[\]\\]/g, "\\$&").replace(/\(\\\.\*\)/g, "(.*)") + "$");
}

/** The headers vercel.json would add to `path` (later rules override earlier ones of the same name, as on Vercel). */
export function staticHeaders(vercelJsonPath, path) {
  const cfg = JSON.parse(readFileSync(vercelJsonPath, "utf8"));
  const got = {};
  for (const rule of cfg.headers ?? []) {
    if (!sourceRegExp(rule.source).test(path)) continue;
    for (const { key, value } of rule.headers) got[key.toLowerCase()] = value;
  }
  return got;
}

/** One file of each kind under the build: a hashed font and script under /assets/, and the first file of each public folder. */
export function sampleFiles(root) {
  const first = (dir, re) => {
    for (const e of readdirSync(`${root}/${dir}`, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (e.isFile() && re.test(e.name)) return e.name;
      if (e.isDirectory()) {
        const f = first(`${dir}/${e.name}`, re);
        if (f) return `${e.name}/${f}`;
      }
    }
    return undefined;
  };
  const asset = (re) => `/assets/${first("build/client/assets", re)}`;
  const pic = (dir) => `/${dir}/${first(`public/${dir}`, /\.(webp|jpg|jpeg|png|svg)$/)}`;
  return { font: asset(/\.woff2$/), script: asset(/\.js$/), paintings: pic("paintings"), mars: pic("mars"), grounds: pic("grounds"), portraits: pic("portraits"), stack: pic("stack"), work: pic("work") };
}
