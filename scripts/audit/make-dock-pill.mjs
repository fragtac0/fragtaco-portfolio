// Appends the R49.3 checks to scripts/audit/dock-row.json (replacing an earlier run of them): the dock's highlight and the open tab.
//  1. pill: on every dock change (home to work and back, a wall to home, at 1440 by 900 and 390 by 844) a frame recorder reads the
//     highlight's place against the dock's tab row (not the screen) from the click until 1.2 s after: its left moves one way only
//     (monotonic, no overshoot past the two ends, 0.5 px of noise allowed), its top stays level with the tab row (the home dock rises
//     after a change and the old shared-layout pill sprang up and down against it: 13 px at 1440 by 900), and it ends under the
//     current tab. Reduced motion: it is on the new tab at once.
//  2. open tab: a click, Enter and Space on the tab of the page that is open (the dock's Work on /work, the row's Long form on
//     /work/long-form, My experience on /experience) leave the address, history length, the page's <main> element and focus as they
//     were, and no page change runs (`data-change-kind` never set).
// usage: node scripts/audit/make-dock-pill.mjs   then   BASE=http://localhost:5180 node scripts/audit/cdp.mjs scripts/audit/dock-row.json <outdir>   (production build on :5180)
import { readFileSync, writeFileSync } from "node:fs";

const file = new URL("./dock-row.json", import.meta.url);
const GROUP = "dock-pill";
const all = JSON.parse(readFileSync(file, "utf8")).filter((s) => s.group !== GROUP);

const init = `
try{sessionStorage.setItem('ft:intro-seen','1')}catch(e){}
window.__pill=(act,ms,expectMove)=>new Promise(res=>{
 const S=[];const t0=performance.now();let clicked=false;
 const f=()=>{const n=performance.now()-t0;
  if(n>200&&!clicked){clicked=true;act()}
  const tabs=document.querySelector('header[data-site-nav] .dock-tabs'),p=document.querySelector('header[data-site-nav] .dock-pill');
  if(tabs&&p){const a=tabs.getBoundingClientRect(),b=p.getBoundingClientRect();S.push([Math.round(n),+(b.left-a.left).toFixed(2),+(b.top-a.top).toFixed(2),location.pathname])}
  if(n<ms)requestAnimationFrame(f);else{
   const xs=S.map(s=>s[1]),ys=S.map(s=>s[2]);
   const d=xs.slice(1).map((x,i)=>x-xs[i]).filter(v=>Math.abs(v)>0.01);
   const up=d.filter(v=>v>0).length,down=d.filter(v=>v<0).length;
   const lo=Math.min(xs[0],xs.at(-1)),hi=Math.max(xs[0],xs.at(-1));
   const cur=document.querySelector('header[data-site-nav] .dock-tabs a[aria-current]');const tabs2=document.querySelector('header[data-site-nav] .dock-tabs');
   const want=cur?cur.getBoundingClientRect().left-tabs2.getBoundingClientRect().left:null;
   const moved=Math.abs(xs.at(-1)-xs[0]);
   const r={monotonic:up===0||down===0,noOvershoot:Math.min(...xs)>=lo-0.5&&Math.max(...xs)<=hi+0.5,level:Math.max(...ys)-Math.min(...ys)<=0.5,
    endsUnderCurrent:want!=null&&Math.abs(xs.at(-1)-want)<=0.5,moved:expectMove?moved>20:moved<=0.5};
   r.ok=Object.values(r).every(Boolean);
   res(JSON.stringify({ok:r.ok,checks:r,from:+xs[0].toFixed(1),to:+xs.at(-1).toFixed(1),frames:S.length,levelRange:+(Math.max(...ys)-Math.min(...ys)).toFixed(2),path:location.pathname,steps:d.length}))}};
 requestAnimationFrame(f)});
window.__snap=()=>{const h=document.documentElement;window.__k=new Set();new MutationObserver(()=>{if(h.dataset.changeKind)window.__k.add(h.dataset.changeKind)}).observe(h,{attributes:true,attributeFilter:['data-change-kind']});
 window.__s={href:location.href,hist:history.length,main:document.querySelector('main'),focus:document.activeElement};return 'snap'};
window.__same=(sel,wantFocus)=>new Promise(res=>setTimeout(()=>{const s=window.__s,a=document.activeElement;
 const r={address:location.href===s.href,history:history.length===s.hist,mainKept:document.querySelector('main')===s.main,noChange:window.__k.size===0&&!document.documentElement.dataset.changeKind,
  focusKept:wantFocus?a===document.querySelector(sel):(a===s.focus||a===document.querySelector(sel))};r.ok=Object.values(r).every(Boolean);res(JSON.stringify({ok:r.ok,checks:r,at:location.pathname,kinds:[...window.__k]}))},1500));
`.trim();

