import type { MetaFunction } from "@remix-run/node";
import { useRouteLoaderData } from "@remix-run/react";
import WallPage from "../components/work/wall-page";
import type { loader as workLoader } from "./work";

export const meta: MetaFunction = () => [
  { title: "Long form - FragTaco" },
];

export default function WorkLongForm() {
  const data = useRouteLoaderData<typeof workLoader>("routes/work");

  return <WallPage kind="long" videos={data?.work.longForm ?? []} />;
}
