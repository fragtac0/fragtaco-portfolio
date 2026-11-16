import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { getHomePageContent } from "../../content/loaders.server";

// The router hooks the page's nav reads: the first render needs no router.
vi.mock("@remix-run/react", () => ({
  PrefetchPageLinks: () => null,
  useLocation: () => ({ pathname: "/", search: "", hash: "" }),
  useNavigate: () => () => {},
  Link: (props: Record<string, unknown>) => createElement("a", props),
}));

const { default: HomePage } = await import("./home-page");

describe("HomePage: a live visitor loads no flat preview (RB9, spec 6.1)", () => {
  it("the server's first render (which is also the hydration render) holds both boxes as their dark ground: no mini wall, no mini shelf, no thumbnail request", async () => {
    expect(typeof window).toBe("undefined");
    const html = renderToString(createElement(HomePage, await getHomePageContent(() => 0)));
    // both home boxes are in the page, with the block's words...
    expect(html).toContain('id="blkRead"');
    expect(html).toContain('id="blkWatch"');
    expect(html).toContain("Open the wall");
    // ...and neither flat picture, none of its thumbnails and none of its spines: the client decides after hydration
    expect(html).not.toContain("blk-art");
    expect(html).not.toContain("mqdefault");
    expect(html).not.toContain("i.ytimg.com");
    expect(html).not.toContain("ms-sp");
    // neither box is live yet: the scene is client only
    expect(html).not.toMatch(/<article[^>]*data-live/);
  });
});
