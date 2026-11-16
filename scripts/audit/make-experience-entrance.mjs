// Writes experience-entrance.json (R56.6, round 7 second look specs 7 and 8: My experience's words beside the mountain, their entrance, the trail tracing itself).
//   node scripts/audit/make-experience-entrance.mjs                  writes the steps
//   BASE=http://localhost:5180 node scripts/audit/cdp.mjs scripts/audit/experience-entrance.json <fresh outdir>     (under the gate lock; about 4 minutes)
//   node scripts/audit/make-experience-entrance.mjs sheet <outdir> <out.jpg>     the frame sheet (steps for cdp.mjs: see the end of this file)
// Checks (each eval prints a JSON line with `ok`; the in-page code is in entrance-page.mjs):
//   THE FILM, at 1440 by 900 and 390 by 844 (dpr 3), from the portfolio page and from home (the thumbnail hosts are answered with plain pictures, so the pictures show none):
//     the change into /experience is filmed (the compositor's frames, `<keep>-<ms>.jpg` at 0.6 T, 0.8 T, T, T + 1100 ms and T + 3200 ms from the reveal's start, T = GLASS.ms, 2250 ms since R56.4)
//     and a sampler in the page reads every animation frame from the reveal's start (`arrival-go`): at 0.6 T no letter, no line, no bead, no trail; at 0.8 T the title partly in; at T the title in
//     and the trail not begun; at T + 1100 ms the trail about half drawn (its cream pixels against the whole), only the beads the tip has passed in (3 to 5 of 9) and no radar; at T + 3200 ms
//     everything (letters, lines, nine beads, the radar, the way ahead); no layout-shift entry from the reveal's start to T + 4 s; the frame gaps over that time (none over 34 ms); the
//     lag between the reveal's start and the page starting to play.
//   THE LAYOUT of spec 7 at 1440 by 900, 1280 by 720, 1024 by 768 and 900 by 600: the title block centred on the summit's row at the left gutter, its right edge at least 24 px short of the
//     mountain's cliff over its rows (the cliff trace of the content through the plane's own transform), the title between 34 px and the stylesheet's; the mountain's block flush right at the
//     gutter, at most 32 characters wide, at least 32 px clear of every bead, of every trail pixel and of the switch, and inside the screen above the dock; and today's places at 390 by 844,
//     844 by 390 and 820 by 1180 (the old places, the stylesheet's size).
//   THE WAYS IT IS FINISHED: a key press and a click on the switch during the trail finish it at once (every letter, every line, nine beads, the whole trail, the radar), and the click's action
//     is taken; a bead that has the focus is shown before the tip reaches it; a first load or deep link plays the same entrance from the picture's showing; coming back from My climb replays
//     nothing (no letter or line animation, the words fade in as before, the trail is whole); reduced motion has no letters and no drawing and fades everything in together over about 200 ms
//     when the 120 ms reveal ends; with no canvas the words still enter, in their old places, with no trail and no beads.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";
import { glassMs } from "./glass-constants.mjs";
import { BACK, CLEAR, CLICKED, FINISHED, FOCUS, INIT, NOMAP, REDUCED, START, VERDICT } from "./entrance-page.mjs";

const dir = path.dirname(fileURLToPath(import.meta.url));
const content = JSON.parse(readFileSync(path.join(dir, "../../content/site/experience.json"), "utf8"));
// the cliff in map units, as app/components/experience/frame.ts makes them (25 units a degree from the picture's west edge, 31.366 N at the top)
const WEST = ((-153.205 % 360) + 360) % 360;
const cliff = content.cliff.points.map(({ lon, lat }) => {
  let d = (((lon % 360) + 360) % 360) - WEST;
  if (d < -180) d += 360;
  if (d > 180) d -= 360;
  return [d * 25, (31.366 - lat) * 25];
});

