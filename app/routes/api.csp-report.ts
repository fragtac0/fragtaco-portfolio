import type { ActionFunctionArgs } from "@remix-run/node";
import { INTERNAL_RESPONSE_HEADERS } from "../lib/security-headers.server";

/**
 * Where the browser sends content policy reports (`report-to csp` and `report-uri`). It keeps nothing: one line per report goes to the server
 * log, with the query and fragment of every address cut off (an address can carry something private), and the answer is 204. It is what makes
 * a policy that blocks something it should not visible after a release.
 */
const MAX_BYTES = 8192;
const MAX_LINE = 2000;
const TYPES = ["application/csp-report", "application/reports+json"];

const refuse = (status: number, extra: Record<string, string> = {}) => new Response(null, { status, headers: { ...INTERNAL_RESPONSE_HEADERS, ...extra } });
const notAllowed = () => refuse(405, { Allow: "POST" });

/** The policy a report quotes holds the page's nonce (a secret for that one response) and says nothing the site does not already know: it is not logged. */
const LEFT_OUT = new Set(["originalPolicy", "original-policy"]);

/** An address without its query and fragment. Anything that is not an http(s) address (a sample of code, "inline", "eval") is left as it is. */
function cutAddress(value: string): string {
  if (!/^https?:\/\//i.test(value)) return value.length > 300 ? `${value.slice(0, 300)}...` : value;
  try {
    const u = new URL(value);
    return `${u.protocol}//${u.host}${u.pathname}`;
  } catch {
    return "(unreadable address)";
  }
}

/** The report with every address cleaned, however deep it sits. Bounded: it reads at most 6 levels and 20 entries of an array. */
export function cleanReport(value: unknown, depth = 0): unknown {
  if (typeof value === "string") return cutAddress(value);
  if (depth >= 6 || value === null || typeof value !== "object") return typeof value === "object" ? null : value;
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => cleanReport(v, depth + 1));
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).filter(([k]) => !LEFT_OUT.has(k)).slice(0, 30).map(([k, v]) => [k, cleanReport(v, depth + 1)]));
}

/** The body as text, or null when it is longer than the limit (read as a stream: a missing or false length cannot make the server hold a big body). */
async function readLimited(request: Request): Promise<string | null> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_BYTES) return null;
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BYTES) {
      void reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

export async function action({ request }: ActionFunctionArgs) {
  if (request.method.toUpperCase() !== "POST") return notAllowed();
  const type = (request.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (!TYPES.includes(type)) return refuse(415);
  const body = await readLimited(request);
  if (body === null) return refuse(413);
  let cleaned: unknown;
  try {
    cleaned = cleanReport(JSON.parse(body));
  } catch {
    cleaned = { note: "unreadable report body" };
  }
  console.warn("csp-report", JSON.stringify(cleaned).slice(0, MAX_LINE - "csp-report ".length));
  return refuse(204);
}

export function loader() {
  return notAllowed();
}
