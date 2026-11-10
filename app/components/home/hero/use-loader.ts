import { useEffect, useRef, type MutableRefObject } from "react";
import { INTRO_KEY, introMode } from "../../../lib/intro-session";
import { createTimers, must, prefersReducedMotion, type HeroRuntime } from "./hero-runtime";
import { LOADER, loaderSchedule, revealPlan, type LoaderStep, type RevealPlan } from "./loader-timeline";
import { REVEAL_TRIES } from "./painting-cycle";
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
 *
 * The big name is not driven from here: loader.css runs it from first paint under html.intro. This
 * hook joins the timeline where it is (the head script's `__introT0` is time zero) and performs the
 * remaining steps at their nominal times, minus what has already passed. The reveal never waits
 * more than LOADER.revealMaxWait for the painting (see revealPlan); the steps after it move by
 * however long it did wait, and `done` unlocks the page whether or not the sharp painting arrived.
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
      // फ्रैग rises as one word (its mask has to move with it), then T, A, C, O
      logo.classList.add("reset");
      logo.classList.remove("in");
      logoParts.forEach((g, i) => {
        g.style.transitionDelay =
          i === 0 ? "0ms" : `${LOADER.logoFirstLetter + (i - 1) * LOADER.logoLetterStep}ms`;
      });
      for (const el of [nameSmall, roleLine, vig, cap, cue]) el.classList.remove("on");
      void root.offsetWidth;
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
        // (which also starts the name's CSS now) and owns the failsafe, cleared on unmount and
        // harmless once `done` has unlocked
        html.classList.add("intro");
        window.__introT0 = performance.now();
        later(15000, () => html.classList.remove("intro"));
      }
      // time zero of the loader: when the name's CSS started (the head script's clock)
      const t0 = window.__introT0 ?? performance.now();
      const clock = () => performance.now() - t0;
      window.scrollTo(0, 0);
      resetToLoaderStart();
      paint.black();
      // The sharp painting, tried from the start so its download never waits for a step. It resolves
      // with the first of the first two paintings that loads (or null); readyAt is when, on the clock.
      const sharp = cycle.firstLoaded(cycle.firstLoad(), Infinity, REVEAL_TRIES);
      let readyAt: number | null = null;
      void sharp.then((found) => {
        if (found) readyAt = clock();
      });

      const act = (s: LoaderStep) => {
        switch (s.step) {
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

      // The reveal waits for the sharp painting at most LOADER.revealMaxWait; after that it opens
      // on the blurred placeholder and the sharp one crossfades in when it arrives. The steps after
      // it shift by how long it was held. A throw while showing a painting must not stop the
      // timeline: the page stays locked until `done`.
      const revealThenContinue = async () => {
        const planNow = (): RevealPlan =>
          revealPlan({ paintingReadyAt: readyAt, now: clock(), revealAt: LOADER.reveal });
        let at: number = LOADER.reveal;
        try {
          let plan = planNow();
          if (plan.action === "wait") {
            await timers.atMost(sharp, Math.max(0, plan.at - clock()));
            if (timers.isDisposed()) return;
            plan = planNow();
            // the cut-off came a hair early, or no painting could load at all: stop waiting
            if (plan.action === "wait") plan = { action: "placeholder", at: clock() };
          }
          at = plan.at;
          const found = plan.action === "sharp" ? await sharp : null;
          if (timers.isDisposed()) return;
          if (found) {
            vig.classList.add("on");
            cycle.present(found, LOADER.revealMs);
          } else if (plan.action === "placeholder") {
            const shown = await cycle.revealPlaceholder(LOADER.revealMs);
            if (timers.isDisposed()) return;
            if (shown) {
              vig.classList.add("on");
              cycle.upgradeWhenLoaded(sharp);
            } else {
              // no placeholder to open on: the painting reveals whenever it arrives
              void sharp.then((late) => {
                if (!late || timers.isDisposed()) return;
                vig.classList.add("on");
                cycle.present(late, LOADER.revealMs);
              });
            }
          }
        } catch (err) {
          console.error("hero: could not reveal the first painting", err);
        }
        if (timers.isDisposed()) return;
        const shift = Math.max(0, at - LOADER.reveal);
        for (const s of afterReveal) later(Math.max(0, s.at + shift - clock()), () => act(s));
      };

      for (const s of upToReveal) later(Math.max(0, s.at - clock()), () => act(s));
    }

    return () => {
      timers.dispose();
      // never leave the page locked: the next run adds it back if its loader plays
      html.classList.remove("intro");
    };
  }, [rootRef, engineRef, dataRef, cycleRef, onReadyRef]);
}
