// Preview 2: one camera drives everything. Overview and The mountain are the flat, toned picture.
// My climb is a tilted night map drawn on a canvas, with every contour line lifted to its height.
(() => {
  const D = window.R7, PW = 1000, PH = 650;
  const $ = (id) => document.getElementById(id);
  const stage = $('stage'), plane = $('plane'), ink = $('ink'), terrain = $('terrain'), fx = $('fx');
  const pinsEl = $('pins'), card = $('card'), nightEl = $('night'), nextBtn = $('next'), nextName = $('nextName');
  const tctx = terrain.getContext('2d'), fctx = fx.getContext('2d');
  const NS = 'http://www.w3.org/2000/svg';
  const el = (name, attrs = {}, parent) => { const n = document.createElementNS(NS, name); for (const k in attrs) n.setAttribute(k, attrs[k]); if (parent) parent.appendChild(n); return n; };
  const rad = (d) => (d * Math.PI) / 180;
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const HEIGHT = 92;   // the summit's height in map units: about nine times the truth
  const STEM = 17;     // how tall a milestone's pin stands

  // ---------- the camera ----------
  const cam = { tx: 470, ty: 325, tz: 0, s: 1, pitch: 0, yaw: 0, rise: 0, night: 0 };
  let SW = 0, SH = 0, K = 1, dpr = 1, dirty = true, P = {};
  function size() {
    const r = stage.getBoundingClientRect();
    SW = r.width; SH = r.height; K = Math.max(SW / PW, SH / PH); dpr = Math.min(window.devicePixelRatio || 1, 2);
    [terrain, fx].forEach((c) => { c.width = Math.round(SW * dpr); c.height = Math.round(SH * dpr); });
    dirty = true;
  }
  new ResizeObserver(size).observe(stage);
  function frame() {
    P = { S: K * cam.s, cy: Math.cos(cam.yaw), sy: Math.sin(cam.yaw), cp: Math.cos(cam.pitch), sp: Math.sin(cam.pitch), CX: SW / 2, CY: SH * (0.5 + 0.13 * cam.night), DIST: 1350 / cam.s };
  }
  const zOf = (n) => n * HEIGHT * smooth(n * 0.55, n * 0.55 + 0.45, cam.rise); // low lines settle first, the summit last
  function proj(x, y, z) {
    const px = x - cam.tx, py = y - cam.ty;
    const xr = px * P.cy - py * P.sy, yr = px * P.sy + py * P.cy;
    const zz = z - cam.tz, ys = yr * P.cp - zz * P.sp;
    const f = P.DIST / (P.DIST - Math.min(yr * P.sp + zz * P.cp, P.DIST * 0.8));
    return [P.CX + P.S * f * xr, P.CY + P.S * f * ys];
  }
  let tw = null;
  function to(target, ms, shape) { tw = { from: { ...cam }, to: { ...cam, ...target }, t0: performance.now(), ms: reduce ? 1 : ms, shape: shape || {} }; }
  function step(now) {
    if (!tw) return;
    const t = clamp((now - tw.t0) / tw.ms);
    for (const k in cam) { const sh = tw.shape[k]; const tk = sh ? clamp((t - sh[0]) / (sh[1] - sh[0])) : t; cam[k] = tw.from[k] + (tw.to[k] - tw.from[k]) * ease(tk); }
    if (t >= 1) tw = null;
    dirty = true;
  }

  // ---------- the heights: a smooth field, then contour rings ----------
  const GW = 640, GH = 416;
  let field = null, base = 0, hi = 1, levels = [];
  const sampleN = (x, y) => {
    if (!field) return 0;
    const gx = clamp((x / PW) * (GW - 1), 0, GW - 1.001), gy = clamp((y / PH) * (GH - 1), 0, GH - 1.001);
    const ix = Math.floor(gx), iy = Math.floor(gy), fx_ = gx - ix, fy_ = gy - iy, i = iy * GW + ix;
    const v = (field[i] * (1 - fx_) + field[i + 1] * fx_) * (1 - fy_) + (field[i + GW] * (1 - fx_) + field[i + GW + 1] * fx_) * fy_;
    return (v - base) / (hi - base);
  };
  function blur(src, w, h, r) {
    const tmp = new Float32Array(src.length), win = r * 2 + 1;
    for (let pass = 0; pass < 3; pass++) {
      for (let y = 0; y < h; y++) { let s = 0; for (let x = -r; x <= r; x++) s += src[y * w + clamp(x, 0, w - 1)]; for (let x = 0; x < w; x++) { tmp[y * w + x] = s / win; s += src[y * w + clamp(x + r + 1, 0, w - 1)] - src[y * w + clamp(x - r, 0, w - 1)]; } }
      for (let x = 0; x < w; x++) { let s = 0; for (let y = -r; y <= r; y++) s += tmp[clamp(y, 0, h - 1) * w + x]; for (let y = 0; y < h; y++) { src[y * w + x] = s / win; s += tmp[clamp(y + r + 1, 0, h - 1) * w + x] - tmp[clamp(y - r, 0, h - 1) * w + x]; } }
    }
  }
  const img = new Image();
  img.onload = () => {
    const c = document.createElement('canvas'); c.width = GW; c.height = GH;
    const g = c.getContext('2d'); g.drawImage(img, 0, 0, GW, GH);
    const px = g.getImageData(0, 0, GW, GH).data;
    field = new Float32Array(GW * GH);
    for (let i = 0; i < field.length; i++) field[i] = px[i * 4];
    blur(field, GW, GH, 2);
    const sorted = Float32Array.from(field).sort();
    base = sorted[Math.floor(sorted.length * 0.4)]; hi = sorted[sorted.length - 1];
    const cream = d3.interpolateRgb('rgba(253,244,222,0.30)', 'rgba(255,214,170,0.62)'), fire = d3.interpolateRgb('rgba(255,190,130,0.7)', 'rgba(255,118,40,1)');
    const floor = d3.interpolateRgb('#0f0e0d', '#21160f');
    levels = d3.contours().size([GW, GH]).smooth(true).thresholds(d3.range(Math.ceil(sorted[0]) + 0.5, hi, 2.6))(field).map((ct, i) => {
      const n = (ct.value - base) / (hi - base), major = i % 5 === 0;
      return {
        n: Math.max(n, -0.06),
        fill: floor(clamp(n)),
        stroke: n < 0.05 ? `rgba(253,252,230,${major ? 0.2 : 0.11})` : n < 0.45 ? cream(n / 0.45) : fire((n - 0.45) / 0.55),
        width: major ? 1.4 : 0.8,
        rings: ct.coordinates.flatMap((poly) => poly.map((ring) => { const a = new Float32Array(ring.length * 2); ring.forEach((p, k) => { a[k * 2] = (p[0] * PW) / GW; a[k * 2 + 1] = (p[1] * PH) / GH; }); return a; })),
      };
    });
    road.forEach((p) => { p.n = sampleN(p.x, p.y); }); ahead.forEach((p) => { p.n = sampleN(p.x, p.y); }); moments.forEach((m) => { m.n = sampleN(m.x, m.y); });
    dirty = true;
  };
  img.src = '../round7-preview/assets/dem.png';

  function drawTerrain() {
    const c = tctx; c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, SW, SH); c.lineJoin = 'round';
    const { S, cy, sy, cp, sp, CX, CY, DIST } = P, tx = cam.tx, ty = cam.ty, lim = DIST * 0.8;
    for (let li = 0; li < levels.length; li++) {
      const L = levels[li], z = zOf(L.n) - cam.tz, zs = z * sp, zc = z * cp;
      c.beginPath();
      for (let r = 0; r < L.rings.length; r++) {
        const a = L.rings[r];
        for (let i = 0; i < a.length; i += 2) {
          const px = a[i] - tx, py = a[i + 1] - ty, xr = px * cy - py * sy, yr = px * sy + py * cy;
          let dep = yr * sp + zc; if (dep > lim) dep = lim;
          const f = DIST / (DIST - dep), X = CX + S * f * xr, Y = CY + S * f * (yr * cp - zs);
          if (i) c.lineTo(X, Y); else c.moveTo(X, Y);
        }
        c.closePath();
      }
      c.fillStyle = L.fill; c.fill('evenodd');
      c.strokeStyle = L.stroke; c.lineWidth = L.width; c.stroke();
    }
  }

  // ---------- the road and the milestones ----------
  const roadPath = el('path', { d: d3.line().curve(d3.curveCatmullRom.alpha(0.5))(D.route) });
  const len = roadPath.getTotalLength();
  const road = d3.range(0, 161).map((i) => { const p = roadPath.getPointAtLength((len * i) / 160); return { x: p.x, y: p.y, n: 0 }; });
  const end = D.route[D.route.length - 1], top = D.summit;
  const aheadPath = el('path', { d: d3.line().curve(d3.curveBasis)([end, [(end[0] + top[0]) / 2 - 14, (end[1] + top[1]) / 2 - 16], top]) });
  const alen = aheadPath.getTotalLength();
  const ahead = d3.range(0, 41).map((i) => { const p = aheadPath.getPointAtLength((alen * i) / 40); return { x: p.x, y: p.y, n: 0 }; });
  const FR = [0, 0.3, 0.38, 0.48, 0.58, 0.66, 0.8, 0.93, 1];
  const YEAR = ['17', '21', '21', '22', '22', '23', '24', '25', 'now'];
  const moments = D.moments.map((m, i) => {
    const p = roadPath.getPointAtLength(len * FR[i]);
    const b = document.createElement('button');
    b.className = 'mpin' + (i === D.moments.length - 1 ? ' now' : '');
    b.innerHTML = `<span class="bead">${YEAR[i]}</span><span class="tip">${m.label}: ${m.title}</span>`;
    b.setAttribute('aria-label', `${m.label}: ${m.title}`);
    b.addEventListener('click', () => { if (mode !== 'climb') setMode('climb', i); else go(i); });
    pinsEl.appendChild(b);
    return { ...m, x: p.x, y: p.y, n: 0, pin: b, head: [0, 0] };
  });

  let roadA = 1;
  function drawFx(now) {
    const c = fctx; c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, SW, SH);
    roadA += ((mode === 'mountain' ? 0.22 : 1) - roadA) * 0.08;
    const trace = (pts) => { c.beginPath(); pts.forEach((p, i) => { const q = proj(p.x, p.y, zOf(p.n) + 0.8 * cam.rise); if (i) c.lineTo(q[0], q[1]); else c.moveTo(q[0], q[1]); }); };
    c.lineCap = 'round'; c.lineJoin = 'round'; c.globalAlpha = roadA;
    trace(road); c.strokeStyle = 'rgba(0,0,0,0.42)'; c.lineWidth = 3.6; c.stroke();
    trace(road); c.strokeStyle = '#fff8e8'; c.lineWidth = 1.5; c.stroke();
    trace(ahead); c.setLineDash([1.5, 6]); c.strokeStyle = 'rgba(255,248,232,0.9)'; c.lineWidth = 1.4; c.stroke(); c.setLineDash([]);
    if (mode !== 'mountain') {
      const bs = 0.5 + 0.5 * cam.night;
      moments.forEach((m) => {
        const z0 = zOf(m.n), b = proj(m.x, m.y, z0), h = proj(m.x, m.y, z0 + STEM * cam.rise);
        m.head = h;
        if (cam.rise > 0.02) {
          c.beginPath(); c.moveTo(b[0], b[1]); c.lineTo(h[0], h[1]); c.strokeStyle = 'rgba(255,255,255,0.8)'; c.lineWidth = 1.2; c.stroke();
          c.beginPath(); c.ellipse(b[0], b[1], 3.4, 3.4 * Math.max(0.3, P.cp), 0, 0, 7); c.fillStyle = '#fff'; c.fill();
        }
        m.pin.style.transform = `translate(${h[0]}px, ${h[1]}px)`; m.pin.style.setProperty('--bs', bs); m.pin.style.zIndex = Math.round(h[1]);
      });
      // the radar at "now": rings that widen on the ground
      const m = moments[moments.length - 1], z0 = zOf(m.n);
      for (let k = 0; k < 2; k++) {
        const t = ((now / 2600 + k * 0.5) % 1), r = (2 + 15 * t) / Math.sqrt(cam.s) * 1.6;
        c.beginPath();
        for (let a = 0; a <= 40; a++) { const q = proj(m.x + Math.cos((a / 40) * 6.2832) * r, m.y + Math.sin((a / 40) * 6.2832) * r, z0); if (a) c.lineTo(q[0], q[1]); else c.moveTo(q[0], q[1]); }
        c.strokeStyle = `rgba(252,76,0,${0.95 * (1 - t)})`; c.lineWidth = 1.6; c.stroke();
      }
    }
    c.globalAlpha = 1;
  }

  // ---------- the places, taught one at a time on the flat picture ----------
  const circle = (cx, cy, r) => `M${cx + r},${cy} A${r},${r} 0 1,1 ${cx - r},${cy} A${r},${r} 0 1,1 ${cx + r},${cy}`;
  const ellipse = (cx, cy, rx, ry) => `M${cx + rx},${cy} A${rx},${ry} 0 1,1 ${cx - rx},${cy} A${rx},${ry} 0 1,1 ${cx + rx},${cy}`;
  const cliffD = d3.line().curve(d3.curveCatmullRomClosed.alpha(0.5))(D.cliff);
  const places = [
    { name: 'Olympus Mons', kind: 'Shield volcano', line: 'The largest volcano known in the solar system. Its base would cover Italy, and its slopes are so gentle you could walk up without noticing the climb.', stats: [['610 km', 'across'], ['22 km', 'tall']], seen: ['Mariner 9, 1971', 'Arrived during a planet-wide dust storm. The first thing it saw of Mars was this summit, standing above the dust.'], d: circle(485, 318, 129), at: [485 + 129 * 0.77, 318 - 129 * 0.64], cam: { tx: 540, ty: 318, s: 1.5 } },
    { name: 'Olympus Rupes', kind: 'Cliff', line: 'A wall of rock that rings the whole mountain. Whoever climbs Olympus Mons has to get up this before the real climb starts.', stats: [['6 km', 'at its highest']], seen: ['Viking orbiters, 1976 to 1980', 'Mapped the cliff from orbit. The picture on this page is stitched from their photographs.'], d: cliffD, at: D.cliff[14], cam: { tx: 580, ty: 330, s: 1.9 } },
    { name: 'Olympus Paterae', kind: 'Summit calderas', line: 'Craters nested inside each other, each one left where the roof fell in after an eruption drained the rock below.', stats: [['85 km', 'across'], ['3 km', 'deep']], seen: ['Mars Express, 2004', 'Its stereo camera photographed the calderas in colour and in 3D, weeks after arriving.'], d: circle(500.4, 326.2, 18), at: [513, 313], cam: { tx: 528, ty: 326, s: 2.9 } },
    { name: 'Pangboche', kind: 'Crater', line: 'A small, sharp impact crater close to the summit, named for a village in Nepal on the trail to Everest.', stats: [['10 km', 'across']], d: circle(495.1, 352.2, 5), at: [498.7, 348.6], cam: { tx: 520, ty: 350, s: 3.3 } },
    { name: 'Karzok', kind: 'Crater', line: 'An impact crater on the eastern flank, named for a village in Ladakh.', stats: [['15 km', 'across']], d: circle(536.6, 324.2, 5.5), at: [540.6, 320.2], cam: { tx: 560, ty: 322, s: 3.3 } },
    { name: 'Lycus Sulci', kind: 'Aureole', line: 'Ridged, broken ground that spreads up to a thousand kilometres from the foot of the cliff. It may be the wreckage of giant landslides off the mountain. Nobody is sure.', stats: [['1,000 km', 'reach']], seen: ['Mars Global Surveyor, 1997 to 2006', 'Its laser measured the height of this whole region. The contour lines in My climb come from it.'], d: ellipse(290, 215, 185, 150), at: [290 + 185 * 0.5, 215 - 150 * 0.87], cam: { tx: 400, ty: 260, s: 1.25 } },
    { name: 'Nobody has landed here', kind: 'Still unvisited', line: 'The summit stands above most of the air on Mars, so there is too little of it to slow a parachute. Every visit so far has been from orbit.', stats: [['0', 'landings']], seen: ['Mars Odyssey, 2024', 'Photographed the whole mountain side-on against the horizon, the view an astronaut in orbit would have.'], d: circle(500, 325, 34), at: [524, 301], cam: { tx: 520, ty: 325, s: 1.15 } },
  ];
  places.forEach((p) => {
    p.halo = el('path', { d: p.d, class: 'trace-halo' }, ink);
    p.trace = el('path', { d: p.d, class: 'trace', pathLength: 1, style: 'stroke-width: calc(1.6px * var(--u))' }, ink);
  });

  // ---------- modes ----------
  let mode = 'overview', idx = 0, anchor = null, cardTimer = 0;
  function showCard(html, a, delay) {
    card.classList.remove('show', 'draw'); clearTimeout(cardTimer); anchor = a;
    cardTimer = setTimeout(() => { card.innerHTML = html; void card.offsetWidth; card.classList.add('show', 'draw'); }, reduce ? 0 : delay);
  }
  function clearPlaces() { places.forEach((p) => { p.trace.classList.remove('on'); p.halo.classList.remove('on'); p.trace.getAnimations().forEach((a) => a.cancel()); }); }
  function go(i, first) {
    if (mode === 'climb') {
      idx = (i + moments.length) % moments.length;
      const m = moments[idx];
      moments.forEach((x, k) => x.pin.classList.toggle('cur', k === idx));
      to({ tx: m.x * 0.8 + 500 * 0.2, ty: m.y * 0.8 + 340 * 0.2, tz: m.n * HEIGHT * 0.85, s: 3.1, pitch: rad(61), yaw: rad(-14), rise: 1, night: 1 }, first ? 3200 : 1300, first ? { night: [0, 0.3], pitch: [0.16, 1], rise: [0.3, 1], s: [0.16, 1], yaw: [0.16, 1], tx: [0.1, 1], ty: [0.1, 1] } : null);
      const title = m.struck ? m.title.replace(m.struck, `<s>${m.struck}</s>`) : m.title;
      showCard(`<div class="when"><span>${m.label}</span><span>${idx + 1} of ${moments.length}</span></div><h3>${title}</h3><div class="rule"></div><p>${m.line}</p>`, () => m.head, first ? 2600 : 700);
    } else if (mode === 'mountain') {
      idx = (i + places.length) % places.length;
      const p = places[idx];
      clearPlaces();
      to({ ...p.cam, tz: 0, pitch: 0, yaw: 0, rise: 0, night: 0 }, first ? 2200 : 1700, cam.night > 0.3 ? { night: [0.45, 1], pitch: [0, 0.7], rise: [0, 0.6] } : null);
      p.trace.classList.add('on'); p.halo.classList.add('on');
      p.trace.animate([{ strokeDasharray: '0 1' }, { strokeDasharray: '1 0' }], { duration: reduce ? 1 : 1800, delay: reduce ? 0 : 1300, easing: 'cubic-bezier(0.45,0,0.15,1)', fill: 'backwards' });
      const stats = p.stats.map(([b, s]) => `<div><b>${b}</b><span>${s}</span></div>`).join('');
      const seen = p.seen ? `<div class="seen"><b>${p.seen[0]}</b>${p.seen[1]}</div>` : '';
      showCard(`<div class="when"><span>${p.kind}</span></div><h3>${p.name}</h3><div class="rule"></div><p>${p.line}</p><div class="stats">${stats}</div>${seen}`, () => proj(p.at[0], p.at[1], 0), 2300);
      nextName.textContent = idx === places.length - 1 ? 'Start again' : places[idx + 1].name;
    }
  }
  function setMode(m, i) {
    if (m === mode) return;
    const was = mode; mode = m; stage.dataset.mode = m;
    $('modeSwitch').querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.v === m));
    moments.forEach((x) => x.pin.classList.remove('cur'));
    clearPlaces();
    if (m === 'overview') {
      card.classList.remove('show'); clearTimeout(cardTimer); anchor = null;
      to({ tx: 470, ty: 325, tz: 0, s: 1, pitch: 0, yaw: 0, rise: 0, night: 0 }, was === 'climb' ? 2600 : 1600, was === 'climb' ? { night: [0.5, 1], pitch: [0, 0.75], rise: [0, 0.6] } : null);
    } else go(m === 'climb' ? (i ?? moments.length - 1) : 0, true);
  }
  $('modeSwitch').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) setMode(b.dataset.v); });
  nextBtn.addEventListener('click', () => go(idx + 1));
  window.addEventListener('keydown', (e) => {
    if (!active || mode === 'overview') return;
    if (e.key === 'ArrowRight') go(idx + 1); else if (e.key === 'ArrowLeft') go(idx - 1); else if (e.key === 'Escape') setMode('overview');
  });

  // ---------- one loop ----------
  let active = false;
  function render(now) {
    if (!active) return;
    step(now); frame();
    if (dirty) {
      const nv = cam.night;
      plane.style.transform = `translate(${P.CX - P.S * cam.tx}px, ${P.CY - P.S * cam.ty}px) scale(${P.S})`;
      plane.style.opacity = 1 - smooth(0.1, 0.75, nv);
      nightEl.style.opacity = smooth(0, 0.6, nv);
      terrain.style.opacity = smooth(0.05, 0.7, nv);
      stage.style.setProperty('--night', smooth(0.5, 1, cam.rise).toFixed(3));
      ink.style.setProperty('--u', 1 / P.S);
      if (nv > 0.02 && levels.length) drawTerrain();
      dirty = false;
    }
    drawFx(now);
    if (anchor) {
      const [ax, ay] = anchor(), cw = card.offsetWidth, ch = card.offsetHeight;
      let x = ax + 34, y = ay - ch - 14;
      if (x + cw > SW - 16) x = ax - cw - 34;
      if (y < 72) y = ay + 30;
      card.style.setProperty('--cx', clamp(x, 16, SW - cw - 16) + 'px'); card.style.setProperty('--cy', clamp(y, 72, SH - ch - 76) + 'px');
    }
    requestAnimationFrame(render);
  }
  window.addEventListener('r7:section', (e) => { const was = active; active = e.detail === 'map'; if (active && !was) { size(); requestAnimationFrame(render); } });
})();
