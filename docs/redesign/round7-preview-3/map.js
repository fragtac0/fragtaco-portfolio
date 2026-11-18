// Preview 3: one camera, three states. The flat picture follows the camera in 3D, so the change into
// My climb is one move. In My climb the camera rides the road, which loops round the mountain.
(() => {
  const D = window.R7, PW = 1000, PH = 650;
  const $ = (id) => document.getElementById(id);
  const stage = $('stage'), plane = $('plane'), ink = $('ink'), terrain = $('terrain'), fx = $('fx');
  const pinsEl = $('pins'), card = $('card'), nightEl = $('night'), nextBtn = $('next'), nextName = $('nextName');
  const spot = $('spot'), brackets = $('brackets'), lander = $('lander'), scaleEl = $('scale');
  const tctx = terrain.getContext('2d'), fctx = fx.getContext('2d');
  const NS = 'http://www.w3.org/2000/svg';
  const el = (name, attrs = {}, parent) => { const n = document.createElementNS(NS, name); for (const k in attrs) n.setAttribute(k, attrs[k]); if (parent) parent.appendChild(n); return n; };
  const rad = (d) => (d * Math.PI) / 180;
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const wrap = (d) => ((((d + 180) % 360) + 360) % 360) - 180;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const HEIGHT = 84;            // the summit in map units: about eight times the truth
  const PITCH = rad(62), SCLIMB = 2.7, STEM = 15;
  const C = { x: 487, y: 320 }; // the middle of the mountain

  // ---------- the road: once and a third round the mountain, on a gentle slope ----------
  const PHI0 = -10, SWEEP = 480, N = 240;
  function spiral(t) {
    if (t <= 1) { const phi = PHI0 + SWEEP * t, r = 150 - 50 * Math.pow(t, 0.85); return { x: C.x + r * Math.cos(rad(phi)), y: C.y + r * Math.sin(rad(phi)), phi, n: 0 }; }
    const q = t - 1, phi = PHI0 + SWEEP + 620 * q, r = 100 * Math.pow(1 - q, 1.1);
    const cx = lerp(C.x, D.summit[0], q), cy = lerp(C.y, D.summit[1], q);
    return { x: cx + r * Math.cos(rad(phi)), y: cy + r * Math.sin(rad(phi)), phi, n: 0 };
  }
  const road = d3.range(0, N + 1).map((i) => spiral(i / N));
  const ahead = d3.range(0, 181).map((i) => spiral(1 + i / 180));
  function roadAt(u) { const f = clamp(u) * N, i = Math.min(N - 1, Math.floor(f)), a = road[i], b = road[i + 1], w = f - i; return { x: lerp(a.x, b.x, w), y: lerp(a.y, b.y, w), n: lerp(a.n, b.n, w), phi: lerp(a.phi, b.phi, w) }; }

  // ---------- the camera ----------
  // ax, ay, s: where the flat views look. k: 0 flat, 1 riding the road. u: how far along the road.
  const cam = { ax: 470, ay: 325, s: 1, k: 0, u: 1 };
  let SW = 0, SH = 0, K = 1, dpr = 1, dirty = true, P = {}, V = {};
  function size() {
    const r = stage.getBoundingClientRect();
    SW = r.width; SH = r.height; K = SW / PW; dpr = Math.min(window.devicePixelRatio || 1, 2);
    [terrain, fx].forEach((c) => { c.width = Math.round(SW * dpr); c.height = Math.round(SH * dpr); });
    dirty = true;
  }
  new ResizeObserver(size).observe(stage);
  const zRaw = (n, rise) => n * HEIGHT * smooth(n * 0.55, n * 0.55 + 0.45, rise); // low lines settle first, the summit last
  const zOf = (n) => zRaw(n, V.rise);
  function frame() {
    const F = roadAt(cam.u), k = cam.k, rise = smooth(0.2, 1, k);
    V = {
      k, rise, night: smooth(0.08, 0.62, k),
      tx: lerp(cam.ax, F.x + (C.x - F.x) * 0.3, k), ty: lerp(cam.ay, F.y + (C.y - F.y) * 0.3, k), tz: zRaw(F.n, rise) * 0.9,
      s: Math.exp(lerp(Math.log(cam.s), Math.log(SCLIMB), k)), pitch: PITCH * k, yaw: rad(wrap(90 - F.phi - 12)) * k,
    };
    P = { S: K * V.s, cy: Math.cos(V.yaw), sy: Math.sin(V.yaw), cp: Math.cos(V.pitch), sp: Math.sin(V.pitch), CX: SW / 2, CY: SH * (0.5 + 0.12 * k), DIST: 1350 / V.s };
  }
  function proj(x, y, z) {
    const px = x - V.tx, py = y - V.ty;
    const xr = px * P.cy - py * P.sy, yr = px * P.sy + py * P.cy, zz = z - V.tz;
    const f = P.DIST / (P.DIST - Math.min(yr * P.sp + zz * P.cp, P.DIST * 0.8));
    return [P.CX + P.S * f * xr, P.CY + P.S * f * (yr * P.cp - zz * P.sp)];
  }
  let tw = null;
  function to(target, ms) { tw = { from: { ...cam }, to: { ...cam, ...target }, t0: performance.now(), ms: reduce ? 1 : ms }; }
  function step(now) {
    if (!tw) return;
    const t = clamp((now - tw.t0) / tw.ms), e = ease(t);
    for (const key in cam) cam[key] = key === 's' ? Math.exp(lerp(Math.log(tw.from.s), Math.log(tw.to.s), e)) : lerp(tw.from[key], tw.to[key], e);
    if (t >= 1) tw = null;
    dirty = true;
  }

  // ---------- the heights: a wider frame than the picture, so the ground runs on past the edges ----------
  const GW = 800, GH = 520, X0 = -300, Y0 = -195, XW = 1600, YH = 1040;
  let field = null, base = 0, hi = 1, levels = [];
  const sampleN = (x, y) => {
    if (!field) return 0;
    const gx = clamp(((x - X0) / XW) * (GW - 1), 0, GW - 1.001), gy = clamp(((y - Y0) / YH) * (GH - 1), 0, GH - 1.001);
    const ix = Math.floor(gx), iy = Math.floor(gy), a = gx - ix, b = gy - iy, i = iy * GW + ix;
    return (((field[i] * (1 - a) + field[i + 1] * a) * (1 - b) + (field[i + GW] * (1 - a) + field[i + GW + 1] * a) * b) - base) / (hi - base);
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
    base = sorted[Math.floor(sorted.length * 0.3)]; hi = sorted[sorted.length - 1];
    const cream = d3.interpolateRgb('rgba(253,244,222,0.30)', 'rgba(255,214,170,0.62)'), fire = d3.interpolateRgb('rgba(255,190,130,0.7)', 'rgba(255,118,40,1)');
    const floor = d3.interpolateRgb('#0f0e0d', '#21160f');
    levels = d3.contours().size([GW, GH]).smooth(true).thresholds(d3.range(Math.ceil(sorted[0]) + 0.5, hi, 3))(field).map((ct, i) => {
      const n = (ct.value - base) / (hi - base), major = i % 5 === 0;
      return {
        n: Math.max(n, -0.05), fill: floor(clamp(n)), width: major ? 1.4 : 0.8,
        stroke: n < 0.05 ? `rgba(253,252,230,${major ? 0.2 : 0.11})` : n < 0.45 ? cream(n / 0.45) : fire((n - 0.45) / 0.55),
        rings: ct.coordinates.flatMap((poly) => poly.map((ring) => { const a = new Float32Array(ring.length * 2); ring.forEach((p, k) => { a[k * 2] = (p[0] * XW) / GW + X0; a[k * 2 + 1] = (p[1] * YH) / GH + Y0; }); return a; })),
      };
    });
    [...road, ...ahead].forEach((p) => { p.n = sampleN(p.x, p.y); });
    moments.forEach((m) => { m.n = sampleN(m.x, m.y); });
    dirty = true;
  };
  img.src = 'assets/dem-wide.png';

  function drawTerrain() {
    const t0 = performance.now();
    const c = tctx; c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, SW, SH); c.lineJoin = 'round';
    const { S, cy, sy, cp, sp, CX, CY, DIST } = P, tx = V.tx, ty = V.ty, lim = DIST * 0.8;
    for (let li = 0; li < levels.length; li++) {
      const L = levels[li], z = zOf(L.n) - V.tz, zs = z * sp, zc = z * cp;
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
    window.__r7ms = performance.now() - t0;
  }

  // ---------- the milestones ----------
  const FR = [0, 0.3, 0.38, 0.48, 0.58, 0.66, 0.8, 0.93, 1];
  const ICON = ['gear-six', 'scissors', 'graduation-cap', 'megaphone', 'video-camera', 'film-slate', 'microphone', 'paper-plane-tilt', 'person-simple-hike'];
  const moments = D.moments.map((m, i) => {
    const p = roadAt(FR[i]);
    const b = document.createElement('button');
    b.className = 'mpin' + (i === D.moments.length - 1 ? ' now' : '');
    b.innerHTML = `<span class="bead"><i class="ph-fill ph-${ICON[i]}"></i></span><span class="tip">${m.label}: ${m.title}</span>`;
    b.setAttribute('aria-label', `${m.label}: ${m.title}`);
    b.addEventListener('click', () => { if (mode !== 'climb') setMode('climb', i); else go(i); });
    pinsEl.appendChild(b);
    return { ...m, x: p.x, y: p.y, n: 0, u: FR[i], pin: b, head: [0, 0] };
  });

  let roadA = 1;
  function drawFx(now) {
    const c = fctx; c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, SW, SH);
    roadA += ((mode === 'mountain' ? 0 : 1) - roadA) * 0.08;
    if (roadA < 0.01) return;
    const lift = 0.8 * V.rise;
    // how much of a point is in view: the far side of the mountain is drawn faint, so the loop reads as going round the back
    const near = (p) => 1 - 0.74 * V.k * smooth(-8, -46, (p.x - C.x) * P.sy + (p.y - C.y) * P.cy);
    const run = (pts, style, width, dash) => {
      c.strokeStyle = style; c.lineWidth = width; c.setLineDash(dash || []);
      let prev = null;
      pts.forEach((p) => { const q = proj(p.x, p.y, zOf(p.n) + lift); if (prev) { c.globalAlpha = roadA * near(p); c.beginPath(); c.moveTo(prev[0], prev[1]); c.lineTo(q[0], q[1]); c.stroke(); } prev = q; });
      c.setLineDash([]);
    };
    c.lineCap = 'round'; c.lineJoin = 'round';
    run(road, 'rgba(0,0,0,0.42)', 3.6);
    run(road, '#fff8e8', 1.5);
    run(ahead, 'rgba(255,248,232,0.75)', 1.3, [1.5, 6]);
    c.globalAlpha = roadA;
    const bs = 0.5 + 0.5 * V.k;
    moments.forEach((m) => {
      const z0 = zOf(m.n) + lift, b = proj(m.x, m.y, z0), h = proj(m.x, m.y, z0 + STEM * V.rise);
      m.head = h;
      if (V.rise > 0.02) {
        c.beginPath(); c.moveTo(b[0], b[1]); c.lineTo(h[0], h[1]); c.strokeStyle = 'rgba(255,255,255,0.8)'; c.lineWidth = 1.2; c.stroke();
        c.beginPath(); c.ellipse(b[0], b[1], 3.4, 3.4 * Math.max(0.35, P.cp), 0, 0, 7); c.fillStyle = '#fff'; c.fill();
      }
      m.pin.style.transform = `translate(${h[0]}px, ${h[1]}px)`; m.pin.style.setProperty('--bs', bs); m.pin.style.zIndex = Math.round(h[1]); m.pin.style.opacity = mode === 'mountain' ? '' : (0.35 + 0.65 * near(m)).toFixed(2);
    });
    const m = moments[moments.length - 1], z0 = zOf(m.n) + lift;      // the radar at "now"
    for (let k = 0; k < 2; k++) {
      const t = ((now / 2600 + k * 0.5) % 1), r = ((2 + 15 * t) / Math.sqrt(V.s)) * 1.6;
      c.beginPath();
      for (let a = 0; a <= 40; a++) { const q = proj(m.x + Math.cos((a / 40) * 6.2832) * r, m.y + Math.sin((a / 40) * 6.2832) * r, z0); if (a) c.lineTo(q[0], q[1]); else c.moveTo(q[0], q[1]); }
      c.strokeStyle = `rgba(252,76,0,${0.95 * (1 - t)})`; c.lineWidth = 1.6; c.stroke();
    }
    c.globalAlpha = 1;
  }

  // ---------- the tour: three close stops, then back and back until half of Mars is in view ----------
  const cliffD = d3.line().curve(d3.curveCatmullRomClosed.alpha(0.5))(D.cliff);
  const cliffTrace = el('path', { d: cliffD, class: 'trace', pathLength: 1, style: 'stroke-width: calc(1.8px * var(--u))' }, ink);
  const farLine = el('path', { d: `M${D.summit[0]},${D.summit[1]} L2630,227`, class: 'far', style: 'stroke-width: calc(1.4px * var(--u)); stroke-dasharray: calc(2px * var(--u)) calc(7px * var(--u))' }, ink);
  const places = [
    { name: 'Olympus Mons', kind: 'Shield volcano', line: 'The largest volcano known in the solar system. Its base would cover Italy, and its slopes are so gentle you could walk up without noticing the climb.', stats: [['610 km', 'across'], ['22 km', 'tall']], seen: ['Mariner 9, 1971', 'Arrived during a planet-wide dust storm. The first thing it saw of Mars was this summit, standing above the dust.'], box: [350, 184, 622, 454], cam: { ax: 570, ay: 318, s: 1.45 } },
    { name: 'Olympus Rupes', kind: 'Cliff', line: 'A wall of rock that rings the whole mountain. Whoever climbs Olympus Mons has to get up this before the real climb starts.', stats: [['6 km', 'at its highest']], seen: ['Viking orbiters, 1976 to 1980', 'Mapped the cliff from orbit. The picture on this page is stitched from their photographs.'], box: [350, 184, 622, 454], cliff: true, cam: { ax: 600, ay: 330, s: 1.8 } },
    { name: 'Olympus Paterae', kind: 'Summit calderas', line: 'Craters nested inside each other, each one left where the roof fell in after an eruption drained the rock below.', stats: [['85 km', 'across'], ['3 km', 'deep']], seen: ['Mars Express, 2004', 'Its stereo camera photographed the calderas in colour and in 3D, weeks after arriving.'], box: [477, 303, 524, 349], cam: { ax: 540, ay: 326, s: 2.9 } },
    { name: 'Lycus Sulci', kind: 'Aureole', line: 'Ridged, broken ground that spreads up to a thousand kilometres from the foot of the cliff. It may be the wreckage of giant landslides off the mountain. Nobody is sure.', stats: [['1,000 km', 'reach']], seen: ['Mars Global Surveyor, 1997 to 2006', 'Its laser measured the height of this whole region. The contour lines in My climb come from it.'], box: [95, 55, 470, 372], cam: { ax: 430, ay: 270, s: 0.95 } },
    { name: 'Tharsis Montes', kind: 'Three more volcanoes', line: 'Three more giants in a row, each taller than any mountain on Earth. With Olympus Mons they sit on Tharsis, a bulge in the crust of Mars the size of a continent.', stats: [['3', 'in a line'], ['18 km', 'the tallest']], box: [770, 420, 1290, 1050], cam: { ax: 1150, ay: 640, s: 0.5 } },
    { name: 'Valles Marineris', kind: 'Canyon system', line: 'A crack in the planet about 4,000 km long and up to 7 km deep. Laid over Earth it would run from one coast of the United States to the other.', stats: [['4,000 km', 'long'], ['7 km', 'deep']], seen: ['Mariner 9, 1971', 'Found it and gave it its name: Valles Marineris means the valleys of Mariner.'], box: [1440, 850, 2640, 1215], cam: { ax: 2080, ay: 880, s: 0.36 } },
    { name: 'Viking 1', kind: 'The first landing', line: 'The first spacecraft to work on the surface of Mars set down here on 20 July 1976, about 4,700 km east of Olympus Mons. Landers aim for low ground, where the air is thickest.', stats: [['1976', 'landed'], ['6 years', 'of work']], box: [2585, 182, 2675, 272], lander: [2630, 227], far: true, cam: { ax: 1700, ay: 420, s: 0.34 } },
    { name: 'Half a planet', kind: 'The whole view', line: 'Everything on this page in one look: the tallest mountain, three more giants, the great canyon and the first landing site. Mars is about half as wide as Earth.', stats: [['6,779 km', 'across'], ['2', 'moons']], cam: { ax: 1255, ay: 659, s: 0.262 } },
  ];

  // ---------- modes ----------
  let mode = 'overview', idx = 0, anchor = null, cardTimer = 0, markTimer = 0, place = null;
  function showCard(html, a, delay) {
    card.classList.remove('show', 'draw'); clearTimeout(cardTimer); anchor = a;
    cardTimer = setTimeout(() => { card.innerHTML = html; void card.offsetWidth; card.classList.add('show', 'draw'); }, reduce ? 0 : delay);
  }
  function clearTour() {
    clearTimeout(markTimer); place = null;
    spot.classList.remove('on'); brackets.classList.remove('on'); lander.classList.remove('on'); farLine.classList.remove('on');
    cliffTrace.classList.remove('on'); cliffTrace.getAnimations().forEach((a) => a.cancel());
  }
  function go(i, first) {
    if (mode === 'climb') {
      const was = idx; idx = (i + moments.length) % moments.length;
      const m = moments[idx];
      moments.forEach((x, k) => x.pin.classList.toggle('cur', k === idx));
      let ms = 3600;
      if (first) cam.u = m.u; else ms = 1100 + 3200 * Math.abs(m.u - moments[was].u);
      to({ k: 1, u: m.u }, ms);
      const title = m.struck ? m.title.replace(m.struck, `<s>${m.struck}</s>`) : m.title;
      showCard(`<div class="when"><span>${m.label}</span><span>${idx + 1} of ${moments.length}</span></div><h3>${title}</h3><div class="rule"></div><p>${m.line}</p>`, () => m.head, ms - 500);
    } else if (mode === 'mountain') {
      idx = (i + places.length) % places.length;
      const p = places[idx];
      clearTour();
      const ms = first ? 2400 : 2000;
      to({ ...p.cam, k: 0 }, ms);
      markTimer = setTimeout(() => {
        place = p;
        if (p.box) { spot.classList.add('on'); brackets.classList.add('on'); }
        if (p.lander) lander.classList.add('on');
        if (p.far) farLine.classList.add('on');
        if (p.cliff) { cliffTrace.classList.add('on'); cliffTrace.animate([{ strokeDasharray: '0 1' }, { strokeDasharray: '1 0' }], { duration: reduce ? 1 : 2200, easing: 'cubic-bezier(0.45,0,0.15,1)', fill: 'backwards' }); }
      }, reduce ? 0 : ms * 0.62);
      const stats = p.stats.map(([b, s]) => `<div><b>${b}</b><span>${s}</span></div>`).join('');
      const seen = p.seen ? `<div class="seen"><b>${p.seen[0]}</b>${p.seen[1]}</div>` : '';
      showCard(`<div class="when"><span>${p.kind}</span><span>${idx + 1} of ${places.length}</span></div><h3>${p.name}</h3><div class="rule"></div><p>${p.line}</p><div class="stats">${stats}</div>${seen}`,
        () => (p.box ? proj(p.box[2], p.box[1], 0) : [0, SH]), ms * 0.85);
      nextName.textContent = idx === places.length - 1 ? 'Start again' : places[idx + 1].name;
    }
  }
  function setMode(m, i) {
    if (m === mode) return;
    const was = mode; mode = m; stage.dataset.mode = m;
    $('modeSwitch').querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.v === m));
    moments.forEach((x) => x.pin.classList.remove('cur'));
    clearTour();
    if (m === 'overview') {
      card.classList.remove('show'); clearTimeout(cardTimer); anchor = null;
      to({ ax: 470, ay: 325, s: 1, k: 0 }, was === 'climb' ? 3200 : 2000);
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
  const NICE = [5000, 2000, 1000, 500, 200, 100, 50];
  function render(now) {
    if (!active) return;
    step(now); frame();
    if (dirty) {
      const nv = V.night, op = 1 - smooth(0.12, 0.85, nv);
      if (op > 0.003) plane.style.transform = `translate(${P.CX}px, ${P.CY}px) perspective(${P.DIST * P.S}px) rotateX(${V.pitch}rad) rotateZ(${V.yaw}rad) translateZ(${-V.tz * P.S}px) scale(${P.S}) translate(${-V.tx}px, ${-V.ty}px)`;
      plane.style.opacity = op;
      nightEl.style.opacity = smooth(0, 0.7, nv);
      terrain.style.opacity = smooth(0.04, 0.75, nv);
      stage.style.setProperty('--night', smooth(0.45, 1, V.k).toFixed(3));
      ink.style.setProperty('--u', 1 / P.S);
      if (nv > 0.02 && levels.length) drawTerrain();
      const km = (110 / P.S) * 2.372, nice = NICE.find((v) => v <= km) || 50;   // one map unit is 2.372 km
      scaleEl.firstElementChild.style.width = (nice / 2.372) * P.S + 'px'; scaleEl.lastElementChild.textContent = nice.toLocaleString('en') + ' km';
      dirty = false;
    }
    drawFx(now);
    if (place && place.box) {
      const a = proj(place.box[0], place.box[1], 0), b = proj(place.box[2], place.box[3], 0), pad = 10;
      const x = a[0] - pad, y = a[1] - pad, w = b[0] - a[0] + pad * 2, h = b[1] - a[1] + pad * 2;
      brackets.style.transform = `translate(${x}px, ${y}px)`; brackets.style.width = w + 'px'; brackets.style.height = h + 'px';
      spot.style.background = `radial-gradient(ellipse ${w * 0.95}px ${h * 0.95}px at ${x + w / 2}px ${y + h / 2}px, rgba(8,6,5,0) 58%, rgba(8,6,5,0.56) 100%)`;
    }
    if (place && place.lander) { const q = proj(place.lander[0], place.lander[1], 0); lander.style.transform = `translate(${q[0]}px, ${q[1] - 22}px)`; }
    if (anchor) {
      const [ax, ay] = anchor(), cw = card.offsetWidth, ch = card.offsetHeight;
      let x = ax + 26, y = ay - ch * (mode === 'climb' ? 1 : 0.1) - (mode === 'climb' ? 12 : 0);
      if (x + cw > SW - 16) x = ax - cw - 26 - (place && place.box ? (proj(place.box[2], 0, 0)[0] - proj(place.box[0], 0, 0)[0]) + 20 : 0);
      if (y < 72) y = ay + 26;
      card.style.setProperty('--cx', clamp(x, 16, SW - cw - 16) + 'px'); card.style.setProperty('--cy', clamp(y, 72, SH - ch - 70) + 'px');
    }
    requestAnimationFrame(render);
  }
  window.addEventListener('r7:section', (e) => { const was = active; active = e.detail === 'map'; if (active && !was) { size(); requestAnimationFrame(render); } });
})();
