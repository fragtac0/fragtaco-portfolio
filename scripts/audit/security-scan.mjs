// A source scan for the inventory: every place app/ writes HTML or runs a string as code, and every browser feature it asks for.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const SINKS = [
  ["innerHTML", /\.innerHTML\s*=/],
  ["outerHTML", /\.outerHTML\s*=/],
  ["insertAdjacentHTML", /insertAdjacentHTML\s*\(/],
  ["document.write", /document\.write(ln)?\s*\(/],
  ["dangerouslySetInnerHTML", /dangerouslySetInnerHTML/],
  ["eval", /\beval\s*\(/],
  ["new Function", /new Function\s*\(/],
  ["setHTMLUnsafe / parseHTMLUnsafe", /setHTMLUnsafe|parseHTMLUnsafe/],
  ["script src / text", /\.(src|text|textContent)\s*=\s*[^;]*script/i],
  ["DOMParser", /new DOMParser/],
  ["Worker", /new (Shared)?Worker\s*\(/],
];
const FEATURES = [
  ["geolocation", /navigator\.geolocation/],
  ["camera / microphone", /getUserMedia/],
  ["clipboard", /navigator\.clipboard/],
  ["fullscreen", /requestFullscreen/],
  ["pointer lock", /requestPointerLock/],
  ["device motion / orientation", /devicemotion|deviceorientation/],
  ["notifications", /Notification\.requestPermission/],
  ["web share", /navigator\.share/],
  ["vibrate", /navigator\.vibrate/],
  ["wake lock", /wakeLock/],
  ["gamepad", /getGamepads/],
  ["payment", /PaymentRequest/],
  ["local fonts", /queryLocalFonts/],
  ["storage (session/local)", /(session|local)Storage/],
  ["workers via blob", /URL\.createObjectURL/],
  ["WebGL / canvas", /getContext\(\s*["'](webgl|webgl2|2d|bitmaprenderer)/],
  ["WebGPU", /navigator\.gpu/],
  ["autoplay media", /\.play\(\)|<video|<audio/],
  ["sendBeacon / keepalive", /sendBeacon|keepalive/],
];

function* files(dir) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) yield* files(p);
    else if (/\.(tsx?|mjs)$/.test(f) && !/\.test\./.test(f)) yield p;
  }
}

export function scanSource(root) {
  const sinks = Object.fromEntries(SINKS.map(([n]) => [n, []]));
  const features = Object.fromEntries(FEATURES.map(([n]) => [n, []]));
  for (const file of files(join(root, "app"))) {
    const text = readFileSync(file, "utf8");
    const rel = file.slice(root.length + 1);
    for (const [n, re] of SINKS) if (re.test(text)) sinks[n].push(rel);
    for (const [n, re] of FEATURES) if (re.test(text)) features[n].push(rel);
  }
  return { sinks, features };
}
