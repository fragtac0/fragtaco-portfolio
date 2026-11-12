import { redirect } from "@remix-run/node";

// `/timeline` is now `/experience` (round 6). A permanent redirect, so old links and bookmarks keep working.
export function loader() {
  return redirect("/experience", 301);
}
