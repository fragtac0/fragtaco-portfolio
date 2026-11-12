import { useNavigate } from "@remix-run/react";
import { useEffect } from "react";
import { changePage } from "../../lib/page-change";
import type { WorkVideo } from "../../types";
import VideoWall from "./gallery/video-wall";
import ReturnMark from "./return-mark";
import WallHeading from "./wall-heading";
import "./work.css";
import "./wall.css";

interface WallPageProps {
  kind: "long" | "short";
  videos: WorkVideo[];
}

/**
 * One video wall (`/work/long-form`, `/work/short-form`): the heading (kind and count) at the top
 * left, the return mark at the top right and the wall itself (`VideoWall`: the shader gallery over the
 * links, which stay as the list and as the picture where there is no WebGL). Esc goes back to the rings
 * with the radial change, as the return mark does.
 */
export default function WallPage({ kind, videos }: WallPageProps) {
  const navigate = useNavigate();

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
      <VideoWall kind={kind} items={videos} />
      <WallHeading kind={kind} count={videos.length} />
      <ReturnMark />
    </main>
  );
}
