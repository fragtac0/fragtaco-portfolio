import type { SiteCredits } from "../../../types";
import { creditLinkLabel, creditLinkValue } from "./credit-link";
import { cardClass, inertIf, twoLines, type CardShellProps } from "./card-shell";

type CreditsCardProps = CardShellProps & { credits: SiteCredits };

/** The left card, "credits". Ported from the mockup's #cardL. */
export default function CreditsCard({ credits, cardRef, mode, hot }: CreditsCardProps) {
  const open = mode === "open";
  const [first, second] = twoLines(credits.name);
  return (
    <aside
      ref={cardRef}
      className={cardClass("left", { mode, hot })}
      aria-label="Credits"
      {...inertIf(mode === "hidden")}
    >
      <button type="button" className="rail" aria-label="Open credits">
        <span>credits</span>
      </button>
      <div
        className="card-body card-scroll"
        tabIndex={-1}
        aria-hidden={!open}
        {...inertIf(!open)}
      >
        <div className="cr-head">
          <div
            className="cr-ph"
            role="img"
            aria-label={credits.name}
            style={{ backgroundImage: `url(${credits.image})` }}
          />
          <div>
            <h2 className="display">
              {first}
              {second && (
                <>
                  <br />
                  {second}
                </>
              )}
            </h2>
            <div className="cr-role">{credits.role}</div>
          </div>
        </div>
        <p className="cr-blurb">{credits.blurb}</p>
        <div className="placeholder">{credits.note}</div>
        <dl className="dl">
          {credits.facts.map((fact) => (
            <div key={fact.label} className="dl-row">
              <dt>{fact.label}</dt>
              <dd>{fact.value}</dd>
            </div>
          ))}
        </dl>
        <div className="links">
          {credits.links.map((link) => (
            <a key={link.url} href={link.url} target="_blank" rel="noopener noreferrer">
              <span>{creditLinkLabel(link.type)}</span>
              <span>{creditLinkValue(link)}</span>
            </a>
          ))}
        </div>
      </div>
    </aside>
  );
}
