import { describe, expect, it } from "vitest";
import { CONNECT_ORIGINS, IMG_ORIGINS, contentPolicy, documentHeaders, makeNonce, TRUSTED_TYPES_ENFORCED } from "./security-headers.server";

describe("the headers of an HTML response", () => {
  const h = documentHeaders("abc123");
  const csp = h["Content-Security-Policy"];

  it("carries a content policy whose scripts need the nonce and nothing else", () => {
    expect(csp).toContain("script-src 'nonce-abc123' 'strict-dynamic' 'report-sample'");
    for (const d of ["default-src 'self'", "object-src 'none'", "base-uri 'none'", "frame-ancestors 'none'", "form-action 'self'", "font-src 'self'", "report-to csp"])
      expect(csp).toContain(d);
    expect(csp).not.toMatch(/script-src[^;]*(unsafe-inline|unsafe-eval|https:|\*)/);
    expect(csp).not.toMatch(/(default|script)-src[^;]*\bdata:/);
  });

  it("sends the report to the site's own endpoint in both forms (Reporting-Endpoints for report-to, report-uri for browsers without it)", () => {
    expect(h["Reporting-Endpoints"]).toBe('csp="/api/csp-report"');
    expect(csp).toContain("report-uri /api/csp-report");
  });

  it("sets the companion headers", () => {
    expect(h["X-Content-Type-Options"]).toBe("nosniff");
    expect(h["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(h["X-Frame-Options"]).toBe("DENY");
    expect(h["Cross-Origin-Opener-Policy"]).toBe("same-origin-allow-popups");
    expect(h["Cross-Origin-Resource-Policy"]).toBe("same-origin");
    expect(h["Strict-Transport-Security"]).toBe("max-age=63072000; includeSubDomains; preload");
    expect(h["Permissions-Policy"]).toMatch(/camera=\(\).*geolocation=\(\).*microphone=\(\)/);
  });

  it("switches off the features the site never asks for, each as an empty allowlist, with no feature twice", () => {
    const features = h["Permissions-Policy"].split(", ").map((x) => x.split("=")[0]);
    for (const f of ["camera", "microphone", "geolocation", "payment", "usb", "bluetooth", "serial", "hid", "midi", "accelerometer", "gyroscope", "magnetometer", "display-capture", "web-share", "screen-wake-lock"])
      expect(features).toContain(f);
    for (const part of h["Permissions-Policy"].split(", ")) expect(part).toMatch(/^[a-z-]+=\(\)$/);
    expect(new Set(features).size).toBe(features.length);
  });

  it("makes a new nonce of 16 random bytes every time", () => {
    expect(makeNonce()).not.toBe(makeNonce());
    expect(atob(makeNonce()).length).toBe(16);
    expect(makeNonce()).toMatch(/^[A-Za-z0-9+/]{22}==$/);
  });
});

describe("contentPolicy", () => {
  it("names exactly the picture origins the audit found, and no origin for fetch", () => {
    expect(IMG_ORIGINS).toEqual(["https://i.ytimg.com", "https://covers.openlibrary.org", "https://archive.org", "https://*.archive.org"]);
    expect(CONNECT_ORIGINS).toEqual([]);
    const { enforced } = contentPolicy("n", { reportOnlyTrustedTypes: false });
    expect(enforced).toContain(`img-src 'self' data: blob: ${IMG_ORIGINS.join(" ")}`);
    expect(enforced).toContain("connect-src 'self'");
    expect(enforced).toMatch(/connect-src 'self';/);
    expect(enforced).toContain("style-src 'self' 'unsafe-inline'");
  });

  it("enforces Trusted Types, with no policy name allowed (the site has no pass-through policy)", () => {
    const p = contentPolicy("n", { reportOnlyTrustedTypes: false });
    expect(p.enforced).toContain("require-trusted-types-for 'script'");
    expect(p.enforced).not.toMatch(/trusted-types (?!\w*-for)/);
    expect(p.reportOnly).toBeNull();
  });

  it("can send Trusted Types in report-only form instead, and then the enforced policy lacks it", () => {
    const p = contentPolicy("n", { reportOnlyTrustedTypes: true });
    expect(p.enforced).not.toContain("require-trusted-types-for");
    expect(p.reportOnly).toContain("require-trusted-types-for 'script'");
    expect(p.reportOnly).toContain("report-to csp");
    const h = documentHeaders("n", { reportOnlyTrustedTypes: true });
    expect(h["Content-Security-Policy-Report-Only"]).toBe(p.reportOnly);
    expect(documentHeaders("n", { reportOnlyTrustedTypes: false })["Content-Security-Policy-Report-Only"]).toBeUndefined();
  });

  it("follows the module's own switch by default", () => {
    const h = documentHeaders("n");
    if (TRUSTED_TYPES_ENFORCED) expect(h["Content-Security-Policy"]).toContain("require-trusted-types-for 'script'");
    else expect(h["Content-Security-Policy-Report-Only"]).toContain("require-trusted-types-for 'script'");
  });

  it("has no nonce-like characters that could break out of the header", () => {
    expect(contentPolicy(makeNonce(), { reportOnlyTrustedTypes: false }).enforced).not.toMatch(/[\r\n]/);
  });
});
