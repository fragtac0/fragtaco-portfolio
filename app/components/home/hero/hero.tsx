import { forwardRef, useEffect, useImperativeHandle, useRef, type ReactNode } from "react";
import { INTRO_KEY, introMode } from "../../../lib/intro-session";
import { hasWebGL } from "../../../lib/webgl-support";
import type { SiteHeroPainting } from "../../../types";
import "./hero.css";
import { createImageFallback } from "./image-fallback";
import { loadImage } from "./load-image";
import { LOADER, loaderSchedule, type LoaderStep } from "./loader-timeline";
import { paintStep } from "./paint-gate";
import { createPaint, type PaintEngine, type PaintMeta } from "./paint-engine";
import {
  makeOrder,
  nextDelayMs,
  paintingSrc,
  parseFocal,
  pickFirst,
  RECENT_KEY,
  RECENT_LIMIT,
  nextRevealTry,
} from "./painting-cycle";
import Lockup from "./lockup";

export interface HeroHandle {
  /** Blurs the painting behind an open card (0 clears it). */
  setBlur(v: 0 | 1): void;
  /** A card or a layer is open: the painting stops changing, and the draw loop parks. */
  setParked(reason: "card" | "layer", on: boolean): void;
  /** The hero `<section>`, for listeners that live on it (wheel, touch, visibility). */
  root(): HTMLElement | null;
}

interface HeroProps {
  name: string;
  roles: string;
  paintings: SiteHeroPainting[];
  /** A card is open: the lockup blurs and fades, the caption and cue dim. */
  softened: boolean;
  /** Fires once, when the loader finishes (or at once when it is skipped). */
  onReady: () => void;
  /** Rendered inside the section after the hero's own layers (the cards and their scrim). */
  children?: ReactNode;
}

