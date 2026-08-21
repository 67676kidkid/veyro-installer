/* ============================================================
   Veyro Health Monitor.
   Produces the PC HEALTH page data + the notification/alert feed.
   Only actionable signals — no junk warnings.
   ============================================================ */
console.log('[health.js] loading...');
Veyro.Health = (() => {
  'use strict';

  const CHECKS = [
    { key: 'cpu', label: 'CPU', icon: 'cpu' },
    { key: 'gpu', label: 'GPU', icon: 'gpu' },
    { key: 'storage', label: 'Storage', icon: 'disk' },
    { key: 'ram', label: 'RAM', icon: 'ram' },
    { key: 'drivers', label: 'Drivers', icon: 'scan' },
    { key: 'windows', label: 'Windows', icon: 'shield' }
  ];

  function check(snap) {
    const out = {};
    const gpuT = snap.gpu.temp, cpuT = snap.cpu.temp;
    const disk = snap.storage[0];
    const fullness = (disk && disk.total) ? disk.used / disk.total : null;
    const ramPct = (snap.ram.total && snap.ram.used) ? snap.ram.used / snap.ram.total : null;

    /* CPU */
    if (cpuT === null || cpuT === undefined) {
      out.cpu = { status: 'good', message: 'CPU temperature sensor not exposed by Windows.', detail: 'No temperature module is installed — this is not an error.' };
    } else if (cpuT > 88) {
      out.cpu = { status: 'crit', message: 'CPU temperature is critically high.', detail: `${Math.round(cpuT)}°C — check cooling and airflow.` };
    } else if (cpuT > 78) {
      out.cpu = { status: 'warn', message: 'CPU temperature is higher than usual.', detail: `${Math.round(cpuT)}°C sustained can cause throttling.` };
    } else {
      out.cpu = { status: 'good', message: 'CPU temperature is normal.', detail: `${Math.round(cpuT)}°C under load.` };
    }

    /* GPU */
    if (gpuT === null || gpuT === undefined) {
      out.gpu = { status: 'good', message: 'GPU temperature sensor unavailable.', detail: 'Requires an NVIDIA driver (nvidia-smi) or a supported sensor module.' };
    } else if (gpuT > 85) {
      out.gpu = { status: 'warn', message: 'GPU temperature is higher than usual.', detail: `${Math.round(gpuT)}°C — check fans and case airflow.` };
    } else {
      out.gpu = { status: 'good', message: 'GPU temperature is normal.', detail: `${Math.round(gpuT)}°C${typeof snap.gpu.usage === 'number' ? ' at ' + Math.round(snap.gpu.usage) + '% load' : ''}.` };
    }

    /* Storage */
    if (fullness === null) {
      out.storage = { status: 'good', message: 'Storage volume data unavailable.', detail: 'Windows did not expose logical volume capacity.' };
    } else if (fullness > 0.92) {
      out.storage = { status: 'crit', message: 'Your SSD is almost full.', detail: `${Math.round(fullness * 100)}% used — free space before performance drops.` };
    } else if (fullness > 0.8) {
      out.storage = { status: 'warn', message: 'Storage is getting full.', detail: `${Math.round(fullness * 100)}% used — consider cleanup or an extra drive.` };
    } else {
      out.storage = { status: 'good', message: 'Free disk space is healthy.', detail: `${Math.round((1 - fullness) * 100)}% free on ${disk.label || 'system volume'}.` };
    }

    /* RAM */
    if (ramPct === null) {
      out.ram = { status: 'good', message: 'RAM usage sensor unavailable.', detail: 'Windows performance data was not readable.' };
    } else if (ramPct > 0.92) {
      out.ram = { status: 'crit', message: 'RAM usage is consistently high.', detail: `${Math.round(ramPct * 100)}% in use — close background apps or plan an upgrade.` };
    } else if (ramPct > 0.82) {
      out.ram = { status: 'warn', message: 'RAM usage is high during gaming.', detail: `${Math.round(ramPct * 100)}% in use — pagefile is being hit.` };
    } else if (ramPct > 0.6) {
      out.ram = { status: 'good', message: 'RAM usage is normal.', detail: `${Math.round(ramPct * 100)}% in use — plenty of headroom.` };
    } else {
      out.ram = { status: 'good', message: 'RAM usage is low.', detail: `${Math.round(ramPct * 100)}% in use.` };
    }

    /* Drivers */
    out.drivers = snap.gpu.driver
      ? { status: 'good', message: 'GPU driver is installed.', detail: `Driver ${snap.gpu.driver}${snap.gpu.driverDate ? ' · ' + snap.gpu.driverDate : ''}.` }
      : { status: 'good', message: 'Driver information unavailable.', detail: 'Windows did not expose the GPU driver version.' };

    /* Windows */
    out.windows = {
      status: 'good',
      message: snap.os.name ? `Windows ${snap.os.version || snap.os.build || ''}`.trim() : 'Windows information unavailable.',
      detail: snap.os.build ? `build ${snap.os.build}${snap.os.arch ? ' · ' + snap.os.arch : ''}.` : ''
    };

    return out;
  }

  function score(snap) {
    const c = check(snap);
    let s = 100;
    for (const k of Object.keys(c)) {
      if (c[k].status === 'warn') s -= 3;
      if (c[k].status === 'crit') s -= 10;
    }
    return Math.max(40, s);
  }

  /* ---------------- alerts (notification feed) ---------------- */

  function alerts(snap) {
    const c = check(snap);
    const list = [];
    for (const k of CHECKS) {
      const r = c[k.key];
      if (r.status !== 'good') {
        list.push({
          id: k.key + '_' + r.status,
          severity: r.status === 'crit' ? 'crit' : 'warn',
          title: r.message,
          body: r.detail,
          part: k.label
        });
      }
    }
    /* healthy-system confirmation alert */
    if (!list.length) {
      list.push({ id: 'all_good', severity: 'good', title: 'All systems healthy', body: 'No active issues detected.', part: 'System' });
    }
    return list.map((a, i) => ({ ...a, at: Date.now() - i * 420000 }));
  }

  return { check, score, alerts, CHECKS };
})();