// Writes scripts/audit/arrival.json: the review-focus steps of the arrival check, run with cdp.mjs (see make-arrival.mjs).
//   node scripts/audit/make-arrival-steps.mjs        (or `make-arrival.mjs steps`)
// Every step that checks something answers with an `ok` (true or false), so the file's result is read without judging each step. Held requests are held
// for a finite time (HANG_MS), so the run exits by itself once the steps are done.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const HANG_MS = 9000;
const HEADER = "header[data-site-nav]";

const wait = (expr, ms = 6000) => `await new Promise((res) => { const t0 = performance.now(); const id = setInterval(() => { if ((${expr}) || performance.now() - t0 > ${ms}) { clearInterval(id); res(); } }, 16); });`;
const click = (sel) => `document.querySelector(${JSON.stringify(sel)}).click();`;
const state = `({ path: location.pathname, kind: document.documentElement.dataset.changeKind ?? null, hold: 'changeHold' in document.documentElement.dataset, late: document.documentElement.dataset.arrivalLate ?? null, glass: document.documentElement.dataset.glass ?? null, busy: document.documentElement.dataset.changeBusy ?? null, focus: document.activeElement?.getAttribute('data-work-tab') || document.activeElement?.getAttribute('href') || document.activeElement?.tagName })`;
const hang = (ms = HANG_MS) => [".webp", ".jpg", ".jpeg", ".png", ".avif", ".svg", "i.ytimg.com", "covers.openlibrary"].map((match) => ({ match, delay: ms }));
const tab = (path) => `${HEADER} [data-work-tab="${path}"]`;
const settle = (ms = 700) => `await new Promise((r) => setTimeout(r, ${ms}));`;

/**
 * Review focus 1 (arrival.ts): a late part fades in over 200 ms and moves nothing else, whether it comes while the reveal runs (a delay of 1.5 s) or after the change has
 * ended (4 s). Every request whose address contains `match` is held for `delay` ms (cache off); the probe clicks `link`, samples `target`'s opacity every frame, and reads
 * that the part came after the reveal began (and, for 4 s, after the change had ended), that its first reading after it came is under 0.5 (it did not pop), that it
 * reached 1 in 120 to 300 ms and never dipped after, and that nothing else in `scope` (boxes, opacity; canvases, the rings, the wall's canvas and what `ignore` names left out: the wall's links fade out
 * under the engine when it takes over, by design) changed meanwhile.
 */
