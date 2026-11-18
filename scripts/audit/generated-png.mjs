// A generated picture for the thumbnail and cover hosts (R58 audits): diagonal colour bands with a bright border and a cross, so a push shows on
// it, and no network and no third party's picture is used. One generator for make-edge-look.mjs and make-tile-swaps.mjs (the CRC is node:zlib's).
import { crc32, deflateSync } from "node:zlib";

export function patternPng() {
  const [w, h] = [64, 36];
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const base = [[200, 90, 60], [60, 140, 200], [230, 200, 80], [90, 90, 110]][Math.floor((x + y) / 6) % 4];
      const edge = x < 2 || y < 2 || x >= w - 2 || y >= h - 2 || Math.abs(x - w / 2) < 1 || Math.abs(y - h / 2) < 1;
      for (let c = 0; c < 3; c++) raw[y * (w * 3 + 1) + 1 + x * 3 + c] = edge ? 245 : base[c];
    }
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const sum = Buffer.alloc(4);
    sum.writeUInt32BE(crc32(body));
    return Buffer.concat([len, body, sum]);
  };
  const head = Buffer.alloc(13);
  head.writeUInt32BE(w, 0);
  head.writeUInt32BE(h, 4);
  head.set([8, 2, 0, 0, 0], 8);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", head), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]).toString("base64");
}

/** The intercept entries (cdp.mjs) that answer the thumbnail and cover hosts with the generated picture. */
export const GENERATED = ["ytimg.com", "img.youtube.com", "covers.openlibrary.org"].map((match) => ({ match, status: 200, type: "image/png", body: patternPng() }));
