/*
 * sampleFrames(ms): how smooth is the page right now?
 *
 * Paste this whole file into the DevTools console on the page, then run for example
 *   await sampleFrames(5000)
 * and, while it runs, do the thing you are measuring (open a card, scroll, hover the wall).
 * It resolves { n, avg, p95, max, over20 }: the number of frames, the average, 95th percentile and
 * worst gap between frames in milliseconds, and how many gaps were longer than 20 ms. On a 60 Hz
 * screen a smooth run is avg about 16.7 and over20 = 0. Measure with the page loaded, in a
 * production build (yarn build, then yarn start), and compare on a phone through remote debugging.
 */
function sampleFrames(ms) {
  return new Promise((resolve) => {
    const gaps = [];
    const start = performance.now();
    let last = start;
    function tick(now) {
      gaps.push(now - last);
      last = now;
      if (now - start < ms) {
        requestAnimationFrame(tick);
        return;
      }
      // the first gap runs from the call to the first frame, not between two frames
      const g = gaps.slice(1);
      if (g.length === 0) {
        resolve({ n: 0, avg: 0, p95: 0, max: 0, over20: 0 });
        return;
      }
      const sorted = g.slice().sort((a, b) => a - b);
      const sum = g.reduce((a, b) => a + b, 0);
      const round = (x) => Math.round(x * 10) / 10;
      resolve({
        n: g.length,
        avg: round(sum / g.length),
        p95: round(sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)]),
        max: round(sorted[sorted.length - 1]),
        over20: g.filter((x) => x > 20).length,
      });
    }
    requestAnimationFrame(tick);
  });
}
