import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { SiteBook, SiteVideo } from "../../../types";
import InterestBlocks from "./interest-blocks";

const books: SiteBook[] = [
  { id: "story", title: "Story", author: "A", pages: 300, isbn: "0", heightIn: 9, aspect: 0.65, color: "#7a2b1e", style: "plain", note: "" },
];
const videos: SiteVideo[] = [{ id: "abc", title: "V", channel: "C", channelUrl: "https://example.test", subscribers: null, thumb: "hq" }];

const render = (live: { reading: boolean; watching: boolean }) =>
  renderToString(
    createElement(InterestBlocks, { books, videos, onOpen: () => {}, homes: null, live, onNear: () => {} }),
  );

describe("InterestBlocks: the flat previews are the picture of a box that is not live", () => {
  it("mounts neither flat preview while both boxes hold their live scene (no thumbnail is requested, no spine painted)", () => {
    const html = render({ reading: true, watching: true });
    expect(html).not.toContain("blk-art");
    expect(html).not.toContain("i.ytimg.com");
    expect(html.match(/data-live/g)).toHaveLength(2);
  });

  it("mounts both when WebGL is missing or the scenes failed: the mini shelf and the mini wall with their small thumbnails", () => {
    const html = render({ reading: false, watching: false });
    expect(html).toContain("blk-art ms");
    expect(html).toContain("blk-art mw");
    expect(html).toContain("https://i.ytimg.com/vi/abc/mqdefault.jpg");
    expect(html).not.toContain("data-live");
  });

  it("decides per box: a failed shelf scene shows only the mini shelf", () => {
    const html = render({ reading: false, watching: true });
    expect(html).toContain("blk-art ms");
    expect(html).not.toContain("blk-art mw");
    expect(html).not.toContain("i.ytimg.com");
  });
});
