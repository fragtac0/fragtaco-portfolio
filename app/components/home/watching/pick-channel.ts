/** A tile the wall reports as picked: the video, where the tile is, and its key. */
export type WallPick = { index: number; rect: DOMRect; key: string };

/**
 * The wall engine is created in HomePage, before any scene exists, but a pick has to reach the
 * scene's state: HomePage hands `emit` to `createWall` as `onPick` and the scene subscribes.
 * It lives in its own file so the scene stays a components-only module (Fast Refresh).
 */
export function createPickChannel() {
  let handler: ((pick: WallPick) => void) | null = null;
  return {
    emit: (index: number, rect: DOMRect, key: string) => {
      handler?.({ index, rect, key });
    },
    subscribe: (fn: (pick: WallPick) => void) => {
      handler = fn;
      return () => {
        if (handler === fn) handler = null;
      };
    },
  };
}
export type PickChannel = ReturnType<typeof createPickChannel>;
