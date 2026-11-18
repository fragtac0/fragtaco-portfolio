// Proves the hero's logo is the same two ways: its markup (outerHTML) as the server sends it and as React makes it in the browser on a page change to "/",
// and its picture (a screenshot of that markup on a plain ground), between two servers (usage: BEFORE=http://localhost:5185 AFTER=http://localhost:5180
// node scripts/audit/logo-compare.mjs <outdir>). Written for the security pass, where the logo's inner SVG stopped being written with innerHTML.
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { launch, sleep } from "./chrome-lite.mjs";

const [outDir] = process.argv.slice(2);
const sha = (s) => createHash("sha256").update(s).digest("hex").slice(0, 16);
const out = {};
for (const [name, base] of [["before", process.env.BEFORE], ["after", process.env.AFTER]]) {
  if (!base) throw new Error("BEFORE and AFTER (server addresses) are needed");
  const c = await launch({ width: 1400, height: 400, dpr: 2 });
  await c.send("Page.addScriptToEvaluateOnNewDocument", { source: "try{sessionStorage.setItem('ft:intro-seen','1');sessionStorage.setItem('ft:debug-change','1')}catch(e){}" });
  await c.send("Page.navigate", { url: `${base}/` });
  await sleep(6000);
  const server = await c.evaluate(`document.querySelector(".home-hero .logo").outerHTML`);
  await c.send("Page.navigate", { url: `${base}/work` });
  await sleep(4000);
  await c.evaluate(`window.__ftChange("/")`); // React makes the logo in the browser
  await sleep(7000);
  const client = await c.evaluate(`document.querySelector(".home-hero .logo")?.outerHTML ?? null`);
  await c.send("Page.navigate", { url: "about:blank" });
  await sleep(300);
  await c.evaluate(`document.body.style.cssText="margin:0;background:#0d0c0b";document.body.innerHTML=${JSON.stringify(server)};const s=document.querySelector("svg");s.style.cssText="width:1228px;height:296px;display:block;margin:20px";s.setAttribute("fill","#fdfce6");`);
  await sleep(300);
  const shot = await c.send("Page.captureScreenshot", { format: "png" });
  if (outDir) writeFileSync(`${outDir}/logo-${name}.png`, Buffer.from(shot.data, "base64"));
  out[name] = { serverMarkup: sha(server), clientMarkup: client ? sha(client) : null, picture: sha(shot.data), markupLength: server.length };
  await c.close();
}
out.same = out.before.serverMarkup === out.after.serverMarkup && out.before.clientMarkup === out.after.clientMarkup && out.before.serverMarkup === out.before.clientMarkup && out.before.picture === out.after.picture;
console.log(JSON.stringify(out, null, 1));
process.exit(out.same ? 0 : 1);
