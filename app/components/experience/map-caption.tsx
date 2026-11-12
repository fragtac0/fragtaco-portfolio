type Props = {
  title: string;
  line: string;
  fact?: string;
  credit: string;
};

/** The picture's caption (spec 9.4), lower left, in the painting caption's style: title, line, NASA's figures, the credit. */
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
