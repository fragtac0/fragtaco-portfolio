import { json, type MetaFunction } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { getHomePageContent } from "../content/loaders.server";
import HomePage from "../components/home/home-page";

export const meta: MetaFunction = () => [
  { title: "FragTaco — Aditya Bhoir" },
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
