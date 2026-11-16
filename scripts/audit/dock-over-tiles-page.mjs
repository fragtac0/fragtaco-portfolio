// What dock-over-tiles.json runs inside the page for the contrast steps (R56.4 and its fix round R56.4b, spec 4 of the round 7 second look). Plain strings of browser code,
// injected as the first step's `init` together with dock-foot-page.mjs (the foot picture's functions).
//
//  - __prep(hide, tint)  (tint: a value for --dock-tint, to measure another tint than the build's) reads the size of the long and the short tile from the rings (as drawn), and
//                  with `hide` hides the rings so that only the test tile is under the dock. __rings(on) shows or hides the rings again.
//  - __rank(k)     ranks every thumbnail of the set (long form, and short form where it has a picture; fetched with CORS, i.ytimg.com allows it) by its BRIGHTEST WINDOW:
//                  the picture is drawn at the size of its tile (cover, as the rings draw it), and the box mean of the relative luminance is taken over a 160 by 112 px window
//                  (about what the glass's blur reaches: backdrop-blur-2xl is a 40 px blur) at every position; the best window's mean ranks it and its centre (u, v) is kept.
//                  The top `k` are kept (window.__cands) with their data addresses. Also kept for each: the BLURRED PEAK, the brightest point of the picture on the dark ground blurred
//                  with a 40 px gaussian, and where it is: the worst pixel under a label is the brightest point of the blurred backdrop inside the label's box, so a tile with its peak
//                  under the label's middle is the worst case for that tile. The mean over the whole picture, the old ranking, is returned beside it.
//  - __place(sel, ci, fu, fv, anchor)  a stand-in tile of the candidate's size, laid so that the point (u + fu * w, v + fv * h) of it (the centre of its brightest window, or its
//                  blurred peak when `anchor` is 'p', moved by a share of the tile) is under the middle of the element; ci -1 is a pure white tile centred (the bound no picture can pass), -2 none. It sits above the
//                  rings and below the dock (z-index 25, the dock is 30), where a ring tile that turns under the glass is.
//  - __ring(sel, ci, fu, fv, all)  the same with a REAL ring tile, its blurred peak first (that candidate's own, in its own ring, the rings visible, every ring paused at the phase nearest): the ring
//                  phase that puts that point of the tile closest to the element's middle (reports how far it is: a ring that never passes there cannot put it under the label);
//                  `all` puts the brightest thumbnail on every tile, so every neighbour is as bright as can be.
//  - __inks()      the ink every dock label and icon is really drawn with (colour, times the opacity of it and its parents), so the contrast steps' inks cannot drift.
export const page = (tabs, nav) => String.raw`
try{sessionStorage.setItem('ft:intro-seen','1')}catch(e){}
window.__rank=async(k)=>{const w=window.__remixContext.state.loaderData['routes/work'].work;
 const idOf=u=>{try{const p=new URL(u);const h=p.hostname.replace(/^(www|m)\./,'');let c=null;if(h==='youtu.be')c=p.pathname.split('/')[1];
  else if(h==='youtube.com'){const[,k,i]=p.pathname.split('/');c=k==='watch'?p.searchParams.get('v'):(k==='shorts'||k==='embed'||k==='live')?i:null}
  return c&&/^[A-Za-z0-9_-]{11}$/.test(c)?c:null}catch(e){return null}};
 const list=[];for(const [vids,tall] of [[w.longForm,false],[w.shortForm,true]])for(const v of vids){const id=v.cover?null:idOf(v.url);
  const url=v.cover||(id?'https://i.ytimg.com/vi/'+id+'/'+(tall?'oar2':'hqdefault')+'.jpg':null);if(url&&!url.startsWith('data:'))list.push({id:v.id,url,tall})}
 const lin=v=>{v/=255;return v<=0.03928?v/12.92:((v+0.055)/1.055)**2.4};
 const rows=[];
 for(const it of list){const kind=it.tall?'short':'long',T=window.__tile[kind];if(!T)continue;
  try{const r=await fetch(it.url,{mode:'cors'});if(!r.ok)continue;const blob=await r.blob();const bmp=await createImageBitmap(blob);if(bmp.width<=120)continue;
  const W=T.w,H=T.h,c=new OffscreenCanvas(W,H),x=c.getContext('2d',{willReadFrequently:true});const sc=Math.max(W/bmp.width,H/bmp.height);
  x.drawImage(bmp,(W-bmp.width*sc)/2,(H-bmp.height*sc)/2,bmp.width*sc,bmp.height*sc);const d=x.getImageData(0,0,W,H).data;
  const I=new Float64Array((W+1)*(H+1));let whole=0;
  for(let y=0;y<H;y++)for(let xx=0;xx<W;xx++){const o=(y*W+xx)*4,l=0.2126*lin(d[o])+0.7152*lin(d[o+1])+0.0722*lin(d[o+2]);whole+=l;I[(y+1)*(W+1)+xx+1]=l+I[y*(W+1)+xx+1]+I[(y+1)*(W+1)+xx]-I[y*(W+1)+xx]}
  const ww=Math.min(160,W),hh=Math.min(112,H);let best=-1,bx=0,by=0;
  for(let y=0;y+hh<=H;y+=2)for(let xx=0;xx+ww<=W;xx+=2){const s=I[(y+hh)*(W+1)+xx+ww]-I[y*(W+1)+xx+ww]-I[(y+hh)*(W+1)+xx]+I[y*(W+1)+xx];const m=s/(ww*hh);if(m>best){best=m;bx=xx;by=y}}
  // the brightest point of the blurred tile: the luminance map at a quarter size, on the dark ground, blurred with a 40 px gaussian (the glass's blur), its maximum and where
  const q=4,gw=Math.ceil(W/q),gh=Math.ceil(H/q),pad=Math.ceil(120/q),PW=gw+2*pad,PH=gh+2*pad,g0=new Float64Array(PW*PH).fill(0.02);
  for(let y=0;y<gh;y++)for(let xx=0;xx<gw;xx++){let sum=0,n=0;for(let dy=0;dy<q;dy++)for(let dx=0;dx<q;dx++){const X=xx*q+dx,Y=y*q+dy;if(X<W&&Y<H){const o=(Y*W+X)*4;sum+=0.2126*lin(d[o])+0.7152*lin(d[o+1])+0.0722*lin(d[o+2]);n++}}g0[(y+pad)*PW+xx+pad]=sum/n}
  const sg=40/q,kr=Math.ceil(3*sg),ker=Array.from({length:2*kr+1},(_,i)=>Math.exp(-((i-kr)**2)/(2*sg*sg)));const ks=ker.reduce((a,b)=>a+b,0);
  const g1=new Float64Array(PW*PH),g2=new Float64Array(PW*PH);
  for(let y=0;y<PH;y++)for(let xx=0;xx<PW;xx++){let a=0;for(let k=-kr;k<=kr;k++)a+=ker[k+kr]*g0[y*PW+Math.min(PW-1,Math.max(0,xx+k))];g1[y*PW+xx]=a/ks}
  for(let y=0;y<PH;y++)for(let xx=0;xx<PW;xx++){let a=0;for(let k=-kr;k<=kr;k++)a+=ker[k+kr]*g1[Math.min(PH-1,Math.max(0,y+k))*PW+xx];g2[y*PW+xx]=a/ks}
  let peak=-1,pu=0,pv=0;for(let y=pad;y<pad+gh;y++)for(let xx=pad;xx<pad+gw;xx++){if(g2[y*PW+xx]>peak){peak=g2[y*PW+xx];pu=(xx-pad+0.5)*q;pv=(y-pad+0.5)*q}}
  const data=await new Promise(res=>{const f=new FileReader();f.onload=()=>res(f.result);f.readAsDataURL(blob)});
  rows.push({id:it.id,kind,window:best,whole:whole/(W*H),u:bx+ww/2,v:by+hh/2,peak,pu:Math.min(W,pu),pv:Math.min(H,pv),data})}catch(e){}}
 rows.sort((a,b)=>b.window-a.window);if(!rows.length)return JSON.stringify({error:'no thumbnail could be read',asked:list.length});
 window.__cands=rows.slice(0,k||3);const byWhole=[...rows].sort((a,b)=>b.whole-a.whole)[0];
 return JSON.stringify({asked:list.length,read:rows.length,tile:window.__tile,window:[160,112],
  top:window.__cands.map(r=>({id:r.id,kind:r.kind,windowMean:+r.window.toFixed(4),at:[Math.round(r.u),Math.round(r.v)],wholeMean:+r.whole.toFixed(4),blurredPeak:+r.peak.toFixed(4),peakAt:[Math.round(r.pu),Math.round(r.pv)]})),
  brightestByWholeMean:{id:byWhole.id,wholeMean:+byWhole.whole.toFixed(4),windowMean:+byWhole.window.toFixed(4)},medianWindowMean:+rows[Math.floor(rows.length/2)].window.toFixed(4)})};
window.__prep=(hide,tint)=>{if(tint!=null)document.documentElement.style.setProperty('--dock-tint',String(tint));
 const size=k=>{const t=document.querySelector('.work-item[data-ring='+k+'] .work-item-turn');if(!t)return null;const r=t.getBoundingClientRect();return{w:Math.round(r.width),h:Math.round(r.height)}};
 window.__tile={long:size('long'),short:size('short')};
 if(!window.__hide){const s=document.createElement('style');s.textContent='.work-rings{visibility:hidden !important}';document.head.appendChild(s);s.disabled=!hide;window.__hide=s}else window.__hide.disabled=!hide;
 return JSON.stringify({tile:window.__tile,hidden:!!hide,tint:getComputedStyle(document.documentElement).getPropertyValue('--dock-tint').trim()})};
window.__rings=(on)=>{window.__hide.disabled=!!on;return on?'rings shown':'rings hidden'};
window.__place=(sel,ci,fu,fv,anchor)=>{let t=document.getElementById('__t');if(!t){t=document.createElement('div');t.id='__t';t.style.cssText='position:fixed;z-index:25;pointer-events:none;display:none';document.body.appendChild(t)}
 if(ci===-2){t.style.display='none';return JSON.stringify({placed:'none'})}
 const e=document.querySelector(sel);if(!e)return JSON.stringify({error:'missing '+sel});const r=e.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;
 const c=ci>=0?window.__cands[ci]:null,T=c?window.__tile[c.kind]:window.__tile.long,u=c?(anchor==='p'?c.pu:c.u)+fu*T.w:T.w/2,v=c?(anchor==='p'?c.pv:c.v)+fv*T.h:T.h/2;
 t.style.display='block';t.style.width=T.w+'px';t.style.height=T.h+'px';t.style.left=(cx-u)+'px';t.style.top=(cy-v)+'px';
 t.style.background=c?'url('+c.data+') center/cover':'#fff';return JSON.stringify({placed:c?c.id:'white',at:[Math.round(cx-u),Math.round(cy-v)]})};
window.__ring=(sel,ci,fu,fv,all)=>{const t=document.getElementById('__t');if(t)t.style.display='none';
 const e=document.querySelector(sel),c=window.__cands[ci];if(!e||!c)return JSON.stringify({error:'missing '+sel+' or candidate '+ci});
 const r=e.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2,T=window.__tile[c.kind];
 for(const img of document.querySelectorAll('.work-cover img')){if(all){if(img.dataset.orig===undefined)img.dataset.orig=img.src;img.src=window.__cands[0].data}else if(img.dataset.orig!==undefined){img.src=img.dataset.orig;delete img.dataset.orig}}
 const turning=ul=>ul.getAnimations({subtree:true}).filter(a=>a.animationName==='work-spin'||a.animationName==='work-unspin');
 document.getAnimations().filter(a=>a.animationName==='work-ring-in').forEach(a=>a.finish());
 for(const ul of document.querySelectorAll('.work-ring'))for(const a of turning(ul)){a.pause();a.currentTime=0}
 const item=document.querySelector('.work-item[data-id="'+c.id+'"] .work-item-turn');if(!item)return JSON.stringify({error:'no ring tile '+c.id});
 const ul=item.closest('.work-ring'),as=turning(ul),dur=as[0].effect.getTiming().duration;let best=null;
 for(let k=0;k<720;k++){const ms=k/720*dur;for(const a of as)a.currentTime=ms;const b=item.getBoundingClientRect();
  const dd=Math.hypot(b.left+c.pu+fu*T.w-cx,b.top+c.pv+fv*T.h-cy);if(!best||dd<best.dd)best={dd,ms}}
 for(const a of as)a.currentTime=best.ms;return JSON.stringify({placed:c.id,ring:ul.dataset.ringId,miss:+best.dd.toFixed(1)})};
window.__inks=()=>{const g=document.querySelector('[data-dock-glass]');const out={};const cv=document.createElement('canvas');cv.width=cv.height=1;const cx=cv.getContext('2d',{willReadFrequently:true});
 const ink=(name,sel)=>{const e=document.querySelector(sel);if(!e){out[name]='missing';return}let o=1;for(let n=e;n&&n!==g.parentElement;n=n.parentElement)o*=parseFloat(getComputedStyle(n).opacity);
  cx.clearRect(0,0,1,1);cx.fillStyle=getComputedStyle(e).color;cx.fillRect(0,0,1,1);const d=cx.getImageData(0,0,1,1).data;out[name]=[d[0],d[1],d[2],+(d[3]/255*o).toFixed(2)]};
 for(const t of ${JSON.stringify(tabs)})ink('tab '+t,'[data-dock-glass] a[data-work-tab="'+t+'"]');
 for(const k of ${JSON.stringify(nav)})ink(k.name,k.sel);return JSON.stringify(out)};
`;
