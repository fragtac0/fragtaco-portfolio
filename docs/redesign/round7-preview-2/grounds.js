// Preview 2: grainy glow grounds. Near-black, one soft orange light, heavy film grain, very slow.
(() => {
  const FRAG = `precision highp float;
uniform vec2 uRes; uniform float uT; uniform float uStyle;
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h(i),h(i+vec2(1.,0.)),f.x), mix(h(i+vec2(0.,1.)),h(i+vec2(1.,1.)),f.x), f.y); }
float fbm(vec2 p){ float a=.5, s=0.; for(int i=0;i<4;i++){ s+=a*n(p); p=p*2.02+vec2(3.1,1.7); a*=.5; } return s; }
vec2 rot(vec2 p, float a){ float c=cos(a), s=sin(a); return vec2(p.x*c-p.y*s, p.x*s+p.y*c); }
void main(){
  vec2 p=(gl_FragCoord.xy-.5*uRes)/uRes.y; float asp=uRes.x/uRes.y; float t=uT; float L=0.;
  vec2 w=p+.10*vec2(fbm(p*1.3+t*.02), fbm(p*1.3-t*.017+4.));     // a little wobble, so no edge is geometric
  if(uStyle<.5){            // 0 beam: a wide band of light leaning across, like the reference
    vec2 q=rot(w, -.5+.06*sin(t*.04));
    float band=smoothstep(.62,0.,abs(q.y+.08*sin(t*.05)));
    float along=smoothstep(-.9,.55,q.x+.25*sin(t*.03));
    L=band*along;
  } else if(uStyle<1.5){    // 1 eclipse: a light on the right, with a dark round shoulder cutting into it
    vec2 c1=vec2(asp*.62,.08+.08*sin(t*.04));
    float g=smoothstep(1.55,.05,length(w-c1));
    vec2 c2=vec2(-asp*.18+.1*sin(t*.03),-.95+.08*cos(t*.035));
    float s=smoothstep(.82,1.3,length(w-c2));
    L=g*s*1.05;
  } else if(uStyle<2.5){    // 2 crescent: a ring of light, lit on one side, turning slowly
    vec2 c=vec2(.05*sin(t*.03),.02); float r=length(w-c); float a=atan(w.y-c.y,w.x-c.x);
    float ring=exp(-pow((r-.52)/.2,2.));
    L=ring*(.12+.88*pow(.5+.5*cos(a-t*.05-.6),1.6));
  } else if(uStyle<3.5){    // 3 horizon: a low glow along the bottom edge that breathes
    float y=(w.y+.5);
    L=smoothstep(.7,-.12,y)*(.72+.28*fbm(vec2(w.x*1.1+t*.03,t*.025)))*(.85+.15*sin(t*.08));
  } else if(uStyle<4.5){    // 4 corner: light pouring in from one corner
    vec2 c=vec2(asp*.5,-.5); float r=length(w-c);
    L=smoothstep(1.55,.0,r)*(.75+.25*fbm(w*1.4+vec2(t*.03,0.)));
  } else {                  // 5 two lights: one large, one small, drifting apart and back
    vec2 a=vec2(-asp*.28+.14*sin(t*.03),.16*cos(t*.025)), b=vec2(asp*.3+.1*cos(t*.02),-.2+.12*sin(t*.033));
    L=smoothstep(.95,0.,length(w-a))*.75+smoothstep(.6,0.,length(w-b));
  }
  L=clamp(L,0.,1.);
  vec3 col=vec3(.045,.043,.040);                                  // near-black, a touch warm
  col=mix(col,vec3(.20,.068,.022),smoothstep(0.,.34,L));         // deep brown where the light starts
  col=mix(col,vec3(.80,.33,.075),smoothstep(.22,.82,L));         // the orange
  col=mix(col,vec3(.97,.50,.14),smoothstep(.78,1.,L)*.55);       // its hottest part
  float g=h(gl_FragCoord.xy+floor(t*12.)*17.3)-.5;               // film grain, 12 frames a second
  float g2=h(floor(gl_FragCoord.xy*.5)+floor(t*12.)*7.1)-.5;     // a coarser grain under it
  col+=(g*.11+g2*.06)*(.35+.9*L);
  gl_FragColor=vec4(col,1.);
}`;
  const VERT = 'attribute vec2 a; void main(){ gl_Position=vec4(a,0.,1.); }';
  const NAMES = ['1 Beam', '2 Eclipse', '3 Crescent', '4 Horizon', '5 Corner', '6 Two lights'];
  const root = document.getElementById('grounds');
  const runs = [];
  function tiles(i) {
    let out = `<b>${['My portfolio', 'Long form', 'Short form', 'What I am reading', 'Home', 'What I am watching'][i]}</b>`;
    const box = (l, t, w, h) => { out += `<i style="left:${l}%;top:${t}%;width:${w}%;height:${h}%"></i>`; };
    if (i === 1 || i === 5) for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) box(8 + c * 21.5, 26 + r * 22, 20, 19);
    if (i === 2) for (let c = 0; c < 9; c++) { box(9.5 + c * 9.2, 26 + (c % 2) * 4, 8, 28); box(9.5 + c * 9.2, 60 + (c % 2) * 4, 8, 28); }
    if (i === 0) for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; box(50 + Math.cos(a) * 34 * 0.625 - 4, 54 + Math.sin(a) * 34 - 5, 8, 10); }
    if (i === 3) for (let c = 0; c < 14; c++) box(15 + c * 5, 34 + (c * 37 % 9), 4.4, 50 - (c * 37 % 9));
    if (i === 4) { box(8, 26, 40, 60); box(52, 26, 40, 60); }
    return out;
  }
  NAMES.forEach((name, i) => {
    const p = document.createElement('div'); p.className = 'gpanel';
    p.innerHTML = `<canvas></canvas><div class="gtiles">${tiles(i)}</div><div class="gtag">${name}</div>`;
    root.appendChild(p);
    p.addEventListener('click', () => p.classList.toggle('big'));
    const cv = p.querySelector('canvas'), gl = cv.getContext('webgl', { antialias: false });
    if (!gl) { p.querySelector('.gtag').textContent = 'WebGL is off here'; return; }
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(s)); return s; };
    const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, VERT)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FRAG)); gl.linkProgram(pr); gl.useProgram(pr);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const a = gl.getAttribLocation(pr, 'a'); gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
    const uRes = gl.getUniformLocation(pr, 'uRes'), uT = gl.getUniformLocation(pr, 'uT'), uStyle = gl.getUniformLocation(pr, 'uStyle');
    runs.push((t) => {
      const w = Math.round(cv.clientWidth), hgt = Math.round(cv.clientHeight);
      if (cv.width !== w || cv.height !== hgt) { cv.width = w; cv.height = hgt; gl.viewport(0, 0, w, hgt); }
      gl.uniform2f(uRes, w, hgt); gl.uniform1f(uT, t); gl.uniform1f(uStyle, i);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    });
  });
  document.getElementById('contentChips').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    e.currentTarget.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
    root.classList.toggle('content', b.dataset.v === 'on');
  });
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') root.querySelectorAll('.big').forEach((p) => p.classList.remove('big')); });
  let on = false, last = 0;
  window.addEventListener('r7:section', (e) => { on = e.detail === 'grounds'; });
  function loop(ms) { if (on && ms - last > 30) { last = ms; runs.forEach((r) => r(ms / 1000)); } requestAnimationFrame(loop); }
  requestAnimationFrame(loop);
})();
