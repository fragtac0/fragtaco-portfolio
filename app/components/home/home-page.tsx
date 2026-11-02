import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import type {
  SiteBook,
  SiteHeroPainting,
  SiteHomeContent,
  SiteNavigationItem,
  SiteSocialLink,
  SiteVideo,
} from "../../types";
import SiteNav from "../site-nav";
import HeroCards from "./cards/hero-cards";
import { heroNav, type NavContext, type NavInput, type NavState } from "./cards/hero-nav";
import Hero, { type HeroHandle } from "./hero/hero";

type HomePageProps = {
  home: SiteHomeContent;
  heroPaintings: SiteHeroPainting[];
  books: SiteBook[];
  videos: SiteVideo[];
  navigationItems: SiteNavigationItem[];
  socialLinks: SiteSocialLink[];
};

/** Each dispatch carries the context it was made in, so the reducer stays pure. */
type NavAction = { input: NavInput; ctx: NavContext };
const navReducer = (state: NavState, { input, ctx }: NavAction): NavState =>
  heroNav(state, input, ctx);

export default function HomePage({
  home,
  heroPaintings,
  navigationItems,
  socialLinks,
}: HomePageProps) {
  const heroRef = useRef<HeroHandle>(null);
  const [nav, dispatchNav] = useReducer(navReducer, "hidden");
  // The gesture gate: the cards hook keeps heroVisible current; a later task sets layerOpen.
  const navCtx = useRef<NavContext>({ heroVisible: true, layerOpen: false });
  const dispatch = useCallback(
    (input: NavInput) => dispatchNav({ input, ctx: { ...navCtx.current } }),
    [],
  );
  const onHeroReady = useCallback(() => {
    dispatch({ kind: "show" });
    // Arriving at /#about (a reload, or "the cut" from /work): open the intro card, then drop
    // the hash so it does not linger. Remix keeps its bookkeeping in history.state: keep it.
    if (window.location.hash === "#about") {
      dispatch({ kind: "go", to: "right" });
      window.history.replaceState(
        window.history.state,
        "",
        window.location.pathname + window.location.search,
      );
    }
  }, [dispatch]);

  // The dock rises with the cards, the first time the hero leaves "hidden".
  const [revealed, setRevealed] = useState(false);
  if (!revealed && nav !== "hidden") setRevealed(true);

  // "the cut": scroll to the top first when needed, wait for it, then toggle the intro card.
  const aboutTimer = useRef<number | null>(null);
  const onAbout = useCallback(() => {
    if (aboutTimer.current !== null) window.clearTimeout(aboutTimer.current);
    const toggle = () => {
      aboutTimer.current = null;
      dispatch({ kind: "toggle", side: "right" });
    };
    if (window.scrollY > 10) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      aboutTimer.current = window.setTimeout(toggle, 520);
    } else {
      toggle();
    }
  }, [dispatch]);
  useEffect(
    () => () => {
      if (aboutTimer.current !== null) window.clearTimeout(aboutTimer.current);
    },
    [],
  );

  const open = nav === "left" || nav === "right";
  useEffect(() => {
    heroRef.current?.setBlur(open ? 1 : 0);
    heroRef.current?.setParked("card", open);
  }, [open]);

  return (
    <main className="home-page bg-ink text-fog">
      <Hero
        ref={heroRef}
        name={home.hero.name}
        roles={home.hero.roles}
        paintings={heroPaintings}
        softened={open}
        onReady={onHeroReady}
      >
        <HeroCards
          about={home.about}
          credits={home.credits}
          nav={nav}
          dispatch={dispatch}
          hero={heroRef}
          navCtx={navCtx}
        />
      </Hero>
      <SiteNav
        items={navigationItems}
        socialLinks={socialLinks}
        home={{
          revealed,
          hidden: false, // a later task passes the layer state
          aboutOpen: nav === "right",
          onAbout,
        }}
      />
    </main>
  );
}
