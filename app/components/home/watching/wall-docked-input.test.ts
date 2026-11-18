import { afterEach, describe, expect, it, vi } from "vitest";
import { attachWallInput, createWallInput } from "./wall-input";
import { createWallState, type Tile } from "./wall-types";

/** The wall's keys, through the real input code: a docked wall (its `running` is false) answers none, an undocked one does. */
let keydown: (e: unknown) => void = () => undefined;

function setup(running: boolean) {
  const canvas = { addEventListener: () => undefined, focus: () => undefined } as unknown as HTMLCanvasElement;
  vi.stubGlobal("window", {
    addEventListener: (type: string, cb: (e: unknown) => void) => {
      if (type === "keydown") keydown = cb;
    },
  });
  vi.stubGlobal("document", { activeElement: canvas });
  const st = createWallState();
  st.vw = 1440;
  st.vh = 900;
  const tile = { key: "0,0", idx: 0, x: 700, y: 400, cx: 720, cy: 420, w: 40, h: 30, f: 1 } as unknown as Tile;
  st.tiles = [tile];
  const picked: number[] = [];
  const input = createWallInput({ canvas, st, running: () => running, live: () => true, count: () => 12 }, (i) => picked.push(i), () => undefined);
  attachWallInput(canvas, input.handlers, new AbortController().signal);
  return { st, picked };
}

const key = (k: string) => keydown({ key: k, altKey: false, ctrlKey: false, metaKey: false, preventDefault: () => undefined });

afterEach(() => vi.unstubAllGlobals());

describe("the wall's keys", () => {
  it("a wall that answers input moves its keyboard tile", () => {
    const { st } = setup(true);
    key("ArrowRight");
    expect(st.kbd).not.toBeNull();
  });

  it("a docked wall ignores the arrow keys and Enter", () => {
    const { st, picked } = setup(false);
    key("ArrowRight");
    key("ArrowDown");
    key("Enter");
    expect(st.kbd).toBeNull();
    expect(picked).toEqual([]);
  });
});
