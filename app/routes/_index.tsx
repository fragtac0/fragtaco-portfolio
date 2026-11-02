import { json, type LinksFunction, type MetaFunction } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { getHomePageContent } from "../content/loaders.server";
import HomePage from "../components/home/home-page";

export const meta: MetaFunction = () => [
  { title: "FragTaco — Aditya Bhoir" },
];

// Preload only the server-rendered hero painting (the first manifest entry).
// The client may swap to a random pick, but this keeps the initial paint fast.
// Keep this href in sync with the first item in content/site/hero-paintings.json.
export const links: LinksFunction = () => [
  { rel: "preload", as: "image", href: "/paintings/school-of-athens.jpg" },
];

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
