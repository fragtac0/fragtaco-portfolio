// What dock-over-tiles.json runs inside the page for the foot picture (R56.4 and its fix round R56.4b). Plain strings of browser code (see dock-over-tiles-page.mjs).
//
//  - __bring(where)  puts a REAL ring tile (the ring's own animation, paused at the phase chosen) at the dock: 'centre' nearest to its middle; 'left', 'right', 'top', 'bottom'
//                  the phase where the tile reaches that edge best (it lies over the strip 2 to 10 px outside the edge, over the largest share of the shorter of its own
//                  extent and the side). Prints both boxes and how far it reaches, so the foot picture is of the page as it is, not of a stand-in.
//  - __reach()     for each side, the most any video tile of any ring reaches that edge at any phase (0 to 1): a side no ring reaches at this size cannot be tested there.
//  - __oldShadow(on)  the dock's old drop shadow (0 18px 60px at 38%) put back, for the negative control: the foot check must fail with it.
//  - __fake()      generated pictures on every tile (nothing from a third party), for the pictures that are committed.
//  - __dockShow(on) hides / shows the dock only (visibility), for the same picture without it.
export const footPage = String.raw`
window.__dockShow=(on)=>{document.querySelector('[data-site-nav]').style.visibility=on?'':'hidden';return on?'dock shown':'dock hidden'};
window.__oldShadow=(on)=>{document.querySelector('[data-dock-glass]').style.boxShadow=on?'0 18px 60px rgba(0,0,0,0.38), inset 0 1px 0 rgba(255,236,214,0.24), inset 0 -1px 0 rgba(255,255,255,0.05)':'';return on?'old shadow':'no shadow'};
window.__fake=()=>{let i=0;for(const img of document.querySelectorAll('.work-cover img')){i++;const tall=img.closest('.work-item').dataset.ring==='short';
 const W=tall?360:640,H=tall?640:360,hue=(i*47)%360;
 const svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+W+' '+H+'"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl('+hue+',55%,60%)"/><stop offset="1" stop-color="hsl('+((hue+60)%360)+',60%,38%)"/></linearGradient></defs><rect width="'+W+'" height="'+H+'" fill="url(#g)"/><text x="'+W/2+'" y="'+(H/2+30)+'" font-family="monospace" font-size="'+Math.round(H*.22)+'" text-anchor="middle" fill="rgba(255,255,255,.9)">'+i+'</text></svg>';
 img.src='data:image/svg+xml;utf8,'+encodeURIComponent(svg)}return i};
const turning=ul=>ul.getAnimations({subtree:true}).filter(a=>a.animationName==='work-spin'||a.animationName==='work-unspin');
const cover=(lo,hi,a0,a1)=>Math.max(0,Math.min(hi,a1)-Math.max(lo,a0))/Math.min(hi-lo,a1-a0);
const reachOf=(side,d,r)=>side==='left'?(r.left<=d.left-2&&r.right>=d.left-10?cover(d.top,d.bottom,r.top,r.bottom):0)
 :side==='right'?(r.right>=d.right+2&&r.left<=d.right+10?cover(d.top,d.bottom,r.top,r.bottom):0)
 :side==='top'?(r.top<=d.top-2&&r.bottom>=d.top-10?cover(d.left,d.right,r.left,r.right):0)
 :(r.bottom>=d.bottom+2&&r.top<=d.bottom+10?cover(d.left,d.right,r.left,r.right):0);
const scan=(fn)=>{document.getAnimations().filter(a=>a.animationName==='work-ring-in').forEach(a=>a.finish());
 const uls=[...document.querySelectorAll('.work-ring[data-ring-id^="long"],.work-ring[data-ring-id^="short"]')];
 for(const ul of document.querySelectorAll('.work-ring'))for(const a of turning(ul)){a.pause();a.currentTime=0}
 for(const ul of uls){const as=turning(ul),dur=as[0].effect.getTiming().duration,item=ul.querySelector('.work-item-turn');
  for(let k=0;k<480;k++){const t=k/480*dur;for(const a of as)a.currentTime=t;fn(ul,item,t,item.getBoundingClientRect())}
  for(const a of as)a.currentTime=0}};
window.__reach=()=>{const d=document.querySelector('[data-dock-glass]').getBoundingClientRect(),m={left:0,right:0,top:0,bottom:0};
 scan((ul,item,t,r)=>{for(const s of Object.keys(m))m[s]=Math.max(m[s],reachOf(s,d,r))});
 for(const s of Object.keys(m))m[s]=+m[s].toFixed(3);return JSON.stringify(m)};
window.__bring=(where)=>{const d=document.querySelector('[data-dock-glass]').getBoundingClientRect(),pt=[(d.left+d.right)/2,(d.top+d.bottom)/2];let best=null;
 scan((ul,item,t,r)=>{const dd=Math.hypot((r.left+r.right)/2-pt[0],(r.top+r.bottom)/2-pt[1]);
  const score=where==='centre'?-dd:reachOf(where,d,r)*1e6-dd; // an edge: the most reach first, then the nearest to the dock's middle
  if(!best||score>best.score)best={score,t,ul,item}});
 for(const a of turning(best.ul))a.currentTime=best.t;const r=best.item.getBoundingClientRect();
 return JSON.stringify({where,ring:best.ul.dataset.ringId,dock:[d.left,d.top,d.right,d.bottom].map(v=>+v.toFixed(2)),tile:[r.left,r.top,r.right,r.bottom].map(v=>+v.toFixed(2)),dpr:devicePixelRatio})};
`;
