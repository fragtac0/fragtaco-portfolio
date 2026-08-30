import {
  getClientsSection,
  getFactsSection,
  getHeroPaintings,
  getHomeContent,
  getNavigationItems,
  getProjectsSection,
  getReachOutSection,
  getSocialLinks,
  getTechStackSection,
  getWorkExperienceSection,
} from "./site-content.server";

export async function getHomePageContent() {
  const [home, facts, heroPaintings, navigationItems, socialLinks] =
    await Promise.all([
      getHomeContent(),
      getFactsSection(),
      getHeroPaintings(),
      getNavigationItems(),
      getSocialLinks(),
    ]);

  return {
    home,
    facts,
    heroPaintings,
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
