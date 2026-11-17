// Writes the steps file for the modern web pass's before/after pictures: the five pages at 1440x900, 390x844 and 320x568.
// usage: node scripts/audit/make-web-pass-pictures.mjs <before|after> > steps.json ; BASE=... node scripts/audit/cdp.mjs steps.json <outdir>
// Pictures of the three video pages (/work and the two walls) show YouTube thumbnails: their names start with `local-` (git-ignored, docs/redesign/compare/local/).
const when = process.argv[2] ?? "after";
const pages = [["home", "/", 7500], ["work", "/work", 4500], ["long-form", "/work/long-form", 4500], ["short-form", "/work/short-form", 4500], ["experience", "/experience", 4500]];
const sizes = [[1440, 900, false], [390, 844, true], [320, 568, true]];
const steps = [{ go: "about:blank", wait: 200 }];
for (const [w, h, phone] of sizes) {
  for (const [name, path, wait] of pages) {
    const local = name === "work" || name.endsWith("-form") ? "local-" : "";
    steps.push({ size: [w, h], dpr: 1, ...(phone ? { mobile: true, touch: true } : {}), nocache: true, reduce: false, go: `{{BASE}}${path}`, wait });
    steps.push({ shot: `${local}${when}-${name}-${w}-warm` });
    steps.push({ shot: `${local}${when}-${name}-${w}` });
  }
}
console.log(JSON.stringify(steps, null, 1));
