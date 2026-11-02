import type {
  SiteBook,
  SiteHeroPainting,
  SiteHomeContent,
  SiteNavigationItem,
  SiteSocialLink,
  SiteVideo,
} from "../../types";
import SiteNav from "../site-nav";
import Hero from "./hero/hero";

type HomePageProps = {
  home: SiteHomeContent;
  heroPaintings: SiteHeroPainting[];
  books: SiteBook[];
  videos: SiteVideo[];
  navigationItems: SiteNavigationItem[];
  socialLinks: SiteSocialLink[];
};

// Nothing needs the loader's end yet; the cards and dock tasks hang their entrance on it.
const onHeroReady = () => undefined;

export default function HomePage({
  home,
  heroPaintings,
  navigationItems,
  socialLinks,
}: HomePageProps) {
  return (
    <main className="home-page bg-ink text-fog">
      <Hero
        name={home.hero.name}
        roles={home.hero.roles}
        paintings={heroPaintings}
        softened={false}
        onReady={onHeroReady}
      />
      <div className="below-wrap">
        <SiteNav currentPage="home" items={navigationItems} socialLinks={socialLinks} />
      </div>
    </main>
  );
}
