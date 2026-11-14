type Props = {
  title: string;
  /** The one-line description under the title. */
  text: string;
};

/** The heading block (spec 9.6), top left: the title (in capitals, the largest and brightest words on the map) and its description under it, small and quiet. It shows in the overview and leaves in My climb. The sizes and strengths are tokens (experience.css). */
export default function HeadingBlock({ title, text }: Props) {
  return (
    <header className="map-heading">
      <h1 className="map-title">{title}</h1>
      <p className="map-text">{text}</p>
    </header>
  );
}
