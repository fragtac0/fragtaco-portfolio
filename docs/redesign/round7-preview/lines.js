// Preview only: the idea that is not Mars. Each craft is a line; the moments are stations.
(() => {
  const svg = document.getElementById('lines'), card = document.getElementById('lineCard');
  const NS = 'http://www.w3.org/2000/svg';
  const el = (name, attrs = {}, text) => { const n = document.createElementNS(NS, name); for (const k in attrs) n.setAttribute(k, attrs[k]); if (text != null) n.textContent = text; svg.appendChild(n); return n; };
  const Y = { prod: 230, social: 310, edit: 390, own: 470, eng: 310 };
  const C = { eng: '#8a887b', edit: '#fc4c00', social: '#fdfce6', own: '#ffb066', prod: '#c9632b' };
  const X = { vesit: 150, first: 430, grad: 570, social: 750, own: 910, head: 1050, embassy: 1130, free: 1370, now: 1490 };

  // the lines, drawn back to front
  const lines = [
    ['eng', `M${X.vesit},${Y.eng} H${X.grad}`, 'Engineering', X.vesit + 26, Y.eng - 16],
    ['prod', `M${X.head},${Y.social} l60,-80 H${X.now}`, 'Producing', X.head + 76, Y.prod + 30],
    ['social', `M${X.social},${Y.edit} l60,-80 H${X.now}`, 'Social', X.social + 76, Y.social - 16],
    ['own', `M${X.own},${Y.edit} l60,80 H${X.now}`, 'My own videos', X.own + 70, Y.own + 36],
    ['edit', `M${X.first},${Y.edit} H${X.now}`, 'Editing', X.first + 24, Y.edit - 16],
  ];
  lines.forEach(([k, d, name, lx, ly]) => {
    el('path', { d, class: 'ln', stroke: C[k] });
    el('text', { x: lx, y: ly, class: 'ln-name', fill: C[k] }, name);
  });
  // what is still ahead: every line keeps going
  ['prod', 'social', 'edit', 'own'].forEach((k) => el('path', { d: `M${X.now},${Y[k]} h80`, class: 'ln', stroke: C[k], 'stroke-dasharray': '1 16', opacity: 0.8 }));

  const stations = [
    { x: X.vesit, y0: Y.eng, y1: Y.eng, date: '2017', title: 'Engineering at VESIT, Mumbai', line: 'Plan A (IIT) did not happen. Plan B was four years of engineering.' },
    { x: X.first, y0: Y.eng, y1: Y.edit, date: 'Feb 2021', title: 'First editing job', line: 'Part-time short form editor at Bharat in Germany, while finishing the degree.' },
    { x: X.grad, y0: Y.eng, y1: Y.edit, date: 'Jun 2021', title: 'Graduated, went full time', line: 'The degree was done. Editing became the job.' },
    { x: X.social, y0: Y.edit, y1: Y.edit, date: 'Jan 2022', title: 'Social media manager', line: 'From cutting the videos to running the channels they went out on.' },
    { x: X.own, y0: Y.edit, y1: Y.edit, date: 'Sep 2022', title: 'Started making my own', line: 'YouTube videos and Reels, from the idea to the upload.' },
    { x: X.head, y0: Y.social, y1: Y.edit, date: 'Jan 2023', title: 'Head of Content and Producer', line: 'Responsible for what got made and how.' },
    { x: X.embassy, y0: Y.prod, y1: Y.prod, date: 'Jun 2024', title: 'Interview at the German Embassy', line: "Interviewed the embassy's spokesperson, at the embassy." },
    { x: X.free, y0: Y.prod, y1: Y.own, date: 'Dec 2025', title: 'Went freelance', line: 'Left Bharat in Germany to edit full time for myself. Every line came along.' },
    { x: X.now, y0: Y.prod, y1: Y.own, date: 'Now', title: 'Freelance creative editor', line: 'Still adding lines.', now: true },
  ];
  const LABELS = [[0, 350, 'middle'], [0, 426, 'middle'], [0, 266, 'middle'], [0, 426, 'middle'], [0, 346, 'middle'], [0, 426, 'middle'], [0, 186, 'middle'], [14, 186, 'end'], [70, 506, 'end']];
  const show = (s) => { card.innerHTML = `<div class="when">${s.date}</div><h3>${s.title}</h3><div class="rule"></div><p>${s.line}</p>`; card.classList.remove('draw'); void card.offsetWidth; card.classList.add('draw'); };
  stations.forEach((s, i) => {
    const tall = s.y1 - s.y0;
    const g = tall
      ? el('rect', { x: s.x - 11, y: s.y0 - 11, width: 22, height: tall + 22, rx: 11, class: 'st' })
      : el('circle', { cx: s.x, cy: s.y0, r: 9, class: 'st' });
    if (s.now) {
      const ring = el('circle', { cx: s.x, cy: (s.y0 + s.y1) / 2, r: 30, fill: 'none', stroke: '#fc4c00', 'stroke-width': 2 });
      ring.animate([{ r: 20, opacity: 0.9 }, { r: 150, opacity: 0 }], { duration: 2600, iterations: Infinity, easing: 'cubic-bezier(0.2,0.6,0.3,1)' });
    }
    const [dx, ly, anchor] = LABELS[i];
    el('text', { x: s.x + dx, y: ly, class: 'st-date', 'text-anchor': anchor }, s.date);
    el('text', { x: s.x + dx, y: ly + 18, class: 'st-label', 'text-anchor': anchor }, s.title);
    g.addEventListener('pointerenter', () => show(s));
    g.addEventListener('click', () => show(s));
  });
  show(stations[stations.length - 1]);
})();
