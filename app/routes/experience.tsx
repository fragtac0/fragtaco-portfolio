import { json, type HeadersFunction, type MetaFunction } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import ExperiencePlain from "../components/experience/experience-plain";
import WorkShell from "../components/work/work-shell";
import { getExperiencePageContent } from "../content/loaders.server";

export const meta: MetaFunction = () => [
  { title: "My experience - FragTaco" },
];

// The page's own response carries the loader's cache header too (Remix does not pass it on by itself).
export const headers: HeadersFunction = ({ loaderHeaders }) => ({
  "Cache-Control": loaderHeaders.get("Cache-Control") ?? "private, no-cache",
});

// "Now" is today (the server's UTC date), so the response must not outlive the day for long:
// private (no shared cache can hand yesterday's page to a visitor tomorrow) and five minutes at most.
export async function loader() {
  const content = await getExperiencePageContent();

  return json(content, { headers: { "Cache-Control": "private, max-age=300" } });
}

// A plain page for now (the words and the moments as a list); Task 18 replaces it with the Mars map.
// The dock and its row come from WorkShell, so My experience is the current link of the row.
export default function Experience() {
  const { navigationItems, socialLinks, experience } = useLoaderData<typeof loader>();

  return (
    <WorkShell navigationItems={navigationItems} socialLinks={socialLinks} ground={false}>
      <ExperiencePlain experience={experience} />
    </WorkShell>
  );
}
