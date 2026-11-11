import { json, type HeadersFunction, type MetaFunction } from "@remix-run/node";
import type { ShouldRevalidateFunction } from "@remix-run/react";
import { useLoaderData } from "@remix-run/react";
import WorkPage from "../components/work/work-page";
import { getWorkPageContent } from "../content/loaders.server";

export const meta: MetaFunction = () => [
  { title: "Work - FragTaco" },
];

export const headers: HeadersFunction = ({ loaderHeaders }) => ({
  "Cache-Control": loaderHeaders.get("Cache-Control") ?? "private, no-cache",
});

// The view (`?view=long`) is only a way of looking at the same content, so changing it does not need the
// page's data again: the view changes at once and Back is instant.
export const shouldRevalidate: ShouldRevalidateFunction = ({ currentUrl, nextUrl, defaultShouldRevalidate }) =>
  currentUrl.pathname === nextUrl.pathname ? false : defaultShouldRevalidate;

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

export default function Work() {
  const data = useLoaderData<typeof loader>();

  return <WorkPage {...data} />;
}
