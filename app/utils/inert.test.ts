import { describe, expect, it } from "vitest";
import { inertProps } from "./inert";

describe("inertProps", () => {
  it("marks a subtree inert and hidden from assistive tech when on", () => {
    expect(inertProps(true)).toEqual({ inert: "", "aria-hidden": "true" });
  });

  it("adds nothing when off", () => {
    expect(inertProps(false)).toEqual({});
  });
});
