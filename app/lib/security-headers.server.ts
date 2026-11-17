import { randomBytes } from "node:crypto";

/**
 * The security headers of an HTML response, and the content policy with them (task 34 of the modern web pass; the audit is
 * docs/redesign/security-audit-2026-11.md, the proof scripts/audit/security.mjs). Every list here comes from the inventory in
 * docs/redesign/compare/web-pass/security.json, not from a guess.
 */

/** The report endpoint (app/routes/api.csp-report.ts): named for the Reporting API, and also given as report-uri for browsers that lack it. */
export const REPORT_PATH = "/api/csp-report";
const REPORT_GROUP = "csp";

/**
 * Whether `require-trusted-types-for 'script'` is enforced (true) or only reported (false). It is enforced because the whole audit ran clean
 * under it: the site writes no HTML or script text from the browser (the logo is JSX, the intro script is made by the server and never by
 * React in the browser; see app/root.tsx), so it needs no Trusted Types policy of its own.
 */
export const TRUSTED_TYPES_ENFORCED = true;

/**
 * Where the site's pictures come from besides itself: YouTube's thumbnails, and Open Library's covers, which answer with a redirect
 * to the Internet Archive (archive.org and its ia<number>.us.archive.org hosts). `https://archive.org` does not match its own subdomains' wildcard, so both.
 * `data:` (the WebP probe, the glass's tiles) and `blob:` (the glass's pictures) are added in the policy itself.
 */
export const IMG_ORIGINS: readonly string[] = ["https://i.ytimg.com", "https://covers.openlibrary.org", "https://archive.org", "https://*.archive.org"];

/** Origins the page may fetch from besides itself. None: the textures are pictures (img-src), and the counter's endpoint is the site's own. */
export const CONNECT_ORIGINS: readonly string[] = [];

/** Features the site never asks for (the inventory saw none of them asked for), each switched off for the page and for any frame in it. Only names this Chrome knows: it warns in the console about one it does not (ambient-light-sensor and attribution-reporting were taken out for that). */
export const DISABLED_FEATURES: readonly string[] = [
  "accelerometer", "autoplay", "bluetooth", "browsing-topics", "camera", "compute-pressure",
  "display-capture", "encrypted-media", "gamepad", "geolocation", "gyroscope", "hid", "identity-credentials-get", "idle-detection", "local-fonts",
  "magnetometer", "microphone", "midi", "otp-credentials", "payment", "picture-in-picture", "publickey-credentials-create", "publickey-credentials-get",
  "screen-wake-lock", "serial", "speaker-selection", "storage-access", "usb", "web-share", "window-management", "xr-spatial-tracking",
];

/** 16 random bytes, base64: a new one for every response (a nonce that repeats is no nonce). */
export function makeNonce(): string {
  return randomBytes(16).toString("base64");
}

const TRUSTED_TYPES = "require-trusted-types-for 'script'";

/**
 * The content policy for `nonce`. Scripts run only with the nonce, and the scripts they load run too ('strict-dynamic': Remix's entry loads the
 * route code), with no host list, no 'unsafe-inline' and no 'unsafe-eval'. Styles keep 'unsafe-inline' (the server render writes style attributes;
 * the threat this policy is for is script). `reportOnlyTrustedTypes` moves Trusted Types out of the enforced policy into a report-only one.
 */
export function contentPolicy(nonce: string, opts: { reportOnlyTrustedTypes: boolean }): { enforced: string; reportOnly: string | null } {
  const reporting = [`report-to ${REPORT_GROUP}`, `report-uri ${REPORT_PATH}`];
  const enforced = [
    "default-src 'self'",
    `script-src 'nonce-${nonce}' 'strict-dynamic' 'report-sample'`,
    "style-src 'self' 'unsafe-inline'",
    `img-src ${["'self'", "data:", "blob:", ...IMG_ORIGINS].join(" ")}`,
    "font-src 'self'",
    `connect-src ${["'self'", ...CONNECT_ORIGINS].join(" ")}`,
    "object-src 'none'",
    "base-uri 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    ...(opts.reportOnlyTrustedTypes ? [] : [TRUSTED_TYPES]),
    ...reporting,
  ].join("; ");
  return { enforced, reportOnly: opts.reportOnlyTrustedTypes ? [TRUSTED_TYPES, ...reporting].join("; ") : null };
}

/** Every header of an HTML response (documents, the 404 page, the error page). Production only: Vite's dev client needs inline scripts. */
export function documentHeaders(nonce: string, opts: { reportOnlyTrustedTypes: boolean } = { reportOnlyTrustedTypes: !TRUSTED_TYPES_ENFORCED }): Record<string, string> {
  const policy = contentPolicy(nonce, opts);
  return {
    "Content-Security-Policy": policy.enforced,
    ...(policy.reportOnly ? { "Content-Security-Policy-Report-Only": policy.reportOnly } : {}),
    "Reporting-Endpoints": `${REPORT_GROUP}="${REPORT_PATH}"`,
    // what Vercel already sends on its own domain, set here so a custom domain gets it too
    "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Frame-Options": "DENY",
    "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
    "Cross-Origin-Resource-Policy": "same-origin",
    "Permissions-Policy": DISABLED_FEATURES.map((f) => `${f}=()`).join(", "),
  };
}

/** The headers of a data response (`?_data=`) and of the site's own endpoints: not documents, so no policy, but never sniffed, never embedded, never leaking a path. */
export const INTERNAL_RESPONSE_HEADERS: Readonly<Record<string, string>> = {
  "X-Content-Type-Options": "nosniff",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Referrer-Policy": "strict-origin-when-cross-origin",
};

/** A request that came from another site must not get a cached answer meant for this one: the answer depends on these request headers. */
export const FETCH_METADATA_VARY = "Sec-Fetch-Dest, Sec-Fetch-Mode, Sec-Fetch-Site";