function lateProbe({ name, start, link, match, delay, target, pick = "all", scope, ignore = "", needsNetwork = false }) {
  const probe = `(async () => {
    const html = document.documentElement;
    const link = ${link};
    if (!link) return { ok: false, err: 'no link' };
    const skip = (el) => el.closest(${JSON.stringify("canvas, svg, .work-rings, .wall-canvas-host, [data-glass-warm]" + (ignore ? ", " + ignore : ""))});
    const snap = (ignore) => { const out = {}; const roots = [...document.querySelectorAll(${JSON.stringify(scope)}), document.querySelector('[data-dock-glass]')].filter(Boolean); let n = 0;
      for (const root of roots) for (const el of [root, ...root.querySelectorAll('*')]) { if (skip(el) || ignore.some((t) => t.contains(el))) continue; const r = el.getBoundingClientRect(); out[n++ + ':' + el.tagName + '.' + String(el.className).slice(0, 24)] = [r.x, r.y, r.width, r.height, +getComputedStyle(el).opacity]; } return out; };
    const pickTargets = () => { const all = [...document.querySelectorAll(${JSON.stringify(target)})].filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.right > 0 && r.bottom > 0 && r.left < innerWidth && r.top < innerHeight; }); return ${pick === "last" ? "all.slice(-1)" : "all"}; };
    const seen = new Map(); // element -> samples [t, opacity, in]
    const marks = () => { const m = performance.getEntriesByName('arrival-go').at(-1); return m && m.startTime > t0 ? m.startTime - t0 : null; };
    let before = null, after = null, overAt = null, doneAt = null;
    const t0 = performance.now();
    link.click();
    await new Promise((res) => { const loop = () => {
      const t = performance.now() - t0;
      if (overAt === null && t > 100 && !html.dataset.changeKind) overAt = t;
      const go = marks();
      for (const el of pickTargets()) { if (!seen.has(el)) seen.set(el, []); seen.get(el).push([t, +getComputedStyle(el).opacity, el.complete && el.naturalWidth > 0]); }
      const targets = [...seen.keys()];
      // (nothing is called done before the held requests can have come: ${delay} ms; the hero's placeholder is in and at 1 long before its sharp painting)
      // the first moment a part is in after the reveal began: what else is on the page is photographed then, and 450 ms later (a late part must move nothing)
      if (before === null && go !== null && targets.some((el) => { const s = seen.get(el); const i = s.findIndex((x) => x[2]); return i >= 0 && s[i][0] > go; })) { before = snap(targets); setTimeout(() => { after = snap(targets); }, 450); }
      if (doneAt === null && t > ${delay} + 150 && targets.length && targets.every((el) => seen.get(el).some((x) => x[2] && x[1] >= 0.99))) doneAt = t;
      if ((doneAt !== null && t > doneAt + 700 && (after || go === null || before === null)) || t > ${delay} + 7000) return res();
      requestAnimationFrame(loop); }; requestAnimationFrame(loop); });
    const goAt = marks() ?? -1;
    const rows = [...seen.entries()].map(([el, s]) => {
      const i = s.findIndex((x) => x[2]);
      if (i < 0) return { never: true };
      const first = s[i], rest = s.slice(i);
      const up = rest.find((x) => x[1] >= 0.99), start = rest.find((x) => x[1] > 0.02);
      const dips = rest.filter((x) => up && x[0] > up[0] && x[1] < 0.97).length;
      return { arrivedMs: Math.round(first[0]), startOp: +rest[0][1].toFixed(2), rampMs: up && start ? Math.round(up[0] - start[0]) : null, dips, late: first[0] > goAt };
    });
    const lateRows = rows.filter((r) => r.late && !r.never);
    const diff = (a, b) => { const moved = [], faded = []; if (a && b) for (const k of Object.keys(a)) { if (!b[k]) continue; if (Math.abs(a[k][0] - b[k][0]) > 1 || Math.abs(a[k][1] - b[k][1]) > 1 || Math.abs(a[k][2] - b[k][2]) > 1 || Math.abs(a[k][3] - b[k][3]) > 1) moved.push(k); if (Math.abs(a[k][4] - b[k][4]) > 0.05) faded.push(k); } return { moved: moved.slice(0, 6), faded: faded.slice(0, 6) }; };
    const elsewhere = diff(before, after);
    const arrivedAt = lateRows.length ? Math.min(...lateRows.map((r) => r.arrivedMs)) : null;
    const res = { part: ${JSON.stringify(name)}, delayMs: ${delay}, targets: rows.length, late: lateRows.length, arrivedMs: arrivedAt, revealBeganMs: Math.round(goAt), neverIn: rows.filter((r) => r.never).length, changeOverMs: overAt === null ? null : Math.round(overAt),
      arrivedAfterReveal: arrivedAt !== null && arrivedAt > goAt, arrivedAfterChangeEnd: arrivedAt !== null && overAt !== null && arrivedAt > overAt,
      startOpMax: lateRows.length ? Math.max(...lateRows.map((r) => r.startOp)) : null, rampMs: lateRows.length ? [Math.min(...lateRows.map((r) => r.rampMs ?? 9999)), Math.max(...lateRows.map((r) => r.rampMs ?? 0))] : null,
      dips: lateRows.reduce((n, r) => n + r.dips, 0), elsewhere };
    res.ok = ${needsNetwork ? "res.targets === 0 || " : ""}(res.late > 0 && res.arrivedAfterReveal && ${delay >= 4000 ? "res.arrivedAfterChangeEnd && " : ""}res.startOpMax < 0.5 && res.rampMs[0] >= 120 && res.rampMs[1] <= 320 && res.dips === 0 && res.elsewhere.moved.length === 0 && res.elsewhere.faded.length === 0);
    return res;
  })()`;
  return [
    { label: `RF6 ${name} ${delay} ms: fresh load, cache off`, intercept: [], nocache: true, go: `{{BASE}}${start}`, wait: 4500 },
    { intercept: [{ match, delay }], label: `RF6 ${name} ${delay} ms: arm` },
    { label: `RF6 ${name}: late part comes ${delay} ms after the click, fades in over about 200 ms, nothing else moves`, eval: probe },
    { intercept: [], label: `RF6 ${name} ${delay} ms: disarm` },
    { eval: `new Promise((r) => setTimeout(() => r(1), 4000))`, label: "RF6 let the change end" },
  ];
}

