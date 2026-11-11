import { describe, expect, it } from "vitest";
import {
  cellAt,
  clampView,
  columnsFor,
  dateOfIndex,
  dayIndex,
  detailLevel,
  fitView,
  hitCell,
  roleAt,
  roleCounts,
  totalDays,
  zoomAt,
  type View,
} from "./timeline-math";

const START = "2020-12-01";
const TODAY = "2026-11-11";
const ROLES = [
  { from: "2020-12-01" },
  { from: "2021-06-01" },
  { from: "2022-01-01" },
  { from: "2022-09-01" },
  { from: "2023-01-01" },
  { from: "2025-12-01" },
];

describe("dayIndex and dateOfIndex", () => {
  it("counts whole days from the start", () => {
    expect(dayIndex(START, START)).toBe(0);
    expect(dayIndex("2020-12-02", START)).toBe(1);
  });

  it("counts the leap day 2024-02-29 as day 1185 and gives it back", () => {
    expect(dayIndex("2024-02-29", START)).toBe(1185);
    expect(dateOfIndex(1185, START)).toBe("2024-02-29");
    expect(dateOfIndex(1184, START)).toBe("2024-02-28");
    expect(dateOfIndex(1186, START)).toBe("2024-03-01");
  });

  it("crosses month boundaries and the year end", () => {
    expect(dayIndex("2020-12-31", START)).toBe(30);
    expect(dayIndex("2021-01-01", START)).toBe(31);
    expect(dateOfIndex(30, START)).toBe("2020-12-31");
    expect(dateOfIndex(31, START)).toBe("2021-01-01");
    expect(dateOfIndex(dayIndex("2023-12-31", START), START)).toBe("2023-12-31");
    expect(dayIndex("2024-01-01", START) - dayIndex("2023-12-31", START)).toBe(1);
  });

  it("round-trips every day of the real range", () => {
    for (let i = 0; i < 2172; i++) expect(dayIndex(dateOfIndex(i, START), START)).toBe(i);
  });

  it("gives negative indexes for days before the start", () => {
    expect(dayIndex("2020-11-30", START)).toBe(-1);
    expect(dateOfIndex(-1, START)).toBe("2020-11-30");
  });

  it("is not moved by the machine's time zone or a daylight saving change", () => {
    expect(dayIndex("2021-03-29", "2021-03-28")).toBe(1);
    expect(dayIndex("2021-10-31", "2021-10-30")).toBe(1);
  });

  it("rejects text that is not a real ISO date", () => {
    expect(() => dayIndex("2021-02-30", START)).toThrow();
    expect(() => dayIndex("2021-2-3", START)).toThrow();
    expect(() => dayIndex("nonsense", START)).toThrow();
  });
});

describe("totalDays", () => {
  it("counts both the first and the last day", () => {
    expect(totalDays(START, TODAY)).toBe(2172);
  });

  it("is 1 when today is the start", () => {
    expect(totalDays(START, START)).toBe(1);
  });

  it("is 0 when today is before the start", () => {
    expect(totalDays(START, "2020-11-30")).toBe(0);
  });

  it("counts across the leap day", () => {
    expect(totalDays("2024-02-28", "2024-03-01")).toBe(3);
  });
});

describe("roleAt", () => {
  it("changes role on each role's first day", () => {
    expect(roleAt(0, ROLES, START)).toBe(0);
    expect(roleAt(181, ROLES, START)).toBe(0);
    expect(roleAt(182, ROLES, START)).toBe(1);
    expect(roleAt(dayIndex("2025-11-30", START), ROLES, START)).toBe(4);
    expect(roleAt(dayIndex("2025-12-01", START), ROLES, START)).toBe(5);
    expect(roleAt(2171, ROLES, START)).toBe(5);
  });

  it("is -1 for a day before the first role", () => {
    expect(roleAt(-1, ROLES, START)).toBe(-1);
  });
});

describe("roleCounts", () => {
  it("matches the spec's legend on 2026-11-11", () => {
    expect(roleCounts(ROLES, START, TODAY)).toEqual([182, 214, 243, 122, 1065, 346]);
  });

  it("adds up to the total days", () => {
    const sum = roleCounts(ROLES, START, TODAY).reduce((a, b) => a + b, 0);

    expect(sum).toBe(totalDays(START, TODAY));
  });

  it("gives 1 for the first role and 0 for the rest when today is the start", () => {
    expect(roleCounts(ROLES, START, START)).toEqual([1, 0, 0, 0, 0, 0]);
  });

  it("gives 0 for a role that begins after today", () => {
    expect(roleCounts(ROLES, START, "2022-03-15")).toEqual([182, 214, 74, 0, 0, 0]);
  });

  it("counts a role that begins today as 1", () => {
    expect(roleCounts(ROLES, START, "2025-12-01")).toEqual([182, 214, 243, 122, 1065, 1]);
  });

  it("gives all zeros when today is before the start", () => {
    expect(roleCounts(ROLES, START, "2020-11-30")).toEqual([0, 0, 0, 0, 0, 0]);
  });

  it("gives an empty list for no roles", () => {
    expect(roleCounts([], START, TODAY)).toEqual([]);
  });
});

