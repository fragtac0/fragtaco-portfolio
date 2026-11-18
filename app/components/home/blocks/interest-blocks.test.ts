import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { SiteBook, SiteVideo } from "../../../types";
import type { BoxPicture } from "./box-picture";
import InterestBlocks from "./interest-blocks";

const books: SiteBook[] = [
  { id: "story", title: "Story", author: "A", pages: 300, isbn: "0", heightIn: 9, aspect: 0.65, color: "#7a2b1e", style: "plain", note: "" },
];
const videos: SiteVideo[] = [{ id: "abc", title: "V", channel: "C", channelUrl: "https://example.test", subscribers: null, thumb: "hq" }];

const render = (picture: Record<"reading" | "watching", BoxPicture>) =>
  renderToString(
    createElement(InterestBlocks, { books, videos, onOpen: () => {}, homes: null, picture, onNear: () => {} }),
  );

describe("InterestBlocks: the flat previews are the picture of a box the client has decided cannot draw", () => {
  it("mounts neither flat preview while both boxes hold their live scene (no thumbnail is requested, no spine painted)", () => {
    const html = render({ reading: "live", watching: "live" });
    expect(html).not.toContain("blk-art");
    expect(html).not.toContain("i.ytimg.com");
    expect(html.match(/data-live/g)).toHaveLength(2);
  });

  it("mounts neither while the client has not decided (the server's and the hydration render): the dark ground and the words, no request", () => {
    const html = render({ reading: "ground", watching: "ground" });
    expect(html).not.toContain("blk-art");
    expect(html).not.toContain("i.ytimg.com");
    expect(html).not.toContain("data-live");
    expect(html).toContain("What I&#x27;m");
    expect(html).toContain("Open the wall");
  });

  it("mounts both when WebGL is missing or the scenes failed: the mini shelf and the mini wall with their small thumbnails", () => {
    const html = render({ reading: "flat", watching: "flat" });
    expect(html).toContain("blk-art ms");
    expect(html).toContain("blk-art mw");
    expect(html).toContain("https://i.ytimg.com/vi/abc/mqdefault.jpg");
    expect(html).not.toContain("data-live");
  });

  it("decides per box: a failed shelf scene shows only the mini shelf", () => {
    const html = render({ reading: "flat", watching: "live" });
    expect(html).toContain("blk-art ms");
    expect(html).not.toContain("blk-art mw");
    expect(html).not.toContain("i.ytimg.com");
  });
});
