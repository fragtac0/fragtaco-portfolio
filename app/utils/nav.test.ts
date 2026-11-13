import { describe, expect, it } from "vitest";
import { activeNavKey, isHomeSectionId, isOpenAddress, legacyViewTarget, tabCurrent } from "./nav";

describe("activeNavKey", () => {
  it("reads the home page as home", () => {
    expect(activeNavKey("/")).toBe("home");
  });

  it("reads /work and /experience, and anything under them, as work", () => {
    expect(activeNavKey("/work")).toBe("work");
    expect(activeNavKey("/work/")).toBe("work");
    expect(activeNavKey("/work/some-project")).toBe("work");
    expect(activeNavKey("/work/long-form")).toBe("work");
    expect(activeNavKey("/work/short-form")).toBe("work");
    expect(activeNavKey("/experience")).toBe("work");
  });

  it("matches whole path segments only", () => {
    expect(activeNavKey("/workshop")).toBeNull();
    expect(activeNavKey("/experiences")).toBeNull();
    expect(activeNavKey("/timeline")).toBeNull();
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
    expect(tabCurrent("/work", "/experience", true)).toBe("true");
    expect(tabCurrent("/work", "/work/long-form", true)).toBe("true");
    expect(tabCurrent("/work", "/work/some-project", true)).toBe("true");
  });

  it("says nothing on a tab that is not the active one", () => {
    expect(tabCurrent("/", "/work", false)).toBeUndefined();
    expect(tabCurrent("/work", "/", false)).toBeUndefined();
  });
});

describe("legacyViewTarget", () => {
  it("sends round 5 ?view= links to the new addresses", () => {
    expect(legacyViewTarget("?view=long")).toBe("/work/long-form");
    expect(legacyViewTarget("?view=short")).toBe("/work/short-form");
    expect(legacyViewTarget("?view=clients")).toBe("/work");
  });

  it("leaves anything else alone", () => {
    expect(legacyViewTarget("")).toBeNull();
    expect(legacyViewTarget("?view=all")).toBeNull();
    expect(legacyViewTarget("?view=other")).toBeNull();
    expect(legacyViewTarget("?x=1")).toBeNull();
  });
});

describe("isOpenAddress", () => {
  it("is true when a link points at the page that is open, with or without a trailing slash", () => {
    expect(isOpenAddress("/work", "/work")).toBe(true);
    expect(isOpenAddress("/work/", "/work")).toBe(true);
    expect(isOpenAddress("/work", "/work/")).toBe(true);
    expect(isOpenAddress("/", "/")).toBe(true);
  });

  it("is false for another page, and for a link with a query or a hash (a different place on the page)", () => {
    expect(isOpenAddress("/work", "/")).toBe(false);
    expect(isOpenAddress("/work/long-form", "/work")).toBe(false);
    expect(isOpenAddress("/work?view=long", "/work")).toBe(false);
    expect(isOpenAddress("/#about", "/")).toBe(false);
  });
});
