import type { ComponentType } from "react";
import { FaGlobe, FaInstagram, FaXTwitter, FaYoutube } from "react-icons/fa6";
import type { WorkClient } from "../../types";

type SocialType = WorkClient["socials"][number]["type"];

const ICON: Record<SocialType, ComponentType<{ "aria-hidden"?: boolean }>> = {
  youtube: FaYoutube,
  instagram: FaInstagram,
  x: FaXTwitter,
  website: FaGlobe,
};

const SITE: Record<SocialType, string> = {
  youtube: "on YouTube",
  instagram: "on Instagram",
  x: "on X",
  website: "website",
};

/** "Placeholder client 01 on YouTube", "Placeholder client 01 website". */
export function socialLabel(name: string, type: SocialType): string {
  return `${name} ${SITE[type]}`;
}

/**
 * A client's links as a row of icons, each its own link that opens in a new tab. They show when
 * the client is hovered, focused or (on touch) tapped once; the page's CSS decides when.
 */
export default function ClientSocials({ client }: { client: WorkClient }) {
  if (client.socials.length === 0) return null;
  return (
    <span className="client-socials">
      {client.socials.map((s) => {
        const Icon = ICON[s.type];
        return (
          <a
            key={`${s.type}-${s.url}`}
            className="client-social"
            href={s.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={socialLabel(client.name, s.type)}
          >
            <Icon aria-hidden={true} />
          </a>
        );
      })}
    </span>
  );
}
