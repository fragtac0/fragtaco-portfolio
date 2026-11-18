import { createElement, type ReactNode } from "react";
import lockupSvg from "./fragtaco-lockup.svg?raw";

/**
 * The inside of the logo's <svg>, made into React elements from the SVG file itself (the file stays the one source of the drawing). It used to
 * be written into the page as a string with innerHTML, which the browser's Trusted Types rule refuses; elements React makes itself need no such
 * write. The file holds only <defs>, <mask>, <rect>, <g> and <path>: the reader below knows nothing else, and throws on anything it does not
 * (a new element in the file fails the test at once rather than being drawn wrong).
 */
const KNOWN = new Set(["defs", "mask", "rect", "g", "path"]);
const TAG = /<(\/?)([a-zA-Z][\w-]*)((?:\s+[\w:-]+="[^"]*")*)\s*(\/?)>/y;
const ATTR = /([\w:-]+)="([^"]*)"/g;

// the one attribute whose React name differs from its SVG name in this file (the rest are already camel case: viewBox, maskUnits; logo-nodes.test.ts fails if the file gets a name that is neither)
const REACT_NAME: Record<string, string> = { class: "className" };

function props(raw: string, key: number): Record<string, string | number> {
  const out: Record<string, string | number> = { key };
  for (const [, name, value] of raw.matchAll(ATTR)) out[REACT_NAME[name] ?? name] = value;
  return out;
}

/** The elements between the outer <svg> tags of `svg`. */
export function svgChildren(svg: string): ReactNode[] {
  const inner = svg.replace(/^[\s\S]*?<svg\b[^>]*>/, "").replace(/<\/svg>\s*$/, "").trim();
  const root: ReactNode[] = [];
  const stack: Array<{ tag: string; props: Record<string, string | number>; children: ReactNode[] }> = [];
  let at = 0;
  while (at < inner.length) {
    TAG.lastIndex = at;
    const m = TAG.exec(inner);
    if (!m) throw new Error(`logo: unreadable SVG at ${at}: ${inner.slice(at, at + 40)}`);
    at = TAG.lastIndex;
    const [, closing, tag, attrs, selfClosing] = m;
    if (!KNOWN.has(tag)) throw new Error(`logo: <${tag}> is not one the logo reader knows`);
    const siblings = stack.length ? stack[stack.length - 1].children : root;
    if (closing) {
      const open = stack.pop();
      if (!open || open.tag !== tag) throw new Error(`logo: </${tag}> does not close ${open?.tag ?? "anything"}`);
      (stack.length ? stack[stack.length - 1].children : root).push(createElement(open.tag, open.props, ...open.children));
    } else if (selfClosing) {
      siblings.push(createElement(tag, props(attrs, siblings.length)));
    } else {
      stack.push({ tag, props: props(attrs, siblings.length), children: [] });
    }
  }
  if (stack.length) throw new Error(`logo: <${stack[stack.length - 1].tag}> is never closed`);
  return root;
}

export const LOGO_NODES: ReactNode[] = svgChildren(lockupSvg);
