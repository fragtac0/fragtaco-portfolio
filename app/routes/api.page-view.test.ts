import { beforeEach, describe, expect, it, vi } from "vitest";

const increment = vi.fn((source: string | null) => Promise.resolve({ source: source ?? "organic", total: 26000, live: true }));
vi.mock("../lib/page-views.server", () => ({ incrementPageView: (s: string | null) => increment(s) }));

const { action, loader } = await import("./api.page-view");
const call = (request: Request) => action({ request, params: {}, context: {} });
const post = (headers: Record<string, string> = {}, search = "?source=twitter") => new Request(`https://site.test/api/page-view${search}`, { method: "POST", headers });

describe("POST /api/page-view", () => {
  beforeEach(() => increment.mockClear());

  it("counts a request that comes from this site", async () => {
    const res = await call(post({ "Sec-Fetch-Site": "same-origin" }));
    expect(res.status).toBe(200);
    expect(increment).toHaveBeenCalledWith("twitter");
    expect(await res.json()).toMatchObject({ source: "twitter", total: 26000 });
  });

  it("refuses a request from another site with 403 before it touches the counter", async () => {
    const foreign: Array<Record<string, string>> = [{ "Sec-Fetch-Site": "cross-site" }, { "Sec-Fetch-Site": "same-site" }, { Origin: "https://evil.test" }];
    for (const headers of foreign) {
      const res = await call(post(headers));
      expect(res.status).toBe(403);
    }
    expect(increment).not.toHaveBeenCalled();
  });

  it("still counts a request with neither header (a script: the counter is a vanity counter with nothing to protect)", async () => {
    expect((await call(post())).status).toBe(200);
    expect(increment).toHaveBeenCalledTimes(1);
  });

  it("answers every response, the refusal too, with the headers of an internal endpoint and a Vary on the fetch metadata", async () => {
    for (const res of [await call(post({ "Sec-Fetch-Site": "same-origin" })), await call(post({ "Sec-Fetch-Site": "cross-site" })), await call(new Request("https://site.test/api/page-view", { method: "PUT" })), loader()]) {
      expect(res.headers.get("Vary")).toContain("Sec-Fetch-Dest, Sec-Fetch-Mode, Sec-Fetch-Site");
      expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
      expect(res.headers.get("Cross-Origin-Resource-Policy")).toBe("same-origin");
      expect(res.headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    }
  });

  it("keeps its 405 for other methods", async () => {
    const res = await call(new Request("https://site.test/api/page-view", { method: "DELETE" }));
    expect(res.status).toBe(405);
    expect(res.headers.get("Allow")).toBe("POST");
  });
});
