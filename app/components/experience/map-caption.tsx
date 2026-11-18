import type { CSSProperties } from "react";
import SplitLetters from "./split-letters";

type Props = {
  title: string;
  line: string;
  fact?: string;
  credit: string;
};

/**
 * The picture's caption (spec 9.6; round 7 second look spec 7): the mountain's name as a small letter-spaced label in a warm light orange, its line (the
 * quietest words on the map), NASA's figures and the credit. On a wide screen it sits right of the mountain, flush right, on the summit's row; on a narrow
 * one lower left (experience.css, words-layout.ts). It shows in the overview and leaves in My climb. The label comes in letter by letter and the lines after
 * it, a breath apart (spec 8: entrance.css, `--k` is the line's place). On a small screen only the label and the line are shown (experience.css); the rest
 * is still in the page.
 */
export default function MapCaption({ title, line, fact, credit }: Props) {
  const lines = [["map-caption-line", line], ...(fact ? [["map-caption-fact", fact]] : []), ["map-caption-credit", credit]];

  return (
    <figure className="map-caption">
      <figcaption>
        <span className="map-caption-title">
          <SplitLetters text={title} />
        </span>
        {lines.map(([name, text], k) => (
          <span key={name} className={`${name} map-rise`} style={{ "--k": k } as CSSProperties}>
            {text}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
