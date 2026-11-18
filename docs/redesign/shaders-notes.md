# `shaders` notes (for the work page background)

Reference for round 6, Task 9. Package: `shaders` 4.0.7 (MIT, WebGPU only, peer react 18 or 19), pinned exactly. Read on 11 November 2026 from `https://shaders.com/llms-full.txt`, `https://shaders.com/docs/guide/ssr`, `https://shaders.com/docs/guide/quickstart` and the package's own type files in `node_modules/shaders/dist`. The spec's brief for the picture is section 6.4 of `docs/superpowers/specs/2026-11-11-round6-design.md`.

Nothing imports `shaders` yet. The build was checked: it is in no server bundle and no first-load chunk (see the Task 1 report).

## 1. What it is

- One root component, `Shader`, makes a canvas and a WebGPU renderer. Effects are child components from `shaders/react` (`import { Shader, FlowingGradient, ... } from "shaders/react"`). Layers draw in source order, later ones on top. A child with `requiresChild: true` in the catalogue (Vignette, FilmGrain, Blur and the other effects) wraps other components and filters what is inside it; generative components (gradients, noise, Nebula) make their own picture.
- Every component also takes `opacity` (0 to 1), `blendMode` (normal, multiply, screen, overlay, add, softLight and the rest), `visible`, `transform` (`offsetX`, `offsetY`, `rotation`, `scale`, `anchorX`, `anchorY`, `edges`), `maskSource` and `maskType`, and `boundingBox`.
- Props are camelCase. Numbers go in braces (`speed={0.2}`). Changing a prop at run time updates a GPU uniform and does not recompile, so a prop may be driven from state without cost. Do not change props per animation frame from React state anyway (global rule); use `speed`.
- Size the canvas by styling `<Shader>` itself (`className` or `style`), never the inner canvas. It resizes by itself and cleans up on unmount.
- The package is `sideEffects: false` and ESM only. Sub-paths: `shaders/react`, `shaders/react/bundle`, `shaders/core` (and `shaders/core/<Name>` per effect), `shaders/js`.

## 2. Mounting it client only in Remix

The guide's rule: WebGPU exists only in the browser, so a `<Shader>` must start on the client. In plain React (no Next.js) the guide says to keep a `mounted` flag set in an effect and render nothing until it is true. Our global rule is stricter: `shaders` is reached only through a dynamic import inside an effect, so the module is never in the server bundle or the first-load chunk.

Pattern for Task 9 (one small client component, e.g. `WorkGround`):

```tsx
// Sketch, not final code.
const [kit, setKit] = useState<null | typeof import("shaders/react")>(null);
const [failed, setFailed] = useState(false);

useEffect(() => {
  if (reducedMotion) return;               // CSS gradient only
  let cancelled = false;
  const start = () => {
    void import("shaders/react")
      .then((m) => {
        if (cancelled) return;
        if (!m.isWebGPUSupported()) { setFailed(true); return; }   // sync pre-check
        setKit(m);
      })
      .catch(() => { if (!cancelled) setFailed(true); });
  };
  // after the page change is over (spec 6.4): wait for the transition, then idle
  const id = window.setTimeout(start, TRANSITION_MS + 100);
  return () => { cancelled = true; window.clearTimeout(id); };
}, [reducedMotion]);
```

- The server renders only the still CSS gradient (the fallback layer). The shader canvas goes on top once `kit` is set and fades in with `opacity`.
- Render the shader tree from `kit` (`const { Shader, FlowingGradient } = kit`). Do not write `import { Shader } from "shaders/react"` at the top of any route or component file: that puts the package in the main graph. A `type`-only import (`import type {...} from "shaders/react"`) is fine, it is erased.
- Next.js style `next/dynamic` and `ClientOnly` are not available in Remix; the effect plus dynamic import above is the equivalent. `React.lazy` would also work but renders a `Suspense` boundary on the server, so avoid it.
- Keep the canvas wrapper `position: fixed; inset: 0; pointer-events: none; aria-hidden`, behind the page (z-index from `tokens.css`).
- Vite: `shaders` is in `dependencies`. If dev pre-bundling warns, add it to `optimizeDeps.include`; the production build needs nothing.

