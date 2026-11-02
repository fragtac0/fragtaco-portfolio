import { json, type LinksFunction, type MetaFunction } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { getHomePageContent } from "../content/loaders.server";
import AboutSection from "../components/home/about-section";
import HeroSection from "../components/home/hero-section";
import SiteNav from "../components/site-nav";

export const meta: MetaFunction = () => [
  { title: "FragTaco — Aditya Bhoir" },
];

// Preload only the server-rendered hero painting (the first manifest entry).
// The client may swap to a random pick, but this keeps the initial paint fast.
// Keep this href in sync with the first item in content/site/hero-paintings.json.
export const links: LinksFunction = () => [
  { rel: "preload", as: "image", href: "/paintings/school-of-athens.jpg" },
];

export async function loader() {
  const homePageContent = await getHomePageContent();

  return json(
    {
      ...homePageContent,
    },
    {
      headers: {
        "Cache-Control": "private, max-age=900",
      },
    },
  );
}

export default function Index() {
  const {
    home,
    facts,
    heroPaintings,
    navigationItems,
    socialLinks,
  } = useLoaderData<typeof loader>();

  return (
    <main className="bg-ink text-fog">
      <HeroSection
        title={home.hero.name}
        subtitle={home.hero.roles}
        paintings={heroPaintings}
      />
      <SiteNav currentPage="home" items={navigationItems} socialLinks={socialLinks} />
      <AboutSection
        paragraphs={home.about.paragraphs}
        facts={facts}
        credits={home.credits}
      />
    </main>
  );
}
