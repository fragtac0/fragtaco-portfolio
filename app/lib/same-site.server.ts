/**
 * Whether a request comes from this site's own pages (or from no page at all: the address bar, a bookmark). Used before anything that
 * writes: a request from another site is refused. Fetch metadata first (a browser sets Sec-Fetch-Site itself and a page cannot change it);
 * browsers that lack it send Origin on a POST, whose host must be the request's own. With neither header the request is not from a
 * browser page, so it is let through: the one endpoint that asks is a vanity counter with no sign-in to protect.
 */
export function isOwnRequest(request: Request): boolean {
  const site = request.headers.get("Sec-Fetch-Site");
  if (site) return site === "same-origin" || site === "none";
  const origin = request.headers.get("Origin");
  if (origin === null) return true;
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false; // "null" (a sandboxed frame, a redirect through another site) and anything that is not an address
  }
}
