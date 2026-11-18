// Preview 7: the Eclipse ground, slow, under a very faint still grain. The light and the dark shoulder drift against each other and a soft
// noise moves through the light. Four placements of the same ground.
(() => {
  const FRAG = `precision highp float;
uniform vec2 uRes; uniform float uT, uPlace, uNoise, uGrain;
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h(i),h(i+vec2(1.,0.)),f.x), mix(h(i+vec2(0.,1.)),h(i+vec2(1.,1.)),f.x), f.y); }
float fbm(vec2 p){ float a=.5, s=0.; for(int i=0;i<4;i++){ s+=a*n(p); p=p*2.02+vec2(3.1,1.7); a*=.5; } return s; }
void main(){
  vec2 p=(gl_FragCoord.xy-.5*uRes)/uRes.y; float asp=uRes.x/uRes.y; float t=uT;
  vec2 w=p+.12*vec2(fbm(p*1.2+t*.03), fbm(p*1.2-t*.025+4.));        // no edge stays geometric
  vec2 c1, c2; float sIn=.82, sOut=1.3, reach=1.55;
  if(uPlace<.5){ c1=vec2(asp*.62,.08); c2=vec2(-asp*.18,-.95); }                    // light on the right, shoulder from the lower left
  else if(uPlace<1.5){ c1=vec2(-asp*.6,.1); c2=vec2(asp*.2,-.95); }                 // the same, mirrored
  else if(uPlace<2.5){ c1=vec2(0.,-.8); c2=vec2(0.,.62); sIn=.6; sOut=1.2; reach=1.7; } // light from below, a dark disc above: a sunrise behind a planet
  else { c1=vec2(asp*.45,.8); c2=vec2(-asp*.12,-.62); }                             // light from the upper right
  c1+=vec2(.11*sin(t*.05), .09*cos(t*.04));                         // the light wanders
  c2+=vec2(.13*sin(t*.035+1.), .11*cos(t*.045+2.));                 // the shoulder wanders against it
  float L=smoothstep(reach,.05,length(w-c1))*smoothstep(sIn,sOut,length(w-c2))*1.05;
  float nz=fbm(w*1.6+vec2(t*.06,-t*.04)), nz2=fbm(w*3.1-vec2(t*.05,t*.03)+9.);
  L*=1.+uNoise*(.6*(nz-.5)+.32*(nz2-.5));                           // the noise gradient: slow smoke in the light
  L=clamp(L,0.,1.);
  vec3 col=vec3(.045,.043,.040);
  col=mix(col,vec3(.20,.068,.022),smoothstep(0.,.34,L));
  col=mix(col,vec3(.80,.33,.075),smoothstep(.22,.82,L));
  col=mix(col,vec3(.97,.50,.14),smoothstep(.78,1.,L)*.55);
  // grain like the tooth of paper: coarse, strong and still. Two sizes of speck, stronger where the light is.
  float g1=h(floor(gl_FragCoord.xy/1.5))-.5, g2=n(gl_FragCoord.xy/2.6)-.5, g3=h(floor(gl_FragCoord.xy/3.)+41.)-.5;
  float gr=g1*.62+g2*.5+g3*.3; float lum=dot(col,vec3(.4,.45,.15));
  col+=vec3(1.,.82,.6)*gr*uGrain*(.13+.6*lum);
  col=max(col,vec3(0.));
  gl_FragColor=vec4(col,1.);
}`;
  const VERT = 'attribute vec2 a; void main(){ gl_Position=vec4(a,0.,1.); }';
  let move = 2.2, noise = 1, grain = 0.1, clock = 0, last = 0, section = 'map';
  const runs = [];
  // other sections may ask for a ground too (the shelf does)
  window.r7ground = (cv, place, sec) => {
    const gl = cv.getContext('webgl', { antialias: false }); if (!gl) return;
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(s)); return s; };
    const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, VERT)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FRAG)); gl.linkProgram(pr); gl.useProgram(pr);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const a = gl.getAttribLocation(pr, 'a'); gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
    const U = (name) => gl.getUniformLocation(pr, name);
    runs.push({ sec, draw: () => {
      const w = Math.round(cv.clientWidth), hgt = Math.round(cv.clientHeight);   // one canvas pixel per CSS pixel, so a speck is two or three screen pixels on a sharp display
      if (cv.width !== w || cv.height !== hgt) { cv.width = w; cv.height = hgt; gl.viewport(0, 0, w, hgt); }
      gl.uniform2f(U('uRes'), w, hgt); gl.uniform1f(U('uT'), clock); gl.uniform1f(U('uPlace'), place); gl.uniform1f(U('uNoise'), noise); gl.uniform1f(U('uGrain'), grain);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    } });
  };
  window.r7ground(document.querySelector('.ground-big canvas'), 0, 'grounds');
  const row = document.getElementById('groundRow');
  ['Mirrored', 'From below, behind a dark disc', 'From the upper right'].forEach((name, i) => {
    const p = document.createElement('div'); p.className = 'gpanel'; p.innerHTML = `<canvas></canvas><div class="gtag">${name}</div>`;
    row.appendChild(p); window.r7ground(p.querySelector('canvas'), i + 1, 'grounds');
  });
  const chips = (id, fn) => document.getElementById(id).addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    e.currentTarget.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); fn(+b.dataset.v);
  });
  chips('grainChips', (v) => { grain = v; });
  window.addEventListener('r7:section', (e) => { section = e.detail; });
  function loop(ms) {
    if (ms - last > 30) { clock += Math.min(0.1, (ms - last) / 1000) * move; last = ms; runs.forEach((r) => { if (r.sec === section) r.draw(); }); }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
