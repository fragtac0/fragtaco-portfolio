import type * as THREE from "three";
import type { SiteBook } from "~/types";
import { idleSlice } from "../../../utils/idle";
import { coloursOfImage, type CoverColours } from "./cover-colours";
import { coverCanvas } from "./shelf-canvases";

/**
 * The real covers, from Open Library. They arrive whenever the network answers. Each one is
 * decoded off the main thread, then painted (one per idle slice) and uploaded, and none of that
 * happens during the drop-in or while a book is open: while the scene is running, the painted
 * canvas waits in `pend` and the frame loop uploads one per frame after the entrance (`drain`).
 * The two main colours of each cover are read while it is painted, and handed to `colours` so the
 * book's spine can go over to them. A missing cover keeps the generated one and the book's own colour. A decoded image
 * is kept after it is painted (`kept`, a few hundred pixels wide), so a cover can be painted again at a new size
 * when the screen changes a lot (`repaint`); everything is dropped by `clear`.
 */

export type CoverQueueDeps = {
  /** The shelf has been disposed: nothing more is painted or uploaded. */
  disposed(): boolean;
  /** The GL scene exists, so textures can be uploaded. */
  ready(): boolean;
  /** The frame loop is running. */
  running(): boolean;
  /** Not running, or past the entrance with no book open. */
  calm(): boolean;
  /** Hands a painted canvas to a texture and uploads it to the GPU. */
  upload(tex: THREE.CanvasTexture, canvas: HTMLCanvasElement): void;
  /** The cover's dominant and secondary colours, read from the decoded image. */
  colours(d: SiteBook, colours: CoverColours): void;
  /** The width in pixels to paint this book's cover at (see `coverPixels`). */
  pixels(d: SiteBook): number;
};

export type CoverQueue = {
  /** Paints `tex` again at the book's current `pixels`: from its real cover if that has arrived, else the generated one. */
  repaint(tex: THREE.CanvasTexture, d: SiteBook): void;
  /** `repaint` for a book with no real cover (painted or on its way): only the generated cover draws text in the interface faces. */
  repaintGenerated(tex: THREE.CanvasTexture, d: SiteBook): void;
  /** A decoded cover is ready to be painted onto `tex`. */
  add(tex: THREE.CanvasTexture, d: SiteBook, img: HTMLImageElement): void;
  /** Starts the download for a book's cover and queues it once decoded. */
  load(tex: THREE.CanvasTexture, d: SiteBook): void;
  /** Uploads one painted cover that waited for the scene; true when it did. Called per frame. */
  drain(): boolean;
  /** Restarts painting (the scene was built, or the loop stopped and covers waited for calm). */
  wake(): void;
  /** Drops everything queued and aborts downloads still in flight. */
  clear(): void;
};

/** `again`: a repaint at a new size (no colours read, the image is kept as it is). */
type CoverJob = { tex: THREE.CanvasTexture; d: SiteBook; img: HTMLImageElement | null; again?: boolean };

export function createCoverQueue(deps: CoverQueueDeps): CoverQueue {
  const jobs: CoverJob[] = [];
  const pend: [THREE.CanvasTexture, HTMLCanvasElement][] = [];
  const images: HTMLImageElement[] = [];
  /** Painted covers' decoded images, by book, for a repaint. */
  const kept = new Map<string, HTMLImageElement>();
  let painterScheduled = false;
  let painterTimer = 0;

  /** The painted image is no longer a download in flight: it is kept, not aborted by `clear`'s loop. */
  const untrack = (img: HTMLImageElement) => {
    img.onload = null;
    const i = images.indexOf(img);
    if (i >= 0) images.splice(i, 1);
  };

  function schedulePainter(delayMs = 0) {
    if (painterScheduled || deps.disposed()) return;
    painterScheduled = true;
    if (delayMs > 0) painterTimer = window.setTimeout(() => idleSlice(paintSlice), delayMs);
    else idleSlice(paintSlice);
  }

  function paintSlice() {
    painterScheduled = false;
    if (deps.disposed() || !deps.ready()) return;
    const running = deps.running();
    if (!jobs.length && (running || !pend.length)) return;
    if (!deps.calm()) {
      schedulePainter(500);
      return;
    }
    const waiting = !running ? pend.shift() : undefined;
    if (waiting) {
      deps.upload(waiting[0], waiting[1]);
    } else {
      const job = jobs.shift();
      if (job) {
        const img = job.again ? (kept.get(job.d.id) ?? null) : job.img; // a repaint uses the real cover if it has come by now
        const c = coverCanvas(job.d, img, deps.pixels(job.d));
        if (job.img && !job.again) {
          const colours = coloursOfImage(job.img);
          if (colours) deps.colours(job.d, colours);
          untrack(job.img);
          kept.set(job.d.id, job.img);
        }
        if (running) pend.push([job.tex, c]);
        else deps.upload(job.tex, c);
      }
    }
    if (jobs.length || (!deps.running() && pend.length)) schedulePainter();
  }

  const add: CoverQueue["add"] = (tex, d, img) => {
    jobs.push({ tex, d, img });
    schedulePainter();
  };

  const repaint: CoverQueue["repaint"] = (tex, d) => {
    // a real cover still waiting to be painted will be painted at the new size anyway
    if (jobs.some((j) => j.tex === tex && !j.again)) return;
    // one job per book: an older one for this texture (painted or not) is at the wrong size by now
    for (let i = jobs.length - 1; i >= 0; i--) if (jobs[i].tex === tex && jobs[i].again) jobs.splice(i, 1);
    for (let i = pend.length - 1; i >= 0; i--) if (pend[i][0] === tex) pend.splice(i, 1);
    jobs.push({ tex, d, img: null, again: true });
    schedulePainter();
  };

  return {
    add,

    repaint,

    repaintGenerated(tex, d) {
      if (kept.has(d.id)) return; // a real cover is on the book: nothing of it is drawn in our faces
      repaint(tex, d);
    },

    load(tex, d) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        if (deps.disposed() || img.naturalWidth <= 10) return;
        // decode now, off the main thread, so painting it later does not stall on the JPEG
        void img
          .decode()
          .catch(() => undefined)
          .then(() => {
            if (deps.disposed()) return;
            add(tex, d, img);
          });
      };
      img.src = `https://covers.openlibrary.org/b/isbn/${d.isbn}-L.jpg?default=false`;
      images.push(img);
    },

    drain() {
      const queued = pend.shift();
      if (!queued) return false;
      deps.upload(queued[0], queued[1]);
      return true;
    },

    wake: () => schedulePainter(),

    clear() {
      pend.length = 0;
      jobs.length = 0;
      window.clearTimeout(painterTimer);
      for (const img of images) {
        img.onload = null;
        img.src = "";
      }
      images.length = 0;
      for (const img of kept.values()) img.src = "";
      kept.clear();
    },
  };
}
