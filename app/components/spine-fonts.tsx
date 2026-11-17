import { useEffect } from "react";
import { SPINE_FONT_SHEETS } from "../styles/fonts";

// The six faces of the book spines (art, not interface). Only the shelf uses them, so their stylesheet
// must not hold up the first paint: it is linked with media="print" (fetched, never blocking) and switched
// to "all" once the page is up. Without scripts the <noscript> link loads it the plain way. The sheet is on the site's own
// origin (styles/fonts.ts), so no other server is asked for it or for its font files.
export default function SpineFonts() {
  // After hydration (never on the server): React leaves the attribute alone, so setting it here is safe,
  // and it avoids a string onLoad handler, which React rejects.
  useEffect(() => {
    const links = [...document.querySelectorAll<HTMLLinkElement>("link[data-spine-fonts]")];
    const stops = links.map((link) => {
      const on = () => {
        link.media = "all";
      };
      if (link.sheet) {
        on();
        return () => undefined;
      }
      link.addEventListener("load", on, { once: true });
      return () => link.removeEventListener("load", on);
    });
    return () => stops.forEach((stop) => stop());
  }, []);

  return (
    <>
      {SPINE_FONT_SHEETS.map((href) => (
        <link key={href} rel="stylesheet" href={href} media="print" data-spine-fonts="" />
      ))}
      <noscript>
        {SPINE_FONT_SHEETS.map((href) => (
          <link key={href} rel="stylesheet" href={href} />
        ))}
      </noscript>
    </>
  );
}
