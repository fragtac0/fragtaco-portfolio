import { PrefetchPageLinks, useLocation, useNavigate } from "@remix-run/react";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import type { ComponentType, ReactNode } from "react";
import type { SiteNavigationItem, SiteSocialLink } from "../types";
import DockNav from "./react-bits/dock-nav";
import { useDockRowOpen } from "./use-dock-row";
import "./dock-row.css";
import { inertProps } from "../utils/inert";
import { externalLinkProps } from "../utils/link";
import { activeNavKey, isHomeSectionId } from "../utils/nav";
import {
  FaInstagram,
  FaRegEnvelope,
  FaXTwitter,
  FaYoutube,
} from "react-icons/fa6";

/** The home page drives the dock: it stays down until `revealed`, hides while the layer is open,
 * and the home tab calls `onHome` (close a card or layer, scroll to the top) instead of navigating.
 * Other pages pass no `home`, so the home tab is then an ordinary link to `/`. */
export interface SiteNavHome {
  revealed: boolean;
  hidden: boolean;
  onHome: () => void;
}

interface SiteNavProps {
  items: SiteNavigationItem[];
  socialLinks: SiteSocialLink[];
  home?: SiteNavHome;
  /** A second row of controls inside the same glass, above the tabs (the work page's switcher). The
   * dock looks as it always did without one. */
  upperRow?: ReactNode;
}

const SOCIAL_ICON_MAP: Record<
  string,
  ComponentType<{ className?: string }>
> = {
  instagram: FaInstagram,
  mail: FaRegEnvelope,
  x: FaXTwitter,
  youtube: FaYoutube,
};

const SOCIAL_ICON_CLASS_MAP: Record<string, string> = {
  instagram: "h-6 w-6 sm:h-7 sm:w-7",
  mail: "h-5 w-5 sm:h-6 sm:w-6",
  x: "h-5 w-5 sm:h-5.5 sm:w-5.5",
  youtube: "h-6 w-6 sm:h-7 sm:w-7",
};

