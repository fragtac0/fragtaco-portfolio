import { describe, expect, it } from "vitest";
import type { SiteTimeline } from "../../types";
import { roleAt } from "./timeline-math";
import {
  buildModel,
  describeDay,
  edgeJitter,
  fillOf,
  formatLongDate,
  formatMonthYear,
  inkFor,
  inkOf,
  luminance,
  MARK_COLOR,
  stairPath,
  summariseRoles,
} from "./timeline-model";

const DATA: SiteTimeline = {
  start: "2020-12-01",
  roles: [
    { id: "student", label: "Student and part-time editor", from: "2020-12-01", color: "#3E8A7C" },
    { id: "editor", label: "Full-time editor", from: "2021-06-01", color: "#D9A441" },
    { id: "social", label: "Social media manager", from: "2022-01-01", color: "#C94F35" },
    { id: "creator", label: "Content creator and editor", from: "2022-09-01", color: "#9C8AC9" },
    { id: "head", label: "Content head", from: "2023-01-01", color: "#FC4C00" },
    { id: "freelance", label: "Freelance creative editor", from: "2025-12-01", color: "#fdfce6" },
  ],
  marks: [],
};
const TODAY = "2026-11-11";

describe("formatLongDate and formatMonthYear", () => {
  it("writes a date in words", () => {
    expect(formatLongDate("2026-11-11")).toBe("11 November 2026");
    expect(formatLongDate("2024-02-29")).toBe("29 February 2024");
    expect(formatLongDate("2020-12-01")).toBe("1 December 2020");
  });

  it("writes the month and year for the label block", () => {
    expect(formatMonthYear("2020-12-01")).toBe("Dec 2020");
    expect(formatMonthYear("2024-02-29")).toBe("Feb 2024");
  });
});

describe("luminance, inkFor", () => {
  it("is 0 for black and 1 for white", () => {
    expect(luminance("#000000")).toBeCloseTo(0, 5);
    expect(luminance("#ffffff")).toBeCloseTo(1, 5);
  });

  it("picks dark ink on light fills and cream ink on dark ones", () => {
    expect(inkFor("#fdfce6")).toBe("#0b0907");
    expect(inkFor("#D9A441")).toBe("#0b0907");
    expect(inkFor("#3E8A7C")).toBe("#0b0907");
    expect(inkFor("#111111")).toBe("#fdfce6");
    expect(inkFor("#2a1f3d")).toBe("#fdfce6");
  });
});

describe("buildModel", () => {
  const model = buildModel(DATA, TODAY);

  it("counts 2172 days and gives each day the role roleAt would", () => {
    expect(model.total).toBe(2172);
    expect(model.roleOfDay.length).toBe(2172);
    for (const i of [0, 1, 181, 182, 183, 395, 396, 1184, 1185, 1186, 2171]) {
      expect(model.roleOfDay[i]).toBe(roleAt(i, DATA.roles, DATA.start));
    }
    for (let i = 0; i < model.total; i += 37) {
      expect(model.roleOfDay[i]).toBe(roleAt(i, DATA.roles, DATA.start));
    }
  });

  it("makes the last day today, and freelance", () => {
    expect(model.roleOfDay[model.total - 1]).toBe(5);
    expect(model.roles[5].label).toBe("Freelance creative editor");
  });

  it("marks the first day of each role, the first role's included", () => {
    expect([...model.firstDays.entries()]).toEqual([
      [0, 0],
      [182, 1],
      [396, 2],
      [639, 3],
      [761, 4],
      [1826, 5],
    ]);
  });

  it("lists every month start, flags each 1 January, and keeps the day of the month", () => {
    expect(model.monthStarts[0]).toEqual({ index: 0, short: "Dec", year: 2020, newYear: false });
    expect(model.monthStarts[1]).toEqual({ index: 31, short: "Jan", year: 2021, newYear: true });
    expect(model.monthStarts.filter((m) => m.newYear).map((m) => m.year)).toEqual([2021, 2022, 2023, 2024, 2025, 2026]);
    expect(model.monthStarts[model.monthStarts.length - 1]).toEqual({ index: 2161, short: "Nov", year: 2026, newYear: false });
    expect(model.monthAt.get(0)).toBe("Dec");
    expect(model.monthAt.get(1)).toBeUndefined();
    expect(model.dayOfMonth[0]).toBe(1);
    expect(model.dayOfMonth[1185]).toBe(29);
    expect(model.dayOfMonth[2171]).toBe(11);
  });

  it("has no days, months or first days when today is before the start", () => {
    const empty = buildModel(DATA, "2020-11-30");
    expect(empty.total).toBe(0);
    expect(empty.firstDays.size).toBe(0);
    expect(empty.monthStarts).toEqual([]);
  });

  it("drops a role that starts after today and starts its months only up to today", () => {
    const early = buildModel(DATA, "2021-05-31");
    expect(early.total).toBe(182);
    expect([...early.firstDays.keys()]).toEqual([0]);
    expect(early.roleOfDay[181]).toBe(0);
  });

  it("keeps a mark on a real day and drops those past today", () => {
    const withMarks = buildModel(
      { ...DATA, marks: [{ date: "2024-02-29", label: "Leap day" }, { date: "2026-11-12", label: "Tomorrow" }] },
      TODAY,
    );
    expect([...withMarks.marks.entries()]).toEqual([[1185, "Leap day"]]);
    expect(fillOf(withMarks, 1185)).toBe(MARK_COLOR);
    expect(inkOf(withMarks, 1185)).toBe("#0b0907");
    expect(fillOf(withMarks, 1184)).toBe(DATA.roles[4].color);
  });
});

