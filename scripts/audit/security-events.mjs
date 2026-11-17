// The event collector of security.mjs: attaches to a chrome-lite page and records, for one walk, every request (origin, type, status),
// every failed request, every console error and exception, every `securitypolicyviolation` event (enforced or report-only) with its
// sample, and every browser feature the page asked for (the init script wraps the APIs that need a permission or a user setting).
// The page-side parts report through console.debug lines tagged "__sv" and "__feat": they survive a navigation, a page's own variables do not.

/** Runs in every document before its own scripts (added with Page.addScriptToEvaluateOnNewDocument, so no policy applies to it). */
export const COLLECT_INIT = `(() => {
  const say = (tag, o) => { try { console.debug("__" + tag, JSON.stringify(o)); } catch (e) { /* ignore */ } };
  const onViolation = (e) => say("sv", { directive: e.violatedDirective, effective: e.effectiveDirective, blocked: String(e.blockedURI || "").slice(0, 160), sample: String(e.sample || "").slice(0, 120), disposition: e.disposition, source: String(e.sourceFile || "").slice(0, 160), line: e.lineNumber, where: location.pathname });
  document.addEventListener("securitypolicyviolation", onViolation, true);
  const wrap = (obj, name, tag) => { try { const f = obj && obj[name]; if (typeof f !== "function") return; obj[name] = function (...a) { say("feat", { feature: tag }); return f.apply(this, a); }; } catch (e) { /* ignore */ } };
  wrap(navigator, "getBattery", "battery"); wrap(navigator, "vibrate", "vibrate"); wrap(navigator, "share", "web-share"); wrap(navigator, "requestMIDIAccess", "midi");
  wrap(navigator, "getGamepads", "gamepad"); wrap(navigator, "requestMediaKeySystemAccess", "encrypted-media"); wrap(navigator, "getInstalledRelatedApps", "related-apps");
  wrap(navigator.geolocation, "getCurrentPosition", "geolocation"); wrap(navigator.geolocation, "watchPosition", "geolocation");
  wrap(navigator.mediaDevices, "getUserMedia", "camera-microphone"); wrap(navigator.mediaDevices, "getDisplayMedia", "display-capture"); wrap(navigator.mediaDevices, "enumerateDevices", "enumerate-devices");
  wrap(navigator.clipboard, "readText", "clipboard-read"); wrap(navigator.clipboard, "read", "clipboard-read"); wrap(navigator.clipboard, "writeText", "clipboard-write"); wrap(navigator.clipboard, "write", "clipboard-write");
  wrap(navigator.permissions, "query", "permissions-query");
  wrap(navigator.credentials, "get", "credentials"); wrap(navigator.credentials, "create", "credentials");
  wrap(navigator.wakeLock, "request", "screen-wake-lock"); wrap(navigator.storage, "persist", "storage-persist");
  wrap(Element.prototype, "requestFullscreen", "fullscreen"); wrap(Element.prototype, "requestPointerLock", "pointer-lock"); wrap(document, "exitFullscreen", "fullscreen");
  wrap(HTMLVideoElement.prototype, "requestPictureInPicture", "picture-in-picture"); wrap(window, "queryLocalFonts", "local-fonts");
  wrap(window, "showOpenFilePicker", "file-picker"); wrap(window, "getScreenDetails", "window-management");
  wrap(window.Notification, "requestPermission", "notifications"); wrap(window, "open", "window-open");
  wrap(HTMLMediaElement.prototype, "play", "media-play");
  wrap(screen.orientation, "lock", "orientation-lock");
  wrap(window, "PaymentRequest", "payment");
  try { const add = window.addEventListener; const MOTION = ["devicemotion", "deviceorientation", "deviceorientationabsolute"]; window.addEventListener = function (type, ...r) { if (MOTION.includes(type)) say("feat", { feature: "motion-sensors:" + type }); return add.call(this, type, ...r); }; } catch (e) { /* ignore */ }
  try { const gc = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (k, ...r) { say("feat", { feature: "canvas:" + k }); return gc.call(this, k, ...r); }; } catch (e) { /* ignore */ }
  try { const rs = window.Worker; if (rs) window.Worker = function (...a) { say("feat", { feature: "worker" }); return new rs(...a); }; } catch (e) { /* ignore */ }
})();`;

const originOf = (u) => {
  try {
    const x = new URL(u);
    return x.protocol === "data:" || x.protocol === "blob:" ? x.protocol : x.origin;
  } catch {
    return "?";
  }
};
const cut = (u) => {
  try {
    const x = new URL(u);
    return x.protocol === "data:" || x.protocol === "blob:" ? x.protocol + "…" : x.origin + x.pathname;
  } catch {
    return String(u).slice(0, 80);
  }
};