describe("columnsFor and cellAt", () => {
  it("uses 28 columns under 700px and 56 from 700px", () => {
    expect(columnsFor(390)).toBe(28);
    expect(columnsFor(699)).toBe(28);
    expect(columnsFor(700)).toBe(56);
    expect(columnsFor(1440)).toBe(56);
  });

  it("reads left to right, top to bottom", () => {
    expect(cellAt(0, 56)).toEqual({ col: 0, row: 0 });
    expect(cellAt(55, 56)).toEqual({ col: 55, row: 0 });
    expect(cellAt(56, 56)).toEqual({ col: 0, row: 1 });
    expect(cellAt(57, 56)).toEqual({ col: 1, row: 1 });
    expect(cellAt(2171, 56)).toEqual({ col: 2171 % 56, row: 38 });
  });
});

describe("fitView", () => {
  it("fits 56 by 39 cells in 1440x900 with an 80px margin, centred", () => {
    const v = fitView(56, 39, 1440, 900, 80);

    expect(v.scale).toBeCloseTo(18.97, 2);
    expect(v.x + (56 * v.scale) / 2).toBeCloseTo(720, 6);
    expect(v.y + (39 * v.scale) / 2).toBeCloseTo(450, 6);
    expect(v.y).toBeCloseTo(80, 6);
  });

  it("is limited by the width when the grid is wide", () => {
    const v = fitView(28, 40, 390, 844, 16);

    expect(v.scale).toBeCloseTo((390 - 32) / 28, 6);
    expect(v.x).toBeCloseTo(16, 6);
  });

  it("is limited by the height on a phone with the real 78 rows, centred across", () => {
    const v = fitView(28, 78, 390, 844, 16);

    expect(v.scale).toBeCloseTo((844 - 32) / 78, 6);
    expect(v.y).toBeCloseTo(16, 6);
    expect(v.x + (28 * v.scale) / 2).toBeCloseTo(195, 6);
  });
});

describe("zoomAt", () => {
  const view: View = { scale: 18.97, x: 90, y: 80 };

  it("keeps the cell under the pointer fixed", () => {
    const px = 600;
    const py = 300;
    const before = { c: (px - view.x) / view.scale, r: (py - view.y) / view.scale };
    const next = zoomAt(view, 2.5, px, py, 4, 80);

    expect(next.scale).toBeCloseTo(18.97 * 2.5, 6);
    expect((px - next.x) / next.scale).toBeCloseTo(before.c, 3);
    expect((py - next.y) / next.scale).toBeCloseTo(before.r, 3);
  });

  it("clamps at max and min and keeps the point fixed when clamped", () => {
    const up = zoomAt(view, 100, 600, 300, 4, 80);
    const down = zoomAt(view, 0.001, 600, 300, 4, 80);

    expect(up.scale).toBe(80);
    expect(down.scale).toBe(4);
    expect((600 - up.x) / up.scale).toBeCloseTo((600 - view.x) / view.scale, 3);
    expect((300 - down.y) / down.scale).toBeCloseTo((300 - view.y) / view.scale, 3);
  });

  it("leaves the view as it is at the limit", () => {
    const atMax: View = { scale: 80, x: 10, y: 20 };

    expect(zoomAt(atMax, 2, 500, 400, 4, 80)).toEqual(atMax);
  });
});

describe("clampView", () => {
  it("leaves a view that is on screen alone", () => {
    const v = { scale: 18, x: 100, y: 80 };

    expect(clampView(v, 56, 39, 1440, 900)).toEqual(v);
  });

  it("stops the grid's left edge at the middle of the screen", () => {
    expect(clampView({ scale: 18, x: 5000, y: 80 }, 56, 39, 1440, 900).x).toBe(720);
  });

  it("stops the grid's right edge at the middle of the screen", () => {
    const w = 56 * 18;

    expect(clampView({ scale: 18, x: -9000, y: 80 }, 56, 39, 1440, 900).x).toBe(720 - w);
  });

  it("clamps the vertical axis the same way", () => {
    const h = 39 * 18;

    expect(clampView({ scale: 18, x: 100, y: 5000 }, 56, 39, 1440, 900).y).toBe(450);
    expect(clampView({ scale: 18, x: 100, y: -9000 }, 56, 39, 1440, 900).y).toBe(450 - h);
  });
});

describe("hitCell", () => {
  const view: View = { scale: 20, x: 100, y: 50 };

  it("finds the cell under a point", () => {
    expect(hitCell(view, 105, 55, 56, 2172)).toBe(0);
    expect(hitCell(view, 100 + 20 * 3 + 1, 50 + 20 * 2 + 1, 56, 2172)).toBe(2 * 56 + 3);
  });

  it("is null outside the grid", () => {
    expect(hitCell(view, 99, 60, 56, 2172)).toBeNull();
    expect(hitCell(view, 110, 49, 56, 2172)).toBeNull();
    expect(hitCell(view, 100 + 56 * 20, 60, 56, 2172)).toBeNull();
    expect(hitCell(view, 110, 50 + 39 * 20, 56, 2172)).toBeNull();
  });

  it("is null beyond the last day in the final row", () => {
    // 2172 = 38 * 56 + 44: the last row holds columns 0 to 43.
    const lastRowY = 50 + 38 * 20 + 5;

    expect(hitCell(view, 100 + 43 * 20 + 5, lastRowY, 56, 2172)).toBe(2171);
    expect(hitCell(view, 100 + 44 * 20 + 5, lastRowY, 56, 2172)).toBeNull();
  });

  it("is null when there are no days", () => {
    expect(hitCell(view, 105, 55, 56, 0)).toBeNull();
  });
});

describe("detailLevel", () => {
  it("has three levels split at 10 and 28", () => {
    expect(detailLevel(9.9)).toBe(0);
    expect(detailLevel(10)).toBe(1);
    expect(detailLevel(28)).toBe(1);
    expect(detailLevel(28.1)).toBe(2);
  });
});
