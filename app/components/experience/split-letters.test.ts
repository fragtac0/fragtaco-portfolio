import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import HeadingBlock from "./heading-block";
import MapCaption from "./map-caption";
import SplitLetters from "./split-letters";

const html = (node: React.ReactElement) => renderToStaticMarkup(node);
/** What a screen reader reads: the text of the markup, leaving out every element that is hidden from assistive technology (tags are word breaks). */
function readAloud(markup: string): string {
  const out: string[] = [];
  let hidden = 0; // the depth inside an aria-hidden element (0: not inside one)
  const stack: boolean[] = []; // for each open element: did it start the hidden part?

  for (const [, closing, tag, attrs, text] of markup.matchAll(/<(\/?)([a-z0-9]+)([^>]*)>|([^<]+)/g)) {
    if (text !== undefined) {
      if (hidden === 0) out.push(text);
    } else if (closing) {
      if (stack.pop()) hidden--;
    } else if (!/\/$/.test(attrs) && !["br", "img", "input"].includes(tag)) {
      const starts = hidden === 0 && /aria-hidden="true"/.test(attrs);

      stack.push(starts);
      if (starts) hidden++;
      if (hidden === 0) out.push(" ");
    }
  }

  return out.join("").replace(/\s+/g, " ").trim();
}

describe("SplitLetters", () => {
  it("has every letter in its own span, numbered by its place among the letters (the space is not counted)", () => {
    const markup = html(createElement(SplitLetters, { text: "My experience" }));
    const letters = [...markup.matchAll(/<span class="map-letter" style="--i:(\d+)">(.)<\/span>/g)];

    expect(letters.map((m) => m[2]).join("")).toBe("Myexperience");
    expect(letters.map((m) => Number(m[1]))).toEqual(Array.from({ length: 12 }, (_, i) => i));
  });

  it("keeps each word's letters together in one span, so a line breaks only at the space", () => {
    const markup = html(createElement(SplitLetters, { text: "My experience" }));

    expect(markup.match(/<span class="map-word">/g)).toHaveLength(2);
    expect(markup).toContain("</span></span> <span class=\"map-word\">");
  });

  it("carries one accessible name: the text once, and the letters hidden from assistive technology", () => {
    const markup = html(createElement(SplitLetters, { text: "My experience" }));

    expect(markup.match(/class="sr-only">My experience</g)).toHaveLength(1);
    expect(markup).toContain('class="map-letters" aria-hidden="true"');
    expect(readAloud(markup)).toBe("My experience");
  });
});

describe("the heading and the caption read once", () => {
  it("the title is an h1 that reads \"My experience\" once, the letters hidden", () => {
    const markup = html(createElement(HeadingBlock, { title: "My experience", text: "Engineer, then editor." }));

    expect(markup).toMatch(/<h1 class="map-title"><span class="sr-only">My experience<\/span>/);
    expect(readAloud(markup)).toBe("My experience Engineer, then editor.");
  });

  it("the mountain's name is read once too, and every line of the caption is there for the entrance to bring in", () => {
    const markup = html(createElement(MapCaption, { title: "Olympus Mons", line: "The tallest.", fact: "27 km.", credit: "Image: NASA" }));

    expect(readAloud(markup)).toBe("Olympus Mons The tallest. 27 km. Image: NASA");
    expect(markup.match(/map-rise/g)).toHaveLength(3);
    expect([...markup.matchAll(/--k:(\d)/g)].map((m) => m[1])).toEqual(["0", "1", "2"]);
  });

  it("numbers the lines from 0 whether or not there is a fact", () => {
    const markup = html(createElement(MapCaption, { title: "Olympus Mons", line: "The tallest.", credit: "Image: NASA" }));

    expect([...markup.matchAll(/--k:(\d)/g)].map((m) => m[1])).toEqual(["0", "1"]);
  });
});
