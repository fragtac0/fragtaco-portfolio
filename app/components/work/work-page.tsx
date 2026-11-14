import { useState, type MouseEvent } from "react";
import { isRadialChange } from "../../lib/page-change";
import { usePageArrived } from "../../lib/use-page-settled";
import type { SiteWork } from "../../types";
import { introLine } from "./ring-layout";
import Rings from "./rings";
import { ROW_ID } from "./work-switcher";
import "./work.css";

/** A page that comes in through a change builds its rings 8 items every 50 ms: the 64 are in within 0.4 s, long before the reveal's edge reaches the first ring. */
const RING_BATCHES = { items: 8, ms: 50 };

interface WorkPageProps {
  work: SiteWork;
}

/**
 * The rings (`/work`): a fixed stage (the page does not scroll) with the moving ground, the intro in the
 * middle and the three rings round it. The dock and its row belong to the layout (`routes/work.tsx`).
 * The rings and the intro are in the page from its first commit (R60): when the page comes in through a page
 * change, the reveal shows them (`data-arrival="change"` leaves out their own fade-in, the reveal is the arrival).
 */
export default function WorkPage({ work }: WorkPageProps) {
  // Read once, when the page is made: a page made while the radial reveal runs comes in through it. On the server and
  // while hydrating nothing is changing, so it is false (the same markup both times). The reduced-motion fade (120 ms)
  // is not this: the page keeps its own arrival, the rings fading in as on a first load, with no batches.
  const [byChange] = useState(isRadialChange);
  // False until that change is over: the rings of a page that came in by the reveal stand still and begin to turn together when it ends (work.css).
  const arrived = usePageArrived();

  // Twenty or so tab stops sit in the rings before the dock: this link goes straight to the dock's row.
  const skipToRow = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    document.querySelector<HTMLElement>(`#${ROW_ID} a`)?.focus();
  };

  return (
    <main className="work-page" data-arrival={byChange ? "change" : undefined} data-still={byChange && !arrived ? "" : undefined}>
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
        <Rings work={work} batches={byChange ? RING_BATCHES : null} arrived={arrived} />
      </div>
    </main>
  );
}