## 3. Detecting that it cannot run

Three signals, all exported from `shaders/react` (and `shaders/core`):

| Signal | What it tells you |
| --- | --- |
| `isWebGPUSupported(): boolean` | Cheap and synchronous. `false` on the server and in any browser without `navigator.gpu`. `true` does not promise a device. |
| `getWebGPUSupport(): Promise<{ supported: boolean; reason?: GpuFailureReason }>` | Asks for an adapter, caches the answer for the page. Use it when you must decide between shader and still gradient before painting. |
| `<Shader onUnavailable={(reason) => ...}>` | Fires at most once when the browser or GPU cannot run it after all (no adapter, no device, device lost, out of memory, repeated render errors). Nothing is written to the console. The canvas stays transparent for good. |

`GpuFailureReason` is `"unsupported" | "no-adapter" | "no-device" | "init-failed" | "device-lost" | "out-of-memory" | "gpu-error" | "render-failed" | "limit-exceeded"`.

Plan: the CSS gradient is always painted underneath. Mount the shader above it only when `isWebGPUSupported()` is true and reduced motion is off; on `onUnavailable`, or a rejected import, unmount the shader (or just leave the transparent canvas) and the gradient is already there. `<Shader onReady>` fires when the first frame is possible: fade the canvas in from it, so the still gradient and the first frame match (the brief asks the gradient to match the first frame).

Debugging: `setShadersDebug(true)` (or `localStorage["shaders:debug"] = "1"`) turns the library's diagnostics on; by default a failure is silent.

Headless Chrome (our `scripts/audit/cdp.mjs`) normally has no WebGPU adapter, so the fallback path is what the audit will see. Check the real path in a headed browser.

## 4. Things that touch our rules

- **Telemetry.** `<Shader>` samples a short performance report and posts it to `https://shaders.com/api/telemetry`; the payload carries the page's domain, browser family and device type. Pass `disableTelemetry` on the root `<Shader>`. (Its type: `disableTelemetry?: boolean`. Not in the quickstart; read from `dist/react/engine/Shader.d.ts` and `dist/core/telemetry`.)
- **Pixel ratio.** The renderer caps the canvas at devicePixelRatio 2 on desktop and 1.5 on a phone-sized touch device (`maxPixelRatioForDevice`). There is no prop to set it. The spec wants a cap of 1.25. Options for Task 9: give `<Shader>` a container sized to `100% / k` and `transform: scale(k)` it back up (the buffer is then `cssSize x dpr`, so pick `k = dpr / 1.25` when `dpr > 1.25`), or accept 1.5 to 2 and say so. The scale route stays inside the allowed properties (`transform`).
- **Pausing.** The core observes visibility with an `IntersectionObserver` (margin 128 px) and skips drawing while the canvas is off screen. It does not show a `visibilitychange` listener in the places searched, so Task 9 should unmount or hide the layer itself when `document.hidden` (spec 6.4 and the global rule), and verify by counting frames.
- **Animation.** Use each component's own `speed` (a full cycle must be no shorter than 40 s, so keep speeds low and measure). No React state per frame.
- **Reduced motion.** Skip the import altogether and show the still gradient, or mount with `speed={0}` (most generative components accept 0 to freeze). Prefer skipping the import.
- **Colour.** The root takes `colorSpace` (`"p3-linear" | "srgb"`) and `toneMapping` (`linear`, `reinhard`, `cineon`, `aces`, `agx`, `neutral`, `hable`, `unreal`). For a dark, banding-free ground use `colorSpace="srgb"` with `toneMapping="linear"`, and let a `FilmGrain` or the site's own grain dither the gradient. Check the first frame against the CSS fallback colour by colour sample.
- **Licence.** `shaders` is MIT (a row is in `credits.md`). The "Pro" shader library needs a paid licence: use only the 200 free components in `llms-full.txt`.

## 5. Candidate components for a deep dark ground

