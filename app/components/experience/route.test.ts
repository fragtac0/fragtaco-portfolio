import { describe, expect, it } from "vitest";
import { ROUTE_STOP_SHARE, routeStopRadius } from "./route";

describe("routeStopRadius", () => {
  it("is 60% of the way from the cliff to the rim", () => {
    expect(ROUTE_STOP_SHARE).toBe(0.6);
    expect(routeStopRadius(0.34, 0.04)).toBeCloseTo(0.04 + 0.4 * 0.3, 12);
    expect(routeStopRadius(0.34, 0.04)).toBeGreaterThan(0.04);
    expect(routeStopRadius(0.34, 0.04)).toBeLessThan(0.34);
  });
});