export default function SiteNav({
  items,
  socialLinks,
  home,
  upperRow,
}: SiteNavProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const hideTimeoutRef = useRef<number | null>(null);
  const tickingRef = useRef(false);
  const [isDockHidden, setIsDockHidden] = useState(false);
  // Set once a pointer (a mouse or a finger) or the keyboard reaches the dock: from then on the other tabs' pages
  // preload at once (a <Link prefetch="intent"> alone waits 100 ms, and a tap does not last that long).
  const [dockReached, setDockReached] = useState(false);
  const reachDock = () => setDockReached(true);
  // The second row opens after a page change is over and closes when the next one starts.
  const rowOpen = useDockRowOpen();
  const isHomePage = location.pathname === "/";
  // One row is a pill; two rows are a rounded panel, or the pill's ends would cut into the upper row.
  const shape = upperRow ? "rounded-[1.75rem]" : "rounded-full";
  const visibleItems = items.filter(
    (item): item is SiteNavigationItem => item.key === "home" || item.key === "work",
  );
  const visibleSocialLinks = socialLinks.filter((link) =>
    Object.hasOwn(SOCIAL_ICON_MAP, link.label.toLowerCase()),
  );

  const activeKey = activeNavKey(location.pathname);
  // Until the cards rise, and while the layer is open, the dock is down and out of the tab order.
  const isDockDown = home ? !home.revealed || home.hidden : false;

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      setIsDockHidden(false);
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [location.pathname]);

  useEffect(() => {
    const nav = document.querySelector("header[data-site-nav]");

    if (!nav) {
      return;
    }

    const updateNavHeight = () => {
      // The dock's full height: the second row counts as open even while it is closed or opening, so
      // what is sized from this (the work page's fades) does not change when the row arrives.
      const clip = nav.querySelector<HTMLElement>(".dock-row-clip");
      const height = nav.getBoundingClientRect().height + (clip ? clip.scrollHeight - clip.offsetHeight : 0);
      document.documentElement.style.setProperty("--site-nav-height", `${height}px`);
    };

    updateNavHeight();
    window.addEventListener("resize", updateNavHeight);

    return () => {
      window.removeEventListener("resize", updateNavHeight);
    };
  }, []);

  const handleClick = (
    event: MouseEvent<HTMLAnchorElement>,
    item: SiteNavigationItem,
  ) => {
    // Only the home tab, pressed on the home page, is handled here; every other tab is a plain link.
    if (item.key !== "home" || !home || !isHomePage) return;
    // Let a new-tab or new-window click through.
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;

    event.preventDefault();
    home.onHome();
  };

  useEffect(() => {
    if (location.pathname === "/work" || location.pathname.startsWith("/work/")) {
      const sectionId = location.hash.slice(1);

      if (isHomeSectionId(sectionId)) {
        navigate(`/#${sectionId}`, { replace: true });
      }
    }
  }, [location.hash, location.pathname, navigate]);

  useEffect(() => {
    const updateDockVisibility = () => {
      const currentScrollY = window.scrollY;

      if (hideTimeoutRef.current) {
        window.clearTimeout(hideTimeoutRef.current);
      }

      if (currentScrollY < 24) {
        setIsDockHidden(false);
      } else {
        setIsDockHidden(true);
        hideTimeoutRef.current = window.setTimeout(() => {
          setIsDockHidden(false);
        }, 560);
      }

      tickingRef.current = false;
    };

    const handleScroll = () => {
      if (tickingRef.current) {
        return;
      }

      tickingRef.current = true;
      window.requestAnimationFrame(updateDockVisibility);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (hideTimeoutRef.current) {
        window.clearTimeout(hideTimeoutRef.current);
      }
    };
  }, []);

  return (
    <header
      className={`pointer-events-none fixed inset-x-0 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-30 flex w-full justify-center px-2 transition-transform duration-300 ease-out sm:bottom-6 sm:px-3 ${
        isDockHidden || isDockDown ? "translate-y-[calc(100%+2rem)]" : "translate-y-0"
      }`}
      data-site-nav
      {...inertProps(isDockDown)}
    >
      <div
        data-dock-glass
        onPointerEnter={reachDock}
        onPointerDown={reachDock}
        onFocus={reachDock}
        className={`pointer-events-auto relative max-w-[calc(100vw-1rem)] overflow-hidden ${shape} border border-fog/14 bg-[rgba(17,12,8,0.46)] p-1 shadow-nav-glass backdrop-blur-2xl sm:max-w-full sm:p-1.5`}>
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute inset-0 ${shape} bg-[linear-gradient(180deg,rgba(255,236,214,0.16),rgba(255,236,214,0.04)_42%,rgba(0,0,0,0.14))]`}
        />
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute inset-px ${shape} border border-black/20`}
        />

        {upperRow ? (
          <div className="dock-row" data-open={rowOpen} {...inertProps(!rowOpen)}>
            <div className="dock-row-clip">
              <div className="relative mb-1 flex max-w-full items-center justify-start overflow-x-auto border-b border-white/10 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] sm:mb-1.5 sm:justify-center sm:overflow-visible sm:pb-1.5 [&::-webkit-scrollbar]:hidden">
                {upperRow}
              </div>
            </div>
          </div>
        ) : null}

        <nav
          aria-label="Primary"
          className="relative flex max-w-full items-center justify-start gap-1 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] sm:justify-center sm:gap-1.5 sm:overflow-visible [&::-webkit-scrollbar]:hidden"
        >
          <DockNav
            items={visibleItems}
            activeKey={activeKey}
            pathname={location.pathname}
            onItemClick={handleClick}
          />
          {visibleSocialLinks.length > 0 ? (
            <>
              <span
                aria-hidden="true"
                className="h-7 w-px shrink-0 bg-white/10"
              />
              <div className="flex shrink-0 items-center gap-0.5 pr-0.5 sm:gap-1 sm:pr-1">
                {visibleSocialLinks.map((link) => {
                  const iconKey = link.label.toLowerCase();
                  const Icon = SOCIAL_ICON_MAP[iconKey];
                  const iconClassName =
                    SOCIAL_ICON_CLASS_MAP[iconKey] ?? "h-6 w-6";

                  return (
                    <a
                      key={link.label}
                      aria-label={link.label}
                      className="flex h-9 w-9 max-[339px]:h-8 max-[339px]:w-8 shrink-0 items-center justify-center rounded-full text-white/68 outline-none transition-colors duration-150 hover:text-white focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-fog sm:h-11 sm:w-11"
                      href={link.url}
                      {...externalLinkProps(link.url)}
                    >
                      <Icon className={iconClassName} />
                    </a>
                  );
                })}
              </div>
            </>
          ) : null}
        </nav>
      </div>
      {dockReached
        ? visibleItems
            .filter((item) => item.href !== location.pathname)
            .map((item) => <PrefetchPageLinks key={item.key} page={item.href} />)
        : null}
    </header>
  );
}
