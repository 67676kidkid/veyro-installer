/* ============================================================
   Veyro System Report — premium text report builder.
   ============================================================ */
console.log('[report.js] loading...');
Veyro.Report = (() => {
  'use strict';

  function build(snap) {
    const av = Veyro.av;
    const d0 = snap.storage[0] || {};
    const cpuLine = [av(snap.cpu.manufacturer), av(snap.cpu.model)].filter(x => x !== 'Unavailable').join(' ') +
      (snap.cpu.cores != null ? ` — ${snap.cpu.cores}C/${snap.cpu.threads}T` : '') +
      (snap.cpu.clock ? ` @ ${Veyro.fmt.mhz(snap.cpu.clock)}` : '');
    const gpuLine = [av(snap.gpu.manufacturer), av(snap.gpu.model)].filter(x => x !== 'Unavailable').join(' ') +
      (snap.gpu.vram ? ` — ${Math.round(snap.gpu.vram / 1024)} GB VRAM` : '') +
      (snap.gpu.driver ? `, driver ${snap.gpu.driver}` : '');
    const dTot = d0.total, dUsed = d0.used;
    const health = Veyro.Health.score(snap);
    const bn = Veyro.Upgrades.bottleneck(snap);
    const opt = Veyro.Optimizer.build(snap);
    const open = opt.filter(o => !o.applied && (o.status === 'warn' || o.status === 'crit')).length;
    const activeTweaks = (Veyro.Prefs ? Veyro.Prefs.listApplied() : [])
      .map(id => id.replace(/^oc_/, '').replace(/_/g, ' ').toUpperCase());
    const lines = [
      'Veyro PREMIUM SYSTEM REPORT',
      '============================',
      `Generated: ${new Date().toLocaleString()}`,
      `PC: ${snap.pc.name}`,
      `OS: ${av(snap.os.name)} ${av(snap.os.version)}${snap.os.build ? ' (build ' + snap.os.build + ')' : ''}`,
      `CPU: ${cpuLine}`,
      `GPU: ${gpuLine}`,
      `RAM: ${dTot ? Veyro.fmt.gb(snap.ram.total / 1024) : 'Unavailable'}${snap.ram.type ? ' ' + snap.ram.type : ''}${snap.ram.speed ? ' @ ' + snap.ram.speed + ' MT/s' : ''}`,
      `Storage: ${d0.model || 'Unavailable'} (${dTot ? Veyro.fmt.tb(dTot) : 'Unavailable'} total, ${dUsed != null ? Veyro.fmt.tb(dUsed) + ' used' : 'used unknown'})`,
      `Motherboard: ${av(snap.motherboard.manufacturer)} ${av(snap.motherboard.model)}`,
      `Network: ${av(snap.network.adapter)}`,
      ``,
      `HEALTH SCORE: ${health}/100`,
      `BOTTLENECK: ${bn.kind} (${bn.kind === 'GPU' ? 'graphics card' : 'processor'} limits gaming performance)`,
      `OPEN OPTIMIZATIONS: ${open} item(s) found`,
      `PREMIUM: ${Veyro.License.isPremium() ? 'ACTIVE' : 'INACTIVE'}`,
      `GAME CATALOG: ${Veyro.Games ? Veyro.Games.all().length : 0} titles with optimization profiles`,
      `ACTIVE TWEAKS: ${activeTweaks.length} applied (${activeTweaks.join(', ') || 'none'})`,
      `===============`
    ];
    return lines.join('\n');
  }

  return { build };
})();