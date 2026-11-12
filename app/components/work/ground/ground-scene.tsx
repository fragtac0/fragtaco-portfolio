/**
 * The picture of the work pages' ground (spec 6.4), drawn with the `shaders` package (MIT, WebGPU).
 * This is the only file that imports `shaders/react`; WorkGround loads it with a dynamic import after
 * the page change is over, so the package is in no first-load chunk and never in the server bundle.
 *
 * One idea: depth. A near-black ground (`--ground`), one large soft pool of cool cream-grey light off
 * centre and one low ember of orange in the lower right corner, each breathing very slowly (a full
 * cycle of 60 s or more), under a fine static grain that hides banding. No hard shape, nothing the eye
 * follows, and the pool and the ember are weak on purpose so the thumbnails stay the brightest thing.
 * WorkBackground draws the same two gradients in CSS (`.work-wash`): keep the numbers in GROUND_LOOK
 * and in work.css equal, that still picture is the first frame of this one.
 *
 * Telemetry is off (the package would otherwise post the site's domain to shaders.com). The canvas is
 * drawn at no more than 1.25 device pixels per CSS pixel: the package caps at 2 (1.5 on phones) and has
 * no prop for less, so the box is drawn at 1/k of the screen and scaled up by k with a transform.
 */
import { FilmGrain, RadialGradient, Shader, SolidColor } from "shaders/react";
import { useEffect, useRef, useState } from "react";
import { GROUND } from "../../../styles/tokens";
import { GROUND_MAX_DPR, groundScale, libraryDprCap } from "./can-run";
import { breathRange, emberStops, GROUND_LOOK, poolStops, reachFactor } from "./ground-look";

interface GroundSceneProps {
  /** The first frame is possible: WorkGround fades the canvas in. */
  onReady: () => void;
  /** This browser or GPU cannot run it after all: WorkGround takes the canvas away for good. */
  onUnavailable: () => void;
}

function currentScale(): number {
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const cap = libraryDprCap({ coarse, longSide: Math.max(window.innerWidth, window.innerHeight) });
  return groundScale(window.devicePixelRatio || 1, cap);
}

export default function GroundScene({ onReady, onUnavailable }: GroundSceneProps) {
  const box = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  const [reach, setReach] = useState(1);

  // The scale that keeps the canvas at 1.25 device pixels per CSS pixel; a resize also covers browser zoom.
  useEffect(() => {
    const node = box.current;
    if (!node) return;
    let timer = 0;
    const apply = () => {
      node.style.setProperty("--ground-k", String(currentScale()));
      // the radii follow the screen's shape (reachFactor); a state change, but once a resize has settled, never per frame
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setReach(reachFactor(window.innerWidth, window.innerHeight)), 120);
    };
    apply();
    window.addEventListener("resize", apply);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", apply);
    };
  }, []);

  const { pool, ember, grain } = GROUND_LOOK;
  const poolBreath = breathRange(pool.radius * reach);
  const emberBreath = breathRange(ember.radius * reach);
  return (
    <div
      ref={box}
      className="work-ground-fade"
      data-ground-dpr={GROUND_MAX_DPR}
      data-shown={shown ? "true" : "false"}
    >
      <div className="work-ground-box">
        <Shader
          className="work-ground-canvas"
          disableTelemetry
          colorSpace="srgb"
          toneMapping="linear"
          onReady={() => {
            setShown(true);
            onReady();
          }}
          onUnavailable={() => onUnavailable()}
        >
          <FilmGrain strength={grain} animated={false}>
            <SolidColor color={GROUND} />
            <RadialGradient
              colorA={pool.color}
              colorB={GROUND}
              stops={poolStops()}
              center={{ x: pool.x, y: pool.y }}
              aspect={pool.aspect}
              radius={{
                type: "auto-animate",
                mode: "ping-pong",
                outputMin: poolBreath.min,
                outputMax: poolBreath.max,
                speed: GROUND_LOOK.poolSpeed,
                easing: "sine",
              }}
            />
            <RadialGradient
              colorA={ember.color}
              colorB={`${ember.color}00`}
              stops={emberStops()}
              center={{ x: ember.x, y: ember.y }}
              aspect={ember.aspect}
              radius={{
                type: "auto-animate",
                mode: "ping-pong",
                outputMin: emberBreath.min,
                outputMax: emberBreath.max,
                speed: GROUND_LOOK.emberSpeed,
                easing: "sine",
              }}
            />
          </FilmGrain>
        </Shader>
      </div>
    </div>
  );
}
