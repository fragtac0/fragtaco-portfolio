import { describe, expect, it } from "vitest";
import { isOwnRequest } from "./same-site.server";

const req = (headers: Record<string, string>, url = "https://site.test/api/page-view") => new Request(url, { method: "POST", headers });

describe("isOwnRequest", () => {
  it("trusts Sec-Fetch-Site when the browser sends it", () => {
    expect(isOwnRequest(req({ "Sec-Fetch-Site": "same-origin" }))).toBe(true);
    expect(isOwnRequest(req({ "Sec-Fetch-Site": "none" }))).toBe(true);
    expect(isOwnRequest(req({ "Sec-Fetch-Site": "cross-site" }))).toBe(false);
    expect(isOwnRequest(req({ "Sec-Fetch-Site": "same-site" }))).toBe(false);
  });

  it("lets Sec-Fetch-Site win over an Origin that says otherwise", () => {
    expect(isOwnRequest(req({ "Sec-Fetch-Site": "cross-site", Origin: "https://site.test" }))).toBe(false);
    expect(isOwnRequest(req({ "Sec-Fetch-Site": "same-origin", Origin: "https://evil.test" }))).toBe(true);
  });

  it("without Sec-Fetch-Site compares the Origin's host with the request's own", () => {
    expect(isOwnRequest(req({ Origin: "https://evil.test" }))).toBe(false);
    expect(isOwnRequest(req({ Origin: "https://site.test" }))).toBe(true);
    expect(isOwnRequest(req({ Origin: "https://site.test.evil.test" }))).toBe(false);
    expect(isOwnRequest(req({ Origin: "https://evil.test/site.test" }))).toBe(false);
    expect(isOwnRequest(req({ Origin: "https://other.site.test" }))).toBe(false);
  });

  it("treats a host with a port as another host (the port is part of it)", () => {
    expect(isOwnRequest(req({ Origin: "http://localhost:5180" }, "http://localhost:5180/api/page-view"))).toBe(true);
    expect(isOwnRequest(req({ Origin: "http://localhost:3000" }, "http://localhost:5180/api/page-view"))).toBe(false);
  });

  it("counts a request with neither header (a script, an old browser) as its own, and refuses an Origin that is not a URL", () => {
    expect(isOwnRequest(req({}))).toBe(true);
    expect(isOwnRequest(req({ Origin: "null" }))).toBe(false);
    expect(isOwnRequest(req({ Origin: "not a url" }))).toBe(false);
  });
});
