import { useEffect, useRef, useState, type CSSProperties } from "react";
import type MatterJS from "matter-js";
import { aboutProfileTags } from "../../config/ui";
import { cn } from "../../utils/cn";

// Type-only reference to matter-js — erased at compile time, so this alone
// doesn't pull the engine into the bundle. The real, runtime-cost import is
// the `await import("matter-js")` below, fired only from the observer.
type MatterModule = typeof MatterJS;
type MatterEngine = ReturnType<MatterModule["Engine"]["create"]>;
type MatterBody = ReturnType<MatterModule["Bodies"]["rectangle"]>;

const LABELS = aboutProfileTags;

// Hand-placed fallback: SSR, no-JS, mobile/coarse pointers, and
// prefers-reduced-motion all render this instead of running the engine. Also
// doubles as the very first paint before the IntersectionObserver fires, so
// there's never an empty-then-populated flash. Approximates what the physics
// settles into — a loose pile hugging the bottom edge, shallow angles, one
// pill standing nearly vertical.
const STATIC_PILE: { leftPct: number; bottomRem: number; rotateDeg: number }[] = [
  { leftPct: 9, bottomRem: 0.3, rotateDeg: -9 },
  { leftPct: 24, bottomRem: 1.6, rotateDeg: 76 },
  { leftPct: 41, bottomRem: 0.1, rotateDeg: 6 },
  { leftPct: 58, bottomRem: 1.0, rotateDeg: -15 },
  { leftPct: 74, bottomRem: 0.2, rotateDeg: 11 },
  { leftPct: 90, bottomRem: 0.5, rotateDeg: -3 },
];

const WALL_THICKNESS = 200;
const SPAWN_STAGGER_MS = 90;
const CEILING_DELAY_MS = 900;
const OUT_OF_BOUNDS_TOP = -800;
const OUT_OF_BOUNDS_SIDE_MARGIN = 400;
const OUT_OF_BOUNDS_BOTTOM_MARGIN = 400;
// Fixed physics timestep (ms) — one Engine.update() per rAF frame, always
// stepped by this exact amount regardless of the frame's real duration.
// Decouples simulation stability from render jitter.
const PHYSICS_STEP_MS = 16.666;
// A dragged pill escaping this far past the panel's edge releases
// immediately instead of hanging in the air waiting for a mouseup that a
// fast drag may never deliver inside the element.
const RELEASE_GRACE_PX = 24;

function isEngineEligible() {
  if (typeof window === "undefined") return false;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  if (window.matchMedia("(pointer: coarse)").matches) return false;
  if (window.innerWidth < 768) return false;
  return true;
}

interface Dims {
  w: number;
  h: number;
}

interface HeldPill {
  index: number;
  pointerId: number;
  // Grab offset: pointer position minus body position at grab time, in
  // arena-local coordinates. Preserves where on the pill it was grabbed
  // instead of snapping its center to the cursor.
  offsetX: number;
  offsetY: number;
  // Latest pointer position, arena-local — written by pointermove, read by
  // the physics step. pointermove never touches the body directly.
  pointerX: number;
  pointerY: number;
  // Previous frame's target position, for the velocity-from-delta calc.
  prevX: number;
  prevY: number;
}

interface EngineRuntime {
  matter: MatterModule;
  engine: MatterEngine;
  bodies: (MatterBody | null)[];
  floor: MatterBody;
  left: MatterBody;
  right: MatterBody;
  ceiling: MatterBody | null;
  dims: Dims[];
  bounds: { width: number; height: number; padLeft: number; padRight: number; padBottom: number };
  spawnXs: number[];
  spawnTimers: number[];
  ceilingTimer: number | null;
}

interface PillPhysicsProps {
  panelRef: React.RefObject<HTMLElement>;
}

