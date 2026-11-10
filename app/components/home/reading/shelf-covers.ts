import type * as THREE from "three";
import type { SiteBook } from "~/types";
import { coverCanvas } from "./shelf-canvases";

/**
 * The real covers, from Open Library. They arrive whenever the network answers. Each one is
 * decoded off the main thread, then painted (one per idle slice) and uploaded, and none of that
 * happens during the drop-in or while a book is open: while the scene is running, the painted
 * canvas waits in `pend` and the frame loop uploads one per frame after the entrance (`drain`).
 * A missing cover keeps the generated one. Decoded images are released as soon as they are
 * painted, so only the painted canvas is kept.
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
};

export type CoverQueue = {
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

type CoverJob = { tex: THREE.CanvasTexture; d: SiteBook; img: HTMLImageElement };

/** An idle slice with no timeout: it only runs when the main thread has nothing better to do. */
const idleSlice = (cb: () => void) => {
  if (typeof window.requestIdleCallback === "function") window.requestIdleCallback(cb);
  else window.setTimeout(cb, 120);
};

export function createCoverQueue(deps: CoverQueueDeps): CoverQueue {
  const jobs: CoverJob[] = [];
  const pend: [THREE.CanvasTexture, HTMLCanvasElement][] = [];
  const images: HTMLImageElement[] = [];
  let painterScheduled = false;
  let painterTimer = 0;

  const release = (img: HTMLImageElement) => {
    img.onload = null;
    img.src = "";
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
        const c = coverCanvas(job.d, job.img);
        release(job.img);
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

  return {
    add,

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
    },
  };
}
