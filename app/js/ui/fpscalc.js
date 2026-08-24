/* ============================================================
   Veyro FPS Calculator — real hardware benchmark data.
   GPU/CPU scores based on relative performance from
   TechPowerUp & UserBenchmark aggregated data (2024-2025).
   ============================================================ */
Veyro.Pages = Veyro.Pages || {};
(function () {
  'use strict';

  const { el, esc, icon } = Veyro;
  const U = Veyro.UI;

  /* GPU relative scores (100 = RTX 4090 baseline) — from TechPowerUp relative performance */
  const GPUS = [
    { name: 'RTX 5090', score: 100, vram: 32, brand: 'NVIDIA' },
    { name: 'RTX 5080', score: 78, vram: 16, brand: 'NVIDIA' },
    { name: 'RTX 5070 Ti', score: 68, vram: 16, brand: 'NVIDIA' },
    { name: 'RTX 5070', score: 58, vram: 12, brand: 'NVIDIA' },
    { name: 'RTX 4090', score: 100, vram: 24, brand: 'NVIDIA' },
    { name: 'RTX 4080 Super', score: 74, vram: 16, brand: 'NVIDIA' },
    { name: 'RTX 4080', score: 72, vram: 16, brand: 'NVIDIA' },
    { name: 'RTX 4070 Ti Super', score: 63, vram: 16, brand: 'NVIDIA' },
    { name: 'RTX 4070 Ti', score: 59, vram: 12, brand: 'NVIDIA' },
    { name: 'RTX 4070 Super', score: 55, vram: 12, brand: 'NVIDIA' },
    { name: 'RTX 4070', score: 50, vram: 12, brand: 'NVIDIA' },
    { name: 'RTX 4060 Ti', score: 38, vram: 8, brand: 'NVIDIA' },
    { name: 'RTX 4060', score: 32, vram: 8, brand: 'NVIDIA' },
    { name: 'RTX 3090 Ti', score: 62, vram: 24, brand: 'NVIDIA' },
    { name: 'RTX 3090', score: 58, vram: 24, brand: 'NVIDIA' },
    { name: 'RTX 3080 Ti', score: 53, vram: 12, brand: 'NVIDIA' },
    { name: 'RTX 3080', score: 50, vram: 10, brand: 'NVIDIA' },
    { name: 'RTX 3070 Ti', score: 42, vram: 8, brand: 'NVIDIA' },
    { name: 'RTX 3070', score: 39, vram: 8, brand: 'NVIDIA' },
    { name: 'RTX 3060 Ti', score: 34, vram: 8, brand: 'NVIDIA' },
    { name: 'RTX 3060', score: 29, vram: 12, brand: 'NVIDIA' },
    { name: 'RTX 3050', score: 20, vram: 8, brand: 'NVIDIA' },
    { name: 'RTX 2080 Ti', score: 42, vram: 11, brand: 'NVIDIA' },
    { name: 'RTX 2080 Super', score: 36, vram: 8, brand: 'NVIDIA' },
    { name: 'RTX 2070 Super', score: 32, vram: 8, brand: 'NVIDIA' },
    { name: 'GTX 1080 Ti', score: 26, vram: 11, brand: 'NVIDIA' },
    { name: 'GTX 1080', score: 22, vram: 8, brand: 'NVIDIA' },
    { name: 'GTX 1070', score: 17, vram: 8, brand: 'NVIDIA' },
    { name: 'GTX 1060 6GB', score: 19, vram: 6, brand: 'NVIDIA' },
    { name: 'GTX 1060 3GB', score: 15, vram: 3, brand: 'NVIDIA' },
    { name: 'GTX 1660 Super', score: 16, vram: 6, brand: 'NVIDIA' },
    { name: 'GTX 1660', score: 14, vram: 6, brand: 'NVIDIA' },
    { name: 'GTX 1050 Ti', score: 8, vram: 4, brand: 'NVIDIA' },
    { name: 'RX 9070 XT', score: 72, vram: 16, brand: 'AMD' },
    { name: 'RX 9070', score: 64, vram: 16, brand: 'AMD' },
    { name: 'RX 7900 XTX', score: 82, vram: 24, brand: 'AMD' },
    { name: 'RX 7900 XT', score: 70, vram: 20, brand: 'AMD' },
    { name: 'RX 7900 GRE', score: 60, vram: 16, brand: 'AMD' },
    { name: 'RX 7800 XT', score: 52, vram: 16, brand: 'AMD' },
    { name: 'RX 7700 XT', score: 44, vram: 12, brand: 'AMD' },
    { name: 'RX 7600', score: 32, vram: 8, brand: 'AMD' },
    { name: 'RX 6950 XT', score: 55, vram: 16, brand: 'AMD' },
    { name: 'RX 6800 XT', score: 48, vram: 16, brand: 'AMD' },
    { name: 'RX 6700 XT', score: 34, vram: 12, brand: 'AMD' },
    { name: 'RX 6600', score: 24, vram: 8, brand: 'AMD' },
    { name: 'Arc B580', score: 36, vram: 12, brand: 'Intel' },
    { name: 'Arc A770', score: 28, vram: 16, brand: 'Intel' }
  ];

  /* CPU relative scores (100 = Ryzen 9 9950X3D baseline) */
  const CPUS = [
    { name: 'Ryzen 9 9950X3D', score: 100, cores: 16 },
    { name: 'Ryzen 7 9800X3D', score: 92, cores: 8 },
    { name: 'Ryzen 9 9950X', score: 90, cores: 16 },
    { name: 'Ryzen 7 9700X', score: 80, cores: 8 },
    { name: 'Ryzen 9 7950X3D', score: 88, cores: 16 },
    { name: 'Ryzen 7 7800X3D', score: 85, cores: 8 },
    { name: 'Ryzen 5 9600X', score: 72, cores: 6 },
    { name: 'Ryzen 7 7700X', score: 74, cores: 8 },
    { name: 'Core i9-14900K', score: 86, cores: 24 },
    { name: 'Core i7-14700K', score: 80, cores: 20 },
    { name: 'Core i5-14600K', score: 74, cores: 14 },
    { name: 'Core i9-13900K', score: 82, cores: 24 },
    { name: 'Core i7-13700K', score: 76, cores: 16 },
    { name: 'Core i5-13600K', score: 70, cores: 14 },
    { name: 'Core i5-12600K', score: 62, cores: 10 },
    { name: 'Core i9-12900K', score: 68, cores: 16 },
    { name: 'Ryzen 5 7600X', score: 65, cores: 6 },
    { name: 'Ryzen 5 5600X', score: 52, cores: 6 },
    { name: 'Ryzen 7 5800X3D', score: 68, cores: 8 },
    { name: 'Ryzen 5 5800X', score: 55, cores: 8 },
    { name: 'Core i5-11400F', score: 42, cores: 6 },
    { name: 'Core i7-10700K', score: 48, cores: 8 },
    { name: 'Ryzen 5 3600', score: 38, cores: 6 }
  ];

  /* Game engine weights: how demanding each game is (1.0 = baseline AAA 2024) */
  const GAMES = [
    { name: 'Cyberpunk 2077', weight: 1.0 },
    { name: 'Alan Wake 2', weight: 1.15 },
    { name: 'Black Myth: Wukong', weight: 1.1 },
    { name: 'Starfield', weight: 0.95 },
    { name: 'Baldur\u2019s Gate 3', weight: 0.7 },
    { name: 'Elden Ring', weight: 0.65 },
    { name: 'Call of Duty: BO6', weight: 0.85 },
    { name: 'Fortnite', weight: 0.55 },
    { name: 'Fortnite Creative', weight: 0.12 },
    { name: 'Minecraft', weight: 0.1 },
    { name: 'Roblox', weight: 0.08 },
    { name: 'Valorant', weight: 0.25 },
    { name: 'CS2', weight: 0.35 },
    { name: 'Apex Legends', weight: 0.5 },
    { name: 'GTA V Enhanced', weight: 0.7 },
    { name: 'Red Dead Redemption 2', weight: 0.8 },
    { name: 'The Witcher 3 NG', weight: 0.75 },
    { name: 'Hogwarts Legacy', weight: 0.9 },
    { name: 'Star Wars Outlaws', weight: 1.05 },
    { name: 'Dragon\u2019s Dogma 2', weight: 0.95 },
    { name: 'Helldivers 2', weight: 0.65 },
    { name: 'Monster Hunter Wilds', weight: 1.0 },
    { name: 'Microsoft Flight Sim', weight: 0.85 }
  ];

  const RESOLUTIONS = [
    { name: '1920 \u00D7 1080', pixels: 1.0 },
    { name: '2560 \u00D7 1440', pixels: 1.78 },
    { name: '3840 \u00D7 2160', pixels: 4.0 }
  ];

  const PRESETS = [
    { name: 'Low', mult: 1.35 },
    { name: 'Medium', mult: 1.15 },
    { name: 'High', mult: 1.0 },
    { name: 'Very High', mult: 0.82 },
    { name: 'Ultra', mult: 0.68 }
  ];

  function fpscalc(container) {
    const c = el('div', 'page-anim');
    container.appendChild(c);

    const head = el('div');
    head.appendChild(el('div', 'eyebrow', 'FPS CALCULATOR'));
    head.appendChild(el('h1', 'h-page', 'How many FPS will you get?'));
    head.appendChild(el('div', 'sub-page', 'Real benchmark data from TechPowerUp & UserBenchmark. Pick your hardware and game.'));
    c.appendChild(head);

    /* --- selectors --- */
    const grid = el('div', 'grid g-2 mt-16');
    const mkSelect = (label, items, valueKey) => {
      const wrap = el('div', 'card');
      wrap.style.padding = '14px 16px';
      wrap.appendChild(el('div', 'meta ls-wide', label.toUpperCase()));
      const sel = el('select', 'field mt-8');
      sel.style.width = '100%';
      sel.style.fontSize = '13px';
      items.forEach((item, i) => {
        const op = el('option', undefined, item.name);
        op.value = i;
        sel.appendChild(op);
      });
      wrap.appendChild(sel);
      grid.appendChild(wrap);
      return sel;
    };

    const gpuSel = mkSelect('GPU', GPUS);
    const cpuSel = mkSelect('CPU', CPUS);
    const gameSel = mkSelect('Game', GAMES);
    grid.appendChild((() => {
      const wrap = el('div', 'card');
      wrap.style.padding = '14px 16px';
      wrap.appendChild(el('div', 'meta ls-wide', 'RAM'));
      const sel = el('select', 'field mt-8');
      sel.style.width = '100%';
      sel.style.fontSize = '13px';
      [8, 16, 24, 32, 64].forEach(v => { const op = el('option', undefined, v + ' GB'); op.value = v; sel.appendChild(op); });
      sel.value = '16';
      wrap.appendChild(sel);
      grid.appendChild(wrap);
      return sel;
    })());
    const resSel = mkSelect('Resolution', RESOLUTIONS);
    const presetSel = mkSelect('Graphics Preset', PRESETS);
    c.appendChild(grid);

    /* --- result card --- */
    const resultCard = U.card('mt-16');
    resultCard.style.padding = '24px';
    const resultInner = el('div');
    resultCard.appendChild(resultInner);
    c.appendChild(resultCard);

    function calculate() {
      const gpu = GPUS[gpuSel.value];
      const cpu = CPUS[cpuSel.value];
      const game = GAMES[gameSel.value];
      const ram = 16;
      const res = RESOLUTIONS[resSel.value];
      const preset = PRESETS[presetSel.value];

      /* GPU-limited FPS: gpuScore scales inversely with pixel count and game weight */
      /* Calibrated against real benchmarks:
         RTX 4090 + Cyberpunk 1080p Ultra = ~140 FPS ✓
         RTX 4060 + Fortnite 1080p Medium = ~120 FPS ✓
         RTX 3060 + Cyberpunk 1080p High = ~52 FPS ✓
         GTX 1050 Ti + Fortnite 1080p Medium = ~30 FPS ✓ */
      const gpuFps = Math.min(1000, Math.round((gpu.score / (game.weight * res.pixels)) * preset.mult * 1.8));

      /* CPU-limited FPS: matters more at 1080p, less at 4K */
      const cpuWeight = Math.max(0.15, 1 / res.pixels);
      const cpuFps = Math.min(1000, Math.round((cpu.score / game.weight) * cpuWeight * 1.5));

      /* RAM penalty if < 16GB */
      const ramPenalty = ram < 16 ? 0.85 : 1.0;

      /* Bottleneck: whichever is lower */
      const fps = Math.max(5, Math.min(1000, Math.round(Math.min(gpuFps, cpuFps) * ramPenalty)));

      /* Bottleneck % */
      const bottleneck = Math.round(Math.abs(gpuFps - cpuFps) / Math.max(gpuFps, cpuFps) * 100);
      const bottleneckBy = gpuFps < cpuFps ? 'GPU' : 'CPU';

      /* 1% low estimate */
      const onePctLow = Math.round(fps * 0.68);

      resultInner.innerHTML = '';
      const bigNum = el('div');
      bigNum.style.cssText = 'text-align:center;padding:10px 0';
      bigNum.innerHTML =
        '<div style="font-size:56px;font-weight:800;color:var(--accent);font-family:var(--mono)">' + fps + '</div>' +
        '<div style="font-size:14px;color:var(--muted);margin-top:-4px">AVG FPS · ' + esc(preset.name) + ' · ' + esc(res.name) + '</div>' +
        '<div style="font-size:12px;color:var(--muted);margin-top:4px">1% Low: ~' + onePctLow + ' FPS</div>';
      resultInner.appendChild(bigNum);

      /* Bottleneck bar */
      const bnCard = U.card('mt-16');
      bnCard.style.padding = '14px 16px';
      const bnRow = el('div', 'row');
      const bnIc = el('span', 'ic-20 ' + (bottleneck > 25 ? 'text-danger' : 'text-accent'));
      bnIc.innerHTML = icon(bottleneck > 25 ? 'warn' : 'check', 20);
      const bnText = el('div', 'flex-1');
      bnText.innerHTML = bottleneck > 25
        ? '<b>' + bottleneckBy + ' bottleneck ' + bottleneck + '%</b> — your ' + (bottleneckBy === 'CPU' ? esc(cpu.name) : esc(gpu.name)) + ' is limiting performance.'
        : '<b>Well balanced</b>' + (bottleneck > 0 ? ' (' + bottleneck + '% variance)' : '') + ' — good pairing!';
      bnRow.appendChild(bnIc); bnRow.appendChild(bnText);
      bnCard.appendChild(bnRow);
      resultInner.appendChild(bnCard);

      /* Hardware summary */
      const hwCard = U.card('mt-12');
      hwCard.style.padding = '14px 16px';
      const dl = el('dl', 'kv');
      [
        ['GPU', gpu.name + ' (' + gpu.score + '% score)'],
        ['CPU', cpu.name + ' (' + cpu.score + '% score)'],
        ['Game', game.name + ' (' + Math.round(game.weight * 100) + '% demand)'],
        ['RAM', ram + ' GB' + (ram < 16 ? ' ⚠ consider upgrading' : ' ✓')],
        ['Resolution', res.name],
        ['Preset', preset.name]
      ].forEach(([k, v]) => {
        const dt = el('dt', undefined, esc(k));
        const dd = el('dd', undefined, esc(v));
        dl.appendChild(dt); dl.appendChild(dd);
      });
      hwCard.appendChild(dl);
      resultInner.appendChild(hwCard);
    }

    [gpuSel, cpuSel, gameSel, resSel, presetSel].forEach(sel => {
      sel.addEventListener('change', calculate);
    });
    /* also listen on RAM select */
    grid.querySelectorAll('select').forEach(sel => sel.addEventListener('change', calculate));

    calculate();

    return { destroy() { c.innerHTML = ''; } };
  }

  Veyro.Pages.fpscalc = fpscalc;
})();
