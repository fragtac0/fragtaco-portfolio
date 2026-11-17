import type { LinksFunction, MetaFunction } from "@remix-run/node";
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLocation,
  useNavigate,
  useRouteLoaderData,
} from "@remix-run/react";
import { useEffect, useLayoutEffect, type PropsWithChildren } from "react";
import SpineFonts from "./components/spine-fonts";
import PageViewTracker from "./components/page-view-tracker";
import { preloadImage } from "./components/home/hero/painting-cycle";
import { recallPainting } from "./components/home/hero/painting-memory";
import { INTRO_HEAD_SCRIPT } from "./lib/intro-session";
import GlassFilter from "./components/page-change/glass-filter";
import { prepareGlassWhenIdle } from "./components/page-change/glass-prepare";
import { watchPresses } from "./lib/change-finish";
import { watchHistory } from "./lib/history-change";
import { changePage, finishChange, isPageSettled, pageCommitted } from "./lib/page-change";
import glassHref from "./components/page-change/glass.css?url";
import pageTransitionHref from "./components/page-transition.css?url";
import { FONT_PRELOADS, INTERFACE_FONT_SHEETS } from "./styles/fonts";
import appStylesHref from "./styles/tailwind.css?url";
import tokensHref from "./styles/tokens.css?url";
import type { loader as homeLoader } from "./routes/_index";

export const links: LinksFunction = () => [
  // fonts from the site's own origin (styles/fonts.ts); a preloaded font file (none today, see FONT_PRELOADS) needs crossorigin even here
  ...(FONT_PRELOADS.root ?? []).map((href) => ({ rel: "preload", href, as: "font", type: "font/woff2", crossOrigin: "anonymous" as const })),
  ...INTERFACE_FONT_SHEETS.map((href) => ({ rel: "stylesheet", href })),
  { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
  { rel: "icon", type: "image/png", sizes: "64x64", href: "/favicon.png" },
  { rel: "shortcut icon", href: "/favicon.ico" },
  { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
  { rel: "stylesheet", href: appStylesHref },
  { rel: "stylesheet", href: tokensHref },
  { rel: "stylesheet", href: pageTransitionHref },
  { rel: "stylesheet", href: glassHref },
];

export const meta: MetaFunction = () => [
  { title: "FragTaco - Aditya Bhoir" },
  {
    name: "description",
    content:
      "Portfolio of Aditya Bhoir (FragTaco), a video editor and content head from Mumbai, working remote, with 6+ years on the timeline.",
  },
];

export function Layout({ children }: PropsWithChildren) {
  // The loader lock (`intro` on <html>) is only ever removed by the home hero, so the script
  // that adds it before first paint is rendered on the home route alone.
  // <html> carries suppressHydrationWarning because that script adds `intro` before hydration.
  const isHome = useLocation().pathname === "/";
  // The painting the home loader picked, preloaded from the HTML with high priority. When the hero
  // already remembers a painting (a client-side return to "/") that one is shown instead, so the
  // pick is not fetched for nothing. On the server and during hydration nothing is remembered yet,
  // so both render the link.
  const home = useRouteLoaderData<typeof homeLoader>("routes/_index");
  const firstPainting = isHome
    ? home?.heroPaintings.find((p) => p.id === home.firstPaintingId)
    : undefined;
  const preload = firstPainting && !recallPainting() ? preloadImage(firstPainting.file) : null;

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {isHome ? <script dangerouslySetInnerHTML={{ __html: INTRO_HEAD_SCRIPT }} /> : null}
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        {preload ? <link {...preload} /> : null}
        <Links />
        <SpineFonts />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  // The page change (app/lib/page-change.ts) waits for the new page to be in the DOM: tell it when it is.
  const { key, pathname } = useLocation();
  useLayoutEffect(() => pageCommitted(pathname), [key, pathname]);
  // Back and Forward get the same change as a click.
  useEffect(() => watchHistory(), []);
  // The first press or key press during a change finishes it (change-finish.ts).
  useEffect(() => watchPresses(), []);
  // The glass front's pictures (tiles for its edge, glow and shade, and the bend's): made in idle time once the first page is up,
  // and not at all under reduced motion or without View Transitions.
  useEffect(() => prepareGlassWhenIdle(), []);
  // A test hook for the audit scripts (set sessionStorage "ft:debug-change" to "1"): runs a page change.
  const navigate = useNavigate();
  useEffect(() => {
    try {
      if (sessionStorage.getItem("ft:debug-change") !== "1") return;
    } catch {
      return;
    }
    const w = window as {
      __ftChange?: (to: string) => Promise<void>;
      __ftSettled?: () => boolean;
      __ftFinish?: () => void;
    };
    // only this site's own paths
    w.__ftChange = (to) => (to.startsWith("/") && !to.startsWith("//") ? changePage(navigate, to) : Promise.resolve());
    w.__ftSettled = isPageSettled;
    w.__ftFinish = finishChange;
    return () => {
      delete w.__ftChange;
      delete w.__ftSettled;
      delete w.__ftFinish;
    };
  }, [navigate]);

  return (
    <>
      {/* first in the page, so the change's glow and shade sit below the dock (the shade over the glow); see page-change/glass.css */}
      <div data-glass-glow aria-hidden="true" />
      <div data-glass-shade aria-hidden="true" />
      <GlassFilter />
      <PageViewTracker />
      <Outlet />
    </>
  );
}
