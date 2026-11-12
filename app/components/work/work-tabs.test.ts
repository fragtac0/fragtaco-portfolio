import { describe, expect, it } from "vitest";
import { activeTab, rowTarget, tabKind, WORK_TABS } from "./work-tabs";

describe("WORK_TABS", () => {
  it("is the three tabs, in order", () => {
    expect(WORK_TABS).toEqual([
      { to: "/work/long-form", label: "Long form" },
      { to: "/work/short-form", label: "Short form" },
      { to: "/experience", label: "My experience" },
    ]);
  });
});

describe("tabKind", () => {
  it("sweeps right from long form to short form and left the other way", () => {
    expect(tabKind("/work/long-form", "/work/short-form")).toBe("linear-right");
    expect(tabKind("/work/short-form", "/work/long-form")).toBe("linear-left");
  });

  it("is radial for every other move", () => {
    expect(tabKind("/work", "/work/long-form")).toBe("radial");
    expect(tabKind("/work/long-form", "/experience")).toBe("radial");
    expect(tabKind("/experience", "/work/short-form")).toBe("radial");
    expect(tabKind("/work/short-form", "/work")).toBe("radial");
    expect(tabKind("/", "/work")).toBe("radial");
    expect(tabKind("/work/long-form", "/work/long-form")).toBe("radial");
  });

  it("reads a trailing slash as the same address", () => {
    expect(tabKind("/work/long-form/", "/work/short-form")).toBe("linear-right");
  });
});

describe("activeTab", () => {
  it("finds the tab of the current address, none on /work or elsewhere", () => {
    expect(activeTab("/work/long-form")).toBe("/work/long-form");
    expect(activeTab("/work/short-form/")).toBe("/work/short-form");
    expect(activeTab("/experience")).toBe("/experience");
    expect(activeTab("/work")).toBeNull();
    expect(activeTab("/")).toBeNull();
  });
});

describe("rowTarget", () => {
  it("goes to the tab's address, and back to the rings from the active tab", () => {
    expect(rowTarget("/work/long-form", "/work")).toBe("/work/long-form");
    expect(rowTarget("/work/long-form", "/work/short-form")).toBe("/work/long-form");
    expect(rowTarget("/work/long-form", "/work/long-form")).toBe("/work");
    expect(rowTarget("/experience", "/experience")).toBe("/work");
  });
});
