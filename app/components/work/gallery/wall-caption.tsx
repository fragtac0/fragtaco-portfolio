import { useState } from "react";
import type { WorkVideo } from "../../../types";

/**
 * The hover caption at the lower left of a wall: the video's title and its year, in the painting
 * caption's style (the home hero's `.caption`). It fades in and out; while fading out it keeps the last
 * words, so it never flashes empty text. Decorative for a screen reader: every link already carries the
 * same words in its name.
 */
export default function WallCaption({ video }: { video: WorkVideo | null }) {
  const [last, setLast] = useState<WorkVideo | null>(video);
  if (video && video !== last) setLast(video);

  return (
    <p className={`wall-caption${video ? " on" : ""}`} aria-hidden="true">
      <span className="t">{(video ?? last)?.title}</span>
      <span className="a">{(video ?? last)?.year}</span>
    </p>
  );
}
