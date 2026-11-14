// Preview 10: the box on the home page holds the live scene from the start. Opening changes only the frame
// around it (and how far in the scene is seen); nothing is swapped and nothing fades into something else.
(() => {
  const stage = document.getElementById('stage'), home = document.getElementById('home');
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- the wall: one finite block of the 109 videos, shuffled the same way every time ----------
  const wall = document.getElementById('wall');
  const COLS = 13, TILE = 176, GAP = 10, TH = TILE * 9 / 16;
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const ids = window.R7VIDS.slice(); for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; }
  const rows = Math.ceil(ids.length / COLS);
  wall.style.gridTemplateColumns = `repeat(${COLS}, ${TILE}px)`;
  ids.forEach((id, i) => {
    const t = document.createElement('div'); t.className = 'tile';
    const last = Math.floor(i / COLS) === rows - 1, short = ids.length - (rows - 1) * COLS;
    if (last && i % COLS === 0) t.style.gridColumnStart = String(Math.floor((COLS - short) / 2) + 1);   // a short last row sits in the middle
    const im = new Image(); im.alt = ''; im.decoding = 'async'; im.src = `https://i.ytimg.com/vi/${id}/mqdefault.jpg`; t.appendChild(im);
    wall.appendChild(t);
  });
  const WALL_W = COLS * TILE + (COLS - 1) * GAP, WALL_H = rows * TH + (rows - 1) * GAP;

  // ---------- the windows ----------
  const wins = [...document.querySelectorAll('.win')].map((el) => ({
    el, key: el.dataset.open, slot: document.getElementById(el.dataset.slot), scene: el.querySelector('.scene'), chrome: el.querySelector('.chrome'),
    t: 0, to: 0, rect: null,
  }));
  let dock = 'mini', dur = 1000, sink = true, W = 0, H = 0;
  const pan = { x: 0, y: 0 }, mouse = { x: 0.5, y: 0.5 };
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const lerp = (a, b, t) => a + (b - a) * t;

  function measure() {
    // the boxes' places are read with the home page at rest (it may be sunk back while a window is open)
    const was = home.style.transform; home.style.transform = 'none';
    const s = stage.getBoundingClientRect(); W = s.width; H = s.height;
    wins.forEach((w) => { const r = w.slot.getBoundingClientRect(); w.rect = { x: r.left - s.left, y: r.top - s.top, w: r.width, h: r.height }; w.scene.style.width = `${W}px`; w.scene.style.height = `${H}px`; });
    home.style.transform = was;
    // the row of books is fitted to the open page, as the real shelf fits its window
    const shelf = document.getElementById('shelf'); shelf.style.transform = 'none';
    const k = Math.min(1, (W - 60) / shelf.scrollWidth, (H * 0.6) / shelf.offsetHeight);
    shelf.style.transform = `scale(${k})`;
  }
  new ResizeObserver(measure).observe(stage);
  document.fonts?.ready.then(measure);

  function frame(now) {
    const dt = Math.min(0.05, (now - (frame.last || now)) / 1000); frame.last = now;
    let most = 0;
    wins.forEach((w) => {
      if (!w.rect) return;
      if (w.t !== w.to) { const step = still ? 1 : (dt * 1000) / dur; w.t = w.to > w.t ? Math.min(w.to, w.t + step) : Math.max(w.to, w.t - step); }
      const e = ease(w.t); most = Math.max(most, e);
      const R = { x: lerp(w.rect.x, 0, e), y: lerp(w.rect.y, 0, e), w: lerp(w.rect.w, W, e), h: lerp(w.rect.h, H, e) };
      const m = Math.max(w.rect.w / W, w.rect.h / H);            // the open page, small enough to fill the box
      const start = dock === 'mini' ? m : dock === 'half' ? Math.sqrt(m) : 1;
      const s = Math.max(R.w / W, R.h / H) * Math.pow(start / m, 1 - e);
      w.el.style.cssText = `left:${R.x}px;top:${R.y}px;width:${R.w}px;height:${R.h}px;border-radius:${14 * (1 - e)}px;z-index:${w.t > 0 ? 5 : 1}`;
      w.scene.style.transform = `translate(-50%, -50%) scale(${s})`;
      w.chrome.style.opacity = String(Math.max(0, (e - 0.72) / 0.28));
      w.el.classList.toggle('open', w.t === 1);
      if (w.key === 'watch') {
        // the wall drifts slowly in the box and follows the mouse once open; one position, eased, so it never jumps
        const rx = Math.max(0, WALL_W - W + 160), ry = Math.max(0, WALL_H - H + 160), t = now / 1000;
        const dx = Math.sin(t * 0.07) * 0.22 * rx, dy = Math.cos(t * 0.05) * 0.2 * ry;
        const mx = (0.5 - mouse.x) * rx, my = (0.5 - mouse.y) * ry;
        const k = 1 - Math.exp(-dt * 2.6);
        pan.x += (lerp(dx, mx, e) - pan.x) * k; pan.y += (lerp(dy, my, e) - pan.y) * k;
        wall.style.transform = `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px))`;
      }
    });
    home.style.transform = sink ? `scale(${1 - 0.05 * most})` : 'none';
    home.style.filter = sink && most > 0 ? `brightness(${1 - 0.55 * most})` : 'none';
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  const openOne = (key) => { if (wins.some((w) => w.to === 1)) return; const w = wins.find((x) => x.key === key); if (w) w.to = 1; };
  const closeAll = () => wins.forEach((w) => { w.to = 0; });
  stage.addEventListener('click', (e) => {
    if (e.target.closest('.close')) { closeAll(); return; }
    const hit = e.target.closest('[data-open]'); if (hit && !hit.classList.contains('open')) openOne(hit.dataset.open);
  });
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeAll(); });
  stage.addEventListener('pointermove', (e) => { const s = stage.getBoundingClientRect(); mouse.x = (e.clientX - s.left) / s.width; mouse.y = (e.clientY - s.top) / s.height; });
  // the pill lights when the pointer is over the box's window as well as over its card
  wins.forEach((w) => {
    const card = document.querySelector(`.block[data-open="${w.key}"]`);
    w.el.addEventListener('pointerenter', () => card.classList.add('hot')); w.el.addEventListener('pointerleave', () => card.classList.remove('hot'));
  });

  const chips = (id, fn) => document.getElementById(id).addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b || !b.dataset.v) return;
    b.parentElement.querySelectorAll(':scope > button').forEach((x) => x.classList.toggle('on', x === b)); fn(b.dataset.v);
  });
  chips('dockChips', (v) => { dock = v; });
  chips('durChips', (v) => { dur = +v; });
  chips('sinkChips', (v) => { sink = v === '1'; });
  document.getElementById('sinkChips').addEventListener('click', (e) => e.stopPropagation());   // it sits inside the length row
  window.addEventListener('r7:section', (e) => { if (e.detail === 'shelf') { measure(); window.dispatchEvent(new Event('resize')); } });
})();
