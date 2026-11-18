// Preview only: moving grounds, drawn live. One small shader, six looks.
(() => {
  const FRAG = `#extension GL_OES_standard_derivatives : enable
precision highp float;
uniform vec2 uRes; uniform float uT; uniform float uStyle;
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h(i),h(i+vec2(1.,0.)),f.x), mix(h(i+vec2(0.,1.)),h(i+vec2(1.,1.)),f.x), f.y); }
float fbm(vec2 p){ float a=.5, s=0.; for(int i=0;i<5;i++){ s+=a*n(p); p=p*2.02+vec2(3.1,1.7); a*=.5; } return s; }
const vec3 G=vec3(.055,.055,.051);   // the site's ground
const vec3 P=vec3(.185,.180,.170);   // a pool of light: the ground lifted with cream
const vec3 E=vec3(.44,.17,.04);      // the ember: orange at about a third
void main(){
  vec2 p=(gl_FragCoord.xy-.5*uRes)/uRes.y; float t=uT; vec3 col=G;
  if(uStyle<.5){            // halftone tide: a field of dots that swell and sink like the pixel type
    float cell=uRes.y/44.; vec2 g=gl_FragCoord.xy/cell; vec2 c=fract(g)-.5;
    vec2 gp=(floor(g)+.5)*cell/uRes.y;
    float f=smoothstep(.32,.78,fbm(gp*1.5+vec2(t*.035,-t*.02)));
    float r=.05+.36*f; float d=smoothstep(r,r-.09,length(c));
    col=mix(G,P*1.35,d*(.22+.78*f));
    float em=smoothstep(.56,.9,fbm(gp*1.0+vec2(-t*.02,t*.016)+7.));
    col+=E*em*d*.7;
    col+=P*.22*smoothstep(1.0,0.,length(p));
  } else if(uStyle<1.5){    // ember drift: two slow pools, one of light and one of ember
    vec2 q=p+.3*vec2(fbm(p*1.2+t*.03),fbm(p*1.2-t*.025+5.));
    float a=fbm(q*1.1+vec2(t*.022,0.)), b=fbm(q*.9+vec2(4.,-t*.018));
    col=mix(G,P*1.1,smoothstep(.36,.8,a)); col=mix(col,E,smoothstep(.58,.9,b)*.6);
  } else if(uStyle<3.5){    // strips: long for long form, upright for short form, with a light walking along them
    vec2 q=uStyle<2.5?p:p.yx;
    float w=q.y*8.+fbm(vec2(q.x*.5+t*.03,q.y*1.6))*2.4;
    float band=smoothstep(.15,.85,.5+.5*sin(w*3.14159));
    float sweep=smoothstep(.75,0.,abs(q.x-sin(t*.06)*.95));
    col=mix(G,P*1.15,band*(.2+.7*sweep));
    col+=E*.5*band*smoothstep(.55,.95,fbm(q*vec2(.5,3.)+vec2(t*.03,2.)));
  } else if(uStyle<4.5){    // contour drift: map lines that creep, the same lines as the experience map
    float f=fbm(p*1.35+vec2(t*.012,t*.008))*13.; float l=abs(fract(f)-.5); float w=fwidth(f);
    float line=smoothstep(w*1.6,w*.3,l); float hgt=f/13.;
    col=G+P*line*(.3+.9*smoothstep(.3,.7,hgt)); col+=E*.9*line*smoothstep(.6,.78,hgt);
    col+=P*.2*smoothstep(1.,0.,length(p));
  } else {                  // silk: slow folds of cloth, lit from one side
    vec2 q=p; q.x+=.18*sin(q.y*2.2+t*.07); q+=.24*vec2(fbm(p*1.1+t*.02),fbm(p*1.3-t*.02+3.));
    float s=sin((q.x*2.2+q.y*1.2)*3.1+fbm(q*1.6)*4.); float lit=smoothstep(-.3,1.,s);
    col=mix(G*.75,P*1.25,lit*lit); col+=E*.55*pow(smoothstep(.55,1.,s),3.)*smoothstep(.25,.85,fbm(q*.8+9.));
  }
  col+=(h(gl_FragCoord.xy+fract(t)*91.)-.5)*.02;
  gl_FragColor=vec4(col,1.);
}`;
  const VERT = 'attribute vec2 a; void main(){ gl_Position=vec4(a,0.,1.); }';
  const NAMES = ['Halftone tide', 'Ember drift', 'Long strips', 'Upright strips', 'Contour drift', 'Silk'];
  const PANELS = [
    { page: 'My portfolio', sub: 'the rings page', opts: [0, 4], tiles: 'ring' },
    { page: 'Long form', sub: 'the wide wall', opts: [2, 5], tiles: 'wide' },
    { page: 'Short form', sub: 'the upright wall', opts: [3, 0], tiles: 'tall' },
    { page: 'Home', sub: 'behind the two shelves', opts: [5, 1], tiles: 'blocks' },
  ];
  const root = document.getElementById('grounds');
  const runs = [];
  function tiles(kind) {
    let out = '';
    const box = (l, t, w, h) => out += `<i style="left:${l}%;top:${t}%;width:${w}%;height:${h}%"></i>`;
    if (kind === 'wide') for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) box(9 + c * 21, 14 + r * 26, 19.5, 22);
    if (kind === 'tall') for (let c = 0; c < 9; c++) box(9.5 + c * 9.2, 14 + (c % 2) * 5, 8, 26), box(9.5 + c * 9.2, 50 + (c % 2) * 5, 8, 26);
    if (kind === 'ring') for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; box(50 + Math.cos(a) * 40 * 0.5625 - 4, 50 + Math.sin(a) * 40 - 4.5, 8, 9); }
    if (kind === 'blocks') { box(8, 22, 40, 60); box(52, 22, 40, 60); }
    return out;
  }
  PANELS.forEach((cfg) => {
    const p = document.createElement('div'); p.className = 'gpanel';
    p.innerHTML = `<canvas></canvas><div class="gtiles">${tiles(cfg.tiles)}</div><div class="gtitle"><b>${cfg.page}</b><span>${cfg.sub}</span></div><div class="gtag"></div><div class="gswap">click for the other option</div>`;
    root.appendChild(p);
    const cv = p.querySelector('canvas'), gl = cv.getContext('webgl', { antialias: false });
    const tag = p.querySelector('.gtag');
    let which = 0;
    const label = () => { tag.textContent = `${which ? 'B' : 'A'}  ${NAMES[cfg.opts[which]]}`; };
    label();
    p.addEventListener('click', () => { which = 1 - which; label(); });
    if (!gl) { tag.textContent = 'WebGL is off here'; return; }
    gl.getExtension('OES_standard_derivatives');
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(s)); return s; };
    const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, VERT)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FRAG)); gl.linkProgram(pr); gl.useProgram(pr);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const a = gl.getAttribLocation(pr, 'a'); gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
    const uRes = gl.getUniformLocation(pr, 'uRes'), uT = gl.getUniformLocation(pr, 'uT'), uStyle = gl.getUniformLocation(pr, 'uStyle');
    runs.push((t) => {
      const w = Math.round(cv.clientWidth), hgt = Math.round(cv.clientHeight);
      if (cv.width !== w || cv.height !== hgt) { cv.width = w; cv.height = hgt; gl.viewport(0, 0, w, hgt); }
      gl.uniform2f(uRes, w, hgt); gl.uniform1f(uT, t); gl.uniform1f(uStyle, cfg.opts[which]);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    });
  });
  let on = false, last = 0;
  window.addEventListener('r7:section', (e) => { on = e.detail === 'grounds'; });
  function loop(ms) { if (on && ms - last > 30) { last = ms; runs.forEach((r) => r(ms / 1000)); } requestAnimationFrame(loop); }
  requestAnimationFrame(loop);
})();
