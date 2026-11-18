import { describe, expect, it } from "vitest";
import { boxPicture } from "./box-picture";

describe("boxPicture", () => {
  it("is the dark ground until the client has hydrated, whatever the scene's status (no picture is mounted, nothing is requested)", () => {
    expect(boxPicture(false, "pending")).toBe("ground");
    expect(boxPicture(false, "ready")).toBe("ground");
    expect(boxPicture(false, "plain")).toBe("ground");
  });

  it("is the live scene while it is being made or drawing", () => {
    expect(boxPicture(true, "pending")).toBe("live");
    expect(boxPicture(true, "ready")).toBe("live");
  });

  it("is the flat preview only once the scene has gone plain (no WebGL, a failed scene, a lost context)", () => {
    expect(boxPicture(true, "plain")).toBe("flat");
  });
});
