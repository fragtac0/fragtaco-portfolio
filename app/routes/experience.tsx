import { json, type HeadersFunction, type MetaFunction } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import TimelinePage from "../components/timeline/timeline-page";
import WorkShell from "../components/work/work-shell";
import { getTimelinePageContent } from "../content/loaders.server";

export const meta: MetaFunction = () => [
  { title: "My experience - FragTaco" },
];

// The page's own response carries the loader's cache header too (Remix does not pass it on by itself).
export const headers: HeadersFunction = ({ loaderHeaders }) => ({
  "Cache-Control": loaderHeaders.get("Cache-Control") ?? "private, no-cache",
});

// The last square is today (the server's UTC date), so the response must not outlive the day for long:
// private (no shared cache can hand yesterday's page to a visitor tomorrow) and five minutes at most.
export async function loader() {
  const timelinePageContent = await getTimelinePageContent();

  return json(
    {
      ...timelinePageContent,
    },
    {
      headers: {
        "Cache-Control": "private, max-age=300",
      },
    },
  );
}

// For now this is the round 5 timeline (Tasks 17 to 19 replace it with the Mars map). The dock and its
// row come from WorkShell, so My experience is the current link of the row.
export default function Experience() {
  const { navigationItems, socialLinks, ...page } = useLoaderData<typeof loader>();

  return (
    <WorkShell navigationItems={navigationItems} socialLinks={socialLinks} ground={false}>
      <TimelinePage {...page} />
    </WorkShell>
  );
}
