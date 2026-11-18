// Preview only: shows whatever real spine pictures the search has saved in the git-ignored local folder.
(() => {
  const row = document.getElementById('spineRow'), status = document.getElementById('spineStatus');
  async function load() {
    try {
      const res = await fetch('../compare/local/spines/sources.json', { cache: 'no-store' });
      if (!res.ok) throw new Error('not yet');
      const list = (await res.json()).filter((b) => b.found);
      if (!list.length) { status.textContent = 'The search found no usable spine pictures.'; return; }
      row.textContent = '';
      list.forEach((b) => {
        const f = document.createElement('figure');
        f.innerHTML = `<img src="../compare/local/spines/${b.id}.jpg" alt=""><figcaption>${b.id.replace(/-/g, ' ')}<br>${b.kind || ''}</figcaption>`;
        f.querySelector('img').onerror = () => f.remove();
        row.appendChild(f);
      });
    } catch { setTimeout(load, 15000); }
  }
  load();
})();