export function writeSteps() {
  const wall = tab("/work/long-form");
  const steps = [
    { size: [1440, 900], dpr: 2, init: "try{sessionStorage.setItem('ft:intro-seen','1');sessionStorage.setItem('ft:debug-change','1')}catch(e){}", go: "{{BASE}}/work", wait: 6000 },
    // Review focus 1: a destination whose pictures never load (held 9 s). The reveal starts at the cap (500 ms), the change ends, nothing is left held, the late parts are named.
    { label: "RF1 arm: every picture held (data-change-hold goes at the cap, not never)", intercept: hang() },
    { label: "RF1 pictures never load: hold length, late parts, the change ends", eval: `(async () => { const html = document.documentElement; ${click(wall)} const t0 = performance.now(); let holdOn = null, holdOff = null, lateAtOff = null; await new Promise((res) => { const id = setInterval(() => { const h = 'changeHold' in html.dataset; if (h && holdOn === null) holdOn = performance.now() - t0; if (!h && holdOn !== null && holdOff === null) { holdOff = performance.now() - t0; lateAtOff = html.dataset.arrivalLate ?? null; } if ((holdOff !== null && !html.dataset.changeKind) || performance.now() - t0 > 9000) { clearInterval(id); res(); } }, 8); }); const r = { holdOnMs: Math.round(holdOn), holdOffMs: Math.round(holdOff), holdLengthMs: Math.round(holdOff - holdOn), lateAtOff, ended: !html.dataset.changeKind, ...${state} }; const m = (n) => performance.getEntriesByName(n).at(-1)?.startTime ?? null; r.markHoldMs = m('arrival-hold') !== null && m('arrival-go') !== null ? Math.round(m('arrival-go') - m('arrival-hold')) : null; /* the cap is counted from the transition's ready: holdLengthMs also has the wait for it */ r.ok = r.markHoldMs !== null && r.markHoldMs >= 480 && r.markHoldMs <= 530 && r.holdLengthMs <= 700 && r.ended && !r.hold && !!lateAtOff; return r; })()` },
    { intercept: [], label: "RF1 disarm" },
    // Review focus 2: a press, Back, or a second link during the hold. Each finishes or replaces the change; nothing stays held. The hold is made long by holding every picture.
    { label: "RF2 reload on the portfolio page", go: "{{BASE}}/work", wait: 4500 },
    { intercept: hang(), label: "RF2 arm" },
    { label: "RF2a a pointer press during the hold finishes the change at once and nothing is held", eval: `(async () => { const html = document.documentElement; ${click(wall)} ${wait("'changeHold' in html.dataset")} await new Promise((r) => setTimeout(r, 150)); const during = ${state}; window.__ftFinish && window.__ftFinish(); ${wait("!html.dataset.changeKind")} ${settle()} const after = ${state}; return { during, after, ok: during.hold === true && after.kind === null && after.hold === false && after.busy === null && after.path === '/work/long-form' }; })()` },
    { intercept: [], label: "RF2 disarm" },
    { label: "RF2b Back during the hold ends the change at once, no second reveal", go: "{{BASE}}/work", wait: 4500 },
    { intercept: hang(), label: "RF2b arm" },
    { label: "RF2b Back", eval: `(async () => { const html = document.documentElement; ${click(wall)} ${wait("'changeHold' in html.dataset")} await new Promise((r) => setTimeout(r, 150)); const during = ${state}; history.back(); ${wait("!html.dataset.changeKind && !('changeHold' in html.dataset)")} ${settle(900)} const after = ${state}; const glass = document.getAnimations().filter((a) => a.animationName === 'glass-p').length; return { during, after, glassAnimations: glass, ok: during.hold === true && after.kind === null && after.hold === false && (after.path === '/work' || after.path === '/work/') && glass === 0 }; })()` },
    { intercept: [], label: "RF2 disarm" },
    { label: "RF2c a second click on another link during the hold replaces the change, nothing stays held", go: "{{BASE}}/work", wait: 4500 },
    { intercept: hang(), label: "RF2c arm" },
    { label: "RF2c a second link", eval: `(async () => { const html = document.documentElement; ${click(wall)} ${wait("'changeHold' in html.dataset")} await new Promise((r) => setTimeout(r, 150)); const during = ${state}; window.__ftChange && window.__ftChange('/experience'); ${settle(900)} window.__ftFinish && window.__ftFinish(); ${wait("!html.dataset.changeKind")} ${settle()} const after = ${state}; return { during, after, ok: during.hold === true && after.kind === null && after.hold === false && after.path === '/experience' }; })()` },
    { intercept: [], label: "RF2 disarm" },
    // Review focus 5: focus in the dock's second row stays where it was across a change between two pages that both have the row (one dock), and is put back when the dock is made again (My experience).
    { label: "RF5a long form, the row's Short form link focused", go: "{{BASE}}/work/long-form", wait: 6000 },
    { label: "RF5a focus the row's Short form link and press Enter", eval: `(async () => { const a = document.querySelector(${JSON.stringify(tab("/work/short-form"))}); a.focus(); window.__rf5 = { el: a, before: ${state} }; return window.__rf5.before; })()` },
    { key: "Enter" },
    { label: "RF5a after the change: the same link has focus (the dock is the same element), the row never closed", eval: `(async () => { const html = document.documentElement; ${wait("!html.dataset.changeKind && location.pathname === '/work/short-form'", 7000)} const row = document.querySelector('.dock-row'); const r = { ...${state}, sameElement: document.activeElement === window.__rf5.el, rowPresent: !!row, rowOpacity: row && getComputedStyle(row).opacity, rowInert: row ? row.hasAttribute('inert') : null }; r.ok = r.sameElement && r.rowPresent && r.rowInert === false && r.path === '/work/short-form' && !r.kind; return r; })()` },
    { label: "RF5b the dock's box does not change across a change between two row pages", eval: `(async () => { const html = document.documentElement; const box = () => { const r = document.querySelector('[data-dock-glass]').getBoundingClientRect(); return [r.x, r.y, r.width, r.height].map((v) => Math.round(v * 10) / 10); }; const before = box(); const seen = new Set([before.join()]); ${click(tab("/work/long-form"))} await new Promise((res) => { const t0 = performance.now(); const id = setInterval(() => { seen.add(box().join()); if ((!html.dataset.changeKind && location.pathname === '/work/long-form') || performance.now() - t0 > 7000) { clearInterval(id); res(); } }, 16); }); return { before, after: box(), distinctBoxes: seen.size, ok: seen.size === 1 }; })()` },
    // the dock is made again (the work layout has the rings and the walls; My experience has its own): focus in the row is put back on the new dock's current tab
    { label: "RF5c focus the row's My experience link (from the long form wall) and press Enter", eval: `(async () => { const a = document.querySelector(${JSON.stringify(tab("/experience"))}); a.focus(); window.__rf5c = { el: a, before: ${state} }; return window.__rf5c.before; })()` },
    { key: "Enter" },
    { label: "RF5c after the change into My experience: the dock was made again, focus is on its current tab (the row's My experience link), the row is there", eval: `(async () => { const html = document.documentElement; ${wait("!html.dataset.changeKind && location.pathname === '/experience'", 7000)} ${settle(300)} const at = document.activeElement; const row = document.querySelector('.dock-row'); const r = { ...${state}, remade: at !== window.__rf5c.el, onCurrentTab: !!at && at.getAttribute('data-work-tab') === '/experience' && at.getAttribute('aria-current') === 'page', inDock: !!at && !!at.closest('header[data-site-nav]'), rowPresent: !!row, rowInert: row ? row.hasAttribute('inert') : null }; r.ok = r.onCurrentTab && r.inDock && r.rowPresent && r.rowInert === false && r.path === '/experience' && !r.kind; return r; })()` },
    // Review focus 1, the other half: a part that is late (1.5 s: while the reveal runs; 4 s: after the change has ended) fades in over about 200 ms and moves nothing else.
    { size: [1440, 900], dpr: 2 },
    ...[1500, 4000].flatMap((delay) => [
      ...lateProbe({ name: "the map's picture", start: "/work", link: `document.querySelector(${JSON.stringify(tab("/experience"))})`, match: "/mars/relief", delay, target: ".map-plane img", pick: "last", scope: ".map-page", ignore: ".map-heading, .map-caption, .map-pins" }), // R56.6: the words and the beads come in on a clock after the reveal (round 7 second look spec 8)
      ...lateProbe({ name: "the ground's still", start: "/", link: `[...document.querySelectorAll('${HEADER} a')].find((a) => a.getAttribute('href') === '/work')`, match: "/grounds/eclipse", delay, target: '.eclipse-still[data-on="true"] img', scope: ".work-page" }),
      // after the change has ended the painting engine is running and loads and reveals its own first painting (use-paint-engine, use-painting-cycle), so the hero's late sharp copy is a 1.5 s case only
      ...(delay < 3000 ? lateProbe({ name: "the hero's sharp painting", start: "/work", link: `[...document.querySelectorAll('${HEADER} a')].find((a) => a.getAttribute('href') === '/')`, match: "/paintings/", delay, target: ".paint-host img.paint-still", pick: "last", scope: "#hero .hero-layer" }) : []),
      ...lateProbe({ name: "the ring covers", start: "/", link: `[...document.querySelectorAll('${HEADER} a')].find((a) => a.getAttribute('href') === '/work')`, match: "ytimg.com", delay, target: ".work-cover img", scope: ".work-page", needsNetwork: true }),
      ...lateProbe({ name: "the wall's pictures", start: "/work", link: `document.querySelector(${JSON.stringify(tab("/work/long-form"))})`, match: "ytimg.com", delay, target: ".wall-tile img", scope: ".wall-stage", ignore: ".wall-links", needsNetwork: true }),
    ]),
    // leave nothing held: the page is taken away from every interception before the run ends
    { intercept: [], label: "RF end: disarm every held request" },
    { go: "about:blank", wait: 200 },
  ];
  writeFileSync(new URL("./arrival.json", import.meta.url), JSON.stringify(steps, null, 1) + "\n");
  console.log("wrote scripts/audit/arrival.json");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) writeSteps();
