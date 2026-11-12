/**
 * The picture of the work pages' ground (spec 6.4), drawn with the `shaders` package (MIT, WebGPU).
 * This is the only file that imports `shaders/react`; WorkGround loads it with a dynamic import after
 * the page change is over, so the package is in no first-load chunk and never in the server bundle.
 *
 * One idea: depth. A near-black ground (`--ground`), one large soft pool of cool cream-grey light off
 * centre and one low ember of orange in the lower right corner, under a fine static grain that hides
 * banding. The package has no way to idle (its frame loop redraws 60 times a second for ever, with or without
 * a driver), so the shader draws ONE frame: in its `onReady` (the same task as that frame, while the canvas can
 * still be read) the frame is copied to a 2D canvas and the shader is unmounted, which frees the GPU. The
 * slow drift (a full cycle of 80 s) is a CSS transform on the still (`work-ground-breathe` in work.css). If the
 * copy comes out empty the shader is left running instead, so the picture is never lost. A resize that
 * changes the screen's size by more than 15% starts the shader again to take a new frame.
 * No hard shape, nothing the eye follows, and the pool and the ember are weak on purpose so the
 * thumbnails stay the brightest thing.
 * WorkBackground draws the same two gradients in CSS (`.work-wash`): keep the numbers in GROUND_LOOK
 * and in work.css equal, that still picture is the first frame of this one.
 *
 * Telemetry is off (the package would otherwise post the site's domain to shaders.com). The canvas is
 * drawn at no more than 1.25 device pixels per CSS pixel: the package caps at 2 (1.5 on phones) and has
 * no prop for less, so the shader draws in a box 1/k of the screen and its one frame is shown at the screen's
 * size (a scale of k).
 */
import { FilmGrain, RadialGradient, Shader, SolidColor } from "shaders/react";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { GROUND } from "../../../styles/tokens";
import { GROUND_MAX_DPR, groundScale, libraryDprCap } from "./can-run";
import { emberStops, GROUND_LOOK, needsRedraw, poolStops, reachFactor } from "./ground-look";

const POOL_STOPS = poolStops();
const EMBER_STOPS = emberStops();

interface GroundSceneProps {
  /** The tab is hidden: a shader that is still running (no frame taken yet) is taken down until it is back. */
  paused: boolean;
  /** This browser or GPU cannot run it after all: WorkGround takes the canvas away for good. */
  onUnavailable: () => void;
}

function currentScale(): number {
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const cap = libraryDprCap({ coarse, longSide: Math.max(window.innerWidth, window.innerHeight) });
  return groundScale(window.devicePixelRatio || 1, cap);
}

/** Copies the shader's canvas into `out`; false if the copy came out empty (then the shader must keep running). */
function copyFrame(from: HTMLCanvasElement | null, out: HTMLCanvasElement | null): boolean {
  if (!from || !out || from.width === 0 || from.height === 0) return false;
  out.width = from.width;
  out.height = from.height;
  const context = out.getContext("2d");
  if (!context) return false;
  context.drawImage(from, 0, 0);
  return context.getImageData(out.width >> 1, out.height >> 1, 1, 1).data[3] === 255;
}

export default function GroundScene({ paused, onUnavailable }: GroundSceneProps) {
  const box = useRef<HTMLDivElement>(null);
  const still = useRef<HTMLCanvasElement>(null);
  const taken = useRef<[number, number] | null>(null); // the screen's size when the still was taken
  const [shown, setShown] = useState(false);
  const [running, setRunning] = useState(true); // the shader is mounted (until its frame is copied)
  const [liveOnly, setLiveOnly] = useState(false); // the copy failed: the shader itself is the picture
  const [reach, setReach] = useState(() => reachFactor(window.innerWidth, window.innerHeight));
  // the scale of the box (see the header), known before the shader mounts so its first frame is already at 1.25
  const [scale, setScale] = useState(currentScale);

  // A resize (which also covers browser zoom) can change the scale that keeps the canvas at 1.25 device pixels per CSS pixel.
  useEffect(() => {
    let timer = 0;
    const apply = () => {
      setScale(currentScale());
      // once a resize has settled (never per frame): follow the screen's shape, and take a new frame if it changed much
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const size: [number, number] = [window.innerWidth, window.innerHeight];
        if (taken.current && needsRedraw(taken.current, size)) {
          setReach(reachFactor(size[0], size[1]));
          setRunning(true);
        }
      }, 150);
    };
    apply();
    window.addEventListener("resize", apply);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", apply);
    };
  }, []);

  // Called by the package in the task that drew the first frame: the only moment the canvas can be read.
  const onFrame = () => {
    const from = box.current?.querySelector<HTMLCanvasElement>("canvas[data-renderer='shaders']") ?? null;
    const node = box.current;
    if (node) node.dataset.groundFrames = String(Number(node.dataset.groundFrames ?? 0) + 1);
    if (copyFrame(from, still.current)) {
      taken.current = [window.innerWidth, window.innerHeight];
      setRunning(false); // unmounts the shader: no frame loop, the GPU is freed
      setLiveOnly(false);
    } else setLiveOnly(true);
    setShown(true);
  };

  const { pool, ember, grain } = GROUND_LOOK;
  return (
    <div
      ref={box}
      className="work-ground-fade"
      data-ground-dpr={GROUND_MAX_DPR}
      data-shown={shown ? "true" : "false"}
      data-ground-live={running ? "true" : "false"}
      data-ground-fallback={liveOnly ? "live" : undefined}
      style={{ "--ground-k": scale } as CSSProperties}
    >
      {/* the shader draws in a box 1/k of the screen, never scaled, so the package sizes its canvas from that (it
          measures with getBoundingClientRect, which a transform would inflate); the still, at the same pixel
          count, is shown at the screen's size over it */}
      <div className="work-ground-box">
        {running && !paused ? (
          <Shader
            className="work-ground-canvas"
            disableTelemetry
            colorSpace="srgb"
            toneMapping="linear"
            onReady={onFrame}
            onUnavailable={() => onUnavailable()}
          >
            <FilmGrain strength={grain} animated={false}>
              <SolidColor color={GROUND} />
              <RadialGradient
                colorA={pool.color}
                colorB={GROUND}
                stops={POOL_STOPS}
                center={{ x: pool.x, y: pool.y }}
                aspect={pool.aspect}
                radius={pool.radius * reach}
              />
              <RadialGradient
                colorA={ember.color}
                colorB={`${ember.color}00`}
                stops={EMBER_STOPS}
                center={{ x: ember.x, y: ember.y }}
                aspect={ember.aspect}
                radius={ember.radius * reach}
              />
            </FilmGrain>
          </Shader>
        ) : null}
      </div>
      <canvas ref={still} className="work-ground-still" />
    </div>
  );
}
