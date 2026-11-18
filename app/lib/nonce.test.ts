import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { NonceProvider, useNonce } from "./nonce";

function Show() {
  return createElement("i", null, useNonce() ?? "none");
}

describe("the nonce context", () => {
  it("hands the server's nonce to every component below the provider", () => {
    expect(renderToStaticMarkup(createElement(NonceProvider, { nonce: "abc" }, createElement(Show)))).toBe("<i>abc</i>");
  });

  it("is undefined without a provider (the browser: the page's scripts have run by then, and a nonce is hidden from the DOM)", () => {
    expect(renderToStaticMarkup(createElement(Show))).toBe("<i>none</i>");
  });
});
