import { useReducedMotion } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "../../utils/cn";

interface RevealProps {
  children: ReactNode;
  delayMs?: number;
  className?: string;
}

// Single reveal treatment for every section/panel: the existing `cut-reveal`
// keyframe, gated by IntersectionObserver so panels below the fold animate
// when scrolled to instead of all firing at once on page load.
export default function Reveal({ children, delayMs = 0, className }: RevealProps) {
  const reducedMotion = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (reducedMotion) return;

    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -10% 0px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [reducedMotion]);

  if (reducedMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div
      ref={ref}
      className={cn(className, visible ? "motion-safe:animate-cut-reveal" : "opacity-0")}
      style={visible ? { animationDelay: `${delayMs}ms` } : undefined}
    >
      {children}
    </div>
  );
}