/** Last painting ids shown this session, newest last. */
function readRecent(): string[] {
  try {
    const parsed: unknown = JSON.parse(sessionStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function remember(id: string) {
  try {
    const next = [...readRecent().filter((r) => r !== id), id].slice(-RECENT_LIMIT);
    sessionStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* storage blocked: the pick still applies to this visit */
  }
}

const metaOf = (p: SiteHeroPainting): PaintMeta => ({ focal: parseFocal(p.focal), zoom: p.zoom });

/**
 * The home hero: a WebGL painting, the centred lockup, the loader that plays once per session,
 * and the painting cycle. Ported from the mockup's paint loop, cycle and playLoader. All of the
 * animation is imperative (classes on refs, a requestAnimationFrame loop); React renders the
 * pre-loader markup once and holds no per-frame state.
 */
const Hero = forwardRef<HeroHandle, HeroProps>(function Hero(
  { name, roles, paintings, softened, onReady, children },
  ref,
) {
  const rootRef = useRef<HTMLElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<PaintEngine | null>(null);
  const blurRef = useRef<0 | 1>(0);
  const parkedRef = useRef({ card: false, layer: false });
  const onReadyRef = useRef(onReady);
  const dataRef = useRef({ name, paintings });
  // StrictMode runs the mount effect twice: the picks, the recent-list write and onReady are
  // per component lifetime, so both runs show (and fetch) the same painting and ready fires once.
  const picksRef = useRef<{ first: SiteHeroPainting | null; order: number[] } | null>(null);
  const rememberedRef = useRef(false);
  const readyFiredRef = useRef(false);

  useEffect(() => {
    onReadyRef.current = onReady;
    dataRef.current = { name, paintings };
  });

  useImperativeHandle(
    ref,
    () => ({
      setBlur(v) {
        blurRef.current = v;
        engineRef.current?.setBlur(v);
      },
      setParked(reason, on) {
        parkedRef.current[reason] = on;
      },
      root() {
        return rootRef.current;
      },
    }),
    [],
  );

  useEffect(() => {
    const root = rootRef.current;
    const host = hostRef.current;
    if (!root || !host) return;
    const { name: heroName, paintings: items } = dataRef.current;
    const n = items.length;
    const html = document.documentElement;

    const must = <T extends Element>(sel: string): T => {
      const el = root.querySelector<T>(sel);
      if (!el) throw new Error(`hero: missing ${sel}`);
      return el;
    };
    const nameBig = must<HTMLElement>(".name-big");
    const letters = Array.from(nameBig.children);
    const logo = must<SVGElement>(".logo");
    const logoParts = [
      must<SVGGElement>(".logo .gw"),
      ...Array.from(logo.querySelectorAll<SVGGElement>(".gl")),
    ];
    const nameSmall = must<HTMLElement>(".name-small");
    const roleLine = must<HTMLElement>(".roles");
    const vig = must<HTMLElement>(".vignette");
    const cap = must<HTMLElement>(".caption");
    const cue = must<HTMLElement>(".cue");

    // ---- timers: everything is cleared on unmount
    let disposed = false;
    const timers = new Set<number>();
    const later = (ms: number, fn: () => void) => {
      const id = window.setTimeout(() => {
        timers.delete(id);
        fn();
      }, ms);
      timers.add(id);
      return id;
    };
    const clear = (id: number) => {
      window.clearTimeout(id);
      timers.delete(id);
    };
    /** Resolves with the promise's value, or null if `ms` pass first. */
    const atMost = <T,>(p: Promise<T | null>, ms: number): Promise<T | null> =>
      new Promise((resolve) => {
        const id = later(ms, () => resolve(null));
        void p.then((v) => {
          clear(id);
          resolve(v);
        });
      });

    // ---- mode
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let seen = false;
    try {
      seen = !!sessionStorage.getItem(INTRO_KEY);
    } catch {
      /* blocked storage counts as not seen, as in the head script */
    }
    const mode = introMode({ seen, hash: window.location.hash, reducedMotion: reduced });

    // ---- the engine. R6: a fresh canvas per effect run, because dispose() loses its context.
    const canvas = document.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    host.appendChild(canvas);
    // no WebGL (or `?nogl=1`): a plain <img> with a CSS crossfade, and the card blur is the tint
    let engine = hasWebGL() ? createPaint(canvas, { reducedMotion: reduced }) : null;
    if (engine) {
      root.dataset.gl = "on";
    } else {
      canvas.remove();
      root.dataset.gl = "off";
      engine = createImageFallback(host, { reducedMotion: reduced });
    }
    const paint: PaintEngine = engine;
    engineRef.current = paint;
    if (blurRef.current) paint.setBlur(blurRef.current);

    // ---- paint loop: draws only when something moves (see paint-gate)
    let pageVisible = !document.hidden;
    let heroOn = true;
    let lastDraw = 0;
    const onVisibility = () => {
      pageVisible = !document.hidden;
    };
    document.addEventListener("visibilitychange", onVisibility);
    const observer = new IntersectionObserver(([entry]) => {
      heroOn = entry.isIntersecting;
    });
    observer.observe(root);
    let raf = requestAnimationFrame(function loop(now) {
      raf = requestAnimationFrame(loop);
      const step = paintStep({
        pageVisible,
        heroOn,
        layerOpen: parkedRef.current.layer,
        cardOpen: parkedRef.current.card,
        active: paint.busy() || paint.moving(),
        sinceLastDraw: now - lastDraw,
      });
      if (step === "park") {
        paint.pause(now);
        return;
      }
      paint.resume(now);
      if (step === "wait") return;
      lastDraw = now;
      paint.draw(now);
    });

    // ---- painting cycle
    picksRef.current ??= (() => {
      const first = n > 0 ? pickFirst(items, readRecent(), Math.random) : null;
      return { first, order: first ? makeOrder(n, items.indexOf(first), Math.random) : [] };
    })();
    const { order } = picksRef.current;
    const fireReady = () => {
      if (readyFiredRef.current) return;
      readyFiredRef.current = true;
      onReadyRef.current();
    };
    let oi = 0;
    let cycleT = 0;
    let nextImg: Promise<HTMLImageElement | null> = Promise.resolve(null);
    const srcAt = (k: number) =>
      paintingSrc(items[order[k]].file, window.innerWidth, window.devicePixelRatio || 1);

    const setCaption = (p: SiteHeroPainting, animate = false) => {
      const fill = () => {
        must(".caption .t").textContent = p.title;
        must(".caption .a").textContent = `${p.artist}, ${p.year}`;
        cap.classList.remove("swap");
      };
      if (!animate) return fill();
      cap.classList.add("swap");
      later(600, fill);
    };
    const preloadNext = () => {
      nextImg = loadImage(srcAt((oi + 1) % n));
    };
    const scheduleNext = (ms = nextDelayMs(Math.random)) => {
      clear(cycleT);
      cycleT = later(ms, () => void nextPainting());
    };
    const nextPainting = async () => {
      if (paint.busy()) return scheduleNext(1500);
      const parked = parkedRef.current;
      if (!pageVisible || !heroOn || parked.layer || parked.card) return scheduleNext(2500);
      let img = await nextImg;
      if (disposed) return;
      oi = (oi + 1) % n;
      // a painting that fails to load is skipped for the one after it
      for (let t = 0; !img && t < n - 1; t++) {
        oi = (oi + 1) % n;
        img = await loadImage(srcAt(oi));
        if (disposed) return;
      }
      if (!img) {
        preloadNext();
        return scheduleNext();
      }
      const p = items[order[oi]];
      paint.swap(img, metaOf(p), 2800, () => {
        preloadNext();
        scheduleNext();
      });
      setCaption(p, true);
    };

    /**
     * The first painting that loads, trying the next in the order when one fails or is too slow,
     * and giving up after `maxTries` (see nextRevealTry).
     */
    const firstLoaded = async (
      firstLoad: Promise<HTMLImageElement | null>,
      maxWait: number,
      maxTries?: number,
    ): Promise<{ img: HTMLImageElement; k: number } | null> => {
      for (let t = 0, k = nextRevealTry(t, n, maxTries); k !== null; k = nextRevealTry(++t, n, maxTries)) {
        const pending = k === 0 ? firstLoad : loadImage(srcAt(k));
        const img = Number.isFinite(maxWait) ? await atMost(pending, maxWait) : await pending;
        if (disposed) return null;
        if (img) return { img, k };
      }
      return null;
    };
    const present = (found: { img: HTMLImageElement; k: number }, ms: number) => {
      oi = found.k;
      const p = items[order[oi]];
      paint.reveal(found.img, metaOf(p), ms);
      setCaption(p);
      if (!rememberedRef.current) {
        rememberedRef.current = true;
        remember(p.id);
      }
      preloadNext();
    };

    // ---- states
    const showFinal = () => {
      // set every class with transitions off for a frame, so the final state simply appears
      root.dataset.final = "";
      if (reduced) root.dataset.fade = "";
      logo.classList.add("in");
      for (const el of [nameSmall, roleLine, vig, cap, cue]) el.classList.add("on");
      root.dataset.peeks = "";
      void root.offsetWidth;
      delete root.dataset.final;
    };
    const resetToLoaderStart = () => {
      delete root.dataset.final;
      delete root.dataset.fade;
      delete root.dataset.peeks;
      nameBig.classList.remove("grow");
      for (const l of letters) l.classList.remove("in", "out");
      // फ्रैग rises as one word (its mask has to move with it), then T, A, C, O
      logo.classList.add("reset");
      logo.classList.remove("in");
      logoParts.forEach((g, i) => {
        g.style.transitionDelay =
          i === 0 ? "0ms" : `${LOADER.logoFirstLetter + (i - 1) * LOADER.logoLetterStep}ms`;
      });
      for (const el of [nameSmall, roleLine, vig, cap, cue]) el.classList.remove("on");
      void nameBig.offsetWidth;
      logo.classList.remove("reset");
    };

    if (mode === "skip") {
      html.classList.remove("intro");
      showFinal();
      fireReady();
      void firstLoaded(n > 0 ? loadImage(srcAt(0)) : Promise.resolve(null), Infinity, n).then(
        (found) => {
          if (!found) return;
          present(found, 0);
          if (n > 1) scheduleNext();
        },
      );
    } else {
      if (!html.classList.contains("intro")) {
        // client navigation to "/": the head script never ran, so this hero locks the page itself
        // and owns the failsafe, cleared on unmount and harmless once `done` has unlocked
        html.classList.add("intro");
        later(15000, () => html.classList.remove("intro"));
      }
      window.scrollTo(0, 0);
      resetToLoaderStart();
      paint.black();
      const firstLoad = n > 0 ? loadImage(srcAt(0)) : Promise.resolve(null);

      const act = (s: LoaderStep) => {
        switch (s.step) {
          case "grow":
            nameBig.classList.add("grow");
            break;
          case "letterIn":
            letters[s.index ?? 0]?.classList.add("in");
            break;
          case "letterOut":
            letters[s.index ?? 0]?.classList.add("out");
            break;
          case "logo":
            logo.classList.add("in");
            break;
          case "reveal":
            void revealThenContinue();
            break;
          case "nameSmall":
            nameSmall.classList.add("on");
            break;
          case "roles":
            roleLine.classList.add("on");
            break;
          case "done":
            html.classList.remove("intro");
            cap.classList.add("on");
            cue.classList.add("on");
            root.dataset.peeks = "";
            try {
              sessionStorage.setItem(INTRO_KEY, "1");
            } catch {
              /* blocked storage: the loader plays again next visit */
            }
            if (n > 1) scheduleNext();
            fireReady();
            break;
        }
      };

      const schedule = loaderSchedule(heroName);
      const upToReveal = schedule.filter((s) => s.at <= LOADER.reveal);
      const afterReveal = schedule.filter((s) => s.at > LOADER.reveal);

      // The reveal waits for the first painting; the steps after it shift by that wait.
      // A painting that never arrives, or a throw while showing one, must not stop the timeline:
      // the page stays locked until `done`.
      const revealThenContinue = async () => {
        try {
          const found = await firstLoaded(firstLoad, LOADER.firstPaintingMaxWait);
          if (disposed) return;
          if (found) {
            vig.classList.add("on");
            present(found, LOADER.revealMs);
          }
        } catch (err) {
          console.error("hero: could not reveal the first painting", err);
        }
        if (disposed) return;
        for (const s of afterReveal) later(s.at - LOADER.reveal, () => act(s));
      };

      for (const s of upToReveal) later(s.at, () => act(s));
    }

    return () => {
      disposed = true;
      timers.forEach((id) => window.clearTimeout(id));
      timers.clear();
      cancelAnimationFrame(raf);
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      paint.dispose();
      canvas.remove();
      engineRef.current = null;
      // never leave the page locked: the next run adds it back if its loader plays
      html.classList.remove("intro");
    };
  }, []);

  const scrollToBlocks = () => {
    const el = rootRef.current;
    if (!el) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({
      top: el.offsetTop + el.offsetHeight,
      behavior: reduced ? "auto" : "smooth",
    });
  };

  return (
    <section
      ref={rootRef}
      id="hero"
      className="home-hero"
      aria-label="Home"
      data-softened={softened ? "" : undefined}
    >
      <div className="hero-layer">
        <div className="paint-host" ref={hostRef} aria-hidden="true" />
        <div className="tex" aria-hidden="true" />
        <div className="vignette" aria-hidden="true" />
        <Lockup name={name} roles={roles} />
        <div className="caption">
          <span className="t" />
          <span className="a" />
        </div>
        <button type="button" className="cue" onClick={scrollToBlocks}>
          My Interests
        </button>
      </div>
      <div className="edge-glow l" aria-hidden="true" />
      <div className="edge-glow r" aria-hidden="true" />
      {children}
    </section>
  );
});

export default Hero;