// plain pictures for the thumbnail and cover hosts: what the film shows of the pages it leaves is flat grey, never a real thumbnail or cover
function flatPng() {
  const [w, h] = [16, 9];
  const raw = Buffer.alloc((w * 3 + 1) * h, 0x55);
  for (let y = 0; y < h; y++) raw[y * (w * 3 + 1)] = 0;
  const crc = (buf) => {
    let c, crcv = 0xffffffff;
    for (const b of buf) {
      c = (crcv ^ b) & 0xff;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcv = (crcv >>> 8) ^ c;
    }
    return (crcv ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const sum = Buffer.alloc(4);
    sum.writeUInt32BE(crc(body));
    return Buffer.concat([len, body, sum]);
  };
  const head = Buffer.alloc(13);
  head.writeUInt32BE(w, 0);
  head.writeUInt32BE(h, 4);
  head.set([8, 2, 0, 0, 0], 8);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", head), chunk("IDAT", Buffer.from(deflateSync(raw))), chunk("IEND", Buffer.alloc(0))]).toString("base64");
}
const PLAIN = ["ytimg.com", "img.youtube.com", "covers.openlibrary.org"].map((match) => ({ match, status: 200, type: "image/png", body: flatPng() }));

const warmed = { label: "glass-warm", eval: "new Promise(r=>{const t=setInterval(()=>{if(performance.getEntriesByName('glass-warm').length){clearInterval(t);r(1)}},100);setTimeout(()=>{clearInterval(t);r(0)},20000)})" };
const PHONE = { size: [390, 844], dpr: 3, mobile: true, touch: true };
const DESK = { size: [1440, 900], dpr: 1, mobile: false, touch: false };
const sleepStep = (ms) => ({ wait: ms });
// the five moments of the film: times from the film's start, from the reveal's start (the page says when it was, once the film is over)
// the reveal's length, GLASS.ms read from the source (glass-constants.mjs): the film's five moments and every wait below follow it
const T = glassMs();
const ATS = `(()=>{const e=performance.getEntriesByName('arrival-go').at(-1);const R=e.startTime-window.__t0,T=${T};return [0.6*T,0.8*T,T,T+1100,T+3200].map(x=>Math.round(R+x))})()`;
const filmFrom = (profile, from, tag) => [
  { ...profile, reduce: false, intercept: PLAIN, go: `{{BASE}}${from}`, wait: 6500 },
  warmed,
  sleepStep(1500),
  { label: `film ${tag}`, film: { ms: 8500, eval: START("change"), keep: `entr-${tag}`, ats: ATS } },
  { label: `the change into My experience from ${from === "/" ? "home" : "the portfolio"} at ${profile.size.join(" x ")}: nothing at 0.6 T, the title partly in at 0.8 T, the trail half drawn with only the beads behind its tip at T + 1100 ms, everything at T + 3200 ms; no layout shift; no frame over 34 ms`, eval: VERDICT },
];
// the same layout read on a page that was loaded at another size and then resized (spec 7: the words are measured in the beside styles whatever the last layout vetoed)
const resizeFrom = ([w0, h0], [w1, h1], tag, wide = true) => [
  { size: [w0, h0], dpr: 1, mobile: false, touch: false, reduce: false, go: "{{BASE}}/experience", wait: 2500 },
  { label: `${tag}: at ${w0} x ${h0} first (the words' places are noted)`, eval: "(async()=>{await new Promise(r=>setTimeout(r,600));const p=document.querySelector('.map-page'),r=document.querySelector('.map-caption').getBoundingClientRect();return JSON.stringify({ok:true,words:p.dataset.words??null,cap:[r.left,r.top,r.right,r.bottom].map(Math.round)})})()" },
  { size: [w1, h1], dpr: 1, mobile: false, touch: false, wait: 1500 },
  { label: `${tag}: resized to ${w1} x ${h1}, the page not reloaded: ${wide ? "the clearances of spec 7 hold as on a page loaded there" : "today's places again"}`, eval: CLEAR(cliff, wide) },
];
const layoutAt = (w, h, wide) => [
  { size: [w, h], dpr: 1, mobile: false, touch: false, reduce: false, go: "{{BASE}}/experience", wait: 2500 },
  { label: `${wide ? "the words beside the mountain" : "today's places"} at ${w} x ${h}`, eval: CLEAR(cliff, wide) },
  { shot: `warm-${w}x${h}` },
  { shot: `r56-6-words-${w}x${h}` }, // the map has no thumbnails: these may be tracked (docs/redesign/compare/round7)
];

const steps = [
  // the first step carries the init script (added once): the observers, and the flags the first-load scenarios set
  { ...DESK, init: INIT, intercept: PLAIN, go: "{{BASE}}/work", wait: 500 },
  ...filmFrom(DESK, "/work", "work-1440"),
  ...filmFrom(DESK, "/", "home-1440"),
  ...filmFrom(PHONE, "/work", "work-390"),
  ...filmFrom(PHONE, "/", "home-390"),
  ...[[1440, 900], [1280, 720], [1024, 768], [900, 600]].flatMap(([w, h]) => layoutAt(w, h, true)),
  ...[[390, 844], [844, 390], [820, 1180]].flatMap(([w, h]) => layoutAt(w, h, false)),
  // a screen that goes from upright or from no room to a wide one (a tablet turned, a window made bigger): the review of R56.6 found the words measured in their old places then
  ...resizeFrom([820, 1180], [1180, 820], "a tablet turned"),
  ...resizeFrom([960, 540], [1280, 800], "a window made bigger"),
  ...resizeFrom([1180, 820], [820, 1180], "a tablet turned back", false),
  // a first load plays the same entrance from the moment the picture is shown
  { ...DESK, reduce: false, intercept: [], go: "{{BASE}}/work", wait: 800 },
  { eval: "sessionStorage.setItem('ft:armLoad','1')" },
  { go: "{{BASE}}/experience", wait: 400 },
  { label: "a first load (a deep link) plays the entrance counted from the picture's showing: the title at 0.7 T, the trail from T", eval: VERDICT },
  // the ways it is finished
  { ...DESK, reduce: false, intercept: PLAIN, go: "{{BASE}}/work", wait: 6500 },
  warmed,
  { label: "start the change, wait for T + 1000 ms", eval: START("change", T + 1000) },
  { key: "a", vk: 65 },
  { label: "a key press during the trail finishes the entrance at once", eval: FINISHED(150) },
  { go: "{{BASE}}/work", wait: 6500 },
  warmed,
  { label: "start the change again, wait for T + 1900 ms", eval: START("change", T + 1900) },
  { click: `(()=>{const b=[...document.querySelectorAll('.map-mode-button')].find(x=>x.textContent==='My climb').getBoundingClientRect();return [b.x+b.width/2,b.y+b.height/2]})()` },
  { label: "a click on the switch during the trail finishes the entrance at once and goes into My climb", eval: CLICKED },
  { go: "{{BASE}}/work", wait: 6500 },
  warmed,
  { label: "start the change, wait for T + 1200 ms", eval: START("change", T + 1200) },
  { film: { ms: 30, tiles: true } }, // brings the page to the front, so it has the focus (a headless page does not, and `:focus` would not match)
  { label: "a bead that has the focus is shown before the tip reaches it", eval: FOCUS },
  { go: "{{BASE}}/experience", wait: 400 },
  { label: "coming back from My climb replays nothing: the words fade in as before, the trail is whole", eval: BACK },
  // reduced motion and no map
  { ...DESK, reduce: true, intercept: PLAIN, go: "{{BASE}}/work", wait: 6500 },
  { label: "reduced motion: no letters, no drawing; everything fades in together over about 200 ms when the reveal ends", eval: REDUCED },
  { reduce: false, wait: 200 },
  { ...DESK, reduce: false, intercept: [], go: "{{BASE}}/work", wait: 800 },
  { eval: "sessionStorage.setItem('ft:nocanvas','1');sessionStorage.setItem('ft:armLoad','1')" },
  { go: "{{BASE}}/experience", wait: 300 },
  { label: "no canvas: the words still enter (old places), no trail and no beads", eval: NOMAP },
  { eval: "sessionStorage.removeItem('ft:nocanvas')" },
];

if (process.argv[2] === "sheet") {
  const [, , , out, jpg] = process.argv;
  writeFileSync(`${out}/sheet.json`, JSON.stringify(sheetSteps(out, jpg)));
  console.log(`wrote ${out}/sheet.json: BASE=http://localhost:5180 node scripts/audit/cdp.mjs ${out}/sheet.json ${out}/sheets`);
} else {
  writeFileSync(path.join(dir, "experience-entrance.json"), JSON.stringify(steps, null, 1));
  console.log(`wrote experience-entrance.json (${steps.length} steps)`);
}

/** The frame sheet: a row for each of the four films, a column for each of the five moments, from the pictures the film saved (a plain page that cdp.mjs photographs). */
function sheetSteps(out) {
  const TAGS = [["work-1440", "portfolio, 1440 x 900"], ["home-1440", "home, 1440 x 900"], ["work-390", "portfolio, 390 x 844"], ["home-390", "home, 390 x 844"]];
  const NAMES = ["0.6 T", "0.8 T", "T", "T + 1.1 s", "T + 3.2 s"];
  const cells = TAGS.map(([tag, label]) => {
    const files = readdirSync(out, { recursive: false }).filter((f) => f.startsWith(`entr-${tag}-`)).sort();
    return { label, files };
  });
  const wide = 300;
  const DESK_H = Math.round((wide * 900) / 1440);
  const PHONE_H = Math.round((wide * 844) / 390);
  const cell = (file, name, h) => `<div style='position:relative;width:${wide}px;height:${h}px;background:#000'><img src='file://${out}/${file}' style='width:${wide}px;height:${h}px;object-fit:cover;display:block'><span style='position:absolute;left:4px;top:2px;background:#000a;color:#fff;padding:1px 4px;font:11px monospace'>${name}</span></div>`;
  const rows = cells.map((c, i) => c.files.map((f, j) => cell(f, `${c.label}, ${NAMES[j] ?? ""}`, i < 2 ? DESK_H : PHONE_H)).join("")).join("");
  const html = `<body style='margin:0;background:#222;display:grid;grid-template-columns:repeat(5,${wide}px);gap:4px'>${rows}</body>`;
  writeFileSync(`${out}/sheet.html`, html);
  return [{ size: [5 * (wide + 4), 2 * (DESK_H + 4) + 2 * (PHONE_H + 4)], go: `file://${out}/sheet.html`, wait: 900, shot: "r56-6-entrance-sheet" }];
}
