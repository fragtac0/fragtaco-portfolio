import { RemixServer } from "@remix-run/react";
import { createReadableStreamFromReadable, type EntryContext } from "@remix-run/node";
import ReactDOMServer from "react-dom/server";
import { PassThrough } from "node:stream";
import { NonceProvider } from "./lib/nonce";
import { INTERNAL_RESPONSE_HEADERS, documentHeaders, makeNonce } from "./lib/security-headers.server";

const { renderToPipeableStream } = ReactDOMServer;

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  remixContext: EntryContext,
): Promise<Response> {
  // A new nonce for every response. The content policy and the other security headers are sent in production only: Vite's dev client
  // writes inline scripts that no nonce covers (see docs/redesign/security-audit-2026-11.md).
  const nonce = makeNonce();
  const production = process.env.NODE_ENV === "production";
  return await new Promise((resolve, reject) => {
    let shellRendered = false;
    const body = new PassThrough();

    const { pipe, abort } = renderToPipeableStream(
      <NonceProvider nonce={nonce}>
        <RemixServer context={remixContext} url={request.url} />
      </NonceProvider>,
      {
        nonce,
        onShellReady() {
          shellRendered = true;
          responseHeaders.set("Content-Type", "text/html");
          if (production) for (const [name, value] of Object.entries(documentHeaders(nonce))) responseHeaders.set(name, value);
          const stream = createReadableStreamFromReadable(body);
          resolve(
            new Response(stream, {
              headers: responseHeaders,
              status: responseStatusCode,
            }),
          );
          pipe(body);
        },
        onShellError(error: unknown) {
          reject(error instanceof Error ? error : new Error(String(error)));
        },
        onError(error: unknown) {
          responseStatusCode = 500;
          if (shellRendered) {
            console.error(error);
          }
        },
      },
    );

    setTimeout(abort, 5000);
  });
}

/** A data response (`?_data=`) is not a document: no policy, but never sniffed, never embedded by another site, and no path in a Referer. */
export function handleDataRequest(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(INTERNAL_RESPONSE_HEADERS)) headers.set(name, value);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
