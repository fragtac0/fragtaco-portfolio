/**
 * The last painting the hero showed, kept for the next time the home route mounts in the same
 * document (R32's client-side dock links unmount and remount it). Module-level on purpose: it is
 * not React state, so it survives the route change. One entry; a reload empties it.
 */

type Remembered = { id: string; img: HTMLImageElement };

let last: Remembered | null = null;

export function rememberPainting(id: string, img: HTMLImageElement): void {
  last = { id, img };
}

export function recallPainting(): Remembered | null {
  return last;
}
