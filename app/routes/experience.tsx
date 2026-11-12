import { json, type HeadersFunction, type LinksFunction, type MetaFunction } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import ExperiencePage from "../components/experience/experience-page";
import WorkShell from "../components/work/work-shell";
import { getExperiencePageContent } from "../content/loaders.server";

// The four level 1 tiles (264 KB together) are the map's first picture: the page shows them as images and the
// canvas draws from them first, so they are asked for from the HTML (and, through Remix's prefetch, when the dock row's
// link is hovered) rather than after the script runs. The finer levels come as the view needs them.
export const links: LinksFunction = () =>
  [0, 1].flatMap((y) =>
    [0, 1].map((x) => ({ rel: "preload", as: "image", href: `/mars/1/${x}_${y}.webp`, type: "image/webp" })),
  );

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

// The Mars map (spec 9). The dock and its row come from WorkShell, so My experience is the current link of the row.
export default function Experience() {
  const { navigationItems, socialLinks, experience, today } = useLoaderData<typeof loader>();

  return (
    <WorkShell navigationItems={navigationItems} socialLinks={socialLinks} ground={false}>
      <ExperiencePage experience={experience} today={today} />
    </WorkShell>
  );
}
