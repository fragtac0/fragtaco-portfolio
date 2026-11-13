/**
 * The way out of a page change. While a change runs the browser shows pictures of the two pages and nothing under them
 * can be used, and it lasts 3.5 s, so the first pointer press or key press during one finishes it at once
 * (`finishChange`: the transition skips to its end and the new page is live). The press that finishes a change is
 * swallowed: it does not also activate what is under it (a click that follows the press, a key's own action, the key's
 * repeats and its release). Browser shortcuts (a key with Ctrl, Cmd or Alt) and a bare modifier key are not presses.
 * Only a change that is showing its pictures counts: while the data loads the old page is live, and a press works as usual.
 */
import { finishChange, isChangeShowing } from "./page-change";

const MODIFIER_KEYS = new Set(["Shift", "Control", "Alt", "Meta", "AltGraph", "CapsLock", "OS"]);

/** Pure: does this key press count as a press that finishes a change? */
export function isFinishingKey(e: Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "altKey">): boolean {
  return !(e.ctrlKey || e.metaKey || e.altKey) && !MODIFIER_KEYS.has(e.key);
}

interface Api {
  showing: () => boolean;
  finish: () => void;
}

/** Watches the window's presses (in the capture phase, ahead of the page). Returns the function that stops watching. */
export function watchPresses(
  target: Pick<Window, "addEventListener" | "removeEventListener"> = window,
  api: Api = { showing: isChangeShowing, finish: finishChange },
): () => void {
  let swallowClick = false;
  let swallowKey: string | null = null;
  const stop = (e: Event) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const onPointerDown = (e: Event) => {
    if (api.showing()) {
      api.finish();
      swallowClick = true;
      stop(e);
    } else swallowClick = false;
  };
  const onClick = (e: Event) => {
    if (!swallowClick) return;
    // a click of the pointer follows its press; one from the keyboard (detail 0) is not that press's
    if ((e as MouseEvent).detail === 0) return;
    swallowClick = false;
    stop(e);
  };
  const onKeyDown = (e: Event) => {
    const k = e as KeyboardEvent;
    if (api.showing() && isFinishingKey(k)) {
      api.finish();
      swallowKey = k.code;
      swallowClick = false;
      stop(e);
    } else if (swallowKey !== null && k.code === swallowKey && k.repeat) stop(e); // the key is still held
    else {
      swallowKey = null;
      swallowClick = false;
    }
  };
  const onKeyUp = (e: Event) => {
    if (swallowKey === null || (e as KeyboardEvent).code !== swallowKey) return;
    swallowKey = null;
    stop(e); // Space activates a button on release: not this one
  };

  const events: Array<[string, (e: Event) => void]> = [
    ["pointerdown", onPointerDown],
    ["click", onClick],
    ["keydown", onKeyDown],
    ["keyup", onKeyUp],
  ];
  for (const [name, fn] of events) target.addEventListener(name, fn, { capture: true });
  return () => {
    for (const [name, fn] of events) target.removeEventListener(name, fn, { capture: true });
  };
}
