// What dock-over-tiles.json runs inside the page (R56.4, spec 4 of the round 7 second look). Plain strings of browser code, injected as the first step's `init`.
//
//  - __rank()      the brightest thumbnail of the set: every long form cover (and short form where it has a picture) is fetched with CORS (i.ytimg.com allows it),
//                  drawn small, and ranked by its mean WCAG relative luminance; the brightest is kept as a data address (window.__bright) for __under. Prints no address.
//  - __prep(hide, tint)  (tint: a value for --dock-tint, to measure another tint than the build's) reads the long tile's size from the rings (as drawn), and with `hide` hides the rings so that only the test tile is under the dock.
//  - __under(sel, which)  a stand-in tile of that size, centred on the element: the brightest thumbnail ('bright'), pure white ('white', the bound no picture can pass), or none.
//                  It sits above the rings and below the dock (z-index 25, the dock is 30), exactly where a ring tile that turns under the glass is.
//  - __inks()      the ink every dock label and icon is really drawn with (colour, times the opacity of it and its parents), so the contrast steps' inks cannot drift.
//  - __bring(where) puts a real ring tile (the ring's own animation, paused at the nearest phase) on the dock's centre, left edge, right edge or top edge, and prints
//                  both boxes, so the foot picture is of the page as it is, not of a stand-in.
//  - __fake()      generated pictures on every tile (nothing from a third party), for the pictures that are committed.
//  - __dockShow(on) hides / shows the dock only (visibility), for the same picture without it.
export const page = (tabs, nav) => String.raw`
try{sessionStorage.setItem('ft:intro-seen','1')}catch(e){}
window.__rank=async()=>{const w=window.__remixContext.state.loaderData['routes/work'].work;
 const idOf=u=>{try{const p=new URL(u);const h=p.hostname.replace(/^(www|m)\./,'');let c=null;if(h==='youtu.be')c=p.pathname.split('/')[1];
  else if(h==='youtube.com'){const[,k,i]=p.pathname.split('/');c=k==='watch'?p.searchParams.get('v'):(k==='shorts'||k==='embed'||k==='live')?i:null}
  return c&&/^[A-Za-z0-9_-]{11}$/.test(c)?c:null}catch(e){return null}};
 const list=[];for(const [vids,tall] of [[w.longForm,false],[w.shortForm,true]])for(const v of vids){const id=v.cover?null:idOf(v.url);
  const url=v.cover||(id?'https://i.ytimg.com/vi/'+id+'/'+(tall?'oar2':'hqdefault')+'.jpg':null);if(url&&!url.startsWith('data:'))list.push({id:v.id,url,tall})}
 const lin=v=>{v/=255;return v<=0.03928?v/12.92:((v+0.055)/1.055)**2.4};
 const rows=[];
 for(const it of list){try{const r=await fetch(it.url,{mode:'cors'});if(!r.ok)continue;const blob=await r.blob();const bmp=await createImageBitmap(blob);if(bmp.width<=120)continue;
  const c=new OffscreenCanvas(48,27),x=c.getContext('2d',{willReadFrequently:true});x.drawImage(bmp,0,0,48,27);const d=x.getImageData(0,0,48,27).data;let s=0;
  for(let i=0;i<d.length;i+=4)s+=0.2126*lin(d[i])+0.7152*lin(d[i+1])+0.0722*lin(d[i+2]);
  const lum=s/(d.length/4);const data=await new Promise(res=>{const f=new FileReader();f.onload=()=>res(f.result);f.readAsDataURL(blob)});rows.push({id:it.id,tall:it.tall,lum,data})}catch(e){}}
 rows.sort((a,b)=>b.lum-a.lum);if(!rows.length)return JSON.stringify({error:'no thumbnail could be read',asked:list.length});
 window.__bright=rows[0].data;const mid=rows[Math.floor(rows.length/2)].lum;
 return JSON.stringify({asked:list.length,read:rows.length,brightest:{id:rows[0].id,tall:rows[0].tall,meanLuminance:+rows[0].lum.toFixed(4)},top3:rows.slice(0,3).map(r=>[r.id,+r.lum.toFixed(4)]),median:+mid.toFixed(4)})};
window.__prep=(hide,tint)=>{if(tint!=null)document.documentElement.style.setProperty('--dock-tint',String(tint));const t=document.querySelector('.work-item[data-ring=long] .work-item-turn');const r=t.getBoundingClientRect();window.__tile={w:r.width,h:r.height};
 if(hide){const s=document.createElement('style');s.textContent='.work-rings{visibility:hidden !important}';document.head.appendChild(s)}
 return JSON.stringify({tile:[Math.round(r.width),Math.round(r.height)],hidden:!!hide,tint:getComputedStyle(document.documentElement).getPropertyValue('--dock-tint').trim()})};
window.__under=(sel,which)=>{let t=document.getElementById('__t');if(!t){t=document.createElement('div');t.id='__t';t.style.cssText='position:fixed;z-index:25;pointer-events:none;display:none';document.body.appendChild(t)}
 if(which==='none'){t.style.display='none';return 'none'}
 const e=document.querySelector(sel);if(!e)return 'missing '+sel;const r=e.getBoundingClientRect();const W=window.__tile.w,H=window.__tile.h;
 t.style.display='block';t.style.width=W+'px';t.style.height=H+'px';t.style.left=(r.left+r.width/2-W/2)+'px';t.style.top=(r.top+r.height/2-H/2)+'px';
 t.style.background=which==='white'?'#fff':'url('+window.__bright+') center/cover';return which+' on '+sel};
// the ink of each label and icon: colour with its own alpha, times the opacity of it and of every parent up to the dock
window.__inks=()=>{const g=document.querySelector('[data-dock-glass]');const out={};const cv=document.createElement('canvas');cv.width=cv.height=1;const cx=cv.getContext('2d',{willReadFrequently:true});
 const ink=(name,sel)=>{const e=document.querySelector(sel);if(!e){out[name]='missing';return}let o=1;for(let n=e;n&&n!==g.parentElement;n=n.parentElement)o*=parseFloat(getComputedStyle(n).opacity);
  cx.clearRect(0,0,1,1);cx.fillStyle=getComputedStyle(e).color;cx.fillRect(0,0,1,1);const d=cx.getImageData(0,0,1,1).data;out[name]=[d[0],d[1],d[2],+(d[3]/255*o).toFixed(2)]};
 for(const t of ${JSON.stringify(tabs)})ink('tab '+t,'[data-dock-glass] a[data-work-tab="'+t+'"]');
 for(const k of ${JSON.stringify(nav)})ink(k.name,k.sel);return JSON.stringify(out)};
// neutral generated pictures (no third party) on every tile, for the pictures that may be committed; a number shows each tile is upright
window.__fake=()=>{let i=0;for(const img of document.querySelectorAll('.work-cover img')){i++;const tall=img.closest('.work-item').dataset.ring==='short';
 const W=tall?360:640,H=tall?640:360,hue=(i*47)%360;
 const svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+W+' '+H+'"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl('+hue+',55%,60%)"/><stop offset="1" stop-color="hsl('+((hue+60)%360)+',60%,38%)"/></linearGradient></defs><rect width="'+W+'" height="'+H+'" fill="url(#g)"/><text x="'+W/2+'" y="'+(H/2+30)+'" font-family="monospace" font-size="'+Math.round(H*.22)+'" text-anchor="middle" fill="rgba(255,255,255,.9)">'+i+'</text></svg>';
 img.src='data:image/svg+xml;utf8,'+encodeURIComponent(svg)}return i};
window.__dockShow=(on)=>{document.querySelector('[data-site-nav]').style.visibility=on?'':'hidden';return on?'dock shown':'dock hidden'};
window.__bring=(where)=>{const d=document.querySelector('[data-dock-glass]').getBoundingClientRect();
 const pt={centre:[(d.left+d.right)/2,(d.top+d.bottom)/2],left:[d.left,(d.top+d.bottom)/2],right:[d.right,(d.top+d.bottom)/2],top:[(d.left+d.right)/2,d.top]}[where];
 const turning=ul=>ul.getAnimations({subtree:true}).filter(a=>a.animationName==='work-spin'||a.animationName==='work-unspin');
 document.getAnimations().filter(a=>a.animationName==='work-ring-in').forEach(a=>a.finish());
 for(const ul of document.querySelectorAll('.work-ring')){for(const a of turning(ul)){a.pause();a.currentTime=0}}
 let best=null;
 for(const ul of document.querySelectorAll('.work-ring[data-ring-id^="long"],.work-ring[data-ring-id^="short"]')){const as=turning(ul);const dur=as[0].effect.getTiming().duration;const item=ul.querySelector('.work-item-turn');
  for(let k=0;k<480;k++){const t=k/480*dur;for(const a of as)a.currentTime=t;const r=item.getBoundingClientRect();const dd=Math.hypot((r.left+r.right)/2-pt[0],(r.top+r.bottom)/2-pt[1]);if(!best||dd<best.dd)best={dd,t,ul,item}}
  for(const a of as)a.currentTime=0}
 for(const a of turning(best.ul))a.currentTime=best.t;const r=best.item.getBoundingClientRect();
 return JSON.stringify({where,ring:best.ul.dataset.ringId,dock:[d.left,d.top,d.right,d.bottom].map(v=>+v.toFixed(2)),tile:[r.left,r.top,r.right,r.bottom].map(v=>+v.toFixed(2)),dpr:devicePixelRatio})};
`;
