import { useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";
import { textStyles } from "../../config/ui";
import type { SiteClientsSection } from "../../types";
import SectionHeadingRow from "../ui/section-heading-row";
import ClientTile from "./client-tile";

interface ClientsSectionProps {
  clients: SiteClientsSection;
}

const BASE_SPEED_PX_PER_MS = 22 / 1000; // ~22px/s, a slow drift
const HOVER_LERP_MS = 240;
const HOVER_SPEED_FACTOR = 0.25;

export default function ClientsSection({ clients }: ClientsSectionProps) {
  const reducedMotion = useReducedMotion();
  const items = clients.items;

  const sectionRef = useRef<HTMLDivElement>(null);
  const row1Ref = useRef<HTMLDivElement>(null);
  const row2Ref = useRef<HTMLDivElement>(null);

  // One requestAnimationFrame loop drives both rows — a CSS animation
  // can't do this: hover has to change speed, and mutating
  // animation-duration mid-run makes the browser recompute progress and
  // visibly jump.
  useEffect(() => {
    if (reducedMotion || items.length === 0) return;
    const row1 = row1Ref.current;
    const row2 = row2Ref.current;
    const section = sectionRef.current;
    if (!row1 || !row2 || !section) return;

    let rafId: number | null = null;
    let lastTime = 0;
    let running = false;
    let intersecting = false;

    let setWidth1 = row1.scrollWidth / 2;
    let setWidth2 = row2.scrollWidth / 2;
    let offset1 = 0;
    let offset2 = -setWidth2;

    let speedFactor1 = 1;
    let speedFactor2 = 1;
    let targetFactor1 = 1;
    let targetFactor2 = 1;

    const resizeObserver = new ResizeObserver(() => {
      setWidth1 = row1.scrollWidth / 2;
      setWidth2 = row2.scrollWidth / 2;
    });
    resizeObserver.observe(row1);
    resizeObserver.observe(row2);

    function frame(now: number) {
      rafId = requestAnimationFrame(frame);
      if (lastTime === 0) lastTime = now;
      const dt = Math.min(now - lastTime, 50);
      lastTime = now;
      if (!running) return;

      // Exponential ease toward the target speed factor, ~240ms to settle.
      const lerpAmount = 1 - Math.exp(-dt / (HOVER_LERP_MS / 4));
      speedFactor1 += (targetFactor1 - speedFactor1) * lerpAmount;
      speedFactor2 += (targetFactor2 - speedFactor2) * lerpAmount;

      offset1 -= BASE_SPEED_PX_PER_MS * dt * speedFactor1;
      offset2 += BASE_SPEED_PX_PER_MS * dt * speedFactor2;

      if (setWidth1 > 0) {
        while (offset1 <= -setWidth1) offset1 += setWidth1;
      }
      if (setWidth2 > 0) {
        while (offset2 >= 0) offset2 -= setWidth2;
      }

      // Non-null: `frame` only ever runs after the row1/row2 guard above
      // (TS can't see that through the function-declaration hoist).
      row1!.style.transform = `translate3d(${offset1}px,0,0)`;
      row2!.style.transform = `translate3d(${offset2}px,0,0)`;
    }
    rafId = requestAnimationFrame(frame);

    function updateRunning() {
      running = intersecting && !document.hidden;
      if (running) lastTime = 0; // avoid a big dt jump right after resuming
    }

    const intersectionObserver = new IntersectionObserver(
      (entries) => {
        intersecting = entries[0]?.isIntersecting ?? false;
        updateRunning();
      },
      { threshold: 0.01 },
    );
    intersectionObserver.observe(section);

    function onVisibilityChange() {
      updateRunning();
    }
    document.addEventListener("visibilitychange", onVisibilityChange);

    // Only the hovered row slows — each row's target is independent.
    function row1Enter() {
      targetFactor1 = HOVER_SPEED_FACTOR;
    }
    function row1Leave() {
      targetFactor1 = 1;
    }
    function row2Enter() {
      targetFactor2 = HOVER_SPEED_FACTOR;
    }
    function row2Leave() {
      targetFactor2 = 1;
    }
    row1.addEventListener("pointerenter", row1Enter);
    row1.addEventListener("pointerleave", row1Leave);
    row2.addEventListener("pointerenter", row2Enter);
    row2.addEventListener("pointerleave", row2Leave);

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      row1.removeEventListener("pointerenter", row1Enter);
      row1.removeEventListener("pointerleave", row1Leave);
      row2.removeEventListener("pointerenter", row2Enter);
      row2.removeEventListener("pointerleave", row2Leave);
    };
  }, [reducedMotion, items.length]);

  if (items.length === 0) return null;

  const count = items.length;

  return (
    <div>
      <SectionHeadingRow
        label="worked with"
        labelClassName={textStyles.giltLabel}
        title={clients.sectionTitle}
        titleClassName={textStyles.shelfTitle}
        meta={`${count} channel${count === 1 ? "" : "s"}`}
        metaClassName={textStyles.shelfLabel}
      />

      {/* Breaks out to the viewport edges regardless of the page's own
          max-width + padding — the standard 50vw breakout, not a separate
          inset. */}
      <div className="relative left-1/2 right-1/2 mt-6 w-screen -mx-[50vw] overflow-hidden lg:mt-8">
        {reducedMotion ? (
          <div className="flex flex-col gap-4">
            <div className="flex gap-4 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {items.map((client) => (
                <ClientTile key={client.id} client={client} />
              ))}
            </div>
            <div className="flex gap-4 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {items.map((client) => (
                <ClientTile key={client.id} client={client} />
              ))}
            </div>
          </div>
        ) : (
          <div ref={sectionRef} className="flex flex-col gap-4">
            <div className="overflow-hidden">
              <div ref={row1Ref} className="flex w-max gap-4 will-change-transform">
                {items.map((client) => (
                  <ClientTile key={`a-${client.id}`} client={client} />
                ))}
                {items.map((client) => (
                  <ClientTile key={`a-dup-${client.id}`} client={client} ariaHidden />
                ))}
              </div>
            </div>
            <div className="overflow-hidden">
              <div ref={row2Ref} className="flex w-max gap-4 will-change-transform">
                {items.map((client) => (
                  <ClientTile key={`b-${client.id}`} client={client} />
                ))}
                {items.map((client) => (
                  <ClientTile key={`b-dup-${client.id}`} client={client} ariaHidden />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
