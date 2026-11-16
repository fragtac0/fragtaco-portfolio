import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent } from "react";
import { easeInPlayback } from "../../lib/arrival-dom";
import { isChangeRunning } from "../../lib/page-change";
import { usePageArrived } from "../../lib/use-page-settled";
import type { SiteWork } from "../../types";
import { introLine } from "./ring-layout";
import Rings from "./rings";
import { ROW_ID } from "./work-switcher";
import "./work.css";
import "./work-keep-out.css";

// Layout effects warn on the server; the effect below never runs there.
const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

interface WorkPageProps {
  work: SiteWork;
}

/**
 * The rings (`/work`): a fixed stage (the page does not scroll) with the moving ground, the intro in the
 * middle and the three rings round it. The dock and its row belong to the layout (`routes/work.tsx`).
 * The rings and the intro are in the page from its first commit, all of them (R60, R56): when the page comes in through a page
 * change, the reveal waits for their pictures (rings.tsx) and then shows them standing still (`data-arrival="change"` leaves out their
 * own fade-in, the reveal is the arrival; `data-still` holds the turn until the change is over), and once it is over the rings
 * begin to turn from standstill and reach their speed over a second (`easeInPlayback`), so nothing starts abruptly.
 */
export default function WorkPage({ work }: WorkPageProps) {
  // Read once, when the page is made: a page made while a change runs comes in through it (the radial reveal or the reduced-motion
  // fade: either way the page is there for it, with no arrival of its own). On the server and while hydrating nothing is changing,
  // so it is false (the same markup both times).
  const [byChange] = useState(isChangeRunning);
  // False until that change is over: the rings of a page that came in by the reveal stand still and begin to turn together when it ends (work.css).
  const arrived = usePageArrived();
  const page = useRef<HTMLElement>(null);
  const eased = useRef(false);
  const stopEase = useRef<(() => void) | null>(null);
  useIsoLayoutEffect(() => {
    const el = page.current;
    if (!byChange || !arrived || !el || eased.current) return;
    eased.current = true;
    stopEase.current = easeInPlayback(el.getAnimations({ subtree: true }).filter((a) => (a as CSSAnimation).animationName === "work-spin" || (a as CSSAnimation).animationName === "work-unspin"));
  }, [byChange, arrived]);
  // leaving the page mid-ramp ends the ramp (its frame loop and the rate it set)
  useEffect(() => () => stopEase.current?.(), []);

  // Twenty or so tab stops sit in the rings before the dock: this link goes straight to the dock's row.
  const skipToRow = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    document.querySelector<HTMLElement>(`#${ROW_ID} a`)?.focus();
  };

  return (
    <main ref={page} className="work-page" data-arrival={byChange ? "change" : undefined} data-still={byChange && !arrived ? "" : undefined}>
      <a className="work-skip" href={`#${ROW_ID}`} onClick={skipToRow}>
        Skip to the work links
      </a>
      <div className="work-stage">
        <div className="work-intro">
          <h1 className="work-title">{work.intro.title}</h1>
          <p className="work-text">
            <span className="work-text-full">{work.intro.text}</span>
            <span className="work-text-short">{introLine(work.intro.text)}</span>
          </p>
        </div>
        <Rings work={work} byChange={byChange} />
      </div>
    </main>
  );
}
