// Preview only: the painting's reveal between two page pictures, at a speed you pick.
(() => {
  const stage = document.getElementById('changeStage'), cv = document.getElementById('changeCanvas');
  const gl = cv.getContext('webgl', { antialias: false });
  if (!gl) { document.getElementById('playHint').textContent = 'WebGL is off here'; return; }
  const FRAG = `precision highp float;
uniform sampler2D uA,uB; uniform vec2 uRes,uO; uniform float uP,uMode,uT;
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h(i),h(i+vec2(1.,0.)),f.x), mix(h(i+vec2(0.,1.)),h(i+vec2(1.,1.)),f.x), f.y); }
float fbm(vec2 p){ return n(p)*.55+n(p*2.03+7.1)*.3+n(p*4.07-3.7)*.15; }
void main(){
  vec2 uv=gl_FragCoord.xy/uRes; float asp=uRes.x/uRes.y; vec2 pa=vec2(uv.x*asp,uv.y);
  if(uMode>1.5){ gl_FragColor=mix(texture2D(uA,uv),texture2D(uB,uv),smoothstep(0.,1.,uP)); return; }
  vec2 o=vec2(uO.x*asp,uO.y); float d, far; vec2 dir;
  if(uMode<.5){ d=length(pa-o); far=length(vec2(max(o.x,asp-o.x),max(o.y,1.-o.y))); dir=normalize(pa-o+1e-4); }
  else { d=uv.x*asp; far=asp; dir=vec2(1.,0.); }
  d+=(fbm(pa*2.4+uT*.06)-.5)*.34;                 // the wandering edge, as on the painting
  float band=.09*far; float front=mix(-band*2.-.2, far+band*2.+.2, uP);
  float x=(d-front)/band;                         // below 0: the new page; above 0: the old one
  float m=smoothstep(-1.,1.,x);
  float bell=exp(-x*x*2.0); vec2 off=dir*bell*.03; off.x/=asp;
  vec3 a=vec3(texture2D(uA,uv+off*1.2).r, texture2D(uA,uv+off).g, texture2D(uA,uv+off*.8).b);
  vec3 b=vec3(texture2D(uB,uv-off*1.2).r, texture2D(uB,uv-off).g, texture2D(uB,uv-off*.8).b);
  vec3 col=mix(b,a,m);
  col+=vec3(1.,.96,.88)*exp(-x*x*36.)*.2;        // the bright line at the front
  gl_FragColor=vec4(col,1.);
}`;
  const VERT = 'attribute vec2 a; void main(){ gl_Position=vec4(a,0.,1.); }';
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(s)); return s; };
  const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, VERT)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FRAG)); gl.linkProgram(pr); gl.useProgram(pr);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const a = gl.getAttribLocation(pr, 'a'); gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
  const U = (name) => gl.getUniformLocation(pr, name);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  const tex = (unit, src) => new Promise((ok) => {
    const t = gl.createTexture(), im = new Image();
    im.onload = () => {
      gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, im);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      ok();
    };
    im.src = src;
  });
  let ms = 1800, shape = 'radial', from = 0, t0 = -1, active = false, ready = false;
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  function draw(now) {
    const w = Math.round(cv.clientWidth * Math.min(devicePixelRatio, 2)), hgt = Math.round(cv.clientHeight * Math.min(devicePixelRatio, 2));
    if (cv.width !== w || cv.height !== hgt) { cv.width = w; cv.height = hgt; gl.viewport(0, 0, w, hgt); }
    const playing = t0 >= 0;
    const p = playing ? Math.min(1, (now - t0) / ms) : 0;
    gl.uniform2f(U('uRes'), w, hgt); gl.uniform2f(U('uO'), 0.47, 0.06); gl.uniform1f(U('uT'), now / 1000);
    gl.uniform1f(U('uMode'), shape === 'radial' ? 0 : shape === 'linear' ? 1 : 2);
    // uA is the page being left, uB the page arriving; the front uncovers uB
    gl.uniform1i(U('uA'), from); gl.uniform1i(U('uB'), playing ? 1 - from : from); gl.uniform1f(U('uP'), ease(p));
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (playing && p >= 1) { t0 = -1; from = 1 - from; }
    if (active) requestAnimationFrame(draw);
  }
  function play() { if (ready && t0 < 0) t0 = performance.now(); }
  Promise.all([tex(0, '../compare/after/hero.jpg'), tex(1, '../compare/after/work.jpg')]).then(() => { ready = true; });
  stage.addEventListener('click', play);
  const chips = (id, fn) => document.getElementById(id).addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    document.getElementById(id).querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
    fn(b.dataset.v); t0 = -1; play();
  });
  chips('speedChips', (v) => { ms = +v; });
  chips('shapeChips', (v) => { shape = v; });
  window.addEventListener('r7:section', (e) => { const was = active; active = e.detail === 'change'; if (active && !was) { requestAnimationFrame(draw); setTimeout(play, 600); } });
})();
