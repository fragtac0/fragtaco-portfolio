import {
  getBooks,
  getClientsSection,
  getHeroPaintings,
  getHomeContent,
  getNavigationItems,
  getProjectsSection,
  getReachOutSection,
  getSocialLinks,
  getTechStackSection,
  getVideos,
  getWorkExperienceSection,
} from "./site-content.server";

export async function getHomePageContent() {
  const [home, heroPaintings, books, videosFile, navigationItems, socialLinks] =
    await Promise.all([
      getHomeContent(),
      getHeroPaintings(),
      getBooks(),
      getVideos(),
      getNavigationItems(),
      getSocialLinks(),
    ]);

  return {
    home,
    heroPaintings,
    books,
    videos: videosFile.items,
    navigationItems,
    socialLinks,
  };
}

export async function getWorkPageContent() {
  const [
    clients,
    navigationItems,
    projects,
    reachOut,
    socialLinks,
    techStack,
    workExperience,
  ] = await Promise.all([
    getClientsSection(),
    getNavigationItems(),
    getProjectsSection(),
    getReachOutSection(),
    getSocialLinks(),
    getTechStackSection(),
    getWorkExperienceSection(),
  ]);

  return {
    clients,
    navigationItems,
    projects,
    reachOut,
    socialLinks,
    techStack,
    workExperience,
  };
}
