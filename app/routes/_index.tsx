import { json, type MetaFunction } from "@remix-run/node";
import { useLoaderData, type ShouldRevalidateFunction } from "@remix-run/react";
import { getHomePageContent } from "../content/loaders.server";
import HomePage from "../components/home/home-page";
import { isHashOnlyMove } from "../lib/revalidate";

export const meta: MetaFunction = () => [
  { title: "FragTaco — Aditya Bhoir" },
];

// Hash-only history moves (the reading / watching layer's /#reading and /#watching) must not
// re-run this loader.
export const shouldRevalidate: ShouldRevalidateFunction = ({
  currentUrl,
  nextUrl,
  defaultShouldRevalidate,
}) => (isHashOnlyMove(currentUrl, nextUrl) ? false : defaultShouldRevalidate);

export async function loader() {
  const homePageContent = await getHomePageContent();

  return json(
    {
      ...homePageContent,
    },
    {
      headers: {
        "Cache-Control": "private, max-age=900",
      },
    },
  );
}

export default function Index() {
  const data = useLoaderData<typeof loader>();

  return <HomePage {...data} />;
}
