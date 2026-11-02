import type { SiteBook } from "~/types";

/**
 * The shelf's painters: every texture is drawn on a 2D canvas, so the books need no image files.
 * Ported from the `Shelf` module of docs/redesign/mockups/home-v4.html (spineCanvas, coverCanvas,
 * backCanvas, topCanvas, foreCanvas, woodCanvas, blobCanvas, softRectCanvas, bandCanvas).
 * Client only: every function creates a canvas. Fonts Lora 500, Tektur 700 and IBM Plex Mono 500
 * must be loaded first (the engine waits for them).
 */

const mk = (w: number, h: number): HTMLCanvasElement => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
};
const ctx2d = (c: HTMLCanvasElement): CanvasRenderingContext2D => {
  const x = c.getContext("2d");
  if (!x) throw new Error("2D canvas is not available");
  return x;
};

type PaintBook = Pick<SiteBook, "title" | "author" | "aspect" | "spine" | "style">;

const rgbOf = (h: string): [number, number, number] => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16),
];
/** Perceived brightness 0..1 of a `#rrggbb` colour. */
const lum = (h: string): number => {
  const [r, g, b] = rgbOf(h);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
};

/** A 128 px tile of white noise, painted once and reused as the grain. */
let NOISE: HTMLCanvasElement | null = null;
function noise(): HTMLCanvasElement {
  if (NOISE) return NOISE;
  const c = mk(128, 128);
  const x = ctx2d(c);
  const id = x.createImageData(128, 128);
  for (let i = 0; i < id.data.length; i += 4) {
    const v = Math.random() * 255;
    id.data[i] = id.data[i + 1] = id.data[i + 2] = v;
    id.data[i + 3] = 255;
  }
  x.putImageData(id, 0, 0);
  NOISE = c;
  return c;
}
function grain(x: CanvasRenderingContext2D, w: number, h: number, a: number): void {
  x.save();
  x.globalAlpha = a;
  x.globalCompositeOperation = "overlay";
  x.fillStyle = x.createPattern(noise(), "repeat") ?? "#000";
  x.fillRect(0, 0, w, h);
  x.restore();
}
/** Shrinks the font from `start` until `text` fits `max` pixels (never below 13). */
function fitText(
  x: CanvasRenderingContext2D,
  text: string,
  font: (size: number) => string,
  max: number,
  start: number,
): number {
  let s = start;
  do {
    x.font = font(s);
    if (x.measureText(text).width <= max) break;
    s -= 1;
  } while (s > 13);
  return s;
}

