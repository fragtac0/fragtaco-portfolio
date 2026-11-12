import { useNavigate } from "@remix-run/react";
import { useEffect } from "react";
import { coverUrl } from "../../content/work-media";
import { changePage } from "../../lib/page-change";
import type { WorkVideo } from "../../types";
import ReturnMark from "./return-mark";
import WallHeading from "./wall-heading";
import WorkBackground from "./work-background";
import "./work.css";
import "./wall.css";

interface WallPageProps {
  kind: "long" | "short";
  videos: WorkVideo[];
}

/**
 * One video wall (`/work/long-form`, `/work/short-form`): the heading (kind and count) at the top
 * left, the return mark at the top right and, for now, a plain grid of the videos' links. Round 6
 * Task 11 puts the shader gallery on top and keeps this grid as the no-WebGL fallback. Pictures come from
 * `coverUrl` at run time and are never stored; each link opens the video in a new tab. Esc goes back to
 * the rings with the radial change, as the return mark does.
 */
export default function WallPage({ kind, videos }: WallPageProps) {
  const navigate = useNavigate();
  const tall = kind === "short";

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      void changePage(navigate, "/work", { kind: "radial" });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate]);

  return (
    <main className="wall-page" data-wall={kind}>
      <WorkBackground />
      <div className="wall-scroll">
        <ul className="wall-grid" aria-label={tall ? "Short form videos" : "Long form videos"}>
          {videos.map((video) => (
            <li key={video.id}>
              <a
                className="wall-tile"
                href={video.url}
                target="_blank"
                rel="noreferrer"
                aria-label={`${video.title}, for ${video.for}, ${video.year}`}
              >
                <img src={coverUrl(video, tall)} alt="" loading="lazy" decoding="async" />
              </a>
            </li>
          ))}
        </ul>
      </div>
      <div className="wall-fade" aria-hidden="true" />
      <WallHeading kind={kind} count={videos.length} />
      <ReturnMark />
    </main>
  );
}
