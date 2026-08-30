import { useState } from "react";
import type { SiteClient } from "../../types";

interface ClientTileProps {
  client: SiteClient;
  ariaHidden?: boolean;
}

export default function ClientTile({ client, ariaHidden }: ClientTileProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const hasImage = !imageFailed;

  const content = (
    <>
      {hasImage ? (
        <img
          src={client.image}
          alt=""
          draggable={false}
          // A 404 that resolves before hydration attaches its listeners
          // fires (and bubbles past) before onError exists to catch it —
          // the same race hero-section.tsx's onLoad already works around.
          // The ref callback catches an already-failed image on mount;
          // onError still covers one that fails after that.
          ref={(node) => {
            if (node && node.complete && node.naturalWidth === 0) {
              setImageFailed(true);
            }
          }}
          onError={() => setImageFailed(true)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        // Never a broken <img> — a neutral tile with a plain label covers
        // the empty state until real logos land.
        <div className="absolute inset-0 flex items-center justify-center bg-steel">
          <span className="font-mono text-[0.62rem] uppercase tracking-[0.2em] text-fog/30">
            PLACEHOLDER
          </span>
        </div>
      )}

      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-1/2 bg-[linear-gradient(to_top,rgba(0,0,0,0.72),transparent)]"
      />
      <span className="absolute inset-x-0 bottom-0 truncate px-3 pb-2 font-mono text-[0.62rem] uppercase tracking-[0.18em] text-fog">
        {client.name}
      </span>

      {/* Hover/focus overlay — opacity only, layout-neutral per R10. */}
      <div className="absolute inset-0 flex items-center justify-center bg-accent/72 opacity-0 transition-opacity duration-[220ms] group-hover:opacity-100 group-focus-visible:opacity-100">
        <span className="font-mono text-[0.78rem] uppercase tracking-[0.16em] text-white">
          {client.handle}
        </span>
      </div>
    </>
  );

  const className =
    "group relative block aspect-video w-[15rem] shrink-0 overflow-hidden rounded-[0.75rem_1.5rem_0.75rem_1.5rem] ring-1 ring-fog/10 sm:w-[16.5rem] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gilt/70";

  if (client.url) {
    return (
      <a
        href={client.url}
        target="_blank"
        rel="noopener"
        aria-label={`${client.name} — ${client.handle}`}
        aria-hidden={ariaHidden}
        tabIndex={ariaHidden ? -1 : undefined}
        className={className}
      >
        {content}
      </a>
    );
  }

  // No dead links — a client without a url renders as a plain, non-
  // interactive tile.
  return (
    <div aria-hidden={ariaHidden} className={className}>
      {content}
    </div>
  );
}
