import { useNavigate } from "@remix-run/react";
import { useEffect } from "react";
import { changePage } from "../../lib/page-change";
import type { WorkVideo } from "../../types";
import BackButton from "./back-button";
import VideoWall from "./gallery/video-wall";
import WallHeading from "./wall-heading";
import "./work.css";
import "./wall.css";

interface WallPageProps {
  kind: "long" | "short";
  videos: WorkVideo[];
}

/**
 * One video wall (`/work/long-form`, `/work/short-form`): the heading (kind and count) at the top
 * left, the back button at the top right (the shelves' close button: the same component and place) and the
 * wall itself (`VideoWall`: the shader gallery over the links, which stay as the list and as the picture
 * where there is no WebGL). The header comes first in the page (as on the shelves), so the heading is read first and
 * Back is the first tab stop; it stays above the wall by its layer. Esc goes back to the rings with the page change, as the back button does.
 */
export default function WallPage({ kind, videos }: WallPageProps) {
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      void changePage(navigate, "/work");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate]);

  return (
    <main className="wall-page" data-wall={kind}>
      <div className="wall-head" data-wall-top="">
        <WallHeading kind={kind} count={videos.length} />
        <BackButton />
      </div>
      <VideoWall kind={kind} items={videos} />
    </main>
  );
}
