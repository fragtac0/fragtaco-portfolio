// Writes scripts/audit/nav.json: the round 5 home and work checks (kept as they were) followed by the round 6 tour of the
// five addresses (/, /work, /work/long-form, /work/short-form, /experience): every move through the dock, the row,
// the return mark and Esc, then Back and Forward retracing them. Each move prints {ok, got, want}: the address, the title,
// which controls of the dock are current ("label=page|true") and which kind of change ran (read from <html data-change-kind>
// by an observer armed before the move). Needs the production build on :5180.
// usage: node scripts/audit/make-nav.mjs   then   BASE=http://localhost:5180 node scripts/audit/cdp.mjs scripts/audit/nav.json <outdir>
import { readFileSync, writeFileSync } from "node:fs";

const file = new URL("./nav.json", import.meta.url);
const all = JSON.parse(readFileSync(file, "utf8"));
const firstTour = all.findIndex((s) => s.init?.includes("__arm"));
// A click whose change finishes while the page is idle is not advanced by headless Chrome: wait for it inside the page.
const settle = (s) => (s.eval?.endsWith(".click(); 1") ? { ...s, eval: s.eval.replace(/\.click\(\); 1$/, ".click(); new Promise(r=>setTimeout(r,2500)).then(()=>1)"), wait: undefined } : s);
const keep = (firstTour < 0 ? all : all.slice(0, firstTour)).map(settle);

const init = `
try{sessionStorage.setItem('ft:intro-seen','1')}catch(e){}
window.__arm=()=>{const k=new Set();window.__k=k;const h=document.documentElement;
 new MutationObserver(()=>{if(h.dataset.changeKind)k.add(h.dataset.changeKind)}).observe(h,{attributes:true,attributeFilter:['data-change-kind']});return 'armed'};
window.__state=()=>({path:location.pathname,title:document.title,
 active:[...document.querySelectorAll('header[data-site-nav] [aria-current]')].map(e=>e.textContent.replace(', back to the rings','').trim().toLowerCase()+'='+e.getAttribute('aria-current')),
 kind:[...(window.__k||[])].join('+')||'none',
 rowOpen:document.querySelector('.dock-row')?.dataset.open??'no-row',
 hint:document.querySelector('[data-work-tab][aria-current]')?.textContent.endsWith(', back to the rings')??'no-current-link'});
window.__move=(act,want)=>{window.__arm();act();return new Promise(res=>setTimeout(()=>{const got=window.__state();
 const ok=['path','title','kind'].every(k=>got[k]===want[k])&&got.active.join(',')===want.active.join(',');res(JSON.stringify({ok,got,want}))},1900))};
`.trim();

const ROW = (to) => `document.querySelector('header[data-site-nav] [data-work-tab="${to}"]').click()`;
const DOCK = (to) => `document.querySelector('header[data-site-nav] nav[aria-label=Primary] a[href="${to}"]').click()`;
const MARK = `document.querySelector('.return-mark').click()`;
const BACK = `history.back()`;
const FWD = `history.forward()`;

const T = { work: "Work - FragTaco", long: "Long form - FragTaco", short: "Short form - FragTaco", exp: "My experience - FragTaco", home: "FragTaco - Aditya Bhoir" };
const at = (path, title, active, kind) => ({ path, title, active, kind });
const WORK = at("/work", T.work, ["work=page"], "radial");
const LONG = at("/work/long-form", T.long, ["long form=page", "work=true"], "radial");
const SHORT = at("/work/short-form", T.short, ["short form=page", "work=true"], "radial");
const EXP = at("/experience", T.exp, ["my experience=page", "work=true"], "radial");
const HOME = at("/", T.home, ["home=page"], "radial");
const k = (w, kind) => ({ ...w, kind });

// R46.1 (M2): a change started from the keyboard inside the dock leaves focus inside the dock, on the new page's current tab
// (not on <body>): focus a link, press Enter, wait for the change to end, read document.activeElement.
const KEYED = (to) => `new Promise(res=>{const t0=performance.now();const iv=setInterval(()=>{if(location.pathname==='${to}'&&!document.documentElement.dataset.changeKind||performance.now()-t0>5000){clearInterval(iv);setTimeout(()=>{const a=document.activeElement,d=document.querySelector('header[data-site-nav]');res(JSON.stringify({ok:location.pathname==='${to}'&&!!d&&!!a&&a!==document.body&&d.contains(a)&&a.getAttribute('aria-current')!==null,path:location.pathname,active:a?a.tagName+' '+(a.getAttribute('data-work-tab')||a.getAttribute('href')||a.textContent.slice(0,20)):null,current:a&&a.getAttribute('aria-current')}))},700)}},50)})`;
const keyed = (label, focus, to) => [
  { tour: true, label: `focus: ${label}`, eval: `document.querySelector('${focus}').focus(); 1` },
  { tour: true, key: "Enter", vk: 13 },
  { tour: true, label: `keyboard: ${label}: focus stays in the dock on the current tab`, eval: KEYED(to) },
];

