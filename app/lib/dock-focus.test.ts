import { afterEach, describe, expect, it, vi } from "vitest";
import { focusInDock, restoreDockFocus } from "./dock-focus";

class FakeEl {
  focusable = true;
  constructor(
    private doc: FakeDoc,
    public name: string,
    private kids: FakeEl[] = [],
  ) {}
  contains(el: unknown): boolean {
    return el === this || this.kids.some((k) => k.contains(el));
  }
  focus() {
    if (this.focusable) this.doc.activeElement = this as unknown as Element;
  }
  querySelectorAll(sel: string) {
    return this.doc.matches[sel] ?? [];
  }
}
class FakeDoc {
  activeElement: Element | null = null;
  body = {} as HTMLElement;
  dock: FakeEl | null = null;
  matches: Record<string, FakeEl[]> = {};
  querySelector(sel: string) {
    return sel === "header[data-site-nav]" ? this.dock : null;
  }
}
const asDoc = (d: FakeDoc) => d as unknown as Pick<Document, "activeElement" | "body" | "querySelector">;

describe("dock focus", () => {
  afterEach(() => vi.unstubAllGlobals());

  function setup() {
    // the helper checks `instanceof HTMLElement`: the fakes stand in for it
    vi.stubGlobal("HTMLElement", FakeEl);
    const doc = new FakeDoc();
    const tab = new FakeEl(doc, "tab");
    const primary = new FakeEl(doc, "primary");
    doc.dock = new FakeEl(doc, "dock", [tab, primary]);
    doc.matches['[aria-current="page"]'] = [tab];
    doc.matches['nav[aria-label="Primary"] [aria-current]'] = [primary];
    doc.activeElement = doc.body;
    return { doc, tab, primary };
  }

  it("knows when focus is inside the dock", () => {
    const { doc, tab } = setup();
    expect(focusInDock(asDoc(doc))).toBe(false);
    tab.focus();
    expect(focusInDock(asDoc(doc))).toBe(true);
    doc.activeElement = new FakeEl(doc, "elsewhere") as unknown as Element;
    expect(focusInDock(asDoc(doc))).toBe(false);
  });

  it("focuses the page's current tab when focus fell to the body", () => {
    const { doc, tab } = setup();
    expect(restoreDockFocus(asDoc(doc))).toBe(true);
    expect(doc.activeElement).toBe(tab);
  });

  it("tries the primary nav's current link when the tab refuses (a closed row is inert)", () => {
    const { doc, tab, primary } = setup();
    tab.focusable = false;
    expect(restoreDockFocus(asDoc(doc))).toBe(true);
    expect(doc.activeElement).toBe(primary);
  });

  it("leaves focus where the page put it on purpose", () => {
    const { doc } = setup();
    const other = new FakeEl(doc, "layer") as unknown as Element;
    doc.activeElement = other;
    expect(restoreDockFocus(asDoc(doc))).toBe(false);
    expect(doc.activeElement).toBe(other);
  });

  it("does nothing without a dock", () => {
    const { doc } = setup();
    doc.dock = null;
    expect(restoreDockFocus(asDoc(doc))).toBe(false);
  });
});
