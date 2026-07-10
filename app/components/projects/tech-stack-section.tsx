import type { IconType } from "react-icons";
import { SiBlender, SiFigma } from "react-icons/si";
import { surfaces } from "../../config/ui";
import type { SiteTechStackItem, SiteTechStackSection } from "../../types";
import { cn } from "../../utils/cn";

interface TechStackSectionProps {
  content: SiteTechStackSection;
}

const TECH_ICON_MAP: Record<string, IconType> = {
  blender: SiBlender,
  figma: SiFigma,
};

// Adobe apps and Final Cut Pro have no brand icon in react-icons' Simple
// Icons set (license/trademark restrictions) — monogram is the fallback.
const TECH_MONOGRAM_MAP: Record<string, string> = {
  premiere: "Pr",
  aftereffects: "Ae",
  finalcut: "FCP",
  photoshop: "Ps",
  illustrator: "Ai",
  lightroom: "Lr",
};

function TechMark({ item }: { item: SiteTechStackItem }) {
  const Icon = TECH_ICON_MAP[item.id];

  if (Icon) {
    return <Icon className="h-5 w-5 text-accent sm:h-6 sm:w-6" />;
  }

  const monogram = TECH_MONOGRAM_MAP[item.id] ?? item.label.slice(0, 2);

  return (
    <span className="grid h-6 min-w-6 place-items-center rounded-md bg-fog/12 px-1.5 font-metric text-[0.66rem] font-semibold text-accent">
      {monogram}
    </span>
  );
}

function TechPill({ item }: { item: SiteTechStackItem }) {
  return (
    <span className="flex h-10 items-center gap-2 rounded-full border border-fog/10 bg-fog/[0.045] px-3 font-mono text-[0.58rem] uppercase tracking-[0.16em] text-accent/80 shadow-[0_10px_26px_rgba(0,0,0,0.18)] sm:h-11 sm:px-4 sm:text-[0.62rem]">
      <TechMark item={item} />
      {item.label}
    </span>
  );
}

function TechMarquee({ items }: { items: SiteTechStackItem[] }) {
  return (
    <div className="group/marquee relative overflow-hidden rounded-full border border-fog/10 bg-theme-black/26 motion-reduce:overflow-x-auto motion-reduce:[-ms-overflow-style:none] motion-reduce:[scrollbar-width:none] motion-reduce:[&::-webkit-scrollbar]:hidden">
      <div
        className={cn(
          "flex w-max transform-gpu gap-2 py-2 will-change-transform motion-safe:animate-stack-marquee motion-reduce:animate-none",
        )}
      >
        {[...items, ...items].map((item, index) => (
          <TechPill key={`${item.id}-${index}`} item={item} />
        ))}
      </div>
    </div>
  );
}

export default function TechStackSection({ content }: TechStackSectionProps) {
  return (
    <section
      className={cn(
        surfaces.workPanel,
        "group/stack !p-4 sm:!p-5",
      )}
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 opacity-45 [background:radial-gradient(circle_at_16%_14%,rgba(255,236,214,.08),transparent_28%),radial-gradient(circle_at_86%_60%,rgba(252,76,0,.12),transparent_36%)]"
      />

      <div className="grid gap-4 lg:grid-cols-[13rem_minmax(0,1fr)] lg:items-center">
        <div>
          <p className="font-mono text-[0.56rem] uppercase tracking-[0.22em] text-gilt sm:text-[0.62rem]">
            {content.eyebrow}
          </p>
          <h2 className="mt-2 font-doto text-[2rem] font-black uppercase leading-none tracking-section text-fog sm:text-[2.65rem]">
            {content.title}
          </h2>
        </div>

        <div className="min-w-0">
          <TechMarquee items={content.items} />
        </div>
      </div>
    </section>
  );
}
