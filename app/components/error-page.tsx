import { isRouteErrorResponse } from "@remix-run/react";

/**
 * The content of the root ErrorBoundary (app/root.tsx): what Remix's default boundary showed (a 24px heading, and for an error that is not a
 * response the red band for its stack), without the script of its own that the default one wrote (an inline console.log, which the content
 * policy blocks and reports on every 404). The page is inside the root Layout, so the fonts, the ground and the nonce'd scripts are the site's.
 * The stack is shown while developing only: in production a visitor sees the heading and an empty band, as before (Remix strips the
 * server's stacks), and never a path of the server's or the code's.
 */
export function ErrorPage({ error, showStack = import.meta.env.DEV }: { error: unknown; showStack?: boolean }) {
  if (isRouteErrorResponse(error)) {
    return (
      <h1 style={{ fontSize: "24px" }}>
        {error.status} {error.statusText}
      </h1>
    );
  }
  const instance = error instanceof Error ? error : new Error(typeof error === "string" ? error : "Unknown Error");
  return (
    <>
      <h1 style={{ fontSize: "24px" }}>Application Error</h1>
      <pre style={{ padding: "2rem", background: "hsla(10, 50%, 50%, 0.1)", color: "red", overflow: "auto" }}>{showStack ? instance.stack : ""}</pre>
    </>
  );
}
