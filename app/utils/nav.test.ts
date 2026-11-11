import { describe, expect, it } from "vitest";
import { activeNavKey, isHomeSectionId, tabCurrent } from "./nav";

describe("activeNavKey", () => {
  it("reads the home page as home", () => {
    expect(activeNavKey("/")).toBe("home");
  });

  it("reads /work and /timeline, and anything under them, as work", () => {
    expect(activeNavKey("/work")).toBe("work");
    expect(activeNavKey("/work/")).toBe("work");
    expect(activeNavKey("/work/some-project")).toBe("work");
    expect(activeNavKey("/timeline")).toBe("work");
    expect(activeNavKey("/timeline/2024")).toBe("work");
  });

  it("matches whole path segments only", () => {
    expect(activeNavKey("/workshop")).toBeNull();
    expect(activeNavKey("/timelines")).toBeNull();
  });

  it("gives null for any other page", () => {
    expect(activeNavKey("/other")).toBeNull();
    expect(activeNavKey("")).toBeNull();
  });
});

describe("isHomeSectionId", () => {
  it("keeps the old about link working", () => {
    expect(isHomeSectionId("about")).toBe(true);
    expect(isHomeSectionId("reading")).toBe(false);
  });
});

describe("tabCurrent", () => {
  it("says page on a tab's own address", () => {
    expect(tabCurrent("/", "/", true)).toBe("page");
    expect(tabCurrent("/work", "/work", true)).toBe("page");
  });

  it("says true on a page that only belongs to the tab", () => {
    expect(tabCurrent("/work", "/timeline", true)).toBe("true");
    expect(tabCurrent("/work", "/work/some-project", true)).toBe("true");
  });

  it("says nothing on a tab that is not the active one", () => {
    expect(tabCurrent("/", "/work", false)).toBeUndefined();
    expect(tabCurrent("/work", "/", false)).toBeUndefined();
  });
});
