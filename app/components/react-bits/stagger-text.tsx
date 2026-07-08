import { motion, useReducedMotion } from "motion/react";

interface StaggerTextProps {
  text: string;
  className?: string;
  charClassName?: string;
  delay?: number;
  stagger?: number;
}

/**
 * Reveals text one character at a time with a clip-wipe rising from below,
 * like clips sliding onto a timeline.
 */
export default function StaggerText({
  text,
  className = "",
  charClassName = "",
  delay = 0,
  stagger = 0.035,
}: StaggerTextProps) {
  const reducedMotion = useReducedMotion();
  const characters = [...text];

  if (reducedMotion) {
    return <span className={className}>{text}</span>;
  }

  return (
    <motion.span
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.4 }}
      transition={{ staggerChildren: stagger, delayChildren: delay }}
      aria-label={text}
    >
      {characters.map((character, index) => (
        <motion.span
          key={`${character}-${index}`}
          aria-hidden="true"
          className={`inline-block whitespace-pre ${charClassName}`.trim()}
          variants={{
            hidden: {
              opacity: 0,
              y: "0.55em",
              clipPath: "inset(0 0 100% 0)",
            },
            visible: {
              opacity: 1,
              y: "0em",
              clipPath: "inset(0 0 -20% 0)",
            },
          }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        >
          {character}
        </motion.span>
      ))}
    </motion.span>
  );
}
