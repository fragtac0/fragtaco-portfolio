import lockupSvg from "./fragtaco-lockup.svg?raw";

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
 * The centred lockup in its pre-loader state (everything hidden). The hero's loader adds and
 * removes classes on these elements through refs: `grow`, `in`, `out` on the big name, `in` and
 * `reset` on the logo, `on` on the small name and the roles.
 */
export default function Lockup({ name, roles }: LockupProps) {
  return (
    <div className="lockup">
      <div className="slot">
        <h1 className="name-small">{name}</h1>
        <div className="name-big" aria-hidden="true">
          {Array.from(name).map((ch, i) => (
            <span key={i}>{ch === " " ? " " : ch}</span>
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