const DOCK = (to) => `document.querySelector('header[data-site-nav] nav[aria-label=Primary] a[href="${to}"]').click()`;
const run = (label, act, move = true, ms = 1800) => ({ group: GROUP, label: `pill: ${label}`, eval: `__pill(()=>{${act}},${ms},${move})` });
const open = (label, path, sel) => [
  { group: GROUP, label: `open tab: ${label}: hard load`, go: `{{BASE}}${path}`, wait: 2800, eval: "__snap()" },
  { group: GROUP, click: `(()=>{const r=document.querySelector('${sel}').getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2]})()` },
  { group: GROUP, label: `open tab: ${label}: mouse click does nothing`, eval: `__same('${sel}',false)` },
  { group: GROUP, label: `open tab: ${label}: focus it`, eval: `document.querySelector('${sel}').focus();__snap()` },
  { group: GROUP, key: "Enter", vk: 13 },
  { group: GROUP, label: `open tab: ${label}: Enter does nothing, focus stays`, eval: `__same('${sel}',true)` },
  { group: GROUP, eval: "__snap()" },
  { group: GROUP, key: " ", vk: 32 },
  { group: GROUP, label: `open tab: ${label}: Space does nothing, focus stays`, eval: `__same('${sel}',true)` },
];
const phone = [{ group: GROUP, size: [390, 844], dpr: 3, mobile: true, touch: true }];
const desk = [{ group: GROUP, size: [1440, 900], dpr: 1, mobile: false, touch: false }];

const steps = [
  ...desk,
  { group: GROUP, init, go: "{{BASE}}/", wait: 4500 },
  run("1440: home -> work (dock Work tab)", DOCK("/work")),
  { group: GROUP, wait: 1500 },
  run("1440: work -> home (dock Home tab)", DOCK("/")),
  { group: GROUP, wait: 1500 },
  run("1440: home -> work again", DOCK("/work")),
  { group: GROUP, wait: 1500 },
  run("1440: work -> long form (row: the pill stays on Work)", `document.querySelector('header[data-site-nav] [data-work-tab="/work/long-form"]').click()`, false, 1800),
  { group: GROUP, wait: 1500 },
  run("1440: long form -> home", DOCK("/")),
  { group: GROUP, wait: 1500 },
  ...phone,
  { group: GROUP, go: "{{BASE}}/", wait: 4500 },
  run("390: home -> work", DOCK("/work")),
  { group: GROUP, wait: 1500 },
  run("390: work -> home", DOCK("/")),
  { group: GROUP, wait: 1500 },
  ...desk,
  { group: GROUP, reduce: true },
  { group: GROUP, go: "{{BASE}}/", wait: 4500 },
  run("reduced motion: home -> work (on the new tab at once)", DOCK("/work")),
  { group: GROUP, wait: 1000 },
  { group: GROUP, reduce: false },
  ...open("dock Work on /work", "/work", "header[data-site-nav] nav[aria-label=Primary] a[href=\"/work\"]"),
  ...open("row Long form on /work/long-form", "/work/long-form", "header[data-site-nav] [data-work-tab=\"/work/long-form\"]"),
  ...open("row Short form on /work/short-form", "/work/short-form", "header[data-site-nav] [data-work-tab=\"/work/short-form\"]"),
  ...open("row My experience on /experience", "/experience", "header[data-site-nav] [data-work-tab=\"/experience\"]"),
];

writeFileSync(file, JSON.stringify([...all, ...steps], null, 1) + "\n");
console.log(`dock-row.json: ${all.length} kept steps, ${steps.length} dock-pill steps`);