const move = (label, act, want) => ({ tour: true, label, eval: `__move(()=>{${act}},${JSON.stringify(want)})` });
const tour = [
  { tour: true, size: [1440, 900], init, go: "{{BASE}}/work", wait: 2500, label: "tour: hard load /work", eval: "JSON.stringify(__state())" },
  move("work -> long form (row, radial)", ROW("/work/long-form"), LONG),
  move("long -> short (row, linear-right)", ROW("/work/short-form"), k(SHORT, "linear-right")),
  move("short -> long (row, linear-left)", ROW("/work/long-form"), k(LONG, "linear-left")),
  move("long -> experience (row, radial)", ROW("/experience"), EXP),
  move("experience -> short (row, radial)", ROW("/work/short-form"), SHORT),
  move("short -> experience (row, radial)", ROW("/experience"), EXP),
  move("experience -> experience again = rings (row, radial)", ROW("/experience"), WORK),
  move("work -> short (row, radial)", ROW("/work/short-form"), SHORT),
  move("short -> rings (return mark, radial)", MARK, WORK),
  move("work -> long (row, radial)", ROW("/work/long-form"), LONG),
  { tour: true, label: "arm for Esc", eval: "__arm()" },
  { tour: true, key: "Escape", vk: 27 },
  { tour: true, label: "long -> rings (Esc, radial)", wait: 1900, eval: "JSON.stringify((()=>{const got=__state();const want=" + JSON.stringify(WORK) + ";return{ok:got.path===want.path&&got.title===want.title&&got.kind===want.kind&&got.active.join()===want.active.join(),got,want}})())" },
  move("work -> short (row, radial)", ROW("/work/short-form"), SHORT),
  move("short -> rings (dock work tab, radial)", DOCK("/work"), WORK),
  move("work -> experience (row, radial)", ROW("/experience"), EXP),
  move("experience -> rings (dock work tab, radial)", DOCK("/work"), WORK),
  move("work -> long (row, radial)", ROW("/work/long-form"), LONG),
  move("long -> home (dock home tab, radial)", DOCK("/"), HOME),
  move("home -> work (dock work tab, radial)", DOCK("/work"), WORK),
  move("work -> experience (row, radial)", ROW("/experience"), EXP),
  move("experience -> home (dock home tab, radial)", DOCK("/"), HOME),
  // Back and Forward retrace the last steps: home <- experience <- work <- home <- long <- work ...
  move("back: home -> experience (radial)", BACK, EXP),
  move("back: experience -> work (radial)", BACK, WORK),
  move("back: work -> home (radial)", BACK, HOME),
  move("back: home -> long (radial)", BACK, LONG),
  move("forward: long -> home (radial)", FWD, HOME),
  move("forward: home -> work (radial)", FWD, WORK),
  move("forward: work -> experience (radial)", FWD, EXP),
  // the sweep between the walls, then Back and Forward over it (Back and Forward are always radial)
  move("experience -> long (row, radial)", ROW("/work/long-form"), LONG),
  move("long -> short (row, linear-right)", ROW("/work/short-form"), k(SHORT, "linear-right")),
  move("back: short -> long (radial)", BACK, LONG),
  move("forward: long -> short (radial)", FWD, SHORT),
  ...keyed("dock Work tab (short form -> rings)", "header[data-site-nav] nav[aria-label=Primary] a[href=\"/work\"]", "/work"),
  ...keyed("row Long form tab (rings -> long form)", "header[data-site-nav] [data-work-tab=\"/work/long-form\"]", "/work/long-form"),
  ...keyed("row My experience tab (long form -> experience)", "header[data-site-nav] [data-work-tab=\"/experience\"]", "/experience"),
  ...keyed("dock Home tab (experience -> home)", "header[data-site-nav] nav[aria-label=Primary] a[href=\"/\"]", "/"),
  { tour: true, label: "hard load /work/short-form (row open at once)", go: "{{BASE}}/work/short-form", wait: 2500, eval: "JSON.stringify(__state())" },
  { tour: true, label: "hard load /experience", go: "{{BASE}}/experience", wait: 2500, eval: "JSON.stringify(__state())" },
  { tour: true, label: "hard load /timeline redirects", go: "{{BASE}}/timeline", wait: 2500, eval: "JSON.stringify(__state())" },
  { tour: true, label: "hard load /work?view=long redirects", go: "{{BASE}}/work?view=long", wait: 2500, eval: "JSON.stringify(__state())" },
  { tour: true, label: "hard load /work?view=clients redirects", go: "{{BASE}}/work?view=clients", wait: 2500, eval: "JSON.stringify(__state())" },
];

const strip = (s) => Object.fromEntries(Object.entries(s).filter(([key]) => key !== "tour"));
writeFileSync(file, JSON.stringify([...keep, ...tour].map((s) => (s.tour ? strip(s) : s)), null, 1) + "\n");
console.log(`nav.json: ${keep.length} kept steps, ${tour.length} tour steps`);
