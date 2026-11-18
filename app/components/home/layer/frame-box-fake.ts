// A canvas stand-in for the frame box tests (frame-box.test.ts, frame-box-place.test.ts): its style remembers what was set.

/** A canvas with a style that remembers what was set, and with what priority (the box only writes style). */
export function fakeCanvas() {
  const props = new Map<string, string>();
  const prio = new Map<string, string>();
  const own: Record<string, unknown> = {
    removeProperty: (p: string) => void (props.delete(p), prio.delete(p)),
    setProperty: (p: string, v: string, pr = "") => void (props.set(p, v), prio.set(p, pr)),
    getPropertyValue: (p: string) => props.get(p) ?? "",
    getPropertyPriority: (p: string) => prio.get(p) ?? "",
  };
  const style = new Proxy(own, {
    get: (t, k: string) => (k in t ? t[k] : props.get(k)),
    set: (_t, k: string, v: string) => (props.set(k, v), true),
  });
  return { canvas: { style } as unknown as HTMLCanvasElement, props, prio };
}
