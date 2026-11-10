import { json, type MetaFunction } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import ProjectsSection from "../components/projects/projects-section";
import SiteNav from "../components/site-nav";
import { getWorkPageContent } from "../content/loaders.server";

export const meta: MetaFunction = () => [
  { title: "Work - FragTaco" },
];

export async function loader() {
  const workPageContent = await getWorkPageContent();

  return json(
    {
      ...workPageContent,
    },
    {
      headers: {
        "Cache-Control": "private, max-age=900",
      },
    },
  );
}

export default function WorkPage() {
  const {
    clients,
    navigationItems,
    projects,
    reachOut,
    socialLinks,
    techStack,
    workExperience,
  } = useLoaderData<typeof loader>();

  return (
    <main className="bg-ink text-white">
      <SiteNav items={navigationItems} socialLinks={socialLinks} />
      <ProjectsSection
        clients={clients}
        projects={projects}
        reachOut={reachOut}
        techStack={techStack}
        workExperience={workExperience}
      />
    </main>
  );
}
