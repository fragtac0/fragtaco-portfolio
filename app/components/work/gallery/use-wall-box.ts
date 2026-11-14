import { useEffect, useLayoutEffect, useState, type RefObject } from "react";
import type { Safe } from "./gallery-math";
import { wallSafe } from "./wall-layout";

/** What the wall measures on the page: its own size, the heading's bottom edge and how much the dock takes from the bottom. */
export type WallBox = { vw: number; vh: number; headingBottom: number; dockBand: number };

// Layout effects warn on the server; the server never measures, so there it is a plain effect.
const useIsoLayoutEffect = typeof document === "undefined" ? useEffect : useLayoutEffect;

/**
 * The wall's size and bands, read from the page (null if the stage has no size yet). The element marked `data-wall-top` is the header: the heading and the back button.
 * On a first load the dock has not yet said how tall it is (SiteNav sets `--site-nav-height` after it mounts, later than this wall's first measure): that read is
 * null too, unless `force`, so the wall is never laid out once on a guessed dock and again a frame later (a jump the plain links, when they already show, would not hide).
 */
export function readWallBox(stage: HTMLElement, force = false): WallBox | null {
  const vw = stage.clientWidth;
  const vh = stage.clientHeight;
  if (!vw || !vh) return null;
  const top = stage.getBoundingClientRect().top;
  let headingBottom = 0;
  document.querySelectorAll<HTMLElement>("[data-wall-top]").forEach((el) => {
    headingBottom = Math.max(headingBottom, el.getBoundingClientRect().bottom - top);
  });
  // The dock's full height (its second row counted as open: SiteNav keeps this variable) plus what is under it.
  const header = document.querySelector<HTMLElement>("header[data-site-nav]");
  const nav = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--site-nav-height"));
  // (a stylesheet may hold a first guess for the variable: only the inline value SiteNav sets counts as its answer)
  if (header && !document.documentElement.style.getPropertyValue("--site-nav-height") && !force) return null;
  const full = Number.isFinite(nav) && nav > 0 ? nav : (header?.getBoundingClientRect().height ?? 140);
  const below = header ? Math.max(0, top + vh - header.getBoundingClientRect().bottom) : 24;
  return { vw, vh, headingBottom, dockBand: full + below };
}

/** The safe area for a measured wall. */
export function safeOf(box: WallBox | null, stage: HTMLElement | null): Safe {
  const b = box ?? (stage ? readWallBox(stage) : null);
  return b ? wallSafe(b.vw, b.vh, b.headingBottom, b.dockBand) : wallSafe(stage?.clientWidth ?? 1280, stage?.clientHeight ?? 720, 0, 0);
}

const same = (a: WallBox | null, b: WallBox | null) =>
  a === b || (!!a && !!b && a.vw === b.vw && a.vh === b.vh && Math.abs(a.headingBottom - b.headingBottom) < 0.5 && Math.abs(a.dockBand - b.dockBand) < 0.5);

/**
 * The wall's measurements, null on the server and until the first measure (before the first paint on the
 * client). Measured again when the stage or the dock changes size or the window resizes; a state update
 * only when a number changed (never per frame).
 */
export function useWallBox(stage: RefObject<HTMLElement>): WallBox | null {
  const [box, setBox] = useState<WallBox | null>(null);

  useIsoLayoutEffect(() => {
    const el = stage.current;
    const measure = (force = false) => {
      const next = el ? readWallBox(el, force) : null;
      if (next) setBox((prev) => (same(prev, next) ? prev : next));
    };
    measure();
    // if the dock never says how tall it is, measure with what is there after a moment
    const giveUp = window.setTimeout(() => measure(true), 600);
    const header = document.querySelector("header[data-site-nav]");
    const again = () => measure();
    const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(again);
    if (el) ro?.observe(el);
    if (header) ro?.observe(header);
    // SiteNav sets --site-nav-height on <html> after it mounts and on resize
    const mo = new MutationObserver(again);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["style"] });
    window.addEventListener("resize", again);
    return () => {
      window.clearTimeout(giveUp);
      ro?.disconnect();
      mo.disconnect();
      window.removeEventListener("resize", again);
    };
  }, [stage]);

  return box;
}
