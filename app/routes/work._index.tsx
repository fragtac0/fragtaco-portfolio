import { redirect, type LoaderFunctionArgs, type MetaFunction } from "@remix-run/node";
import { useRouteLoaderData } from "@remix-run/react";
import WorkPage from "../components/work/work-page";
import { legacyViewTarget } from "../utils/nav";
import type { loader as workLoader } from "./work";

export const meta: MetaFunction = () => [
  { title: "My portfolio - FragTaco" },
];

// Round 5 linked the in-page views as `/work?view=long`, `short` and `clients`: they go to the new addresses.
export function loader({ request }: LoaderFunctionArgs) {
  const target = legacyViewTarget(new URL(request.url).search);
  if (target) return redirect(target, 301);
  return null;
}

export default function WorkIndex() {
  const data = useRouteLoaderData<typeof workLoader>("routes/work");
  if (!data) return null;

  return <WorkPage work={data.work} />;
}
