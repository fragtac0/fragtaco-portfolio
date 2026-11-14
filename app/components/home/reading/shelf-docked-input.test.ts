import { afterEach, describe, expect, it, vi } from "vitest";
import { createFrameBox } from "../layer/frame-box";
import { attachShelfInput, createShelfInput } from "./shelf-input";
import { newShelfState, type ShelfCtx } from "./shelf-open";

/** The shelf's keys, through the real input code: a docked shelf (its `running` is false) answers none, an undocked one does. */
let keydown: (e: unknown) => void = () => undefined;

function setup(running: boolean) {
  const canvas = { addEventListener: () => undefined, focus: () => undefined, style: {} } as unknown as HTMLCanvasElement;
  vi.stubGlobal("window", {
    addEventListener: (type: string, cb: (e: unknown) => void) => {
      if (type === "keydown") keydown = cb;
    },
  });
  vi.stubGlobal("document", { activeElement: canvas });
  const st = newShelfState();
  const gl = { maxX: 2, books: [{ base: { x: 0 }, d: { title: "T", author: "A" } }, { base: { x: 1 }, d: { title: "U", author: "B" } }] };
  const opened: unknown[] = [];
  const ctx = {
    canvas,
    st,
    cam: { x: 0, xV: 0 },
    scene: () => gl,
    els: () => null,
    box: createFrameBox(canvas),
    running: () => running,
    live: () => true,
    reduced: true,
    intro: () => 0,
  } as unknown as ShelfCtx;
  const path = { openBook: (b: unknown) => opened.push(b), closeBook: () => undefined, setNote: () => undefined, announce: () => undefined };
  const input = createShelfInput(ctx, path, () => undefined);
  attachShelfInput(canvas, input.handlers, new AbortController().signal);
  return { st, opened };
}

const key = (k: string) => keydown({ key: k, altKey: false, ctrlKey: false, metaKey: false, preventDefault: () => undefined });

afterEach(() => vi.unstubAllGlobals());

describe("the shelf's keys", () => {
  it("a shelf that answers input moves its keyboard highlight", () => {
    const { st } = setup(true);
    key("ArrowRight");
    expect(st.focusIdx).toBe(0);
  });

  it("a docked shelf ignores the arrow keys and Enter", () => {
    const { st, opened } = setup(false);
    key("ArrowRight");
    key("ArrowLeft");
    key("Enter");
    expect(st.focusIdx).toBe(-1);
    expect(opened).toEqual([]);
  });
});
