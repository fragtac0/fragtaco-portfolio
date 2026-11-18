import { describe, expect, it, vi } from "vitest";
import { isFinishingKey, watchPresses } from "./change-finish";

type Handler = (e: Event) => void;

/** A window that records its capture listeners, and events that record what was done to them. */
function setup(showing = true) {
  const handlers = new Map<string, Handler>();
  const target = {
    addEventListener: (name: string, fn: Handler) => void handlers.set(name, fn),
    removeEventListener: (name: string) => void handlers.delete(name),
  } as unknown as Window;
  const state = { showing };
  const finish = vi.fn(() => void (state.showing = false));
  const stop = watchPresses(target, { showing: () => state.showing, finish });
  const send = (name: string, props: Record<string, unknown> = {}) => {
    const e = { preventDefault: vi.fn(), stopPropagation: vi.fn(), stopImmediatePropagation: vi.fn(), ...props } as unknown as Event;
    handlers.get(name)?.(e);
    return e as unknown as {
      preventDefault: ReturnType<typeof vi.fn>;
      stopPropagation: ReturnType<typeof vi.fn>;
      stopImmediatePropagation: ReturnType<typeof vi.fn>;
    };
  };
  const swallowed = (e: { preventDefault: ReturnType<typeof vi.fn> }) => e.preventDefault.mock.calls.length > 0;
  return { handlers, state, finish, stop, send, swallowed };
}

describe("isFinishingKey", () => {
  const key = (k: string, mods: Partial<Record<"ctrlKey" | "metaKey" | "altKey", boolean>> = {}) =>
    isFinishingKey({ key: k, ctrlKey: false, metaKey: false, altKey: false, ...mods });
  it("counts ordinary keys", () => {
    for (const k of ["Enter", " ", "Escape", "Tab", "a", "ArrowDown"]) expect(key(k)).toBe(true);
  });
  it("does not count a bare modifier or a browser shortcut", () => {
    for (const k of ["Shift", "Control", "Alt", "Meta"]) expect(key(k)).toBe(false);
    expect(key("r", { metaKey: true })).toBe(false);
    expect(key("l", { ctrlKey: true })).toBe(false);
    expect(key("ArrowLeft", { altKey: true })).toBe(false);
  });
  it("does not count the function keys or the browser, audio, media and launch keys (the browser's and the system's own)", () => {
    for (const k of ["F1", "F5", "F6", "F7", "F11", "F12", "F24", "BrowserBack", "BrowserForward", "BrowserRefresh", "BrowserHome"]) expect(key(k)).toBe(false);
    for (const k of ["AudioVolumeUp", "AudioVolumeMute", "MediaPlayPause", "MediaTrackNext", "LaunchMail", "LaunchApplication1"]) expect(key(k)).toBe(false);
    // keys that only look like them are presses
    for (const k of ["f", "F", "Fn", "Backspace", "Home", "Dead"]) expect(key(k)).toBe(true);
  });
});

describe("watchPresses", () => {
  it("listens in the capture phase to the four events, and stops listening", () => {
    const s = setup();
    expect([...s.handlers.keys()].sort()).toEqual(["click", "keydown", "keyup", "pointerdown"]);
    s.stop();
    expect(s.handlers.size).toBe(0);
  });

  it("finishes the change once on the first pointer press, and swallows the press and the click after it", () => {
    const s = setup();
    const down = s.send("pointerdown");
    expect(s.finish).toHaveBeenCalledTimes(1);
    expect(s.swallowed(down)).toBe(true);
    expect(down.stopPropagation).toHaveBeenCalled();
    expect(down.stopImmediatePropagation).toHaveBeenCalled(); // no other window listener sees it
    const click = s.send("click", { detail: 1 });
    expect(s.swallowed(click)).toBe(true);
    expect(click.stopPropagation).toHaveBeenCalled();
    // the next click is the page's own
    expect(s.swallowed(s.send("click", { detail: 1 }))).toBe(false);
    expect(s.finish).toHaveBeenCalledTimes(1);
  });

  it("does not finish, or swallow, anything when no change is showing its pictures", () => {
    const s = setup(false);
    expect(s.swallowed(s.send("pointerdown"))).toBe(false);
    expect(s.swallowed(s.send("click", { detail: 1 }))).toBe(false);
    expect(s.swallowed(s.send("keydown", { key: "Enter", code: "Enter", ctrlKey: false, metaKey: false, altKey: false }))).toBe(false);
    expect(s.finish).not.toHaveBeenCalled();
  });

  it("finishes on the first key press and swallows it, its repeats and its release (Space acts on release)", () => {
    const s = setup();
    const keyProps = { key: " ", code: "Space", ctrlKey: false, metaKey: false, altKey: false };
    const down = s.send("keydown", keyProps);
    expect(s.finish).toHaveBeenCalledTimes(1);
    expect(s.swallowed(down)).toBe(true);
    expect(s.swallowed(s.send("keydown", { ...keyProps, repeat: true }))).toBe(true); // held
    expect(s.swallowed(s.send("keyup", { code: "Space" }))).toBe(true);
    // pressed again: now an ordinary press
    expect(s.swallowed(s.send("keydown", { ...keyProps, repeat: false }))).toBe(false);
    expect(s.swallowed(s.send("keyup", { code: "Space" }))).toBe(false);
    expect(s.finish).toHaveBeenCalledTimes(1);
  });

  it("leaves a bare modifier and a browser shortcut alone", () => {
    const s = setup();
    expect(s.swallowed(s.send("keydown", { key: "Shift", code: "ShiftLeft", ctrlKey: false, metaKey: false, altKey: false }))).toBe(false);
    expect(s.swallowed(s.send("keydown", { key: "r", code: "KeyR", ctrlKey: false, metaKey: true, altKey: false }))).toBe(false);
    expect(s.finish).not.toHaveBeenCalled();
  });

  it("lets F5 and the browser and media keys through untouched: not prevented, nothing finished", () => {
    const s = setup();
    for (const key of ["F5", "F11", "BrowserBack", "AudioVolumeUp", "MediaPlayPause", "LaunchMail"]) {
      const e = s.send("keydown", { key, code: key, ctrlKey: false, metaKey: false, altKey: false });
      expect(s.swallowed(e)).toBe(false);
      expect(e.stopPropagation).not.toHaveBeenCalled();
    }
    expect(s.finish).not.toHaveBeenCalled();
  });

  it("does not swallow a keyboard click (detail 0) after a pointer press", () => {
    const s = setup();
    s.send("pointerdown");
    expect(s.swallowed(s.send("click", { detail: 0 }))).toBe(false);
  });

  it("forgets the swallowed click when a key is pressed afterwards", () => {
    const s = setup();
    s.send("pointerdown");
    s.send("keydown", { key: "a", code: "KeyA", ctrlKey: false, metaKey: false, altKey: false });
    expect(s.swallowed(s.send("click", { detail: 1 }))).toBe(false);
  });
});
