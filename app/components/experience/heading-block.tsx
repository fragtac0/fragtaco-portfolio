import SplitLetters from "./split-letters";

type Props = {
  title: string;
  /** The one-line description under the title. */
  text: string;
};

/**
 * The heading block (spec 9.6; round 7 second look spec 7): the title (in capitals, the largest and brightest words on the map) and its description
 * under it, small and quiet. On a wide screen it sits left of the mountain, on the summit's row (experience.css, words-layout.ts); on a narrow one top
 * left. It shows in the overview and leaves in My climb. The title comes in letter by letter and the description after it (spec 8: entrance.css). The
 * sizes and strengths are tokens (experience.css).
 */
export default function HeadingBlock({ title, text }: Props) {
  return (
    <header className="map-heading">
      <h1 className="map-title">
        <SplitLetters text={title} />
      </h1>
      <p className="map-text map-rise">{text}</p>
    </header>
  );
}
