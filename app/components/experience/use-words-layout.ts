// The page's side of the words' layout (words-layout.ts): measures the two blocks, works the layout out for the screen and writes it as the
// stylesheet's two numbers (`--map-title-size` and `--map-caption-dy`) and a veto (`data-words="old"`: the stylesheet places the blocks beside the
// mountain on a wide screen by itself, before any of this runs, and this only fits them). Applied in a layout effect, so the first paint of a page that
// came in through a change has the words where they belong, and again when the screen, the fonts or the switch change.
import { useEffect, useLayoutEffect, type RefObject } from "react";
import { DOCK_SELECTOR, type Box } from "./keep-out";
import { OVERVIEW } from "./view";
import { layoutWords, type Marks, type WordsLayout } from "./words-layout";

/** The bits of the page the layout reads and writes (a stand-in is given in the test). */
export type LayoutPage = {
  getBoundingClientRect(): { left: number; top: number; width: number; height: number };
  style: { setProperty(name: string, value: string): void; removeProperty(name: string): unknown };
  dataset: Record<string, string | undefined>;
  /** The heading block, the title in it, the mountain's block, the switch (null while it is not there). */
  parts(): {
    heading: { getBoundingClientRect(): { width: number; height: number } };
    titleSize(): number;
    caption: { getBoundingClientRect(): { width: number; height: number } };
    switchBox: Box | null;
    dock: Box | null;
  };
  /** The page's gutter in pixels. */
  gutter(): number;
};

// Layout effects warn on the server; nothing here runs there.
const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/** The two numbers the stylesheet reads. */
export const TITLE_VAR = "--map-title-size";
export const DY_VAR = "--map-caption-dy";

/** Lay the words out for the page as it is, and write the result. Returns the layout (the page's keep-out is read again after it). */
export function applyWordsLayout(page: LayoutPage, cliff: WordsLayoutData["cliff"], marks: Marks): WordsLayout {
  const rect = page.getBoundingClientRect();
  const stage = { w: rect.width, h: rect.height };

  page.style.removeProperty(TITLE_VAR); // the stylesheet's own size is the most the title can be
  page.style.removeProperty(DY_VAR);

  const parts = page.parts();
  const titleMax = parts.titleSize();
  const layout = layoutWords({
    stage,
    look: OVERVIEW,
    cliff,
    marks,
    gutter: page.gutter(),
    switchBox: parts.switchBox,
    dock: parts.dock,
    titleMax,
    measureTitle: (size) => {
      page.style.setProperty(TITLE_VAR, `${size}px`);

      const { width, height } = parts.heading.getBoundingClientRect();

      return { w: width, h: height };
    },
    caption: (() => {
      const { width, height } = parts.caption.getBoundingClientRect();

      return { w: width, h: height };
    })(),
  });

  if (layout.beside) {
    page.style.setProperty(TITLE_VAR, `${layout.titleSize}px`);
    page.style.setProperty(DY_VAR, `${layout.captionDy}px`);
    delete page.dataset.words;
  } else {
    page.style.removeProperty(TITLE_VAR);
    page.dataset.words = "old";
  }

  return layout;
}

export type WordsLayoutData = { cliff: readonly (readonly [number, number])[]; marks: Marks };

/** The real page's parts, read from the DOM under `root`, the page's own element. */
export function pageParts(root: HTMLElement): LayoutPage {
  const origin = () => root.getBoundingClientRect();
  const box = (el: Element | null): Box | null => {
    if (!el) return null;

    const r = el.getBoundingClientRect();
    const o = origin();

    return r.width > 0 && r.height > 0 ? { l: r.left - o.left, t: r.top - o.top, r: r.right - o.left, b: r.bottom - o.top } : null;
  };

  return {
    getBoundingClientRect: () => origin(),
    style: root.style,
    dataset: root.dataset,
    gutter: () => parseFloat(getComputedStyle(root).getPropertyValue("--map-gutter")) || 48,
    parts: () => {
      const heading = root.querySelector(".map-heading") as HTMLElement;
      const title = root.querySelector(".map-title") as HTMLElement;
      const caption = root.querySelector(".map-caption") as HTMLElement;

      return {
        heading,
        titleSize: () => parseFloat(getComputedStyle(title).fontSize) || 64,
        caption,
        switchBox: box(root.querySelector(".map-mode")) ?? SWITCH_GUESS(origin().width, parseFloat(getComputedStyle(root).getPropertyValue("--map-gutter")) || 48),
        dock: box(document.querySelector(DOCK_SELECTOR)),
      };
    },
  };
}

/** Where the switch will be before it is on the page (it comes with the map, on a first load): top right, about 210 by 44. */
const SWITCH_GUESS = (w: number, gutter: number): Box => ({ l: w - gutter - 210, t: 28, r: w - gutter, b: 72 });

/**
 * Lays the words out whenever the screen or the page's parts change, while `active` (the map is on the page: where it is not, the list takes the
 * right side and the words keep their old places). `onApplied` is told after each layout, so the chart's labels can keep out of the words where they
 * are now. Nothing runs on the server.
 */
export function useWordsLayout(ref: RefObject<HTMLElement | null>, data: WordsLayoutData, active: boolean, switchKey: string, onApplied: () => void): void {
  useIsoLayoutEffect(() => {
    const root = ref.current;

    if (!root) return;
    if (!active) {
      root.style.removeProperty(TITLE_VAR);
      root.style.removeProperty(DY_VAR);
      root.dataset.words = "old";

      return;
    }

    const page = pageParts(root);
    let frame = 0;
    /** The page's size when the words were last laid out: the observer's first call, and a repeat of the same size, change nothing (a layout costs a few forced reflows: not to be spent inside a page change's reveal). */
    let laid = "";
    const run = (force: boolean) => {
      const r = root.getBoundingClientRect();
      const size = `${r.width}x${r.height}`;

      if (!force && size === laid) return;
      laid = size;
      applyWordsLayout(page, data.cliff, data.marks);
      onApplied();
    };
    const soon = (force: boolean) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => run(force));
    };
    const observer = new ResizeObserver(() => soon(false));
    const fonts = document.fonts;
    const arrived = () => soon(true);

    run(true);
    observer.observe(root); // the page is fixed to the screen: its size is the screen's, so this is also the window's resize
    // the title's letters are wider or narrower when the lettering font arrives: only a font that is still on its way asks for another layout
    if (fonts?.status === "loading") void fonts.ready.then(arrived);
    fonts?.addEventListener?.("loadingdone", arrived);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      fonts?.removeEventListener?.("loadingdone", arrived);
    };
  }, [ref, data, active, switchKey, onApplied]);
}
