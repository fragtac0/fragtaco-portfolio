type Props = {
  title: string;
  line: string;
  fact?: string;
  credit: string;
};

/** The picture's caption (spec 9.6), lower left: the mountain's name as a small letter-spaced label in a warm light orange, its line (the quietest words on the map), NASA's figures and the credit. It shows in the overview and leaves in My climb. On a small screen only the label and the line are shown (experience.css); the rest is still in the page. */
export default function MapCaption({ title, line, fact, credit }: Props) {
  return (
    <figure className="map-caption">
      <figcaption>
        <span className="map-caption-title">{title}</span>
        <span className="map-caption-line">{line}</span>
        {fact ? <span className="map-caption-fact">{fact}</span> : null}
        <span className="map-caption-credit">{credit}</span>
      </figcaption>
    </figure>
  );
}
