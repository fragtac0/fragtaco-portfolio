import type { MetaFunction } from "@remix-run/node";
import { useRouteLoaderData } from "@remix-run/react";
import WallPage from "../components/work/wall-page";
import type { loader as workLoader } from "./work";

export const meta: MetaFunction = () => [
  { title: "Short form - FragTaco" },
];

export default function WorkShortForm() {
  const data = useRouteLoaderData<typeof workLoader>("routes/work");

  if (!data) return null;

  return <WallPage kind="short" videos={data.work.shortForm} />;
}