/** The spine, drawn lying down (the box's spine face is rotated), `T` thick and `H` tall. */
export function spineCanvas(d: PaintBook, T: number, H: number): HTMLCanvasElement {
  const ch = 1024;
  const cw = Math.max(64, Math.round((ch * T) / H));
  const c = mk(cw, ch);
  const x = ctx2d(c);
  const light = lum(d.spine) > 0.56;
  const ink = light ? "#17120d" : "#f6f0e2";
  const foil = light ? "#8f6b22" : "#d9a441";
  x.fillStyle = d.spine;
  x.fillRect(0, 0, cw, ch);
  grain(x, cw, ch, 0.16);
  x.globalAlpha = 0.05;
  for (let y = 0; y < ch; y += 2) {
    x.fillStyle = (y / 2) % 2 ? "#000" : "#fff";
    x.fillRect(0, y, cw, 1);
  }
  x.globalAlpha = 1;
  if (d.style === "band") {
    x.fillStyle = foil;
    for (const [p, h] of [
      [0.05, 7],
      [0.072, 2],
      [0.926, 2],
      [0.944, 7],
    ] as const) {
      x.fillRect(0, ch * p, cw, h);
    }
  }
  if (d.style === "block") {
    x.fillStyle = light ? "rgba(23,18,13,.92)" : "rgba(246,240,226,.94)";
    x.fillRect(0, ch * 0.05, cw, ch * 0.2);
  }
  const fs = Math.min(cw * 0.42, 46);
  const lastName = (d.author.split(" ").pop() ?? "").toUpperCase();
  x.save();
  x.translate(cw / 2, 0);
  x.rotate(Math.PI / 2);
  x.textBaseline = "middle";
  const [t0, t1] = d.style === "block" ? [0.3, 0.93] : d.style === "band" ? [0.12, 0.72] : [0.07, 0.7];
  const tf =
    d.style === "block"
      ? (s: number) => `700 ${s}px Tektur`
      : (s: number) => `500 ${s}px Lora`;
  fitText(x, d.title, tf, ch * (t1 - t0), fs);
  x.fillStyle = d.style === "band" && !light ? "#f3e2b5" : ink;
  x.textAlign = "left";
  x.fillText(d.title, ch * t0, 2);
  const af = (s: number) => `500 ${s}px "IBM Plex Mono"`;
  if (d.style === "block") {
    fitText(x, lastName, af, ch * 0.17, fs * 0.5);
    x.fillStyle = d.spine;
    x.textAlign = "center";
    x.fillText(lastName, ch * 0.15, 1);
  } else {
    fitText(x, lastName, af, ch * 0.2, fs * 0.48);
    x.globalAlpha = 0.8;
    x.textAlign = "right";
    x.fillText(lastName, ch * (d.style === "band" ? 0.89 : 0.93), 1);
    x.globalAlpha = 1;
  }
  x.restore();
  if (d.style === "plain") {
    x.strokeStyle = ink;
    x.globalAlpha = 0.55;
    x.lineWidth = 2;
    x.beginPath();
    x.arc(cw / 2, ch * 0.965, Math.min(cw * 0.16, 9), 0, Math.PI * 2);
    x.stroke();
    x.globalAlpha = 1;
  }
  const g = x.createLinearGradient(0, 0, cw, 0);
  for (const [o, col] of [
    [0, "rgba(0,0,0,.58)"],
    [0.12, "rgba(0,0,0,.14)"],
    [0.36, "rgba(255,255,255,.17)"],
    [0.55, "rgba(255,255,255,.05)"],
    [0.85, "rgba(0,0,0,.2)"],
    [1, "rgba(0,0,0,.62)"],
  ] as const) {
    g.addColorStop(o, col);
  }
  x.fillStyle = g;
  x.fillRect(0, 0, cw, ch);
  const v = x.createLinearGradient(0, 0, 0, ch);
  v.addColorStop(0, "rgba(255,255,255,.08)");
  v.addColorStop(0.5, "rgba(0,0,0,0)");
  v.addColorStop(1, "rgba(0,0,0,.28)");
  x.fillStyle = v;
  x.fillRect(0, 0, cw, ch);
  x.fillStyle = "rgba(0,0,0,.4)";
  x.fillRect(0, 0, cw, 4);
  x.fillRect(0, ch - 4, cw, 4);
  return c;
}

