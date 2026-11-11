import { describe, expect, it } from "vitest";
import { socialLabel } from "./client-socials";

describe("socialLabel", () => {
  it("names the client and the place", () => {
    expect(socialLabel("Placeholder client 01", "youtube")).toBe("Placeholder client 01 on YouTube");
    expect(socialLabel("Placeholder client 01", "instagram")).toBe("Placeholder client 01 on Instagram");
    expect(socialLabel("Placeholder client 01", "x")).toBe("Placeholder client 01 on X");
    expect(socialLabel("Placeholder client 01", "website")).toBe("Placeholder client 01 website");
  });
});
