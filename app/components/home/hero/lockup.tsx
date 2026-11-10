import type { CSSProperties } from "react";
import lockupSvg from "./fragtaco-lockup.svg?raw";
import "./loader.css";

// The SVG file is a complete <svg>; the logo element is rendered by React, so only its inner
// markup is injected: the <defs> (fragCut mask), one .gw group (फ्रैग) and four .gl groups (T A C O).
const LOGO_INNER = lockupSvg
  .replace(/^[\s\S]*?<svg\b[^>]*>/, "")
  .replace(/<\/svg>\s*$/, "");

interface LockupProps {
  name: string;
  roles: string;
}

/**
 * The centred lockup in its pre-loader state (everything hidden). The big name's letters carry
 * their index as `--i`, and loader.css animates them from the first paint (under html.intro), so
 * the server's markup is all the name needs and the client must render exactly the same (no
 * remount, no class changes: either would restart the animation). The hero's loader adds and
 * removes classes on the rest through refs: `in` and `reset` on the logo, `on` on the small name
 * and the roles.
 */
export default function Lockup({ name, roles }: LockupProps) {
  return (
    <div className="lockup">
      <div className="slot">
        <h1 className="name-small">{name}</h1>
        <div className="name-big" aria-hidden="true">
          {Array.from(name).map((ch, i) => (
            <span key={i} style={{ "--i": i } as CSSProperties}>
              {ch === " " ? "\u00a0" : ch}
            </span>
          ))}
        </div>
        <svg
          className="logo"
          viewBox="465 227 1228 296"
          role="img"
          aria-label="FragTaco"
          dangerouslySetInnerHTML={{ __html: LOGO_INNER }}
        />
        <p className="roles">{roles}</p>
      </div>
    </div>
  );
}
