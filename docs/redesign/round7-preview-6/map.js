// Preview 6: two states. Overview is the flat, toned picture. My climb is the tilted night map with the
// contour lines lifted to their height. One number (k) carries the whole change between them, so the
// camera makes a single move. The trail is the first one, moved a little down the mountain.
(() => {
  const D = window.R7, PW = 1000;
  const $ = (id) => document.getElementById(id);
  const stage = $('stage'), plane = $('plane'), terrain = $('terrain'), fx = $('fx');
  const pinsEl = $('pins'), card = $('card'), nightEl = $('night');
  const frameCv = $('frame'), tctx = terrain.getContext('2d'), fctx = fx.getContext('2d'), gctx = frameCv.getContext('2d');
  const NS = 'http://www.w3.org/2000/svg';
  const svgPath = (d) => { const n = document.createElementNS(NS, 'path'); n.setAttribute('d', d); return n; };
  const rad = (d) => (d * Math.PI) / 180;
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const HEIGHT = 84;            // the summit in map units: about eight times the truth
  const PITCH = rad(61), YAW = rad(-14), SCLIMB = 3, STEM = 15;
  const C = { x: 487, y: 320 }; // the middle of the mountain

  // ---------- the trail: the first one, each point pushed away from the summit, the later ones more ----------
  const N = 200, top = D.summit;
  const lowered = D.route.map((p, i) => { const t = i / (D.route.length - 1), k = 1 + 0.4 * Math.pow(t, 1.2); return [top[0] + (p[0] - top[0]) * k, top[1] + (p[1] - top[1]) * k]; });
  const roadPath = svgPath(d3.line().curve(d3.curveCatmullRom.alpha(0.5))(lowered)), len = roadPath.getTotalLength();
  const road = d3.range(0, N + 1).map((i) => { const p = roadPath.getPointAtLength((len * i) / N); return { x: p.x, y: p.y, n: 0 }; });
  const end = lowered[lowered.length - 1];
  const aheadPath = svgPath(d3.line().curve(d3.curveBasis)([end, [(end[0] + top[0]) / 2 - 20, (end[1] + top[1]) / 2 - 22], top])), alen = aheadPath.getTotalLength();
  const ahead = d3.range(0, 61).map((i) => { const p = aheadPath.getPointAtLength((alen * i) / 60); return { x: p.x, y: p.y, n: 0 }; });
  function roadAt(u) { const f = clamp(u) * N, i = Math.min(N - 1, Math.floor(f)), a = road[i], b = road[i + 1], w = f - i; return { x: lerp(a.x, b.x, w), y: lerp(a.y, b.y, w), n: lerp(a.n, b.n, w) }; }

  // ---------- the camera ----------
  // ax, ay, s: where the overview looks. k: 0 overview, 1 on the trail. u: how far along the trail.
  const cam = { ax: 470, ay: 325, s: 1.1, k: 0, u: 1 };   // a slight zoom, so the picture always covers the frame
  let SW = 0, SH = 0, K = 1, dpr = 1, dirty = true, P = {}, V = {};
  function size() {
    const r = stage.getBoundingClientRect();
    SW = r.width; SH = r.height; K = Math.max(SW / PW, SH / 650); dpr = Math.min(window.devicePixelRatio || 1, 2);
    [terrain, fx, frameCv].forEach((c) => { c.width = Math.round(SW * dpr); c.height = Math.round(SH * dpr); });
    dirty = true;
  }
  new ResizeObserver(size).observe(stage);
  const zRaw = (n, rise) => n * HEIGHT * smooth(n * 0.55, n * 0.55 + 0.45, rise); // low lines settle first, the summit last
  const zOf = (n) => zRaw(n, V.rise);
  // the whole view for a given state: k (0 overview, 1 on the trail) and u (where along the trail the camera sits)
  function viewOf(k, u) {
    const F = roadAt(u), rise = smooth(0.2, 1, k);
    const v = {
      k, rise, night: smooth(0.08, 0.62, k),
      tx: lerp(cam.ax, F.x + (C.x - F.x) * 0.22, k), ty: lerp(cam.ay, F.y + (C.y - F.y) * 0.22, k), tz: zRaw(F.n, rise) * 0.9,
      s: Math.exp(lerp(Math.log(cam.s), Math.log(SCLIMB), k)), pitch: PITCH * k, yaw: YAW * k,
    };
    const p = { S: K * v.s, cy: Math.cos(v.yaw), sy: Math.sin(v.yaw), cp: Math.cos(v.pitch), sp: Math.sin(v.pitch), CX: SW / 2, CY: SH * (0.5 + 0.12 * k), DIST: 1350 / v.s };
    return { v, p };
  }
  function projWith(v, p, x, y, z) {
    const px = x - v.tx, py = y - v.ty;
    const xr = px * p.cy - py * p.sy, yr = px * p.sy + py * p.cy, zz = z - v.tz;
    const f = p.DIST / (p.DIST - Math.min(yr * p.sp + zz * p.cp, p.DIST * 0.8));
    return [p.CX + p.S * f * xr, p.CY + p.S * f * (yr * p.cp - zz * p.sp)];
  }
  function frame() { const w = viewOf(cam.k, cam.u); V = w.v; P = w.p; }
  const proj = (x, y, z) => projWith(V, P, x, y, z);
  // k changes on a timed ease (the change between the two states). u follows its goal like a weight on a soft
  // spring: it starts gently, never overshoots, and a new goal mid-move bends the path without a jolt.
  let tw = null, uGoal = 1, uVel = 0, lastStep = 0;
  function to(target, ms) { tw = { from: { ...cam }, to: { ...cam, ...target }, t0: performance.now(), ms: reduce ? 1 : ms }; }
  function step(now) {
    const dt = Math.min(0.05, (now - (lastStep || now)) / 1000); lastStep = now;
    if (tw) {
      const t = clamp((now - tw.t0) / tw.ms), e = ease(t);
      for (const key of ['ax', 'ay', 's', 'k']) cam[key] = lerp(tw.from[key], tw.to[key], e);
      if (t >= 1) tw = null;
      dirty = true;
    }
    if (Math.abs(uGoal - cam.u) > 0.0004 || Math.abs(uVel) > 0.0004) {
      if (reduce) { cam.u = uGoal; uVel = 0; } else { const w = 2.1; uVel += (w * w * (uGoal - cam.u) - 2 * w * uVel) * dt; cam.u += uVel * dt; }
      dirty = true;
    }
  }
  // where the camera should sit for a milestone: where it is, if the milestone is comfortably in view from there;
  // otherwise the nearest place along the trail from which it is
  function settle(m) {
    const inside = (cu) => { const w = viewOf(1, cu), q = projWith(w.v, w.p, m.x, m.y, zRaw(m.n, 1) + STEM); return q[0] > SW * 0.25 && q[0] < SW * 0.75 && q[1] > SH * 0.4 && q[1] < SH * 0.8; };
    if (inside(uGoal)) return uGoal;
    const dir = Math.sign(m.u - uGoal) || 1;
    for (let cu = uGoal; dir > 0 ? cu <= 1 : cu >= 0; cu += dir * 0.02) if (inside(cu)) return clamp(cu + dir * 0.05);
    return m.u;
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
    [...road, ...ahead, ...moments].forEach((p) => { p.n = sampleN(p.x, p.y); });
    dirty = true;
  };
  img.src = '../round7-preview-3/assets/dem-wide.png';

  function drawTerrain() {
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

  // ---------- the chart marks: a quiet grid, crosses, two dotted range rings, and a frame ----------
  const xOf = (lon) => (lon - 206.795) * 25, yOf = (lat) => (31.366 - lat) * 25;   // 25 map units to a degree
  const LONS = d3.range(190, 266, 2.5), LATS = d3.range(-5, 46, 2.5), INK = '253,252,230';
  const seg = (c, a, b) => { c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); };
  function drawGrid(c, alpha, crosses) {
    c.lineWidth = 1;
    LONS.forEach((lon) => { const major = lon % 5 === 0; c.strokeStyle = `rgba(${INK},${(major ? 0.13 : 0.075) * alpha})`; c.setLineDash(major ? [] : [1, 5]); seg(c, proj(xOf(lon), yOf(45), 0), proj(xOf(lon), yOf(-5), 0)); });
    LATS.forEach((lat) => { const major = lat % 5 === 0; c.strokeStyle = `rgba(${INK},${(major ? 0.13 : 0.075) * alpha})`; c.setLineDash(major ? [] : [1, 5]); seg(c, proj(xOf(190), yOf(lat), 0), proj(xOf(265), yOf(lat), 0)); });
    c.setLineDash([]);
    if (!crosses) return;
    c.strokeStyle = `rgba(${INK},${0.5 * alpha})`;
    LONS.forEach((lon) => LATS.forEach((lat) => { if (lon % 5 || lat % 5) return; const q = proj(xOf(lon), yOf(lat), 0); seg(c, [q[0] - 4.5, q[1]], [q[0] + 4.5, q[1]]); seg(c, [q[0], q[1] - 4.5], [q[0], q[1] + 4.5]); }));
  }
  function drawChart(c) {
    const a = 1 - smooth(0, 0.4, V.k);   // the flat marks leave as the camera tilts
    c.font = '500 10px "IBM Plex Mono", monospace'; c.textBaseline = 'middle';
    if (a > 0.01) {
      drawGrid(c, a, true);
      // how far from the summit: 150 and 300 km, dotted
      [150, 300].forEach((km) => {
        const r = km / 2.372; c.beginPath();
        for (let i = 0; i <= 96; i++) { const q = proj(top[0] + Math.cos((i / 96) * 6.2832) * r, top[1] + Math.sin((i / 96) * 6.2832) * r, 0); if (i) c.lineTo(q[0], q[1]); else c.moveTo(q[0], q[1]); }
        c.setLineDash([1, 4]); c.strokeStyle = `rgba(${INK},${0.42 * a})`; c.lineWidth = 1; c.stroke(); c.setLineDash([]);
        const q = proj(top[0] + r * 0.7071, top[1] - r * 0.7071, 0); c.fillStyle = `rgba(${INK},${0.6 * a})`; c.textAlign = 'left'; c.fillText(km + ' km', q[0] + 6, q[1] - 4);
      });
      // the summit: a small open triangle
      const s = proj(top[0], top[1], 0); c.beginPath(); c.moveTo(s[0], s[1] - 6); c.lineTo(s[0] + 5.5, s[1] + 4); c.lineTo(s[0] - 5.5, s[1] + 4); c.closePath(); c.strokeStyle = `rgba(${INK},${0.85 * a})`; c.lineWidth = 1.2; c.stroke();
    }
  }
  // the frame is drawn on its own canvas above the edge darkening, so it stays crisp in the corners
  function drawFrame() {
    const c = gctx; c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, SW, SH);
    const a = 1 - smooth(0, 0.4, V.k);
    c.font = '500 10px "IBM Plex Mono", monospace'; c.textBaseline = 'middle';
    if (a > 0.01) {
      // the degrees, along the right edge and part of the foot
      c.fillStyle = `rgba(${INK},${0.55 * a})`;
      LATS.forEach((lat) => { if (lat % 5) return; const y = proj(0, yOf(lat), 0)[1]; if (y > 84 && y < SH - 80) { c.textAlign = 'right'; c.fillText(lat + '° N', SW - 16, y - 7); } });
      LONS.forEach((lon) => { if (lon % 5) return; const x = proj(xOf(lon), 0, 0)[0]; if (x > SW * 0.5 && x < SW - 250) { c.textAlign = 'left'; c.fillText(lon + '° E', x + 5, SH - 16); } });
      // north, at the head of the frame, and a scale bar at the foot
      c.fillStyle = `rgba(${INK},${0.75 * a})`; c.textAlign = 'center'; c.fillText('N', SW / 2, 23);
      c.beginPath(); c.moveTo(SW / 2, 7); c.lineTo(SW / 2 + 3.5, 13); c.lineTo(SW / 2 - 3.5, 13); c.closePath(); c.fill();
      const len = (200 / 2.372) * P.S, x1 = SW - 24, x0 = x1 - len, y = SH - 44;
      c.strokeStyle = `rgba(${INK},${0.8 * a})`; c.lineWidth = 1.2; seg(c, [x0, y], [x1, y]);
      [0, 0.5, 1].forEach((t) => seg(c, [x0 + len * t, y - 4], [x0 + len * t, y]));
      c.textAlign = 'left'; c.fillText('0', x0 - 2, y - 11); c.textAlign = 'right'; c.fillText('200 km', x1 + 2, y - 11);
    }
    // always there: four corner marks, two small squares, and where we are
    c.strokeStyle = `rgba(${INK},0.55)`; c.lineWidth = 1.2; const d = 10, L = 12;
    [[d, d, 1, 1], [SW - d, d, -1, 1], [d, SH - d, 1, -1], [SW - d, SH - d, -1, -1]].forEach(([x, y, sx, sy]) => { c.beginPath(); c.moveTo(x + L * sx, y); c.lineTo(x, y); c.lineTo(x, y + L * sy); c.stroke(); });
    c.fillStyle = `rgba(${INK},0.55)`; c.fillRect(d - 1.5, SH / 2 - 1.5, 3, 3); c.fillRect(SW - d - 1.5, SH / 2 - 1.5, 3, 3);
    const at = mode === 'climb' ? moments[idx] : { x: top[0], y: top[1] };
    c.fillStyle = `rgba(${INK},0.72)`; c.textAlign = 'right';
    c.fillText(`${(31.366 - at.y / 25).toFixed(2)}° N   ${(206.795 + at.x / 25).toFixed(2)}° E`, SW - 24, SH - 22);
  }

  function drawFx(now) {
    const c = fctx; c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, SW, SH);
    drawChart(c);
    const lift = 0.8 * V.rise;   // the trail and the pin feet share this height, so the feet sit on the line
    const trace = (pts) => { c.beginPath(); pts.forEach((p, i) => { const q = proj(p.x, p.y, zOf(p.n) + lift); if (i) c.lineTo(q[0], q[1]); else c.moveTo(q[0], q[1]); }); };
    c.lineCap = 'round'; c.lineJoin = 'round';
    trace(road); c.strokeStyle = 'rgba(0,0,0,0.42)'; c.lineWidth = 3.6; c.stroke();
    trace(road); c.strokeStyle = '#fff8e8'; c.lineWidth = 1.5; c.stroke();
    trace(ahead); c.setLineDash([1.5, 6]); c.strokeStyle = 'rgba(255,248,232,0.8)'; c.lineWidth = 1.3; c.stroke(); c.setLineDash([]);
    const bs = 0.5 + 0.5 * V.k;
    moments.forEach((m) => {
      const z0 = zOf(m.n) + lift, b = proj(m.x, m.y, z0), h = proj(m.x, m.y, z0 + STEM * V.rise);
      m.head = h;
      if (V.rise > 0.02) {
        c.beginPath(); c.moveTo(b[0], b[1]); c.lineTo(h[0], h[1]); c.strokeStyle = 'rgba(255,255,255,0.8)'; c.lineWidth = 1.2; c.stroke();
        c.beginPath(); c.ellipse(b[0], b[1], 3.4, 3.4 * Math.max(0.35, P.cp), 0, 0, 7); c.fillStyle = '#fff'; c.fill();
      }
      m.pin.style.transform = `translate(${h[0]}px, ${h[1]}px)`; m.pin.style.setProperty('--bs', bs); m.pin.style.zIndex = Math.round(h[1]);
    });
    const m = moments[moments.length - 1], z0 = zOf(m.n) + lift;      // the radar at "now"
    for (let k = 0; k < 2; k++) {
      const t = ((now / 2600 + k * 0.5) % 1), r = ((2 + 15 * t) / Math.sqrt(V.s)) * 1.6;
      c.beginPath();
      for (let a = 0; a <= 40; a++) { const q = proj(m.x + Math.cos((a / 40) * 6.2832) * r, m.y + Math.sin((a / 40) * 6.2832) * r, z0); if (a) c.lineTo(q[0], q[1]); else c.moveTo(q[0], q[1]); }
      c.strokeStyle = `rgba(252,76,0,${0.95 * (1 - t)})`; c.lineWidth = 1.6; c.stroke();
    }
  }

  // ---------- the two states ----------
  let mode = 'overview', idx = 0, anchor = null, cardTimer = 0, slot = 0;
  // five places a card can sit round its milestone; it takes the one with the fewest other milestones under it
  const SLOTS = [(w, h) => [26, -h - 12], (w, h) => [-w - 26, -h - 12], (w, h) => [-w / 2, -h - 40], (w, h) => [30, 22], (w, h) => [-w - 30, 22]];
  function cardRect(k, ax, ay, cw, ch) { const [dx, dy] = SLOTS[k](cw, ch); return [clamp(ax + dx, 16, SW - cw - 16), clamp(ay + dy, 72, SH - ch - 24)]; }
  function covered(x, y, cw, ch, m) { return m.head[0] > x - 22 && m.head[0] < x + cw + 22 && m.head[1] > y - 22 && m.head[1] < y + ch + 22; }
  function pickSlot() {
    const [ax, ay] = anchor(), cw = card.offsetWidth, ch = card.offsetHeight; let best = 0, bestScore = 1e9;
    SLOTS.forEach((_, k) => {
      const [x, y] = cardRect(k, ax, ay, cw, ch);
      let score = k * 0.1 + moments.reduce((n, m) => n + (covered(x, y, cw, ch, m) ? (m === moments[idx] ? 4 : 1) : 0), 0);
      if (score < bestScore) { bestScore = score; best = k; }
    });
    slot = best;
  }
  // the old card leaves completely first; only then are the new words set, the place chosen and the card shown,
  // so words never change inside a visible card and the card never jumps while it can be seen
  function showCard(html, a, delay) {
    card.classList.remove('show'); clearTimeout(cardTimer);
    cardTimer = setTimeout(() => {
      anchor = a; card.classList.remove('draw'); card.innerHTML = html; void card.offsetWidth; pickSlot(); placeCard();
      card.classList.add('show', 'draw');
    }, reduce ? 0 : Math.max(delay, 260));
  }
  function placeCard() {
    const [ax, ay] = anchor(), cw = card.offsetWidth, ch = card.offsetHeight, [x, y] = cardRect(slot, ax, ay, cw, ch);
    card.style.setProperty('--cx', x + 'px'); card.style.setProperty('--cy', y + 'px');
    return [x, y, cw, ch];
  }
  function go(i, first) {
    idx = (i + moments.length) % moments.length;
    const m = moments[idx];
    moments.forEach((x, k) => x.pin.classList.toggle('cur', k === idx));
    let wait = 250;
    if (first) { uGoal = 0.72; uGoal = settle(m); cam.u = uGoal; uVel = 0; to({ k: 1 }, 3600); wait = 3150; }
    else { const g = settle(m); if (Math.abs(g - uGoal) > 0.001) wait = 1300; uGoal = g; }
    const title = m.struck ? m.title.replace(m.struck, `<s>${m.struck}</s>`) : m.title;
    showCard(`<div class="when"><span>${m.label}</span><span>${idx + 1} of ${moments.length}</span></div><h3>${title}</h3><div class="rule"></div><p>${m.line}</p>`, () => m.head, wait);
  }
  function setMode(m, i) {
    if (m === mode) return;
    mode = m; stage.dataset.mode = m;
    $('modeSwitch').querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.v === m));
    moments.forEach((x) => x.pin.classList.remove('cur'));
    if (m === 'overview') { card.classList.remove('show'); clearTimeout(cardTimer); anchor = null; moments.forEach((x) => { x.pin.style.opacity = ''; }); to({ k: 0 }, 3200); }
    else go(i ?? moments.length - 1, true);
  }
  $('modeSwitch').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) setMode(b.dataset.v); });
  window.addEventListener('keydown', (e) => {
    if (!active || mode !== 'climb') return;
    if (e.key === 'ArrowRight') go(Math.min(idx + 1, moments.length - 1)); else if (e.key === 'ArrowLeft') go(Math.max(idx - 1, 0)); else if (e.key === 'Escape') setMode('overview');
  });

  // ---------- one loop ----------
  let active = false;
  const log = (window.__r7log = []);   // one row a frame while a move runs, to check it for jumps
  function render(now) {
    if (!active) return;
    const u0 = cam.u; step(now); frame();
    const moving = !!tw || u0 !== cam.u;
    if (moving) log.push([Math.round(now), +cam.k.toFixed(4), +P.CY.toFixed(1), +V.pitch.toFixed(4), +V.tx.toFixed(2), +V.ty.toFixed(2), +V.tz.toFixed(2), +V.s.toFixed(3)]);
    if (dirty) {
      const nv = V.night, op = 1 - smooth(0.12, 0.85, nv);
      if (op > 0.003) plane.style.transform = `translate(${P.CX}px, ${P.CY}px) perspective(${P.DIST * P.S}px) rotateX(${V.pitch}rad) rotateZ(${V.yaw}rad) translateZ(${-V.tz * P.S}px) scale(${P.S}) translate(${-V.tx}px, ${-V.ty}px)`;
      plane.style.opacity = op;
      nightEl.style.opacity = smooth(0, 0.7, nv);
      terrain.style.opacity = smooth(0.04, 0.75, nv);
      stage.style.setProperty('--night', smooth(0.45, 1, V.k).toFixed(3));
      if (nv > 0.02 && levels.length) drawTerrain();
      dirty = false;
    }
    drawFx(now); drawFrame();
    if (anchor) {
      const [x, y, cw, ch] = placeCard();
      const shown = card.classList.contains('show');   // a milestone the card still covers steps back
      moments.forEach((m, k) => { m.pin.style.opacity = shown && k !== idx && covered(x - 14, y - 14, cw + 28, ch + 28, m) ? 0.16 : ''; });
    }
    requestAnimationFrame(render);
  }
  window.addEventListener('r7:section', (e) => { const was = active; active = e.detail === 'map'; if (active && !was) { size(); requestAnimationFrame(render); } });
})();
