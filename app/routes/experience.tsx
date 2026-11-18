import { json, type HeadersFunction, type LinksFunction, type MetaFunction } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import ExperiencePage from "../components/experience/experience-page";
import { PHONE_MEDIA, RELIEF_PHONE_SRC, RELIEF_SRC, ROOMY_MEDIA } from "../components/experience/experience-map";
import WorkShell from "../components/work/work-shell";
import { getExperiencePageContent } from "../content/loaders.server";

// The toned picture is the map's first paint, so it is asked for from the HTML (and, through Remix's prefetch, when the dock row's
// link is hovered): the smaller one on a phone, the other elsewhere (the same media query as the picture's own `<source>`). The height
// picture is not preloaded: it is read into the night map at idle once the page change is over, since only My climb needs it.
export const links: LinksFunction = () => [
  { rel: "preload", as: "image", href: RELIEF_PHONE_SRC, type: "image/webp", media: PHONE_MEDIA },
  { rel: "preload", as: "image", href: RELIEF_SRC, type: "image/webp", media: ROOMY_MEDIA },
];

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

// The Mars map, in two states (spec 9). The dock and its row come from WorkShell, so My experience is the current link of the row.
export default function Experience() {
  const { navigationItems, socialLinks, experience } = useLoaderData<typeof loader>();

  return (
    <WorkShell navigationItems={navigationItems} socialLinks={socialLinks} ground={false}>
      <ExperiencePage experience={experience} />
    </WorkShell>
  );
}
