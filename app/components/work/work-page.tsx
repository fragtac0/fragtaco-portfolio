import type { MouseEvent } from "react";
import { usePageArrived } from "../../lib/use-page-settled";
import type { SiteWork } from "../../types";
import { introLine } from "./ring-layout";
import Rings from "./rings";
import { ROW_ID } from "./work-switcher";
import "./work.css";

interface WorkPageProps {
  work: SiteWork;
}

/**
 * The rings (`/work`): a fixed stage (the page does not scroll) with the moving ground, the intro in the
 * middle and the three rings round it. The dock and its row belong to the layout (`routes/work.tsx`).
 */
export default function WorkPage({ work }: WorkPageProps) {
  // Arriving during a page change: the rings (their pictures and their turning) mount once it is over, see Rings.
  const arrived = usePageArrived();

  // Twenty or so tab stops sit in the rings before the dock: this link goes straight to the dock's row.
  const skipToRow = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    document.querySelector<HTMLElement>(`#${ROW_ID} a`)?.focus();
  };

  return (
    <main className="work-page">
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
        <Rings work={work} arrived={arrived} />
      </div>
    </main>
  );
}