/** Attaches to a chrome-lite page; `snapshot()` returns what was seen. `selfOrigin` is the site's own origin. */
export async function collect(c, selfOrigin) {
  const reqs = new Map();
  const docs = []; // the response headers of every document, data request and API call (what security.mjs checks)
  const out = { violations: [], features: new Map(), consoleErrors: [], exceptions: [], log: [], failed: [], requestList: [] };
  await c.send("Log.enable");
  c.on("Network.requestWillBeSent", (p) => {
    const r = { id: p.requestId, url: p.request.url, type: p.type ?? "Other", status: 0, mime: "", failed: null, blocked: null, redirectedFrom: p.redirectResponse ? p.redirectResponse.url : null };
    if (p.redirectResponse) {
      // a redirect hop: the previous response of this id ended in a redirect; keep it as its own row
      out.requestList.push({ ...reqs.get(p.requestId), status: p.redirectResponse.status });
    }
    reqs.set(p.requestId, r);
  });
  c.on("Network.responseReceived", (p) => {
    const r = reqs.get(p.requestId);
    if (r) Object.assign(r, { status: p.response.status, mime: p.response.mimeType, type: p.type ?? r.type });
    if (r && (r.type === "Document" || r.url.includes("_data=") || r.url.includes("/api/"))) {
      const headers = Object.fromEntries(Object.entries(p.response.headers).map(([k, v]) => [k.toLowerCase(), v]));
      docs.push({ url: cut(r.url), type: r.type, status: p.response.status, headers });
    }
  });
  c.on("Network.loadingFailed", (p) => {
    const r = reqs.get(p.requestId);
    if (r) Object.assign(r, { failed: p.errorText, blocked: p.blockedReason ?? null, canceled: !!p.canceled });
  });
  c.on("Runtime.consoleAPICalled", (p) => {
    const text = (p.args ?? []).map((a) => a.value ?? a.description ?? "").join(" ");
    if (p.type === "debug" && text.startsWith("__sv ")) out.violations.push(JSON.parse(text.slice(5)));
    else if (p.type === "debug" && text.startsWith("__feat ")) {
      const f = JSON.parse(text.slice(7)).feature;
      out.features.set(f, (out.features.get(f) ?? 0) + 1);
    } else if (p.type === "error") out.consoleErrors.push(text.slice(0, 300));
  });
  c.on("Runtime.exceptionThrown", (p) => out.exceptions.push((p.exceptionDetails.exception?.description ?? p.exceptionDetails.text ?? "").slice(0, 300)));
  c.on("Log.entryAdded", (p) => {
    const e = p.entry;
    out.log.push({ level: e.level, source: e.source, text: String(e.text).slice(0, 300), url: e.url ? cut(e.url) : undefined });
  });
  return {
    snapshot() {
      const rows = [...out.requestList, ...reqs.values()];
      const byOrigin = {};
      const byType = {};
      const third = new Map();
      for (const r of rows) {
        const o = originOf(r.url);
        const t = r.type;
        const eo = (byOrigin[o] ??= { count: 0, types: {} });
        eo.count += 1;
        eo.types[t] = (eo.types[t] ?? 0) + 1;
        byType[t] = (byType[t] ?? 0) + 1;
        if (o !== selfOrigin && o !== "data:" && o !== "blob:") third.set(`${o} ${t}`, (third.get(`${o} ${t}`) ?? 0) + 1);
      }
      // a request that failed or answered with an error: a picture or font that did not load is listed with its address (no query)
      // a picture the page itself gave up on (a scene closed while it loaded: net::ERR_ABORTED, canceled) is counted apart, not as a failure
      const bad = rows.filter((r) => (r.failed && !r.canceled) || r.status >= 400);
      const abandoned = rows.filter((r) => r.failed && r.canceled);
      return {
        requests: rows.length,
        docs,
        byOrigin,
        byType,
        thirdParty: Object.fromEntries(third),
        bad: bad.map((r) => ({ url: cut(r.url), type: r.type, status: r.status, failed: r.failed, blocked: r.blocked, canceled: r.canceled ?? false })),
        abandoned: { count: abandoned.length, byOrigin: Object.fromEntries([...new Set(abandoned.map((r) => originOf(r.url)))].map((o) => [o, abandoned.filter((r) => originOf(r.url) === o).length])) },
        violations: out.violations,
        features: Object.fromEntries(out.features),
        consoleErrors: out.consoleErrors,
        exceptions: out.exceptions,
        logErrors: out.log.filter((l) => l.level === "error"),
        logWarnings: out.log.filter((l) => l.level === "warning"),
      };
    },
  };
}
