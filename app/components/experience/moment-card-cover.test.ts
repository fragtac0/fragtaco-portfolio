import { describe, expect, it } from "vitest";
import { cardView } from "./moment-card";

/** A stand-in for a bead's button: the style and the attributes `cover` writes. */
function pin() {
  const attrs = new Set<string>();

  return {
    style: { opacity: "", pointerEvents: "" },
    attrs,
    toggleAttribute(name: string, force?: boolean) {
      if (force) attrs.add(name);
      else attrs.delete(name);

      return force === true;
    },
  };
}

function view(pins: ReturnType<typeof pin>[], onCover?: () => void) {
  const card = { querySelectorAll: () => [], offsetWidth: 0, offsetHeight: 0 };

  return cardView(card as unknown as HTMLElement, () => pins as unknown as HTMLElement[], onCover);
}

describe("the beads under the card (R53.4d)", () => {
  it("marks them data-under (the CSS takes their hit span out of the touch), steps them back, and clears them when the card goes", () => {
    const pins = [pin(), pin(), pin()];
    const v = view(pins);

    v.cover([0, 2]);
    expect(pins.map((p) => p.attrs.has("data-under"))).toEqual([true, false, true]);
    expect(pins.map((p) => p.style.opacity)).toEqual(["0.16", "", "0.16"]);
    v.cover([]);
    expect(pins.map((p) => p.attrs.has("data-under"))).toEqual([false, false, false]);
    expect(pins.map((p) => p.style.opacity)).toEqual(["", "", ""]);
  });

  it("no longer writes pointer-events inline (it would not reach the hit span, which sets its own)", () => {
    const pins = [pin()];

    view(pins).cover([0]);
    expect(pins[0].style.pointerEvents).toBe("");
  });

  it("tells the engine after each change, so the hit areas are written again at rest", () => {
    let told = 0;

    view([pin()], () => told++).cover([0]);
    expect(told).toBe(1);
  });
});
