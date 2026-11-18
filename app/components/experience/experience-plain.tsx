import type { ExperienceMoment } from "../../types";
import "./experience-plain.css";

/** A moment's title, with the struck part (if it has one) in `<s>`. */
export function StruckTitle({ moment }: { moment: Pick<ExperienceMoment, "title" | "struck"> }) {
  const [before, after] = moment.struck !== undefined ? moment.title.split(moment.struck, 2) : [moment.title, undefined];

  if (after === undefined) return <>{before}</>;

  return (
    <>
      {before}
      <s>{moment.struck}</s>
      {after}
    </>
  );
}

/** The moments as a list, with the struck part of a title in `<s>`: the fallback where the map cannot be drawn, and the list a screen reader reads (experience-page.tsx). */
export function MomentList({ moments, label }: { moments: ExperienceMoment[]; label?: string }) {
  return (
    <ol className="experience-plain-list" aria-label={label}>
      {moments.map((moment) => (
        <li key={moment.id} className="experience-plain-moment">
          <span className="experience-plain-date">{moment.label}</span>
          <h2 className="experience-plain-name">
            <StruckTitle moment={moment} />
          </h2>
          <p className="experience-plain-line">{moment.line}</p>
        </li>
      ))}
    </ol>
  );
}
