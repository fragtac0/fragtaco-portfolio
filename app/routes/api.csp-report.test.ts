import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { action, cleanReport, loader } from "./api.csp-report";

const post = (body: string, type: string | null = "application/csp-report") =>
  new Request("https://site.test/api/csp-report", { method: "POST", headers: type ? { "content-type": type } : {}, body });
const call = (request: Request) => action({ request, params: {}, context: {} });

describe("POST /api/csp-report", () => {
  let warn: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => warn.mockRestore());

  it("answers 204 to a report of either content type and logs one line", async () => {
    const a = await call(post(JSON.stringify({ "csp-report": { "document-uri": "https://site.test/work", "violated-directive": "img-src" } })));
    expect(a.status).toBe(204);
    const b = await call(post(JSON.stringify([{ type: "csp-violation", url: "https://site.test/", body: { blockedURL: "https://x.test/p.png" } }]), "application/reports+json"));
    expect(b.status).toBe(204);
    expect(warn).toHaveBeenCalledTimes(2);
    expect(warn.mock.calls[0][0]).toBe("csp-report");
  });

  it("accepts a charset parameter on the content type", async () => {
    expect((await call(post("{}", "application/csp-report; charset=utf-8"))).status).toBe(204);
  });

  it("refuses a body over 8192 bytes with 413, by its length and by its size when no length is sent", async () => {
    const big = "x".repeat(8193);
    expect((await call(post(big))).status).toBe(413);
    const noLength = new Request("https://site.test/api/csp-report", { method: "POST", headers: { "content-type": "application/csp-report" }, body: big });
    noLength.headers.delete("content-length");
    expect((await call(noLength)).status).toBe(413);
    expect((await call(post("x".repeat(8192)))).status).toBe(204);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("refuses any other content type with 415, and any other method with 405 and an Allow header", async () => {
    expect((await call(post("{}", "text/plain"))).status).toBe(415);
    expect((await call(post("{}", "application/json"))).status).toBe(415);
    expect((await call(post("{}", null))).status).toBe(415);
    const put = await call(new Request("https://site.test/api/csp-report", { method: "PUT", headers: { "content-type": "application/csp-report" }, body: "{}" }));
    expect(put.status).toBe(405);
    expect(put.headers.get("Allow")).toBe("POST");
    const got = loader();
    expect(got.status).toBe(405);
    expect(got.headers.get("Allow")).toBe("POST");
    expect(warn).not.toHaveBeenCalled();
  });

  it("logs a report with the query and fragment of every address removed", async () => {
    await call(post(JSON.stringify({ "csp-report": { "document-uri": "https://site.test/work?source=x#y", "blocked-uri": "https://i.ytimg.com/vi/abc/hq.jpg?token=secret#frag", referrer: "https://other.test/a?b=c", "violated-directive": "img-src" } })));
    const line = String(warn.mock.calls[0][1]);
    expect(line).toContain('"document-uri":"https://site.test/work"');
    expect(line).toContain('"blocked-uri":"https://i.ytimg.com/vi/abc/hq.jpg"');
    expect(line).not.toMatch(/source=|token|secret|#y|#frag|b=c/);
    expect(line).toContain("img-src");
  });

  it("cleans the Reporting API form too, however deep an address sits", async () => {
    await call(post(JSON.stringify([{ type: "csp-violation", url: "https://site.test/work?a=1", body: { documentURL: "https://site.test/work?a=1", blockedURL: "https://x.test/p?q=2", sourceFile: "https://site.test/assets/a.js?v=3#L1", sample: "alert(1)?x=y" } }]), "application/reports+json"));
    const line = String(warn.mock.calls[0][1]);
    expect(line).not.toMatch(/a=1|q=2|v=3|#L1/);
    expect(line).toContain("https://x.test/p");
    expect(line).toContain("alert(1)?x=y"); // not an address: the sample is left as the browser cut it
  });

  it("leaves the quoted policy out of the line: it holds the response's nonce", async () => {
    await call(post(JSON.stringify([{ type: "csp-violation", url: "https://site.test/", body: { blockedURL: "https://x.test/p.png", originalPolicy: "script-src 'nonce-SECRETNONCE'" } }]), "application/reports+json"));
    await call(post(JSON.stringify({ "csp-report": { "document-uri": "https://site.test/", "original-policy": "script-src 'nonce-SECRETNONCE'", "violated-directive": "img-src" } })));
    for (const call of warn.mock.calls) {
      expect(String(call[1])).not.toContain("SECRETNONCE");
      expect(String(call[1])).toMatch(/x\.test\/p\.png|img-src/);
    }
  });

  it("cuts the line to 2000 characters, and logs a body that is not JSON as a note, not an error", async () => {
    await call(post(JSON.stringify({ "csp-report": { sample: "a".repeat(5000) } })));
    expect(String(warn.mock.calls[0][1]).length).toBeLessThanOrEqual(2000);
    expect((await call(post("not json{"))).status).toBe(204);
    expect(String(warn.mock.calls[1][1])).toContain("unreadable");
  });
});

describe("cleanReport", () => {
  it("leaves values that are not addresses alone and never throws", () => {
    expect(cleanReport({ a: 1, b: null, c: ["https://x.test/p?q=1", { d: "https://y.test/?z" }], e: "plain" })).toEqual({ a: 1, b: null, c: ["https://x.test/p", { d: "https://y.test/" }], e: "plain" });
    expect(cleanReport("https://x.test/?a#b")).toBe("https://x.test/");
    expect(cleanReport(undefined)).toBeUndefined();
  });
});
