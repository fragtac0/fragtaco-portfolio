import type { SiteExperience } from "../../types";
import "./experience-plain.css";

/**
 * My experience as a plain page: the heading block's words and the moments as a list. It stands in until
 * the Mars map (Task 18) replaces it, and stays the words-only version of the page. The dock belongs to
 * the route (`routes/experience.tsx`, through WorkShell).
 */
export default function ExperiencePlain({ experience }: { experience: SiteExperience }) {
  const { heading, moments } = experience;

  return (
    <main className="experience-plain">
      <h1 className="experience-plain-title">{heading.title}</h1>
      <p className="experience-plain-text">{heading.text}</p>
      <ol className="experience-plain-list">
        {moments.map((moment) => {
          const [before, after] =
            moment.struck !== undefined ? moment.title.split(moment.struck, 2) : [moment.title, undefined];

          return (
            <li key={moment.id} className="experience-plain-moment">
              <span className="experience-plain-date">{moment.label}</span>
              <h2 className="experience-plain-name">
                {after === undefined ? (
                  before
                ) : (
                  <>
                    {before}
                    <s>{moment.struck}</s>
                    {after}
                  </>
                )}
              </h2>
              <p className="experience-plain-line">{moment.line}</p>
            </li>
          );
        })}
      </ol>
    </main>
  );
}
