import type {
  SiteBook,
  SiteHeroPainting,
  SiteHomeContent,
  SiteNavigationItem,
  SiteSocialLink,
  SiteVideo,
} from "../../types";
import SiteNav from "../site-nav";
import HeroSection from "./hero-section";

type HomePageProps = {
  home: SiteHomeContent;
  heroPaintings: SiteHeroPainting[];
  books: SiteBook[];
  videos: SiteVideo[];
  navigationItems: SiteNavigationItem[];
  socialLinks: SiteSocialLink[];
};

export default function HomePage({
  home,
  heroPaintings,
  navigationItems,
  socialLinks,
}: HomePageProps) {
  return (
    <main className="bg-ink text-fog">
      <HeroSection
        title={home.hero.name}
        subtitle={home.hero.roles}
        paintings={heroPaintings}
      />
      <SiteNav currentPage="home" items={navigationItems} socialLinks={socialLinks} />
    </main>
  );
}
