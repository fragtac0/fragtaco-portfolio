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
import PageViewTracker from "./components/page-view-tracker";
import { preloadImage } from "./components/home/hero/painting-cycle";
import { recallPainting } from "./components/home/hero/painting-memory";
import { INTRO_HEAD_SCRIPT } from "./lib/intro-session";
import GlassFilter from "./components/page-change/glass-filter";
import { prepareGlassWhenIdle } from "./components/page-change/glass-run";
import { changePage, isPageSettled, pageCommitted, watchHistory, type ChangeKind, type Point } from "./lib/page-change";
import glassHref from "./components/page-change/glass.css?url";
import pageTransitionHref from "./components/page-transition.css?url";
import appStylesHref from "./styles/tailwind.css?url";
import tokensHref from "./styles/tokens.css?url";
import type { loader as homeLoader } from "./routes/_index";

export const links: LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Doto:wght@400..900&family=IBM+Plex+Mono:wght@400;500;600&family=Lora:wght@500;600;700&family=Space+Mono:ital,wght@0,400;0,700;1,400&family=Tektur:wght@500;600;700;800&display=swap",
  },
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
  // The glass front's bend needs two small pictures; make them once the first page is up.
  useEffect(() => prepareGlassWhenIdle(), []);
  // A test hook for the audit scripts (set sessionStorage "ft:debug-change" to "1"): runs a page change of any kind.
  const navigate = useNavigate();
  useEffect(() => {
    try {
      if (sessionStorage.getItem("ft:debug-change") !== "1") return;
    } catch {
      return;
    }
    const w = window as {
      __ftChange?: (to: string, kind?: ChangeKind, origin?: Point) => Promise<void>;
      __ftSettled?: () => boolean;
    };
    // only this site's own paths
    w.__ftChange = (to, kind, origin) =>
      to.startsWith("/") && !to.startsWith("//") ? changePage(navigate, to, { kind, origin }) : Promise.resolve();
    w.__ftSettled = isPageSettled;
    return () => {
      delete w.__ftChange;
      delete w.__ftSettled;
    };
  }, [navigate]);

  return (
    <>
      {/* first in the page, so the change's line sits below the dock; see page-change/glass.css */}
      <div data-glass-line aria-hidden="true" />
      <GlassFilter />
      <PageViewTracker />
      <Outlet />
    </>
  );
}
