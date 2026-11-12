// Preview only: the Olympus Mons map in four looks, flat or tilted, with a glass interface.
(() => {
  const D = window.R7;
  const PW = 1000, PH = 650;
  const $ = (id) => document.getElementById(id);
  const stage = $('stage'), plane = $('plane'), contours = $('contours'), ink = $('ink'), pins = $('pins');
  const card = $('card'), count = $('count');
  const NS = 'http://www.w3.org/2000/svg';
  const el = (name, attrs = {}, parent) => { const n = document.createElementNS(NS, name); for (const k in attrs) n.setAttribute(k, attrs[k]); if (parent) parent.appendChild(n); return n; };

  // ---------- camera ----------
  let W = PW, H = PH;
  const cam = { fx: 470, fy: 325, s: 1 };
  function applyCam() {
    const tilt = stage.dataset.view === 'tilt';
    const tx = ((PW / 2 - cam.fx) / PW) * W, ty = ((PH / 2 - cam.fy) / PH) * H;
    const s = cam.s * (tilt ? 1.5 : 1);
    plane.style.transform = `translate(-50%, -50%) ${tilt ? 'translateY(4%) rotateX(52deg) rotateZ(-14deg)' : ''} scale(${s}) translate(${tx}px, ${ty}px)`;
    stage.style.setProperty('--inv', 1 / s);
    ink.style.setProperty('--u', PW / W / s);
  }
  function size() {
    const r = stage.getBoundingClientRect();
    const k = Math.max(r.width / PW, r.height / PH);
    W = PW * k; H = PH * k;
    plane.style.width = W + 'px'; plane.style.height = H + 'px';
    applyCam();
  }
  new ResizeObserver(size).observe(stage);

  // ---------- contour lines from the elevation picture ----------
  const img = new Image();
  img.onload = () => {
    const gw = 500, gh = 325, c = document.createElement('canvas');
    c.width = gw; c.height = gh;
    const g = c.getContext('2d'); g.drawImage(img, 0, 0, gw, gh);
    const px = g.getImageData(0, 0, gw, gh).data, v = new Float32Array(gw * gh);
    let lo = 255, hi = 0;
    for (let i = 0; i < v.length; i++) { v[i] = px[i * 4]; lo = Math.min(lo, v[i]); hi = Math.max(hi, v[i]); }
    const levels = d3.range(Math.ceil(lo) + 2, hi, 3);
    const path = d3.geoPath(d3.geoIdentity().scale(PW / gw));
    d3.contours().size([gw, gh]).smooth(true).thresholds(levels)(v).forEach((ring, i) => {
      el('path', { d: path(ring), 'data-v': ((ring.value - lo) / (hi - lo)).toFixed(3), 'data-i': i }, contours);
    });
    paintContours();
  };
  img.src = 'assets/dem.png';

  const dark = d3.interpolateRgb('rgba(28,10,4,0.62)', 'rgba(60,24,10,0.5)');
  const gold = d3.interpolateRgb('rgba(255,196,120,0.55)', 'rgba(255,232,190,0.95)');
  const nightLow = d3.interpolateRgb('rgba(253,252,230,0.10)', 'rgba(253,252,230,0.30)');
  const nightHigh = d3.interpolateRgb('rgba(255,160,90,0.5)', 'rgba(255,122,40,0.95)');
  function paintContours() {
    const style = stage.dataset.style;
    contours.querySelectorAll('path').forEach((p) => {
      const v = +p.dataset.v, major = +p.dataset.i % 5 === 0;
      const split = 0.3; // the plains sit below this, the mountain above
      let col;
      if (style === 'night') col = v < split ? nightLow(v / split) : nightHigh((v - split) / (1 - split));
      else if (style === 'both') col = v < split ? 'rgba(253,252,230,0.14)' : gold((v - split) / (1 - split));
      else col = v < split ? dark(v / split) : gold((v - split) / (1 - split));
      p.setAttribute('stroke', col);
      p.setAttribute('stroke-width', major ? 1.25 : 0.7);
    });
  }

  // ---------- the road and the moments ----------
  const line = d3.line().curve(d3.curveCatmullRom.alpha(0.5));
  const roadD = line(D.route);
  el('path', { d: roadD, class: 'road-case', style: 'stroke-width: calc(5 * var(--u))' }, ink);
  const road = el('path', { d: roadD, class: 'road', style: 'stroke-width: calc(2.4 * var(--u))' }, ink);
  const end = D.route[D.route.length - 1], top = D.summit;
  const mid = [(end[0] + top[0]) / 2 - 14, (end[1] + top[1]) / 2 - 16];
  el('path', { d: d3.line().curve(d3.curveBasis)([end, mid, top]), class: 'road-ahead', style: 'stroke-width: calc(2 * var(--u)); stroke-dasharray: calc(0.1 * var(--u)) calc(6 * var(--u))' }, ink);

  const FR = [0, 0.3, 0.38, 0.48, 0.58, 0.66, 0.8, 0.93, 1];
  const len = road.getTotalLength();
  const moments = D.moments.map((m, i) => { const p = road.getPointAtLength(len * FR[i]); return { ...m, x: p.x, y: p.y }; });
  function pin(x, y, cls, html) {
    const p = document.createElement('div');
    p.className = 'pin ' + cls;
    p.style.left = (x / PW) * 100 + '%'; p.style.top = (y / PH) * 100 + '%';
    p.innerHTML = `<div class="pin-in" style="transform: scale(var(--inv)); transition: transform 1.5s var(--ease); position:absolute">${html}</div>`;
    pins.appendChild(p);
    return p;
  }
  moments.forEach((m, i) => {
    const last = i === moments.length - 1;
    m.pin = pin(m.x, m.y, last ? 'now' : 'moment', last ? '<div class="reach-fill"></div><div class="reach"></div><div class="ping"></div><div class="puck"></div>' : '<div class="dot"></div>');
    m.pin.addEventListener('click', () => { setMode('climb'); go(i); });
  });

  // ---------- the places ----------
  const circle = (cx, cy, r) => `M${cx + r},${cy} A${r},${r} 0 1,1 ${cx - r},${cy} A${r},${r} 0 1,1 ${cx + r},${cy}`;
  const ellipse = (cx, cy, rx, ry) => `M${cx + rx},${cy} A${rx},${ry} 0 1,1 ${cx - rx},${cy} A${rx},${ry} 0 1,1 ${cx + rx},${cy}`;
  const cliffD = d3.line().curve(d3.curveCatmullRomClosed.alpha(0.5))(D.cliff);
  const places = [
    { name: 'Olympus Mons', line: 'The largest known volcano in the solar system. It would cover most of France.', fact: '610 km across, 27 km high', d: circle(485, 318, 129), at: [485 + 129 * 0.77, 318 - 129 * 0.64], cam: { fx: 520, fy: 318, s: 1.55 }, dash: true },
    { name: 'Olympus Rupes', line: 'The cliff that rings the whole mountain. You would have to climb it before the climb begins.', fact: 'up to 6 km high', d: cliffD, at: [D.cliff[14][0], D.cliff[14][1]], cam: { fx: 560, fy: 330, s: 2 } },
    { name: 'Olympus Paterae', line: 'The summit: a nest of craters left where the roof fell in, one after another.', fact: '85 km across', d: circle(500.4, 326.2, 18), at: [500.4 + 13, 326.2 - 13], cam: { fx: 512, fy: 326, s: 3 } },
    { name: 'Pangboche', line: 'A small, sharp crater near the top, named for a village in Nepal on the way to Everest.', fact: '10 km across', d: circle(495.1, 352.2, 5), at: [495.1 + 3.6, 352.2 - 3.6], cam: { fx: 505, fy: 350, s: 3.4 } },
    { name: 'Karzok', line: 'A crater on the eastern flank, named for a village in Ladakh.', fact: '15 km across', d: circle(536.6, 324.2, 5.5), at: [536.6 + 4, 324.2 - 4], cam: { fx: 546, fy: 322, s: 3.4 } },
    { name: 'Lycus Sulci', line: 'The aureole: ridged, broken ground that spreads for hundreds of kilometres from the foot of the cliff. How it formed is still argued over.', fact: 'origin unknown', d: ellipse(290, 215, 185, 150), at: [290 + 185 * 0.5, 215 - 150 * 0.87], cam: { fx: 360, fy: 250, s: 1.3 }, dash: true },
  ];
  places.forEach((p) => {
    p.halo = el('path', { d: p.d, class: 'trace-halo' }, ink);
    p.trace = el('path', { d: p.d, class: 'trace', pathLength: 1, style: 'stroke-width: calc(1.5 * var(--u))' }, ink);
    p.pin = pin(p.at[0], p.at[1], 'place', '');
  });

  // ---------- modes ----------
  let mode = 'overview', idx = 0, auto = 0;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let anchor = null;
  function showCard(html, a) {
    card.classList.remove('show', 'draw');
    anchor = a;
    setTimeout(() => { card.innerHTML = html; void card.offsetWidth; card.classList.add('show', 'draw'); }, mode === 'mountain' ? 1500 : 500);
  }
  function clearPlaces() { places.forEach((p) => { p.trace.classList.remove('on'); p.halo.classList.remove('on'); p.trace.getAnimations().forEach((a) => a.cancel()); }); }
  function go(i) {
    clearTimeout(auto);
    if (mode === 'climb') {
      idx = (i + moments.length) % moments.length;
      const m = moments[idx];
      moments.forEach((x, k) => x.pin.classList.toggle('cur', k === idx));
      Object.assign(cam, { fx: m.x * 0.7 + 540 * 0.3, fy: m.y * 0.7 + 360 * 0.3, s: 2.5 });
      const title = m.struck ? m.title.replace(m.struck, `<s>${m.struck}</s>`) : m.title;
      showCard(`<div class="when">${m.label}</div><h3>${title}</h3><div class="rule"></div><p>${m.line}</p>`, m.pin);
      count.textContent = `${idx + 1} / ${moments.length}`;
    } else if (mode === 'mountain') {
      idx = (i + places.length) % places.length;
      const p = places[idx];
      clearPlaces();
      Object.assign(cam, p.cam);
      p.trace.classList.add('on');
      p.trace.style.strokeDasharray = p.dash ? '' : '1';
      p.trace.animate([{ strokeDasharray: '0 1', strokeDashoffset: 0 }, { strokeDasharray: '1 0', strokeDashoffset: 0 }], { duration: reduce ? 1 : 1700, delay: reduce ? 0 : 1000, easing: 'cubic-bezier(0.45,0,0.15,1)', fill: 'backwards' });
      p.halo.classList.add('on');
      showCard(`<div class="when">${idx + 1} of ${places.length}</div><h3>${p.name}</h3><div class="rule"></div><p>${p.line}</p><span class="fact">${p.fact}</span>`, p.pin);
      count.textContent = `${idx + 1} / ${places.length}`;
      if (idx < places.length - 1 && !reduce) auto = setTimeout(() => go(idx + 1), 7500);
    }
    applyCam();
  }
  function setMode(m) {
    if (m === mode) return;
    mode = m; stage.dataset.mode = m; clearTimeout(auto);
    $('modeSwitch').querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.v === m));
    moments.forEach((x) => x.pin.classList.remove('cur'));
    clearPlaces();
    if (m === 'overview') { card.classList.remove('show'); anchor = null; Object.assign(cam, { fx: 470, fy: 325, s: 1 }); applyCam(); }
    else go(m === 'climb' ? moments.length - 1 : 0);
  }
  $('modeSwitch').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) setMode(b.dataset.v); });
  $('prev').addEventListener('click', () => go(idx - 1));
  $('next').addEventListener('click', () => go(idx + 1));
  const chips = (id, key, after) => $(id).addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    $(id).querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
    stage.dataset[key] = b.dataset.v; after();
  });
  chips('styleChips', 'style', paintContours);
  chips('viewChips', 'view', applyCam);

  // the card follows its anchor on the ground, in screen space
  function follow() {
    if (anchor && document.getElementById('sec-map').classList.contains('on')) {
      const s = stage.getBoundingClientRect(), a = anchor.getBoundingClientRect();
      const ax = a.left - s.left, ay = a.top - s.top, cw = card.offsetWidth, ch = card.offsetHeight;
      let x = ax + 30, y = ay - ch - 18;
      if (x + cw > s.width - 16) x = ax - cw - 30;
      if (y < 70) y = ay + 26;
      x = Math.max(16, Math.min(x, s.width - cw - 16)); y = Math.max(70, Math.min(y, s.height - ch - 70));
      card.style.setProperty('--cx', x + 'px'); card.style.setProperty('--cy', y + 'px');
    }
    requestAnimationFrame(follow);
  }
  size(); follow();
})();
