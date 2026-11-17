import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ErrorPage } from "./error-page";

const response = (status: number, statusText: string) => ({ status, statusText, internal: true, data: "" });
const html = (error: unknown, showStack?: boolean) => renderToStaticMarkup(createElement(ErrorPage, { error, showStack }));

describe("the error page (the root ErrorBoundary's content)", () => {
  it("is the markup Remix's default 404 page had: a 24px heading with the status and its text", () => {
    expect(html(response(404, "Not Found"))).toBe('<h1 style="font-size:24px">404 Not Found</h1>');
  });

  it("is the default error page's look for any other error: a heading and the red band for the stack", () => {
    const out = html(new Error("boom"), true);
    expect(out).toMatch(/^<h1 style="font-size:24px">Application Error<\/h1><pre style="[^"]*">/);
    expect(out).toContain("boom");
    expect(out).toContain("padding:2rem");
  });

  it("leaves the stack out when it is not asked for (a visitor does not read a stack), but keeps the band", () => {
    const out = html(new Error("secret path /srv/x"), false);
    expect(out).not.toContain("secret path");
    expect(out).toContain("<pre");
    expect(out).toContain("Application Error");
  });

  it("makes no script element of its own, which the content policy would block (Remix's default page wrote an inline one)", () => {
    for (const e of [response(404, "Not Found"), response(500, "Internal Server Error"), new Error("x"), "a string", null, undefined])
      expect(html(e, true)).not.toContain("<script");
  });

  it("does not throw for something that is not an error at all", () => {
    expect(() => html(undefined, true)).not.toThrow();
  });
});
