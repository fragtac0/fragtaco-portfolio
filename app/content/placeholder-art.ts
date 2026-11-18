import { seededRandom } from "./shuffle";

/** A small string hash (FNV-1a) to seed the picture. */
const hash = (text: string): number => {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
};

const between = (r: () => number, low: number, high: number): number => low + r() * (high - low);
const round = (n: number): number => Math.round(n * 10) / 10;

/**
 * A picture for a work item that has no real cover: a dark warm ground and two or three soft glows, no text,
 * the same for the same `seed` and different for another. It is a `data:` address, so nothing is fetched.
 * `upright` makes it 9 by 16 (the short form cut); otherwise it is 16 by 9.
 */
export function placeholderArt(seed: string, upright: boolean): string {
  const [w, h] = upright ? [360, 640] : [640, 360];
  const r = seededRandom(hash(`${seed}|${upright ? "u" : "w"}`));
  const hue = Math.round(between(r, 8, 42));
  const count = r() < 0.5 ? 2 : 3;
  const short = Math.min(w, h);

  let defs = "";
  let shapes = "";
  for (let i = 0; i < count; i++) {
    const glowHue = Math.round(hue + between(r, -12, 22));
    const radius = round(between(r, 0.45, 0.85) * short);
    const cx = round(between(r, 0.1, 0.9) * w);
    const cy = round(between(r, 0.1, 0.9) * h);
    const light = Math.round(between(r, 30, 46));
    const alpha = round(between(r, 0.35, 0.6));
    defs += `<radialGradient id="g${i}"><stop offset="0" stop-color="hsl(${glowHue} 60% ${light}%)" stop-opacity="${alpha}"/><stop offset="1" stop-color="hsl(${glowHue} 60% ${light}%)" stop-opacity="0"/></radialGradient>`;
    shapes += `<circle cx="${cx}" cy="${cy}" r="${radius}" fill="url(#g${i})"/>`;
  }

  const ground = `hsl(${hue} ${Math.round(between(r, 18, 30))}% ${Math.round(between(r, 6, 11))}%)`;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid slice">` +
    `<defs>${defs}</defs><rect width="${w}" height="${h}" fill="${ground}"/>${shapes}</svg>`;

  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
