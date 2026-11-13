import { describe, expect, it } from "vitest";
import { activeTab, rowTarget, WORK_TABS } from "./work-tabs";

describe("WORK_TABS", () => {
  it("is the three tabs, in order", () => {
    expect(WORK_TABS).toEqual([
      { to: "/work/long-form", label: "Long form" },
      { to: "/work/short-form", label: "Short form" },
      { to: "/experience", label: "My experience" },
    ]);
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
  it("goes to the tab's address, and nowhere from the tab that is already open", () => {
    expect(rowTarget("/work/long-form", "/work")).toBe("/work/long-form");
    expect(rowTarget("/work/long-form", "/work/short-form")).toBe("/work/long-form");
    expect(rowTarget("/work/long-form", "/")).toBe("/work/long-form");
    expect(rowTarget("/work/long-form", "/work/long-form")).toBeNull();
    expect(rowTarget("/experience", "/experience")).toBeNull();
  });

  it("reads a trailing slash as the same address", () => {
    expect(rowTarget("/work/short-form", "/work/short-form/")).toBeNull();
    expect(rowTarget("/work/short-form/", "/work/short-form")).toBeNull();
  });
});
