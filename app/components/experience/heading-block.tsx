type Props = {
  title: string;
  /** The one-line description under the title. */
  text: string;
};

/** The heading block (spec 9.6), top left: the title, and a short quiet line under it. It shows in the overview and leaves in My climb. */
export default function HeadingBlock({ title, text }: Props) {
  return (
    <header className="map-heading">
      <h1 className="map-title">{title}</h1>
      <p className="map-text">{text}</p>
    </header>
  );
}
