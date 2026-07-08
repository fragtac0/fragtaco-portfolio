import {
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
  const [home, heroPaintings, navigationItems, socialLinks] =
    await Promise.all([
      getHomeContent(),
      getHeroPaintings(),
      getNavigationItems(),
      getSocialLinks(),
    ]);

  return {
    home,
    heroPaintings,
    navigationItems,
    socialLinks,
  };
}

export async function getWorkPageContent() {
  const [
    navigationItems,
    projects,
    reachOut,
    socialLinks,
    techStack,
    workExperience,
  ] = await Promise.all([
    getNavigationItems(),
    getProjectsSection(),
    getReachOutSection(),
    getSocialLinks(),
    getTechStackSection(),
    getWorkExperienceSection(),
  ]);

  return {
    navigationItems,
    projects,
    reachOut,
    socialLinks,
    techStack,
    workExperience,
  };
}
