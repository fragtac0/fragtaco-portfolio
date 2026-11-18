import { countLabel } from "../../utils/count-label";

interface WallHeadingProps {
  kind: "long" | "short";
  count: number;
}

const NAME = { long: "Long form", short: "Short form" } as const;

/** The wall's heading at the top left: the kind and how many videos it holds, e.g. "Long form" and "35 videos". */
export default function WallHeading({ kind, count }: WallHeadingProps) {
  return (
    <div className="wall-heading">
      <h1 className="wall-name">{NAME[kind]}</h1>
      <p className="wall-count">{countLabel(count, "video", "videos")}</p>
    </div>
  );
}