export default function PillPhysics({ panelRef }: PillPhysicsProps) {
  const arenaRef = useRef<HTMLUListElement>(null);
  const pillRefs = useRef<(HTMLLIElement | null)[]>([]);
  const [mode, setMode] = useState<"static" | "physics">("static");

  const runtimeRef = useRef<EngineRuntime | null>(null);
  const initStartedRef = useRef(false);
  const cancelledRef = useRef(false);
  const heldRef = useRef<HeldPill | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef(0);

  function releaseHeld(el?: HTMLLIElement | null) {
    const held = heldRef.current;
    if (!held) return;
    heldRef.current = null;
    if (el?.hasPointerCapture(held.pointerId)) {
      el.releasePointerCapture(held.pointerId);
    }
    panelRef.current?.removeAttribute("data-dragging");
  }

  function handlePointerDown(index: number, event: React.PointerEvent<HTMLLIElement>) {
    if (mode !== "physics") return;
    const rt = runtimeRef.current;
    const arenaEl = arenaRef.current;
    if (!rt || !arenaEl) return;
    const body = rt.bodies[index];
    if (!body) return;

    // A settled pill is asleep (enableSleeping) — direct setPosition/
    // setVelocity calls don't clear that flag on their own (unlike
    // MouseConstraint, which wakes bodies it grabs), and Engine.update()
    // skips integrating sleeping bodies entirely. Without this, a grabbed
    // pill would still visually follow the cursor (we write its transform
    // straight from body.position every frame regardless of sleep state)
    // but freeze in place the instant it's released, since its real
    // velocity would never get integrated into further motion.
    rt.matter.Sleeping.set(body, false);

    // Stops the drag from text-selecting the title/meta/caption behind the
    // pills — the [data-dragging] CSS rule below covers the rest of the
    // panel for the duration of the hold.
    event.preventDefault();
    const el = event.currentTarget;
    try {
      el.setPointerCapture(event.pointerId);
    } catch {
      // Per spec, setPointerCapture can throw (e.g. no active pointer with
      // this id) — without capture we can't reliably track the drag past
      // this element's bounds, so bail rather than start a hold we can't
      // properly release. preventDefault() above already stopped the text
      // selection this pointerdown would otherwise have started.
      return;
    }
    panelRef.current?.setAttribute("data-dragging", "true");

    const rect = arenaEl.getBoundingClientRect();
    const px = event.clientX - rect.left;
    const py = event.clientY - rect.top;
    heldRef.current = {
      index,
      pointerId: event.pointerId,
      offsetX: px - body.position.x,
      offsetY: py - body.position.y,
      pointerX: px,
      pointerY: py,
      prevX: body.position.x,
      prevY: body.position.y,
    };
  }

  function handlePointerMove(event: React.PointerEvent<HTMLLIElement>) {
    const held = heldRef.current;
    if (!held || held.pointerId !== event.pointerId) return;

    // Pointer capture keeps delivering move events even far outside the
    // panel — release the instant that happens (plus a small grace margin)
    // so a fast drag out of the box drops the pill instead of leaving it
    // pinned to a cursor that's no longer over the work area.
    const panelEl = panelRef.current;
    if (panelEl) {
      const pr = panelEl.getBoundingClientRect();
      if (
        event.clientX < pr.left - RELEASE_GRACE_PX ||
        event.clientX > pr.right + RELEASE_GRACE_PX ||
        event.clientY < pr.top - RELEASE_GRACE_PX ||
        event.clientY > pr.bottom + RELEASE_GRACE_PX
      ) {
        releaseHeld(event.currentTarget);
        return;
      }
    }

    const arenaEl = arenaRef.current;
    if (!arenaEl) return;
    const rect = arenaEl.getBoundingClientRect();
    held.pointerX = event.clientX - rect.left;
    held.pointerY = event.clientY - rect.top;
  }

  function handlePointerEnd(event: React.PointerEvent<HTMLLIElement>) {
    const held = heldRef.current;
    if (!held || held.pointerId !== event.pointerId) return;
    releaseHeld(event.currentTarget);
  }

  useEffect(() => {
    cancelledRef.current = false;
    const panel = panelRef.current;
    const arena = arenaRef.current;
    if (!panel || !arena) return;

    let intersectionObserver: IntersectionObserver | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let lastIntersecting = false;

    function stopLoop() {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    }

    function frameLoop(now: number) {
      rafIdRef.current = requestAnimationFrame(frameLoop);
      const rt = runtimeRef.current;
      if (!rt) return;

      if (lastFrameTimeRef.current === 0) lastFrameTimeRef.current = now;
      const elapsed = now - lastFrameTimeRef.current;
      lastFrameTimeRef.current = now;
      const clampedElapsed = Math.min(Math.max(elapsed, 1), 33);

      const held = heldRef.current;
      if (held) {
        const body = rt.bodies[held.index];
        if (body) {
          const target = {
            x: held.pointerX - held.offsetX,
            y: held.pointerY - held.offsetY,
          };
          // Velocity from the frame delta — this is what lets a throw
          // carry real momentum on release instead of the pill just
          // dropping dead where the pointer let go.
          const dtFactor = clampedElapsed / PHYSICS_STEP_MS;
          rt.matter.Body.setVelocity(body, {
            x: (target.x - held.prevX) / dtFactor,
            y: (target.y - held.prevY) / dtFactor,
          });
          rt.matter.Body.setPosition(body, target);
          held.prevX = target.x;
          held.prevY = target.y;
        }
      }

      // Fixed timestep regardless of the frame's actual duration — Matter's
      // own Runner does variable-delta catch-up, which spikes exactly when
      // the page is already busy. One update per rAF frame is enough here.
      rt.matter.Engine.update(rt.engine, PHYSICS_STEP_MS);
    }

    function startLoop() {
      if (rafIdRef.current !== null) return;
      lastFrameTimeRef.current = 0;
      rafIdRef.current = requestAnimationFrame(frameLoop);
    }

    function onVisibilityChange() {
      if (document.hidden) {
        stopLoop();
      } else if (initStartedRef.current && (intersectionObserver === null || lastIntersecting)) {
        startLoop();
      }
    }

    async function initEngine() {
      if (initStartedRef.current || cancelledRef.current) return;
      initStartedRef.current = true;

      const mod = await import("matter-js");
      if (cancelledRef.current || !panelRef.current || !arenaRef.current) return;
      const Matter = mod.default;
      const { Engine, Bodies, Body, Composite, Events } = Matter;

      const panelEl = panelRef.current;
      const arenaEl = arenaRef.current;
      const rect = arenaEl.getBoundingClientRect();
      const style = window.getComputedStyle(panelEl);
      const padLeft = parseFloat(style.paddingLeft) || 0;
      const padRight = parseFloat(style.paddingRight) || 0;
      const padBottom = parseFloat(style.paddingBottom) || 0;

      const width = rect.width;
      const height = rect.height;
      const floorY = height - padBottom;
      const leftX = padLeft;
      const rightX = width - padRight;

      const engine = Engine.create();
      engine.gravity.y = 1;
      engine.enableSleeping = true;

      const floor = Bodies.rectangle(
        width / 2,
        floorY + WALL_THICKNESS / 2,
        width + WALL_THICKNESS * 2,
        WALL_THICKNESS,
        { isStatic: true, label: "floor" },
      );
      const left = Bodies.rectangle(
        leftX - WALL_THICKNESS / 2,
        height / 2,
        WALL_THICKNESS,
        height * 3 + WALL_THICKNESS * 2,
        { isStatic: true, label: "left" },
      );
      const right = Bodies.rectangle(
        rightX + WALL_THICKNESS / 2,
        height / 2,
        WALL_THICKNESS,
        height * 3 + WALL_THICKNESS * 2,
        { isStatic: true, label: "right" },
      );
      Composite.add(engine.world, [floor, left, right]);

      // Real rendered size per pill — labels differ in width, and a
      // hardcoded guess would drift from the DOM.
      const dims: Dims[] = pillRefs.current.map((el) => {
        const r = el?.getBoundingClientRect();
        return { w: r?.width ?? 90, h: r?.height ?? 46 };
      });

      const spawnMinX = width * 0.15;
      const spawnMaxX = width * 0.85;
      const spawnXs = dims.map(() => spawnMinX + Math.random() * (spawnMaxX - spawnMinX));

      const rt: EngineRuntime = {
        matter: Matter,
        engine,
        bodies: dims.map(() => null),
        floor,
        left,
        right,
        ceiling: null,
        dims,
        bounds: { width, height, padLeft, padRight, padBottom },
        spawnXs,
        spawnTimers: [],
        ceilingTimer: null,
      };
      runtimeRef.current = rt;

      // Commit the mode switch; the layout effect below parks every pill
      // just above the panel's top edge (clipped by overflow-hidden, so
      // invisible) synchronously post-commit, before the browser paints.
      setMode("physics");

      Events.on(engine, "afterUpdate", () => {
        const runtime = runtimeRef.current;
        if (!runtime) return;
        const { width: bw, height: bh } = runtime.bounds;
        runtime.bodies.forEach((body, i) => {
          if (!body) return;
          const el = pillRefs.current[i];
          if (!el) return;
          const { w, h } = runtime.dims[i];

          if (
            body.position.y > bh + OUT_OF_BOUNDS_BOTTOM_MARGIN ||
            body.position.y < OUT_OF_BOUNDS_TOP ||
            body.position.x < -OUT_OF_BOUNDS_SIDE_MARGIN ||
            body.position.x > bw + OUT_OF_BOUNDS_SIDE_MARGIN
          ) {
            Body.setPosition(body, { x: bw / 2, y: -60 });
            Body.setVelocity(body, { x: 0, y: 0 });
            Body.setAngularVelocity(body, 0);
          }

          el.style.transform = `translate3d(${body.position.x - w / 2}px, ${body.position.y - h / 2}px, 0) rotate(${body.angle}rad)`;
        });
      });

      LABELS.forEach((_, i) => {
        const timer = window.setTimeout(() => {
          if (cancelledRef.current) return;
          const runtime = runtimeRef.current;
          if (!runtime) return;
          const { w, h } = runtime.dims[i];
          const x = runtime.spawnXs[i];
          const y = -(h / 2 + 40);
          const body = Bodies.rectangle(x, y, w, h, {
            chamfer: { radius: h / 2 },
            restitution: 0.34,
            friction: 0.34,
            frictionAir: 0.02,
            density: 0.0012,
          });
          Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.1);
          runtime.bodies[i] = body;
          Composite.add(runtime.engine.world, body);
        }, i * SPAWN_STAGGER_MS);
        rt.spawnTimers.push(timer);
      });

      const ceilingTimer = window.setTimeout(
        () => {
          if (cancelledRef.current) return;
          const runtime = runtimeRef.current;
          if (!runtime) return;
          const ceiling = Bodies.rectangle(
            runtime.bounds.width / 2,
            -WALL_THICKNESS / 2,
            runtime.bounds.width + WALL_THICKNESS * 2,
            WALL_THICKNESS,
            { isStatic: true, label: "ceiling" },
          );
          runtime.ceiling = ceiling;
          Composite.add(runtime.engine.world, ceiling);
        },
        LABELS.length * SPAWN_STAGGER_MS + CEILING_DELAY_MS,
      );
      rt.ceilingTimer = ceilingTimer;

      startLoop();

      resizeObserver = new ResizeObserver(() => {
        const runtime = runtimeRef.current;
        const currentPanel = panelRef.current;
        const currentArena = arenaRef.current;
        if (!runtime || !currentPanel || !currentArena) return;
        const r = currentArena.getBoundingClientRect();
        const s = window.getComputedStyle(currentPanel);
        const pl = parseFloat(s.paddingLeft) || 0;
        const pr = parseFloat(s.paddingRight) || 0;
        const pb = parseFloat(s.paddingBottom) || 0;
        const w = r.width;
        const h = r.height;
        runtime.bounds = { width: w, height: h, padLeft: pl, padRight: pr, padBottom: pb };

        const { Body: MBody } = runtime.matter;
        MBody.setPosition(runtime.floor, { x: w / 2, y: h - pb + WALL_THICKNESS / 2 });
        MBody.setPosition(runtime.left, { x: pl - WALL_THICKNESS / 2, y: h / 2 });
        MBody.setPosition(runtime.right, { x: w - pr + WALL_THICKNESS / 2, y: h / 2 });
        if (runtime.ceiling) {
          MBody.setPosition(runtime.ceiling, { x: w / 2, y: -WALL_THICKNESS / 2 });
        }

        // Clamp any body that resize pushed outside the new pit — never
        // re-spawn or re-stack, a pile the user arranged stays arranged.
        runtime.bodies.forEach((body) => {
          if (!body) return;
          const halfW = (body.bounds.max.x - body.bounds.min.x) / 2;
          const halfH = (body.bounds.max.y - body.bounds.min.y) / 2;
          const clampedX = Math.min(Math.max(body.position.x, pl + halfW), w - pr - halfW);
          const clampedY = Math.min(body.position.y, h - pb - halfH);
          if (clampedX !== body.position.x || clampedY !== body.position.y) {
            MBody.setPosition(body, { x: clampedX, y: clampedY });
          }
        });
      });
      resizeObserver.observe(panelEl);
    }

    intersectionObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          lastIntersecting = entry.isIntersecting;
          if (entry.isIntersecting && !initStartedRef.current) {
            if (isEngineEligible()) {
              void initEngine();
            } else {
              intersectionObserver?.disconnect();
            }
          }
          if (initStartedRef.current) {
            if (entry.isIntersecting) {
              startLoop();
            } else {
              stopLoop();
            }
          }
        }
      },
      { threshold: 0.35 },
    );
    intersectionObserver.observe(panel);

    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelledRef.current = true;
      intersectionObserver?.disconnect();
      resizeObserver?.disconnect();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      stopLoop();
      heldRef.current = null;
      panel.removeAttribute("data-dragging");

      const rt = runtimeRef.current;
      if (rt) {
        rt.spawnTimers.forEach((t) => window.clearTimeout(t));
        if (rt.ceilingTimer !== null) window.clearTimeout(rt.ceilingTimer);
        rt.matter.World.clear(rt.engine.world, false);
        rt.matter.Engine.clear(rt.engine);
        runtimeRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The instant the engine takes over, park every pill just above the
  // panel's top edge (still clipped by overflow-hidden, so invisible) before
  // the browser paints — this is what the staggered spawn timers pick up
  // from a moment later, with zero flash in between.
  useEffect(() => {
    if (mode !== "physics") return;
    const rt = runtimeRef.current;
    if (!rt) return;
    pillRefs.current.forEach((el, i) => {
      if (!el) return;
      const { w, h } = rt.dims[i];
      const x = rt.spawnXs[i] - w / 2;
      const y = -(h / 2 + 40) - h / 2;
      el.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(0deg)`;
    });
  }, [mode]);

  return (
    <ul
      ref={arenaRef}
      className="pointer-events-none absolute inset-0 z-20 m-0 list-none p-0"
    >
      {LABELS.map((label, i) => {
        const staticPos = STATIC_PILE[i];
        const style: CSSProperties | undefined =
          mode === "physics"
            ? undefined
            : {
                left: `${staticPos.leftPct}%`,
                bottom: `${staticPos.bottomRem}rem`,
                transform: `translateX(-50%) rotate(${staticPos.rotateDeg}deg)`,
              };
        return (
          <li
            key={label}
            ref={(el) => {
              pillRefs.current[i] = el;
            }}
            className={cn(
              "absolute select-none whitespace-nowrap rounded-full bg-accent px-[1.15rem] py-[0.7rem] font-mono text-[0.78rem] uppercase tracking-[0.14em] text-white shadow-[0_2px_6px_rgba(0,0,0,0.35)]",
              mode === "physics"
                ? "left-0 top-0 cursor-grab touch-none pointer-events-auto will-change-transform active:cursor-grabbing"
                : "pointer-events-none",
            )}
            style={style}
            onPointerDown={(event) => handlePointerDown(i, event)}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerEnd}
            onPointerCancel={handlePointerEnd}
            onLostPointerCapture={handlePointerEnd}
          >
            {label}
          </li>
        );
      })}
    </ul>
  );
}
