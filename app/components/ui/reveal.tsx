import type { ReactNode } from "react";
import { cn } from "../../utils/cn";

interface RevealProps {
  children: ReactNode;
  delayMs?: number;
  className?: string;
}

// Single reveal treatment for every section/panel: the `cut-reveal` keyframe,
// fired on mount with a staggered delay so panels cascade in one after
// another instead of the page looking empty below the fold. `motion-safe:`
// already no-ops the animation under prefers-reduced-motion, leaving content
// instantly visible with no extra JS branching needed.
export default function Reveal({ children, delayMs = 0, className }: RevealProps) {
  return (
    <div
      className={cn(className, "motion-safe:animate-cut-reveal")}
      style={{ animationDelay: `${delayMs}ms` }}
    >
      {children}
    </div>
  );
}
