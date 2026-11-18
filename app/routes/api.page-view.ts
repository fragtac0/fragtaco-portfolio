import { json, type ActionFunctionArgs } from "@remix-run/node";
import { incrementPageView } from "../lib/page-views.server";
import { isOwnRequest } from "../lib/same-site.server";
import { FETCH_METADATA_VARY, INTERNAL_RESPONSE_HEADERS } from "../lib/security-headers.server";

// Every answer carries the headers of an internal endpoint, and says that it depends on the fetch metadata of the request: a shared cache
// must not give a refusal meant for another site to this one, or the other way round.
const headers = (extra: Record<string, string> = {}) => ({ ...INTERNAL_RESPONSE_HEADERS, Vary: FETCH_METADATA_VARY, ...extra });

export async function action({ request }: ActionFunctionArgs) {
  if (request.method.toUpperCase() !== "POST") {
    return json({ error: "Method not allowed" }, { headers: headers({ Allow: "POST" }), status: 405 });
  }

  // A request from another site is refused before anything is read or written (the counter is a vanity counter, but nothing else
  // has a reason to move it). A request with no fetch metadata and no Origin (a script) is not from a page and is counted.
  if (!isOwnRequest(request)) {
    return json({ error: "Forbidden" }, { headers: headers(), status: 403 });
  }

  const url = new URL(request.url);
  const pageView = await incrementPageView(url.searchParams.get("source"));

  return json({ source: pageView.source, total: pageView.total }, { headers: headers() });
}

export function loader() {
  return json({ error: "Method not allowed" }, { headers: headers({ Allow: "POST" }), status: 405 });
}