/** The front cover: the Open Library image when `img` is given, otherwise a generated one. */
export function coverCanvas(d: PaintBook, img: HTMLImageElement | null): HTMLCanvasElement {
  const cw = 640;
  const ch = Math.round(640 / d.aspect);
  const c = mk(cw, ch);
  const x = ctx2d(c);
  if (img) {
    const ia = img.naturalWidth / img.naturalHeight;
    const ca = cw / ch;
    let sw: number;
    let sh: number;
    let sx = 0;
    let sy = 0;
    if (ia > ca) {
      sh = img.naturalHeight;
      sw = sh * ca;
      sx = (img.naturalWidth - sw) / 2;
    } else {
      sw = img.naturalWidth;
      sh = sw / ca;
      sy = (img.naturalHeight - sh) / 2;
    }
    x.drawImage(img, sx, sy, sw, sh, 0, 0, cw, ch);
  } else {
    x.fillStyle = d.spine;
    x.fillRect(0, 0, cw, ch);
    grain(x, cw, ch, 0.12);
    x.fillStyle = lum(d.spine) > 0.56 ? "#17120d" : "#f6f0e2";
    x.textAlign = "left";
    x.textBaseline = "top";
    fitText(x, d.title, (s) => `500 ${s}px Lora`, cw * 0.8, 58);
    x.fillText(d.title, cw * 0.1, ch * 0.12);
    x.font = '500 22px "IBM Plex Mono"';
    x.globalAlpha = 0.75;
    x.fillText(d.author, cw * 0.1, ch * 0.86);
    x.globalAlpha = 1;
  }
  const hg = x.createLinearGradient(0, 0, cw * 0.09, 0);
  for (const [o, col] of [
    [0, "rgba(0,0,0,.42)"],
    [0.42, "rgba(0,0,0,.06)"],
    [0.52, "rgba(255,255,255,.16)"],
    [0.66, "rgba(0,0,0,.2)"],
    [1, "rgba(0,0,0,0)"],
  ] as const) {
    hg.addColorStop(o, col);
  }
  x.fillStyle = hg;
  x.fillRect(0, 0, cw * 0.09, ch);
  const sg = x.createLinearGradient(0, 0, cw, ch);
  sg.addColorStop(0, "rgba(255,255,255,.12)");
  sg.addColorStop(0.35, "rgba(255,255,255,0)");
  sg.addColorStop(0.7, "rgba(0,0,0,0)");
  sg.addColorStop(1, "rgba(0,0,0,.26)");
  x.fillStyle = sg;
  x.fillRect(0, 0, cw, ch);
  x.strokeStyle = "rgba(0,0,0,.4)";
  x.lineWidth = 5;
  x.strokeRect(2.5, 2.5, cw - 5, ch - 5);
  return c;
}

export function backCanvas(d: PaintBook): HTMLCanvasElement {
  const c = mk(256, 384);
  const x = ctx2d(c);
  x.fillStyle = d.spine;
  x.fillRect(0, 0, 256, 384);
  grain(x, 256, 384, 0.14);
  const g = x.createLinearGradient(0, 0, 256, 384);
  g.addColorStop(0, "rgba(255,255,255,.08)");
  g.addColorStop(1, "rgba(0,0,0,.3)");
  x.fillStyle = g;
  x.fillRect(0, 0, 256, 384);
  return c;
}

/** The page block seen from above: u runs from spine to fore-edge, v across the two boards. */
export function topCanvas(d: PaintBook): HTMLCanvasElement {
  const c = mk(512, 96);
  const x = ctx2d(c);
  x.fillStyle = "#ece2cc";
  x.fillRect(0, 0, 512, 96);
  for (let y = 0; y < 96; y += 2) {
    x.fillStyle = `rgba(110,88,58,${0.05 + Math.random() * 0.1})`;
    x.fillRect(0, y, 512, 1);
  }
  const g = x.createLinearGradient(0, 0, 512, 0);
  g.addColorStop(0, "rgba(60,40,20,.4)");
  g.addColorStop(0.14, "rgba(0,0,0,0)");
  g.addColorStop(1, "rgba(0,0,0,.1)");
  x.fillStyle = g;
  x.fillRect(0, 0, 512, 96);
  x.fillStyle = d.spine;
  x.fillRect(0, 0, 512, 7);
  x.fillRect(0, 89, 512, 7);
  x.fillRect(0, 0, 14, 96);
  x.fillStyle = "rgba(0,0,0,.28)";
  x.fillRect(0, 7, 512, 2);
  x.fillRect(0, 87, 512, 2);
  return c;
}

