import { json, type HeadersFunction } from "@remix-run/node";
import { Outlet, useLoaderData } from "@remix-run/react";
import WorkShell from "../components/work/work-shell";
import { getWorkPageContent } from "../content/loaders.server";

// The layout of the work addresses: `/work` (the rings), `/work/long-form` and `/work/short-form`. It loads
// the work content once for all three (the children read it with `useRouteLoaderData("routes/work")`) and
// holds the dock with its second row, so moving between them keeps one dock. `/experience` is a route of
// its own that wears the same shell.
export const headers: HeadersFunction = ({ loaderHeaders }) => ({
  "Cache-Control": loaderHeaders.get("Cache-Control") ?? "private, no-cache",
});

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

export default function WorkLayout() {
  const { navigationItems, socialLinks } = useLoaderData<typeof loader>();

  return (
    <WorkShell navigationItems={navigationItems} socialLinks={socialLinks}>
      <Outlet />
    </WorkShell>
  );
}
