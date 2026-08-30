import { FaGithub, FaGlobe, FaXTwitter } from "react-icons/fa6";
import type { IconType } from "react-icons";
import { surfaces, textStyles } from "../../config/ui";
import type { SiteCredits, SiteCreditsLink } from "../../types";

interface CreditsCardProps {
  credits: SiteCredits;
}

const LINK_ICONS: Record<SiteCreditsLink["type"], IconType> = {
  website: FaGlobe,
  github: FaGithub,
  x: FaXTwitter,
};

const LINK_LABELS: Record<SiteCreditsLink["type"], string> = {
  website: "website",
  github: "GitHub",
  x: "X",
};

export default function CreditsCard({ credits }: CreditsCardProps) {
  return (
    <div className={surfaces.aboutFooterCard}>
      <p className={textStyles.giltLabel}>original blueprint</p>
      <h2 className={`mt-2 ${textStyles.panelTitle}`}>credits</h2>

      <div className="mt-7 flex items-start gap-5">
        <div
          aria-hidden="true"
          className="h-[5.5rem] w-[5.5rem] shrink-0 overflow-hidden rounded-[1.5rem_0.5rem_1.5rem_0.5rem] bg-steel bg-cover bg-center ring-1 ring-fog/15"
          style={{ backgroundImage: `url('${credits.image}')` }}
        />
        {/* Doto + uppercase is what makes this read as a headline rather
            than metadata beside a photo — deliberately one step below the
            card's own `credits` title so the hierarchy stays legible. */}
        <div className="min-w-0">
          <p className="font-doto text-[1.5rem] font-black uppercase leading-[0.9] tracking-section text-fog sm:text-[1.95rem]">
            {credits.name}
          </p>
          <p className="mt-1.5 font-mono text-[0.56rem] uppercase tracking-[0.22em] text-fog/50">
            site architect · original build
          </p>
        </div>
      </div>

      <p className="mt-5 font-serif text-[0.88rem] italic leading-relaxed text-fog/75">
        {credits.blurb}
      </p>

      {/* mt-auto lives here rather than on the links row so the hairline
          sits glued directly above the links, both anchored to the
          card's bottom edge together, instead of floating right under
          the blurb with a gap before the links row further down. */}
      <div aria-hidden="true" className="mt-auto h-px bg-fog/[0.08]" />

      <div className="flex items-center gap-1 pt-6">
        {credits.links.map((link) => {
          const Icon = LINK_ICONS[link.type];
          return (
            <a
              key={link.type}
              href={link.url}
              target="_blank"
              rel="noopener"
              aria-label={`${credits.name} on ${LINK_LABELS[link.type]}`}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-fog/70 transition-colors duration-200 hover:text-gilt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gilt/70"
            >
              <Icon className="h-5 w-5" />
            </a>
          );
        })}
      </div>
    </div>
  );
}
