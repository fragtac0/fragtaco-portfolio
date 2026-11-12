// Preview 5: the single row of spines on the ledge of rock layers, no gradient behind.
(() => {
  const S = (inner, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" ${extra}>${inner}</svg>`;
  const EMBLEM = {
    blink: S('<path d="M3 10c3 4 6 5.5 9 5.5S18 14 21 10"/><path d="M6 14.5l-1.4 2.6M12 15.8V19M18 14.5l1.4 2.6"/>'),
    hourglass: S('<path d="M6 3h12M6 21h12M7.5 3c0 7 9 6 9 18M16.5 3c0 7-9 6-9 18"/>'),
    film: S('<rect x="4" y="3" width="16" height="18" rx="1.5"/><rect x="8" y="7.5" width="8" height="9"/><path d="M6 6v.1M6 10v.1M6 14v.1M6 18v.1M18 6v.1M18 10v.1M18 14v.1M18 18v.1"/>'),
    splice: S('<path d="M2.5 8h8.5l-3 8h-5.5zM13.5 8h8v8h-11z"/>'),
    arc: S('<path d="M3 19C6 4 18 4 21 19"/><circle cx="3" cy="19" r="1.2" fill="currentColor"/><circle cx="12" cy="7.8" r="1.2" fill="currentColor"/><circle cx="21" cy="19" r="1.2" fill="currentColor"/>'),
    cat: S('<path d="M5 20V6l4.5 4.5h5L19 6v14"/><path d="M9.5 15v.1M14.5 15v.1"/>'),
    dot: S('<circle cx="12" cy="12" r="9.2"/><circle cx="12" cy="12" r="1.7" fill="currentColor"/>'),
    cut: S('<path d="M4 4h10.5L20 9.5V20H4z"/><path d="M14.5 4v5.5H20"/>'),
    share: S('<path d="M10 5H5v14h14v-5"/><path d="M12 12l8-8M14.5 4H20v5.5"/>'),
    eye: S('<path d="M2 12c3-5 6.2-7 10-7s7 2 10 7c-3 5-6.2 7-10 7s-7-2-10-7z"/><circle cx="12" cy="12" r="3"/>'),
    panels: S('<rect x="3" y="3" width="8" height="10"/><rect x="13" y="3" width="8" height="6"/><rect x="13" y="11" width="8" height="10"/><rect x="3" y="15" width="8" height="6"/>'),
    aa: '<svg viewBox="0 0 24 24"><text x="12" y="18" text-anchor="middle" font-family="Bodoni Moda" font-weight="600" font-size="17" fill="currentColor">Aa</text></svg>',
    grid: S('<path d="M4 4h4v4H4zM10 4h4v4h-4zM16 4h4v4h-4zM4 10h4v4H4zM10 10h4v4h-4zM16 10h4v4h-4zM4 16h4v4H4zM10 16h4v4h-4zM16 16h4v4h-4z" fill="currentColor" stroke="none"/>'),
    handle: S('<circle cx="8" cy="12" r="5"/><path d="M13 12h8v4"/>'),
  };
  // cloth, foil, emblem, then how the title is set
  const DESIGN = {
    'in-the-blink-of-an-eye': { cloth: '#e9e1cf', foil: '#1c1a17', em: 'blink', font: 'italic 500 19px "Bodoni Moda"' },
    'sculpting-in-time': { cloth: '#23343c', foil: '#cdd6d8', em: 'hourglass', font: '600 16px "Archivo"', stretch: '62%', upper: true, track: '0.2em', rules: true },
    'making-movies': { cloth: '#cf3f1e', foil: '#f7ecd6', em: 'film', font: '900 19px "Archivo"', stretch: '125%', upper: true, track: '0.02em' },
    'on-film-editing': { cloth: '#161514', foil: '#d7b26c', em: 'splice', font: '400 19px "Young Serif"', rules: true },
    'story': { cloth: '#1e3b2d', foil: '#dcbb78', em: 'arc', font: '800 46px "Bodoni Moda"', upper: true, track: '0.1em', emSize: 30 },
    'save-the-cat': { cloth: '#d69c22', foil: '#1a1714', em: 'cat', font: '700 16px "Unbounded"' },
    'the-creative-act': { cloth: '#cdc7ba', foil: '#1a1917', em: 'dot', font: '400 24px "Space Grotesk"', track: '0.01em', emSize: 34 },
    'steal-like-an-artist': { cloth: '#121212', foil: '#f4f1e8', em: 'cut', font: '600 13px "IBM Plex Mono"', upper: true, track: '0.08em' },
    'show-your-work': { cloth: '#f0bf2e', foil: '#141414', em: 'share', font: '600 15px "IBM Plex Mono"', upper: true, track: '0.06em' },
    'ways-of-seeing': { cloth: '#2944a6', foil: '#f3ead6', em: 'eye', font: '600 21px "Newsreader"' },
    'understanding-comics': { cloth: '#a8c3d2', foil: '#15223e', em: 'panels', font: '800 19px "Archivo"', stretch: '90%', rules: true },
    'thinking-with-type': { cloth: '#efe7d6', foil: '#d23a1c', em: 'aa', font: '600 22px "Bodoni Moda"', lower: true, emSize: 30 },
    'grid-systems-in-graphic-design': { cloth: '#f1eee6', foil: '#161616', em: 'grid', font: '500 14px "Archivo"', lines: ['Grid Systems in', 'Graphic Design'], block: '#d5311b', blockInk: '#ffffff' },
    'the-design-of-everyday-things': { cloth: '#1f5c5e', foil: '#f1e6cf', em: 'handle', font: '600 18px "Space Grotesk"', lines: ['The Design of', 'Everyday Things'] },
  };
  const shelf = document.getElementById('shelf'), wrap = document.getElementById('shelfWrap');
  const book = Object.fromEntries(window.R7BOOKS.map((b) => [b.id, b]));
  const dims = (b) => [Math.round(Math.max(32, Math.min(72, b.pages * 0.105 + 20))), Math.round(b.heightIn * 50)];
  function spine(id) {
    const b = book[id], d = DESIGN[id], [w, h] = dims(b);
    const s = document.createElement('div'); s.className = 'spine'; s.title = `${b.title}, ${b.author}`;
    s.style.cssText = `width:${w}px;height:${h}px;--cloth:${d.cloth};--foil:${d.foil};--em:${d.emSize || 20}px`;
    const title = (d.lines || [b.title]).join('<br>');
    const tstyle = `font:${d.font};${d.stretch ? `font-stretch:${d.stretch};` : ''}${d.upper ? 'text-transform:uppercase;' : ''}${d.lower ? 'text-transform:lowercase;' : ''}${d.track ? `letter-spacing:${d.track};` : ''}${d.lines ? 'line-height:1.15;' : ''}`;
    const block = d.block ? `<div class="sp-block" style="background:${d.block};color:${d.blockInk};display:grid;place-items:center;height:${w + 14}px"><div class="sp-emblem" style="margin:0">${EMBLEM[d.em]}</div></div>` : `<div class="sp-emblem">${EMBLEM[d.em]}</div>`;
    const rule = d.rules ? '<div class="sp-rule" style="margin-top:12px"></div><div class="sp-rule" style="margin-top:3px;--rh:1px;--ro:.6"></div>' : '';
    const rule2 = d.rules ? '<div class="sp-rule" style="--rh:1px;--ro:.6;margin-bottom:3px"></div><div class="sp-rule" style="margin-bottom:12px"></div>' : '';
    s.innerHTML = `${block}${rule}<div class="sp-title" style='${tstyle}'><span>${title}</span></div><div class="sp-author">${b.author.toUpperCase()}</div>${rule2}<div class="sp-mark"></div>`;
    return s;
  }
  // the original layout: one row, in the order of the list
  window.R7BOOKS.forEach((b) => { if (DESIGN[b.id]) shelf.appendChild(spine(b.id)); });

  // the ledge of rock layers
  const strata = document.getElementById('strata');
  let paths = `<rect x="0" y="0" width="1000" height="74" fill="#0d0b0a"/>`;
  for (let i = 0; i < 10; i++) {
    const y0 = 1 + i * 7.4, t = i / 9; let d = '';
    for (let x = 0; x <= 1000; x += 20) { const y = y0 + (i ? 1 : 0) * (2.2 * Math.sin(x * 0.011 + i * 1.3) + 1.4 * Math.sin(x * 0.037 + i * 2.1)) * (0.4 + t); d += `${x ? 'L' : 'M'}${x},${y.toFixed(2)}`; }
    const col = i === 0 ? 'rgba(253,252,230,0.85)' : `rgba(${Math.round(255 - 60 * t)},${Math.round(150 - 80 * t)},${Math.round(80 - 50 * t)},${(0.75 - 0.6 * t).toFixed(2)})`;
    paths += `<path d="${d}" fill="none" stroke="${col}" stroke-width="${i === 0 ? 1.3 : 0.9}" vector-effect="non-scaling-stroke"/>`;
  }
  strata.innerHTML = paths;
})();