describe("fillOf and inkOf", () => {
  const model = buildModel(DATA, TODAY);

  it("gives the role's colour and the ink chosen for it", () => {
    expect(fillOf(model, 0)).toBe("#3E8A7C");
    expect(fillOf(model, 2171)).toBe("#fdfce6");
    expect(inkOf(model, 2171)).toBe("#0b0907");
  });
});

describe("describeDay", () => {
  const model = buildModel({ ...DATA, marks: [{ date: "2024-02-29", label: "Leap day" }] }, TODAY);

  it("says the date and the role (29 February 2024 was a content head day)", () => {
    expect(describeDay(model, 1185)).toEqual({ iso: "2024-02-29", date: "29 February 2024", role: "Content head", mark: "Leap day" });
    expect(describeDay(model, 0)).toEqual({ iso: "2020-12-01", date: "1 December 2020", role: "Student and part-time editor", mark: null });
    expect(describeDay(model, 2171).date).toBe("11 November 2026");
  });
});

describe("summariseRoles", () => {
  it("gives the days and the dates each role covered", () => {
    const rows = summariseRoles(DATA, TODAY);
    expect(rows.map((r) => r.days)).toEqual([182, 214, 243, 122, 1065, 346]);
    expect(rows[0]).toMatchObject({ from: "2020-12-01", to: "2021-05-31" });
    expect(rows[4]).toMatchObject({ from: "2023-01-01", to: "2025-11-30" });
    expect(rows[5]).toMatchObject({ from: "2025-12-01", to: "2026-11-11" });
  });

  it("gives null dates to a role that has not started", () => {
    const rows = summariseRoles(DATA, "2021-05-31");
    expect(rows[1]).toEqual({ id: "editor", label: "Full-time editor", color: "#D9A441", days: 0, from: null, to: null });
  });
});

describe("stairPath", () => {
  it("is a straight line when the day starts a row", () => {
    expect(stairPath(56, 56)).toEqual([{ x: 0, y: 1 }, { x: 56, y: 1 }]);
    expect(stairPath(0, 28)).toEqual([{ x: 0, y: 0 }, { x: 28, y: 0 }]);
  });

  it("steps up at the day's column otherwise", () => {
    // day 31 of 56 columns: row 0, column 31
    expect(stairPath(31, 56)).toEqual([
      { x: 0, y: 1 },
      { x: 31, y: 1 },
      { x: 31, y: 0 },
      { x: 56, y: 0 },
    ]);
    expect(stairPath(2 * 28 + 5, 28)).toEqual([
      { x: 0, y: 3 },
      { x: 5, y: 3 },
      { x: 5, y: 2 },
      { x: 28, y: 2 },
    ]);
  });
});

describe("edgeJitter", () => {
  it("is the same for the same day, within 1.5% of a cell, and differs between days", () => {
    expect(edgeJitter(7)).toEqual(edgeJitter(7));
    for (let i = 0; i < 500; i++) {
      for (const v of edgeJitter(i)) expect(Math.abs(v)).toBeLessThanOrEqual(0.015);
    }
    expect(edgeJitter(7)).not.toEqual(edgeJitter(8));
  });
});
