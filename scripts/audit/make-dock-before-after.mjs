// The dock before and after R56.4 on three pages (R56.4b, Ruling R123: the dock's tint 0.46 with its drop shadow, against the tint of the build without a shadow; for the owner's list).
//
//   node scripts/audit/make-dock-before-after.mjs                                   writes scripts/audit/dock-before-after.json (the steps)
//   BASE=http://localhost:5180 node scripts/audit/cdp.mjs scripts/audit/dock-before-after.json <outdir>
//   node scripts/audit/make-dock-before-after.mjs compose <outdir> <destdir>          crops each pair to the dock and its surroundings, one picture per page: before above, after below
//
// "Before" is made in the page of the build: --dock-tint put back to 0.46 and the old drop shadow (0 18px 60px at 38%) on the glass; "after" is the build as it is. The wall is shown
// in its plain grid (?nogl=1). The wall's pictures are YouTube thumbnails and replacing them in the page did not hold, so the wall's picture goes to docs/redesign/compare/local/ (git-ignored) and
// only the home page and My experience (no thumbnail, no cover) are committed in docs/redesign/compare/round7/.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const PAGES = [
  { name: "home", path: "/", fake: false },
  { name: "wall", path: "/work/long-form?nogl=1", fake: true },
  { name: "experience", path: "/experience", fake: false },
];
const OLD_SHADOW = "0 18px 60px rgba(0,0,0,0.38), inset 0 1px 0 rgba(255,236,214,0.24), inset 0 -1px 0 rgba(255,255,255,0.05)";
const FAKE = String.raw`(()=>{let i=0;for(const img of document.querySelectorAll('img')){if(!/ytimg|openlibrary|covers/.test(img.currentSrc||img.src))continue;i++;img.removeAttribute('srcset');img.removeAttribute('loading');
 const tall=img.naturalHeight>img.naturalWidth,W=tall?360:640,H=tall?640:360,hue=(i*47)%360;
 const svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+W+' '+H+'"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl('+hue+',55%,62%)"/><stop offset="1" stop-color="hsl('+((hue+60)%360)+',60%,40%)"/></linearGradient></defs><rect width="'+W+'" height="'+H+'" fill="url(#g)"/></svg>';
 img.src='data:image/svg+xml;utf8,'+encodeURIComponent(svg)}return i})()`;
const DOCK = "document.querySelector('[data-dock-glass]')";

const steps = [];
PAGES.forEach((p, n) => {
  steps.push({ size: [1440, 900], dpr: 1, mobile: false, touch: false, ...(n === 0 ? { init: "try{sessionStorage.setItem('ft:intro-seen','1')}catch(e){}" } : {}), go: `{{BASE}}${p.path}`, wait: 4500, label: `open|${p.name}`, eval: p.fake ? FAKE : "1" });
  steps.push({ label: `before|${p.name}`, eval: `document.documentElement.style.setProperty('--dock-tint','0.46');${DOCK}.style.boxShadow=${JSON.stringify(OLD_SHADOW)};'before'`, wait: 400 });
  steps.push({ png: `${p.name}-before` });
  steps.push({ label: `after|${p.name}`, eval: `document.documentElement.style.removeProperty('--dock-tint');${DOCK}.style.boxShadow='';getComputedStyle(document.documentElement).getPropertyValue('--dock-tint')`, wait: 400 });
  steps.push({ png: `${p.name}-after` });
});

async function compose(outDir, destDir) {
  const sharp = (await import("sharp")).default;
  for (const p of PAGES) {
    const crop = { left: 220, top: 640, width: 1000, height: 260 };
    const [a, b] = await Promise.all(["before", "after"].map((k) => sharp(`${outDir}/${p.name}-${k}.png`).extract(crop).png().toBuffer()));
    const label = (t) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="26"><rect width="1000" height="26" fill="#111"/><text x="10" y="18" font-family="monospace" font-size="14" fill="#ddd">${t}</text></svg>`);
    await sharp({ create: { width: 1000, height: 2 * (260 + 26), channels: 3, background: "#111" } })
      .composite([{ input: label("before: tint 0.46, drop shadow"), top: 0, left: 0 }, { input: a, top: 26, left: 0 }, { input: label("after: tint from the build, no shadow"), top: 286, left: 0 }, { input: b, top: 312, left: 0 }])
      .jpeg({ quality: 88 }).toFile(`${destDir}/r56-4b-dock-before-after-${p.name}.jpg`);
    console.log("wrote", `${destDir}/r56-4b-dock-before-after-${p.name}.jpg`);
  }
}

if (process.argv[2] === "compose") await compose(process.argv[3], process.argv[4]);
else {
  const file = fileURLToPath(new URL("./dock-before-after.json", import.meta.url));
  writeFileSync(file, JSON.stringify(steps, null, 1) + "\n");
  console.log(`wrote ${steps.length} steps to ${file}`);
}