Defaults and ranges are from `llms-full.txt`. "Wraps" means it needs a child (an effect); the others make their own picture. Colours below are suggestions toward the brief (near-black ground `--ground`, one large soft cool cream-grey pool off centre, one low orange ember in a lower corner, fine grain), not tested values; Task 9 tunes them against the 85% darker than `#2a2826` and orange under about 8% limits.

### Gradients (the pool and the ember)

| Component | Props that matter | Use |
| --- | --- | --- |
| `RadialGradient` | `colorA` (centre), `colorB` (edge), `stops` (multi-stop, overrides A and B), `center` `{x,y}` (0 to 1), `radius` (0 to 2, default 1), `aspect` (0.1 to 4, stretches into an ellipse), `skewAngle`, `colorSpace` (default `linear`) | The best fit. Two of them: a big soft cool pool (`center` about `{x:0.35,y:0.4}`, `radius` about 1.1, `colorA` a cream-grey with `opacity` about 0.18, `colorB` transparent or the ground) and a small ember (`center` about `{x:0.9,y:0.95}`, `radius` about 0.35, orange to transparent, `opacity` below 0.6 so it never reaches full strength). Layer with `blendMode="screen"` or `"add"` over a `SolidColor` ground. |
| `SolidColor` | `color` | The ground (`--ground`). |
| `MultiPointGradient` | `colorA..colorE` with `positionA..positionE`, `smoothness` (0 to 5, default 2), `colorSpace` | One component for the whole composition: ground colour at three points, cream-grey at one, orange at one. Static unless something else moves it. Good for the still match. |
| `MeshGradient` | `colorA`, `colorB`, `stops`, `count` (2 to 8), `smoothness`, `variation`, `swirl`, `drift` (0 to 1), `speed` (default 1), `seed`, `colorSpace` | Built-in slow wander. Use a low `speed` (0.05 to 0.15), `count` 3 to 4, `drift` small. Risk: hard "banded seams" if `wrapping` is above 0, keep it 0. |
| `FlowingGradient` | `colorA` (deep background), `colorB`, `colorC`, `colorD`, `speed`, `distortion` (0 to 2), `seed` | Ready-made drifting blend; defaults are purple and pink so every colour must be replaced. Lower `speed` to 0.1 and `distortion` to 0.3. |
| `LinearGradient`, `ConicGradient`, `DiamondGradient` | `colorA`, `colorB`, `stops`, `angle` | Less useful (hard directional shapes); a very soft `LinearGradient` could lift the top edge slightly. |
| `StudioBackground` | `color`, `keyColor`, `keyIntensity`, `keySoftness`, `fillColor`, `backColor`, `brightness`, `vignette`, `center`, `ambientIntensity`, `ambientSpeed` | A lit wall with drifting ambient light; it is tuned light by default (`#d8dbec`), so it must be pulled very dark (`color` near `--ground`, `brightness` low). Worth a try for a "cool pool" with ambient drift built in. |

### Noise (for slow, organic variation in the pool)

| Component | Props | Use |
| --- | --- | --- |
| `FractalNoise` | `colorA`, `colorB`, `stops`, `octaves` (1 to 8, default 4), `detail`, `contrast` (0.1 to 1), `speed` (0 to 1, default 0.15), `angle`, `seed` | Very low contrast and `opacity`, drives slow cloud-like variation. Set `speed` to about 0.02. |
| `PerlinNoise`, `SimplexNoise`, `CurlNoise`, `WaveletNoise`, `WorleyNoise` | scale, `speed`, `seed`, colours | Alternatives; Perlin or Simplex at low opacity are the soft ones. Worley and Voronoi make cells (hard shapes, avoid). |
| `Aurora` | `colorA..colorC`, `intensity` (0 to 100), `curtainCount`, `speed` (default 5), `waviness`, `rayDensity`, `height`, `center`, `balance` | Visible streaks; too "moving shape" for the brief. Only at very low `intensity` as a faint wash, probably skip. |
| `Nebula`, `Godrays`, `Smoke`, `Fog` | many | Too busy or too eye-catching; skip. |

### Finishing (these wrap the layers under them)

