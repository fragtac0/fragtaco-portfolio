import type { LinksFunction, MetaFunction } from "@remix-run/node";
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLocation,
} from "@remix-run/react";
import type { PropsWithChildren } from "react";
import PageViewTracker from "./components/page-view-tracker";
import { INTRO_HEAD_SCRIPT } from "./lib/intro-session";
import appStylesHref from "./styles/tailwind.css?url";
import tokensHref from "./styles/tokens.css?url";

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
];

export const meta: MetaFunction = () => [
  { title: "FragTaco — Aditya Bhoir" },
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

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {isHome ? <script dangerouslySetInnerHTML={{ __html: INTRO_HEAD_SCRIPT }} /> : null}
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
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
  return (
    <>
      <PageViewTracker />
      <Outlet />
    </>
  );
}
