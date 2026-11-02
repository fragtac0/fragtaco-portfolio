import { useCallback, useEffect, useReducer, useRef } from "react";
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
  const onHeroReady = useCallback(() => dispatch({ kind: "show" }), [dispatch]);

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
      <div className="below-wrap">
        <SiteNav currentPage="home" items={navigationItems} socialLinks={socialLinks} />
      </div>
    </main>
  );
}
