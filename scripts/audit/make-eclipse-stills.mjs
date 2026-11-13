#!/usr/bin/env node
// Draws the Eclipse ground's still pictures (round 7, Task 7) from the shader itself, so the still shown first, under reduced
// motion and where WebGL is missing is the shader's own first frame (clock 0, grain on) and not a lookalike.
//
//   node scripts/audit/make-eclipse-stills.mjs
//
// Reads FRAGMENT_SRC and VERTEX_SRC from app/components/ground/eclipse-shader.ts and the settings from eclipse-look.ts, draws each
// placement in headless Chrome (WebGL 1) at 640 by 400 (landscape) and 360 by 640 (portrait) and writes
// public/grounds/eclipse-<placement>.webp and eclipse-<placement>-tall.webp with sharp. The shader's own grain is in the
// picture; it is dithered a little more by the encoder, which is what keeps the dark gradient from banding.
// Env: ECLIPSE_QUALITY (WebP quality, default 92). Writes nothing outside public/grounds/.
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const outDir = path.join(root, "public/grounds");
const QUALITY = Number(process.env.ECLIPSE_QUALITY ?? 92);
const SIZES = [
  { suffix: "", w: 640, h: 400 },
  { suffix: "-tall", w: 360, h: 640 },
];
const PLACEMENTS = [0, 1, 2, 3];

const shaderSource = readFileSync(path.join(root, "app/components/ground/eclipse-shader.ts"), "utf8");
const lookSource = readFileSync(path.join(root, "app/components/ground/eclipse-look.ts"), "utf8");
const literal = (name) => {
  const match = new RegExp(`export const ${name} =\\s*([\`"])([\\s\\S]*?)\\1;`).exec(shaderSource);
  if (!match) throw new Error(`${name} not found in eclipse-shader.ts`);
  return match[2];
};
const FRAGMENT = literal("FRAGMENT_SRC");
const VERTEX = literal("VERTEX_SRC");
const settings = /ECLIPSE = \{ move: ([\d.]+), noise: ([\d.]+), grain: ([\d.]+) \}/.exec(lookSource);
const clock = /START_CLOCK = ([\d.]+)/.exec(lookSource);
if (!settings || !clock) throw new Error("settings not found in eclipse-look.ts");
const [, , NOISE, GRAIN] = settings.map(Number);
const CLOCK = Number(clock[1]);

const work = mkdtempSync(path.join(tmpdir(), "eclipse-stills-"));
const port = 9333 + Math.floor(Math.random() * 400);
const chrome = spawn("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", [
  "--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${work}/profile`, "--no-first-run", "about:blank",
], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
try {
  let wsUrl;
  for (let i = 0; i < 50 && !wsUrl; i++) {
    await sleep(200);
    try {
      wsUrl = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((t) => t.type === "page")?.webSocketDebuggerUrl;
    } catch { /* not up yet */ }
  }
  const ws = new WebSocket(wsUrl);
  await new Promise((r) => ws.addEventListener("open", r, { once: true }));
  let id = 0;
  const pending = new Map();
  ws.addEventListener("message", (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  });
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });

  const draw = (place, w, h) => `(() => {
    const cv = document.createElement("canvas"); cv.width = ${w}; cv.height = ${h};
    const gl = cv.getContext("webgl", { antialias: false, preserveDrawingBuffer: true });
    if (!gl) return "";
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, ${JSON.stringify(VERTEX)})); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, ${JSON.stringify(FRAGMENT)})); gl.linkProgram(pr); gl.useProgram(pr);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const a = gl.getAttribLocation(pr, "a"); gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
    gl.viewport(0, 0, ${w}, ${h});
    gl.uniform2f(gl.getUniformLocation(pr, "uRes"), ${w}, ${h}); gl.uniform1f(gl.getUniformLocation(pr, "uT"), ${CLOCK});
    gl.uniform1f(gl.getUniformLocation(pr, "uPlace"), ${place}); gl.uniform1f(gl.getUniformLocation(pr, "uNoise"), ${NOISE}); gl.uniform1f(gl.getUniformLocation(pr, "uGrain"), ${GRAIN});
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    return cv.toDataURL("image/png");
  })()`;

  mkdirSync(outDir, { recursive: true });
  for (const place of PLACEMENTS) {
    for (const { suffix, w, h } of SIZES) {
      const res = await send("Runtime.evaluate", { expression: draw(place, w, h), returnByValue: true });
      const url = res.result?.result?.value;
      if (!url) throw new Error(`placement ${place} ${w}x${h}: no picture (${JSON.stringify(res.result?.exceptionDetails ?? res.result)})`);
      const file = path.join(outDir, `eclipse-${place}${suffix}.webp`);
      await sharp(Buffer.from(url.split(",")[1], "base64")).webp({ quality: QUALITY, effort: 6 }).toFile(file);
      console.log(`${path.relative(root, file)}  ${w}x${h}  ${(statSync(file).size / 1024).toFixed(1)} KB`);
    }
  }
  ws.close();
} finally {
  chrome.kill();
  await new Promise((r) => chrome.once("exit", r));
  rmSync(work, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
