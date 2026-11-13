/**
 * Keeps a keyboard user's place across a page change that began in the dock. Every page renders its own
 * dock, so when the page commits the focused tab is removed and focus falls to <body>; at the end of the
 * change this puts it on the new page's current tab (without scrolling), so Tab and Shift+Tab carry on from
 * there instead of from the top of the page. Nothing happens if focus was not in the dock when the change
 * began, or if the new page already put focus somewhere on purpose.
 */
const DOCK = "header[data-site-nav]";

type FocusDoc = Pick<Document, "activeElement" | "body" | "querySelector">;

/** True when keyboard focus (or the pointer's click) is on something inside the dock. */
export function focusInDock(doc: FocusDoc = document): boolean {
  const dock = doc.querySelector(DOCK);
  const at = doc.activeElement;

  return !!dock && !!at && at !== doc.body && dock.contains(at);
}

/** Focuses the current tab of the dock (the page's own tab first, then the primary nav's). Returns whether it did. */
export function restoreDockFocus(doc: FocusDoc = document): boolean {
  const at = doc.activeElement;

  if (at && at !== doc.body) return false; // focus is somewhere on purpose
  const dock = doc.querySelector(DOCK);

  if (!dock) return false;
  const tries = [...dock.querySelectorAll('[aria-current="page"]'), ...dock.querySelectorAll('nav[aria-label="Primary"] [aria-current]')];

  for (const el of tries) {
    if (!(el instanceof HTMLElement)) continue;
    el.focus({ preventScroll: true });
    if (doc.activeElement === el) return true; // a tab in a closed row is inert and refuses: try the next
  }
  return false;
}

/**
 * After a press finished a page change: focus has fallen to <body> when the old page's element went away, so put it on
 * the new page's <main> (made focusable, no outline: it is a place to carry on from, not a control) and Tab goes to the
 * first thing on the page. Nothing happens if focus is already somewhere on purpose. Returns whether it did.
 */
export function focusAfterFinish(doc: FocusDoc = document): boolean {
  const at = doc.activeElement;

  if (at && at !== doc.body) return false;
  const main = doc.querySelector("main");

  if (!main || !(main instanceof HTMLElement)) return false;
  if (!main.hasAttribute("tabindex")) main.setAttribute("tabindex", "-1");
  main.style.outline = "none";
  main.focus({ preventScroll: true });
  return doc.activeElement === main;
}
