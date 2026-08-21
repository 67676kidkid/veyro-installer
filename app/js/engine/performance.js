/* ============================================================
   Veyro Performance Monitor — ring-buffer of live samples.
   Polls the hardware agent; exposes time-windowed series for
   the LIVE PERFORMANCE page and live tiles.
   ============================================================ */
console.log('[performance.js] loading...');
Veyro.Performance = (() => {
  'use strict';

  const CAPACITY = 900;          // 30 min @ 2s
  const POLL_MS = 2000;

  let samples = [];              // {t, cpu, gpu, ram, temp, fps}
  let timer = null;
  let listeners = new Set();
  let lastSnapshot = null;

  function push(snap) {
    const s = {
      t: Date.now(),
      cpu: typeof snap.cpu.usage === 'number' ? Math.round(snap.cpu.usage) : null,
      gpu: typeof snap.gpu.usage === 'number' ? Math.round(snap.gpu.usage) : null,
      ram: typeof snap.ram.used === 'number' && typeof snap.ram.total === 'number'
        ? Math.round(snap.ram.used / snap.ram.total * 1000) / 10 : null,
      temp: (typeof snap.gpu.temp === 'number' ? snap.gpu.temp : (typeof snap.cpu.temp === 'number' ? snap.cpu.temp : null)),
      fps: typeof snap.gpu.fps === 'number' ? snap.gpu.fps : null
    };
    samples.push(s);
    if (samples.length > CAPACITY) samples.shift();
    lastSnapshot = snap;
    listeners.forEach(fn => fn(s));
  }

  function start() {
    if (timer) return;
    const tick = async () => {
      try {
        const snap = await Veyro.HardwareAgent.getSnapshot();
        push(snap);
      } catch (e) {
        /* agent unavailable — keep last data */
      }
    };
    tick();
    timer = setInterval(tick, POLL_MS);
  }

  function stop() {
    if (timer) { clearInterval(timer); timer = null; }
  }

  function series(minutes) {
    const cutoff = Date.now() - minutes * 60000;
    return samples.filter(s => s.t >= cutoff);
  }

  function metrics(key, minutes) {
    const data = series(minutes).map(s => s[key]).filter(v => v !== null && v !== undefined);
    if (!data.length) return { cur: 0, avg: 0, peak: 0 };
    const avg = data.reduce((a, b) => a + b, 0) / data.length;
    return {
      cur: data[data.length - 1],
      avg: Math.round(avg * 10) / 10,
      peak: Math.max(...data)
    };
  }

  function subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  function snapshot() { return lastSnapshot; }

  return { start, stop, series, metrics, subscribe, snapshot, POLL_MS };
})();