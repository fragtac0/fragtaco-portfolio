import {
  getBooks,
  getHeroPaintings,
  getHomeContent,
  getNavigationItems,
  getSocialLinks,
  getVideos,
  getWork,
} from "./site-content.server";

/**
 * The home page's content. `random` picks the first painting (the server's pick, so the HTML can
 * preload it); only that painting keeps its blurred placeholder in the response, which is the only
 * one the hero can need up front (the others are never shown before their sharp copy loads).
 */
export async function getHomePageContent(random: () => number = Math.random) {
  const [home, heroPaintings, books, videosFile, navigationItems, socialLinks] =
    await Promise.all([
      getHomeContent(),
      getHeroPaintings(),
      getBooks(),
      getVideos(),
      getNavigationItems(),
      getSocialLinks(),
    ]);

  const first =
    heroPaintings[Math.min(heroPaintings.length - 1, Math.floor(random() * heroPaintings.length))];
  const firstPaintingId = first?.id ?? "";

  return {
    home,
    firstPaintingId,
    heroPaintings: heroPaintings.map((p) => (p.id === firstPaintingId ? p : { ...p, blur: "" })),
    books,
    videos: videosFile.items,
    navigationItems,
    socialLinks,
  };
}

export async function getWorkPageContent() {
  const [work, navigationItems, socialLinks] = await Promise.all([
    getWork(),
    getNavigationItems(),
    getSocialLinks(),
  ]);

  return { work, navigationItems, socialLinks };
}
