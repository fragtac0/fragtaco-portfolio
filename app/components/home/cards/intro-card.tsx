import { Link } from "@remix-run/react";
import type { SiteHomeContent } from "../../../types";
import { inertProps } from "../../../utils/inert";
import { cardClass, twoLines, type CardShellProps } from "./card-shell";

const PORTRAIT = "/portraits/aditya.jpg";

type IntroCardProps = CardShellProps & { about: SiteHomeContent["about"] };

/**
 * The right card, about (its heading is "the cut"). Two columns: the portrait fills a full-height column on the left,
 * the words scroll on the right (`.intro-text.card-scroll`). Under 700 px it stacks and the whole
 * body scrolls. Ported from the mockup's #cardR.
 */
export default function IntroCard({ about, cardRef, mode, hot }: IntroCardProps) {
  const open = mode === "open";
  const [first, second] = twoLines(about.title);
  return (
    <aside
      ref={cardRef}
      className={cardClass("right", { mode, hot })}
      aria-label="About me"
      {...inertProps(mode === "hidden")}
    >
      <button
        type="button"
        className="rail"
        aria-label={open ? "Close about" : "Open about"}
        aria-expanded={open}
      >
        <span>about</span>
      </button>
      <div
        className="card-body intro-body"
        aria-hidden={!open}
        {...inertProps(!open)}
      >
        <div
          className="ph"
          aria-hidden="true"
          style={{ backgroundImage: `url("${PORTRAIT}")` }}
        />
        <div className="intro-text card-scroll" tabIndex={-1}>
          <h2 className="display">
            {first}
            {second && (
              <>
                <br />
                {second}
              </>
            )}
          </h2>
          <p className="who">
            {about.who.map((line, i) => (
              <span key={line}>
                {i > 0 && <br />}
                {line}
              </span>
            ))}
          </p>
          <div className="copy">
            {about.paragraphs.map((text) => (
              <p key={text}>{text}</p>
            ))}
          </div>
          <div className="card-foot">
            <Link className="pill" to="/work">
              See the work
            </Link>
            <span className="kbd-hint">Esc or ← to close</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
