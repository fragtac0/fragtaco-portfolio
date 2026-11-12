import { useEffect } from "react";

// The six faces of the book spines (art, not interface). Only the shelf uses them, so their stylesheet
// must not hold up the first paint: it is linked with media="print" (fetched, never blocking) and switched
// to "all" once the page is up. Without scripts the <noscript> link loads it the plain way.
export const SPINE_FONTS_HREF =
  "https://fonts.googleapis.com/css2?family=Archivo:ital,wdth,wght@0,62..125,100..900;1,62..125,100..900&family=Bodoni+Moda:ital,opsz,wght@0,6..96,400..900;1,6..96,400..900&family=Newsreader:ital,opsz,wght@0,6..72,300..800;1,6..72,300..800&family=Space+Grotesk:wght@300..700&family=Unbounded:wght@300..900&family=Young+Serif&display=swap";

export default function SpineFonts() {
  // After hydration (never on the server): React leaves the attribute alone, so setting it here is safe,
  // and it avoids a string onLoad handler, which React rejects.
  useEffect(() => {
    const link = document.querySelector<HTMLLinkElement>("link[data-spine-fonts]");
    if (!link) return;
    const on = () => {
      link.media = "all";
    };
    if (link.sheet) {
      on();
      return;
    }
    link.addEventListener("load", on, { once: true });
    return () => link.removeEventListener("load", on);
  }, []);

  return (
    <>
      <link rel="stylesheet" href={SPINE_FONTS_HREF} media="print" data-spine-fonts="" />
      <noscript>
        <link rel="stylesheet" href={SPINE_FONTS_HREF} />
      </noscript>
    </>
  );
}