| Component | Props | Use |
| --- | --- | --- |
| `FilmGrain` (wraps) | `strength` (0 to 1, default 0.5), `bias` (0 to 10, default 2, puts grain in the darks), `animated` (default false) | Fine grain, also hides banding. Strength about 0.15 to 0.3. Leave `animated` false (nothing the eye follows; spec says the site's own grain stays on top in CSS too). |
| `Vignette` (wraps) | `color` (default black), `center`, `radius` (0 to 1.5, default 0.5), `falloff` (0.01 to 1.5), `intensity` (0 to 1) | Pulls the edges to the ground. Radius about 0.7, falloff about 1. |
| `Dither`, `Posterize` | pattern, levels | `Dither` can remove banding; check it does not show a pattern. |
| `Blur` family | `strength` | A small blur over the whole tree softens any hard edge; costs a render pass, so prefer soft gradients over blurring. |
| `BrightnessContrast`, `Exposure`, `Tint`, `Saturation` | amount | Final trim to hit the 85% darker than `#2a2826` limit without editing every colour. |

### A starting tree (to tune in Task 9)

```tsx
<Shader disableTelemetry colorSpace="srgb" toneMapping="linear" onReady={...} onUnavailable={...}
        className="work-ground-canvas">
  <Vignette radius={0.7} falloff={1} intensity={0.8} color="#0c0b0a">
    <FilmGrain strength={0.2} animated={false}>
      <SolidColor color="#0c0b0a" />                                   {/* --ground */}
      <RadialGradient colorA="#c9c4b8" colorB="#0c0b0a" center={{ x: 0.36, y: 0.38 }}
                      radius={1.1} blendMode="screen" opacity={0.16} />   {/* cool pool */}
      <RadialGradient colorA="#d9682a" colorB="#0c0b0a" center={{ x: 0.92, y: 0.96 }}
                      radius={0.32} blendMode="screen" opacity={0.5} />   {/* ember */}
    </FilmGrain>
  </Vignette>
</Shader>
```

The slow drift (full cycle 40 s or more) can come from `transform={{ offsetX, offsetY }}` on a layer driven by the library, or from `MeshGradient`/`FractalNoise` at a tiny `speed`. Whichever is chosen, measure the cycle in the page.

## 6. Open questions to settle while building Task 9

- Does the drift loop need a CSS animation on the wrapper (`transform`) instead of in-shader motion? That is cheaper and fully under our control (a 60 s CSS `translate3d` on a canvas 6% larger than the screen).
- The exact `onReady` timing in a headed browser, to fade the canvas in without a jump.
- Whether `getWebGPUSupport()` (adapter request) is worth awaiting before mounting, to avoid a flash of an empty canvas on blocklisted GPUs.

## 7. Upgrading `shaders` (added with R43.3b)

- `app/components/work/ground/can-run.ts` (`libraryDprCap`) copies the package's private `maxPixelRatioForDevice` (2, or 1.5 on a coarse pointer up to 1366 px long), because the package does not export it and has no pixel-ratio prop. After any version bump, run `scripts/audit/ground.json` and read its backing-size steps: the canvas must stay at 1.25 device pixels per CSS pixel of the screen (`pixelsPerScreenCssPx` 1.25) at dpr 2 and on the phone profile.
- The package's frame loop never idles (`shouldAnimate` is always true: 60 GPU submits a second even with no driver and a static scene; `isVisible` false drops it to one a second but cannot be set from outside). The ground therefore draws one frame, copies it from the canvas in `onReady` (the only moment the WebGPU canvas can be read), and unmounts the shader; the drift is a CSS transform on the copy. The package also measures its canvas with `getBoundingClientRect`, which a transform on an ancestor inflates, so the shader's box is never scaled. The `ground.json` submit counter (GPU submits per second) must stay at 0 after a bump, and `framesDrawn` must be 1 after a load.
- The package's radial gradient is `radius * screen height` pixels, mixed in linear light; `work.css` (`.work-wash`) repeats that. A bump that changes either shows up as a difference between `r43-ground-1440-bare.jpg` and `r43-ground-1440-bare-fallback.jpg`.

