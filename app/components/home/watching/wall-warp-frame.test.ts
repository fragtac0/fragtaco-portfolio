import { describe, expect, it } from "vitest";
import { frameView } from "../layer/frame-math";
import { createWarpPass } from "./wall-warp-pass";
import { warpMargin } from "./wall-warp";

/** A recording stand-in for a WebGL context: constants are distinct numbers, calls are logged, the GPU says yes to everything. */
function fakeGl(drawingBufferWidth: number, drawingBufferHeight: number) {
  const calls: Array<[string, ...unknown[]]> = [];
  const consts = new Map<string, number>();
  const target: Record<string, unknown> = { drawingBufferWidth, drawingBufferHeight };
  const gl = new Proxy(target, {
    get(t, name: string) {
      if (name in t) return t[name];
      if (/^[A-Z0-9_]+$/.test(name)) {
        if (!consts.has(name)) consts.set(name, 1000 + consts.size);
        return consts.get(name);
      }
      if (name === "checkFramebufferStatus") return () => consts.get("FRAMEBUFFER_COMPLETE") ?? (consts.set("FRAMEBUFFER_COMPLETE", 1000 + consts.size), consts.get("FRAMEBUFFER_COMPLETE"));
      if (name === "getProgramParameter" || name === "getShaderParameter") return () => true;
      if (name === "getParameter") return () => 16384;
      return (...args: unknown[]) => {
        calls.push([name, ...args]);
        return {};
      };
    },
  }) as unknown as WebGLRenderingContext;
  return { gl, calls };
}

const of = (calls: Array<[string, ...unknown[]]>, name: string) => calls.filter((c) => c[0] === name).map((c) => c.slice(1));

describe("the second pass with a framed picture", () => {
  it("with no picture it targets the buffer plus the margin and shows the whole buffer (as before frames)", () => {
    const { gl, calls } = fakeGl(2880, 1800);
    const pass = createWarpPass(gl, {});
    expect(pass).not.toBeNull();
    const t = pass!.begin(1440, 900);
    const dm = Math.ceil(warpMargin(1440, 900) * 2);
    expect(t?.margin).toBe(dm / 2);
    const tex = of(calls, "texImage2D").at(-1)!;
    expect([tex[3], tex[4]]).toEqual([2880 + 2 * dm, 1800 + 2 * dm]);
    pass!.present(1440, 900);
    expect(of(calls, "viewport").at(-1)).toEqual([0, 0, 2880, 1800]);
  });

  it("a picture equal to the whole buffer is the same as none", () => {
    const a = fakeGl(2880, 1800);
    const b = fakeGl(2880, 1800);
    const pa = createWarpPass(a.gl, {})!;
    const pb = createWarpPass(b.gl, {})!;
    pa.begin(1440, 900);
    pa.present(1440, 900);
    const view = frameView({ left: 0, top: 0, width: 1440, height: 900 }, 1440, 900, 2);
    pb.begin(1440, 900, view);
    pb.present(1440, 900, view);
    expect(b.calls.filter((c) => c[0] === "viewport")).toEqual(a.calls.filter((c) => c[0] === "viewport"));
    expect(of(b.calls, "texImage2D")).toEqual(of(a.calls, "texImage2D"));
  });

  it("a wide box: the target is the whole window's picture at the box's density, shown into a rectangle centred on the buffer", () => {
    const view = frameView({ left: 40, top: 500, width: 720, height: 200 }, 1440, 900, 1); // scale 0.5: 720 by 450, in a 720 by 200 buffer
    const { gl, calls } = fakeGl(view.bufW, view.bufH);
    const pass = createWarpPass(gl, {})!;
    const t = pass.begin(1440, 900, view);
    const dm = Math.ceil(warpMargin(1440, 900) * 0.5);
    expect(t?.margin).toBe(dm / 0.5);
    const tex = of(calls, "texImage2D").at(-1)!;
    expect([tex[3], tex[4]]).toEqual([720 + 2 * dm, 450 + 2 * dm]);
    pass.present(1440, 900, view);
    // 125 rows cropped above and below: GL counts from the bottom, so the picture starts 125 rows under the buffer's bottom edge
    expect(of(calls, "viewport").at(-1)).toEqual([0, -125, 720, 450]);
  });
});
