import { useEffect, useRef, useState } from "react";

const FPS = 24;

function formatTimecode(totalFrames: number) {
  const frames = totalFrames % FPS;
  const totalSeconds = Math.floor(totalFrames / FPS);
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const hours = Math.floor(totalSeconds / 3600) % 24;

  return [hours, minutes, seconds, frames]
    .map((part) => String(part).padStart(2, "0"))
    .join(":");
}

/**
 * A running 24fps timecode, counting from the moment the page loads —
 * the classic top-corner readout of an editing monitor.
 */
export default function HeroTimecode() {
  const startRef = useRef<number | null>(null);
  const frameRef = useRef<number | null>(null);
  const [label, setLabel] = useState("00:00:00:00");

  useEffect(() => {
    const tick = (time: number) => {
      if (startRef.current === null) {
        startRef.current = time;
      }

      const elapsedFrames = Math.floor(((time - startRef.current) / 1000) * FPS);
      setLabel(formatTimecode(elapsedFrames));
      frameRef.current = window.requestAnimationFrame(tick);
    };

    frameRef.current = window.requestAnimationFrame(tick);

    return () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }
    };
  }, []);

  return (
    <span className="tabular-nums" suppressHydrationWarning>
      {label}
    </span>
  );
}
