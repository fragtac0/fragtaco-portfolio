import { json, type MetaFunction } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import WorkPage from "../components/work/work-page";
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

export default function Work() {
  const data = useLoaderData<typeof loader>();

  return <WorkPage {...data} />;
}