/** The fore-edge: page lines run top to bottom, boards on either side. */
export function foreCanvas(d: PaintBook): HTMLCanvasElement {
  const c = mk(128, 1024);
  const x = ctx2d(c);
  x.fillStyle = "#efe6d1";
  x.fillRect(0, 0, 128, 1024);
  for (let i = 0; i < 128; i += 2) {
    x.fillStyle = `rgba(110,88,58,${0.05 + Math.random() * 0.1})`;
    x.fillRect(i, 0, 1, 1024);
  }
  const g = x.createLinearGradient(0, 0, 128, 0);
  g.addColorStop(0, "rgba(0,0,0,.1)");
  g.addColorStop(0.5, "rgba(0,0,0,.16)");
  g.addColorStop(1, "rgba(0,0,0,.1)");
  x.fillStyle = g;
  x.fillRect(0, 0, 128, 1024);
  const v = x.createLinearGradient(0, 0, 0, 1024);
  v.addColorStop(0, "rgba(255,255,255,.1)");
  v.addColorStop(1, "rgba(0,0,0,.22)");
  x.fillStyle = v;
  x.fillRect(0, 0, 128, 1024);
  x.fillStyle = d.spine;
  x.fillRect(0, 0, 8, 1024);
  x.fillRect(120, 0, 8, 1024);
  return c;
}

export function woodCanvas(): HTMLCanvasElement {
  const c = mk(1024, 128);
  const x = ctx2d(c);
  const g = x.createLinearGradient(0, 0, 0, 128);
  g.addColorStop(0, "#4b3121");
  g.addColorStop(1, "#25170e");
  x.fillStyle = g;
  x.fillRect(0, 0, 1024, 128);
  for (let i = 0; i < 70; i++) {
    x.strokeStyle = `rgba(${Math.random() < 0.5 ? "18,9,3" : "128,86,54"},${
      0.08 + Math.random() * 0.12
    })`;
    x.lineWidth = 0.6 + Math.random() * 1.6;
    x.beginPath();
    const y0 = Math.random() * 128;
    x.moveTo(0, y0);
    for (let X = 0; X <= 1024; X += 32) {
      x.lineTo(X, y0 + Math.sin(X * 0.006 + i) * 3 + Math.sin(X * 0.021 + i * 2) * 1.2);
    }
    x.stroke();
  }
  grain(x, 1024, 128, 0.1);
  return c;
}

/** Contact shadow on the plank. */
export function blobCanvas(): HTMLCanvasElement {
  const c = mk(128, 128);
  const x = ctx2d(c);
  const g = x.createRadialGradient(64, 64, 4, 64, 64, 64);
  g.addColorStop(0, "rgba(0,0,0,.9)");
  g.addColorStop(0.5, "rgba(0,0,0,.42)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  x.fillStyle = g;
  x.fillRect(0, 0, 128, 128);
  return c;
}

/** A book's shadow on the wall: a rectangle with a blurred edge. */
export function softRectCanvas(): HTMLCanvasElement {
  const c = mk(128, 256);
  const x = ctx2d(c);
  x.shadowColor = "#000";
  x.shadowBlur = 26;
  x.shadowOffsetX = 600;
  x.fillRect(30 - 600, 30, 68, 196);
  return c;
}

/** The plank's shadow on the wall below it. */
export function bandCanvas(): HTMLCanvasElement {
  const c = mk(256, 128);
  const x = ctx2d(c);
  const g = x.createLinearGradient(0, 0, 0, 128);
  g.addColorStop(0, "rgba(0,0,0,.9)");
  g.addColorStop(0.35, "rgba(0,0,0,.35)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  x.fillStyle = g;
  x.fillRect(0, 0, 256, 128);
  const e = x.createLinearGradient(0, 0, 256, 0);
  e.addColorStop(0, "rgba(0,0,0,0)");
  e.addColorStop(0.12, "#000");
  e.addColorStop(0.88, "#000");
  e.addColorStop(1, "rgba(0,0,0,0)");
  x.globalCompositeOperation = "destination-in";
  x.fillStyle = e;
  x.fillRect(0, 0, 256, 128);
  return c;
}
