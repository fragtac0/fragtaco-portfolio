import { useEffect, useRef, type MutableRefObject } from "react";
import { INTRO_KEY, introMode } from "../../../lib/intro-session";
import { createTimers, must, prefersReducedMotion, type HeroRuntime } from "./hero-runtime";
import { LOADER, loaderSchedule, type LoaderStep } from "./loader-timeline";
import type { PaintingCycle } from "./use-painting-cycle";

type Options = Pick<HeroRuntime, "rootRef" | "engineRef" | "dataRef"> & {
  cycleRef: MutableRefObject<PaintingCycle | null>;
  /** Fires once, when the loader finishes (or at once when it is skipped). */
  onReadyRef: MutableRefObject<() => void>;
};

/**
 * The loader that plays once per session (or its skipped form), driven by the timeline in
 * loader-timeline. Ported from the mockup's playLoader. Everything is classes on refs and
 * timers cleared on unmount. The page stays locked (html.intro) until `done`, and is never left
 * locked after an unmount.
 */
export function useLoader({ rootRef, engineRef, dataRef, cycleRef, onReadyRef }: Options) {
  // StrictMode runs the effect twice: ready fires once per component lifetime.
  const readyFiredRef = useRef(false);

  useEffect(() => {
    const root = rootRef.current;
    const paint = engineRef.current;
    const cycle = cycleRef.current;
    if (!root || !paint || !cycle) return;
    const { name: heroName } = dataRef.current;
    const n = cycle.count;
    const html = document.documentElement;

    const nameBig = must<HTMLElement>(root, ".name-big");
    const letters = Array.from(nameBig.children);
    const logo = must<SVGElement>(root, ".logo");
    const logoParts = [
      must<SVGGElement>(root, ".logo .gw"),
      ...Array.from(logo.querySelectorAll<SVGGElement>(".gl")),
    ];
    const nameSmall = must<HTMLElement>(root, ".name-small");
    const roleLine = must<HTMLElement>(root, ".roles");
    const vig = must<HTMLElement>(root, ".vignette");
    const cap = must<HTMLElement>(root, ".caption");
    const cue = must<HTMLElement>(root, ".cue");

    const timers = createTimers();
    const later = (ms: number, fn: () => void) => timers.later(ms, fn);
    const reduced = prefersReducedMotion();
    let seen = false;
    try {
      seen = !!sessionStorage.getItem(INTRO_KEY);
    } catch {
      /* blocked storage counts as not seen, as in the head script */
    }
    const mode = introMode({ seen, hash: window.location.hash, reducedMotion: reduced });

    const fireReady = () => {
      if (readyFiredRef.current) return;
      readyFiredRef.current = true;
      onReadyRef.current();
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
      const recalled = cycle.recalled();
      if (recalled) {
        // coming back from another page: the last painting, in the first effect, before any network
        cycle.present(recalled, 0);
        if (n > 1) cycle.scheduleNext();
      } else {
        // nothing remembered: the blurred placeholder, then the sharp painting fades in over it
        void cycle.presentFirst().then((shown) => {
          if (shown && n > 1) cycle.scheduleNext();
        });
      }
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
      const firstLoad = cycle.firstLoad();

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
            if (n > 1) cycle.scheduleNext();
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
          const found = await cycle.firstLoaded(firstLoad, LOADER.firstPaintingMaxWait);
          if (timers.isDisposed()) return;
          if (found) {
            vig.classList.add("on");
            cycle.present(found, LOADER.revealMs);
          }
        } catch (err) {
          console.error("hero: could not reveal the first painting", err);
        }
        if (timers.isDisposed()) return;
        for (const s of afterReveal) later(s.at - LOADER.reveal, () => act(s));
      };

      for (const s of upToReveal) later(s.at, () => act(s));
    }

    return () => {
      timers.dispose();
      // never leave the page locked: the next run adds it back if its loader plays
      html.classList.remove("intro");
    };
  }, [rootRef, engineRef, dataRef, cycleRef, onReadyRef]);
}
