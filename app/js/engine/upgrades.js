/* ============================================================
   Veyro Upgrade Recommendation Engine.
   Pure logic: bottleneck detection, recommendations,
   budget planner, priority list. Never recommends an upgrade
   "just because it's newer" — only on meaningful gain.
   ============================================================ */
console.log('[upgrades.js] loading...');
Veyro.Upgrades = (() => {
  'use strict';

  /* GPU tiers: detect by model substring (longest keys first). */
  const GPU_ANCHOR = {
    'RTX 4090': 380, 'RTX 4080 Super': 330, 'RTX 4080': 305, 'RTX 4070 Ti Super': 300,
    'RTX 4070 Ti': 275, 'RX 7900 XTX': 330, 'RX 7900 XT': 290, 'RX 7800 XT': 265,
    'RTX 4070 Super': 260, 'RTX 4070': 250, 'RX 7700 XT': 235, 'RTX 3070 Ti': 210,
    'RTX 4060 Ti': 225, 'RTX 5060': 225, 'RTX 4060': 210, 'RTX 3080 Ti': 285,
    'RTX 3080': 230, 'RX 6800 XT': 225, 'RX 6800': 195, 'RTX 3070': 195,
    'RTX 3060 Ti': 175, 'RX 6700 XT': 175, 'RTX 3060': 155, 'RX 6600 XT': 160,
    'Arc A770': 155, 'Arc A750': 140, 'RTX 5060 Ti': 250, 'RTX 3060 Laptop': 150,
    'RX 6600': 148, 'RTX 2080 Ti': 175, 'RTX 2080': 160, 'RTX 2070 Super': 155,
    'RX 5700 XT': 140, 'RTX 2070': 145, 'RTX 2060 Super': 145, 'RTX 2060': 130,
    'GTX 1080 Ti': 165, 'GTX 1080': 150, 'GTX 1070 Ti': 140, 'GTX 1070': 125,
    'GTX 1660 Ti': 130, 'GTX 1660 Super': 128, 'GTX 1660': 118, 'RX 580': 92,
    'GTX 1650 Super': 115, 'GTX 1650': 100, 'GTX 1060': 95, 'RTX 3050': 120,
    'GTX 1050 Ti': 75, 'GTX 1050': 65, 'GT 1030': 55, 'UHD Graphics': 40,
    'HD Graphics': 35, 'Iris Xe': 65, 'Vega': 70
  };

  function anchorGpu(model) {
    if (!model) return 150;
    const keys = Object.keys(GPU_ANCHOR).sort((a, b) => b.length - a.length);
    for (const key of keys) {
      if (model.toUpperCase().includes(key.toUpperCase())) return GPU_ANCHOR[key];
    }
    return 150;
  }

  /* Candidate catalog (demo prices, floating ±) */
  const CATALOG = [
    { id: 'gpu_rtx4060', part: 'GPU', name: 'RTX 4060 8GB', price: 299, fps: 210, vram: '8 GB', power: '115 W (1×8-pin)', compat: 'PCIe 4.0 · 450W PSU min', value: 8.7 },
    { id: 'gpu_rtx4070', part: 'GPU', name: 'RTX 4070 12GB', price: 549, fps: 250, vram: '12 GB', power: '200 W (1×12-pin)', compat: 'PCIe 4.0 · 650W PSU min', value: 8.1 },
    { id: 'gpu_rx7700xt', part: 'GPU', name: 'RX 7700 XT 12GB', price: 419, fps: 235, vram: '12 GB', power: '245 W (2×8-pin)', compat: 'PCIe 4.0 · 650W PSU min', value: 8.4 },
    { id: 'gpu_gtx1060', part: 'GPU', name: 'GTX 1060 6GB', price: 129, fps: 95, vram: '6 GB', power: '120 W (1×6-pin)', compat: 'PCIe 3.0 · 400W PSU min', value: 7.0 },
    { id: 'gpu_rtx5060', part: 'GPU', name: 'RTX 5060 8GB', price: 329, fps: 225, vram: '8 GB', power: '145 W (1×8-pin)', compat: 'PCIe 5.0 · 500W PSU min', value: 8.8 },
    { id: 'cpu_13400f', part: 'CPU', name: 'Core i5-13400F', price: 209, fps: 165, vram: '—', power: '65 W', compat: 'LGA1700 · B660/H610', value: 7.9 },
    { id: 'cpu_14600k', part: 'CPU', name: 'Core i5-14600KF', price: 279, fps: 185, vram: '—', power: '125 W', compat: 'LGA1700 · Z690/Z790', value: 7.4 },
    { id: 'ram_32gb', part: 'RAM', name: '32GB DDR4 3600 (2×16)', price: 69, fps: 158, vram: '32 GB', power: '—', compat: 'DDR4 · B660', value: 8.9 },
    { id: 'ssd_2tb', part: 'SSD', name: 'Samsung 990 Pro 2TB', price: 159, fps: 156, vram: '2 TB', power: '—', compat: 'NVMe M.2 PCIe 4.0', value: 8.2 },
    { id: 'ssd_1tb', part: 'SSD', name: 'WD Black SN770 1TB', price: 79, fps: 156, vram: '1 TB', power: '—', compat: 'NVMe M.2 PCIe 4.0', value: 8.6 }
  ];

  /* ---------------- bottleneck detection ---------------- */

  function bottleneck(snap) {
    const cpu = snap.cpu, gpu = snap.gpu;
    const gpuAnch = anchorGpu(gpu.model);
    const gpuLoad = typeof gpu.usage === 'number' ? gpu.usage : null;
    const cpuLoad = typeof cpu.usage === 'number' ? cpu.usage : null;

    let kind, severity, pct;

    if (gpuLoad !== null && cpuLoad !== null) {
      if (cpuLoad > 90 && gpuLoad < 60) {
        kind = 'CPU'; severity = 'high'; pct = Math.round((1 - gpuLoad / cpuLoad) * 100);
      } else if (gpuAnch < 120) {
        kind = 'GPU'; severity = 'critical'; pct = 65;
      } else if (gpuLoad > 88 && cpuLoad < 70) {
        kind = 'GPU'; severity = 'high'; pct = Math.round((gpuLoad - cpuLoad) * 0.9);
      } else {
        kind = 'GPU'; severity = 'medium'; pct = 32;
      }
    } else {
      /* live usage not available: classify from hardware tier alone */
      if (gpuAnch < 120) { kind = 'GPU'; severity = 'critical'; pct = 65; }
      else { kind = 'GPU'; severity = 'medium'; pct = 34; }
    }
    return { kind, severity, pct: Math.max(15, pct) };
  }

  /* ---------------- recommendations ---------------- */

  function classify(item, snap) {
    const isGpu = item.part === 'GPU';
    const currAnch = isGpu ? anchorGpu(snap.gpu.model) : 165;
    const gain = Math.round((item.fps - currAnch) / currAnch * 100);
    const meaningful = gain >= 15;
    const score = (gain * 0.55) + (item.value * 4.2) - (item.price / 120);
    return { item, gain, meaningful, score };
  }

  function allRecommendations(snap) {
    return CATALOG
      .map(c => classify(c, snap))
      .filter(r => r.meaningful)
      .sort((a, b) => b.score - a.score);
  }

  function mainRecommendation(snap) {
    const b = bottleneck(snap);
    const recs = allRecommendations(snap);
    if (!recs.length) return null;

    /* prefer a GPU if GPU is the bottleneck */
    let chosen = recs.find(r => (b.kind === 'GPU') === (r.item.part === 'GPU')) || recs[0];
    return chosen;
  }

  /* ---------------- budget planner ---------------- */

  function plan(budget, snap) {
    const pool = allRecommendations(snap).filter(r => r.item.price <= budget);
    if (!pool.length) return null;

    const bestPerf = pool.reduce((a, b) => a.item.fps > b.item.fps ? a : b);
    const bestValue = pool.reduce((a, b) => a.score > b.score ? a : b);
    const cheapest = pool.reduce((a, b) => a.item.price < b.item.price ? a : b);
    return { budget, pool, bestPerf, bestValue, cheapest };
  }

  /* ---------------- priority list ---------------- */

  function priority(snap) {
    const b = bottleneck(snap);
    const disk = snap.storage[0];
    const fullness = (disk && disk.total) ? disk.used / disk.total : null;
    const list = [];

    list.push({
      part: 'GPU', level: b.kind === 'GPU' ? 'HIGH' : 'LOW',
      why: b.kind === 'GPU'
        ? `Your ${snap.gpu.model || 'graphics card'} anchors ~${anchorGpu(snap.gpu.model)} FPS at 1080p and is the main limit in modern titles.`
        : 'GPU load is below the CPU load; games are still playable without touching this.',
      value: b.kind === 'GPU' ? 3 : 1
    });
    list.push({
      part: 'SSD', level: fullness !== null && fullness > 0.85 ? 'MEDIUM' : 'LOW',
      why: fullness !== null && fullness > 0.85
        ? `Drive is ${Math.round(fullness * 100)}% full — adding an NVMe for games removes load from the system drive.`
        : 'System drive has enough free space.',
      value: fullness !== null && fullness > 0.85 ? 2 : 1
    });
    list.push({
      part: 'RAM', level: snap.ram.total !== null && snap.ram.total < 16384 ? 'MEDIUM' : 'LOW',
      why: snap.ram.total !== null && snap.ram.total < 16384
        ? `${snap.ram.used != null ? Veyro.fmt.gb(snap.ram.used / 1024) : '? GB'}/16 GB is in use during gaming; 32 GB removes background pressure.`
        : 'RAM is adequate for the current workload.',
      value: snap.ram.total !== null && snap.ram.total < 16384 ? 2 : 1
    });
    list.push({
      part: 'CPU', level: b.kind === 'CPU' ? 'HIGH' : 'LOW',
      why: b.kind === 'CPU'
        ? 'CPU is saturated while the GPU idles — a faster CPU unlocks GPU headroom.'
        : `${snap.cpu.cores || '?'} cores / ${snap.cpu.threads || '?'} threads cover current gaming loads fine.`,
      value: b.kind === 'CPU' ? 3 : 1
    });

    return list.sort((a, b) => b.value - a.value)
      .map((x, i) => ({ ...x, rank: i + 1 }));
  }

  /* ---------------- FPS estimates for games ---------------- */

  function estimateFps(snap, game) {
    const gpuAnch = anchorGpu(snap.gpu.model);
    const factor = (game.weight || 1) / 1.02; // game weight vs Fortnite reference
    const hi = Math.round(gpuAnch * factor * (0.9 + Math.random() * 0.1));
    const lo = Math.round(gpuAnch * factor * (0.62 + Math.random() * 0.06));
    return { lo: Math.max(30, lo), hi: hi };
  }

  return {
    bottleneck,
    mainRecommendation,
    allRecommendations,
    plan,
    priority,
    estimateFps,
    anchorGpu,
    CATALOG
  };
})();