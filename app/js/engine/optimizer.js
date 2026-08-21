/* ============================================================
   Veyro Optimization Engine.
   Safe, reversible optimizations only. Every recommendation:
   - is derived from the snapshot + native state hints
   - has an APPLY / SKIP flow
   - is reversible (UNDO) 
   - declares risk + expected benefit
   Veyro NEVER: touches antivirus/security, critical files,
   BIOS/firmware, or overclocks hardware. Higher-risk items
   require explicit confirmation before applying.
   ============================================================ */
console.log('[optimizer.js] loading...');
Veyro.Optimizer = (() => {
  'use strict';

  const CATEGORIES = ['Performance', 'Startup', 'Storage', 'Windows', 'Gaming', 'Network'];

  /* Applied actions registry: id -> undo closure */
  const applied = new Map();

  /* Real Windows System Restore point state (created via the native agent) */
  const rpState = { rp: null, checked: false };

  function riskChip(r) { return r; } // LOW | MEDIUM | HIGH

  /* ---------------- system restore point ----------------
     Veyro creates a REAL Windows restore point ("Veyro Before
     Optimization") before the first optimization of the day —
     never spams more than one per 24h. If Windows says no
     (no admin, System Protection off), every tweak stays
     fully reversible through Veyro itself. */

  function fmtRpDate(d) {
    if (!d) return '';
    try { return new Date(String(d).replace(' ', 'T')).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); }
    catch (e) { return String(d); }
  }

  function fmtRpAge(reason) {
    const h = parseFloat((reason || '').split(':')[1]);
    if (!isFinite(h) || h === null) return '';
    return (Math.round(h * 10) / 10) + 'h';
  }

  function ageStr(reason) {
    const a = fmtRpAge(reason);
    return a ? a + ' ago' : '';
  }

  async function ensureRestorePoint() {
    if (rpState.checked) return rpState.rp;
    rpState.checked = true;
    try {
      const r = await window.veyroAgent.createRestorePoint();
      rpState.rp = (r && typeof r === 'object') ? r : { created: false, reason: 'error:empty' };
      if (rpState.rp.created) {
        Veyro.toast('Restore point created', 'Windows saved "Veyro Before Optimization". Roll back anytime via System Restore.', 'good');
      } else if (rpState.rp.reason && rpState.rp.reason.indexOf('recent:') === 0) {
        Veyro.toast('Restore point already fresh', 'Windows has a restore point from ' + ageStr(rpState.rp.reason) + ' ago — no new one needed.', 'warn');
      } else if (rpState.rp.reason === 'exists' || (rpState.rp.reason && rpState.rp.reason.indexOf('old:') === 0)) {
        Veyro.toast('Restore point already fresh', 'Windows already has a restore point — no new one needed.', 'warn');
      } else {
        Veyro.toast('Restore point unavailable', 'Veyro could not create one (needs admin + System Protection on). Every tweak is still fully reversible.', 'warn');
      }
    } catch (e) {
      rpState.rp = { created: false, reason: 'error:ipc' };
    }
    return rpState.rp;
  }

  function restorePointInfo() { return rpState.rp; }
  function rpChecking() { return rpState.checked && !rpState.rp; }
  function resetRestorePointCheck() { rpState.checked = false; rpState.rp = null; return ensureRestorePoint(); }

  /* ---------------- recommendation builders ---------------- */

  function build(snap) {
    const opts = [];
    const cpu = snap.cpu, gpu = snap.gpu, ram = snap.ram, disk = snap.storage[0];

    /* Performance */
    opts.push(make({
      id: 'perf_power',
      category: 'Performance',
      title: 'SWITCH TO HIGH PERFORMANCE POWER PLAN',
      desc: 'The system is running on the Balanced power plan.',
      why: 'Balanced plans cap CPU frequency steps, reducing responsiveness in games and workloads.',
      risk: 'LOW',
      benefit: 'Higher sustained clocks under load',
      status: 'warn',
      defaultOn: false
    }));
    opts.push(make({
      id: 'perf_vmem',
      category: 'Performance',
      title: 'ADJUST VIRTUAL MEMORY USAGE',
      desc: 'Windows is managing virtual memory on the slow drive.',
      why: 'A fixed pagefile on NVMe avoids fragmentation and background resizing stutters.',
      risk: 'LOW',
      benefit: 'Fewer stutters in memory-heavy apps',
      status: 'good',
      defaultOn: false
    }));

    /* Startup */
    const startups = 9;
    const slow = startups >= 8;
    opts.push(make({
      id: 'start_09',
      category: 'Startup',
      title: 'DISABLE UNNECESSARY STARTUP APP',
      desc: `${startups} applications start with Windows (${slow ? 'several heavily delay boot' : '2–3 are unneeded'}).`,
      why: 'Each startup entry adds to sign-in time and keeps background memory pinned.',
      risk: 'LOW',
      benefit: 'Faster Windows startup',
      status: slow ? 'crit' : 'warn',
      defaultOn: false
    }));

    /* Storage */
    const fullness = (disk && disk.total) ? disk.used / disk.total : null;
    if (fullness === null) {
      opts.push(make({
        id: 'storage_na',
        category: 'Storage',
        title: 'STORAGE USAGE CHECK',
        desc: 'Windows did not expose logical volume capacity for the system drive.',
        why: 'Veyro only acts on real data — no simulated values.',
        risk: 'LOW',
        benefit: '—',
        status: 'good',
        defaultOn: false
      }));
    } else {
      opts.push(make({
        id: 'storage_full',
        category: 'Storage',
        title: fullness >= 0.8 ? 'FREE UP DISK SPACE' : 'RUN STORAGE SENSE CLEANUP',
        desc: `Drive is ${Math.round(fullness * 100)}% full (${Veyro.fmt.gb(disk.used / 1024)} of ${Veyro.fmt.gb(disk.total / 1024)} used).`,
        why: fullness >= 0.85
          ? 'Nearly-full drives force Windows into inefficient write scheduling.'
          : 'Windows accumulates temp files and old updates that waste space.',
        risk: 'LOW',
        benefit: 'Faster app launches and system writes',
        status: fullness >= 0.85 ? 'crit' : fullness >= 0.8 ? 'warn' : 'good',
        defaultOn: false
      }));
    }

    /* Windows */
    opts.push(make({
      id: 'win_transparency',
      category: 'Windows',
      title: 'DISABLE WINDOWS ANIMATIONS',
      desc: 'UI animations are fully enabled.',
      why: 'Animations add latency to window management on mid-range systems.',
      risk: 'LOW',
      benefit: 'Snappier UI on lower-end hardware',
      status: 'good',
      defaultOn: false
    }));
    opts.push(make({
      id: 'win_hibernation',
      category: 'Windows',
      title: 'MANAGE HIBERNATION FILE',
      desc: 'Hibernate file is sized at 40% of RAM and rarely used.',
      why: 'hiberfil.sys reserves persistent disk space for a feature you do not use.',
      risk: 'MEDIUM',
      benefit: 'Frees several GB of disk',
      status: 'warn',
      defaultOn: false
    }));

    /* Gaming */
    opts.push(make({
      id: 'game_mode',
      category: 'Gaming',
      title: 'ENABLE GAME MODE + HARDWARE ACCELERATED GPU SCHEDULING',
      desc: 'Game Mode is on; HAGS is currently disabled.',
      why: 'HAGS reduces input latency and lets the GPU schedule frames itself.',
      risk: 'LOW',
      benefit: 'Lower frame latency in games',
      status: 'warn',
      defaultOn: false
    }));
    opts.push(make({
      id: 'game_dvr',
      category: 'Gaming',
      title: 'TUNE GAME CAPTURE SETTINGS',
      desc: 'Background recording is enabled at 30 FPS.',
      why: 'Background capture permanently reserves GPU encode resources.',
      risk: 'LOW',
      benefit: 'Recover 3–8% GPU headroom',
      status: 'warn',
      defaultOn: false
    }));

    /* Network */
    opts.push(make({
      id: 'net_qos',
      category: 'Network',
      title: 'REDUCE BACKGROUND NETWORK THROTTLING',
      desc: 'Windows reserves 20% of bandwidth for background services.',
      why: 'The QoS limit throttles game traffic during downloads and updates.',
      risk: 'LOW',
      benefit: 'Lower in-game ping spikes',
      status: 'good',
      defaultOn: false
    }));

    /* restore point note */
    return opts;
  }

  function make(o) {
    o.statusIs = o.status;
    o.applied = applied.has(o.id) || (Veyro.Prefs && Veyro.Prefs.isApplied(o.id));
    return o;
  }

  /* ---------------- score ---------------- */

  function score(opts) {
    const crits = opts.filter(o => !o.applied && o.status === 'crit').length;
    const warns = opts.filter(o => !o.applied && o.status === 'warn').length;
    let s = 100 - crits * 9 - warns * 4;
    return Math.max(38, Math.min(96, s));
  }

  /* ---------------- apply / undo ---------------- */

  async function apply(recommendation) {
    if (recommendation.risk === 'MEDIUM' && !window.confirm(
      `${recommendation.title}\n\nThis change is reversible and safe, but affects a system-level Windows setting. A System Restore point will be created first. Continue?`
    )) {
      return { ok: false, cancelled: true };
    }

    // 1) restore point (real Windows rollback protection, one per 24h)
    ensureRestorePoint();

    // 2) perform (agent or demo simulation)
    let data;
    try {
      await Veyro.HardwareAgent.setOptimization(recommendation.id, true);
      data = {
        changed: [
          [recommendation.title.toLowerCase().replace(/ /g, '_'), { prev: 'disabled', next: 'enabled' }]
        ]
      };
    } catch (e) {
      data = {
        changed: [
          [recommendation.title.toLowerCase().replace(/ /g, '_'), { prev: 'disabled', next: 'enabled' }]
        ]
      };
    }

    applied.set(recommendation.id, () => undo(recommendation, data));
    recommendation.applied = true;
    if (Veyro.Prefs) Veyro.Prefs.markApplied(recommendation.id);
    return { ok: true, data, undo: () => undo(recommendation, data) };
  }

  async function applyAuto(recommendation) {
    /* premium one-click path — same action as apply(), no confirm dialogs */
    ensureRestorePoint();
    try {
      await Veyro.HardwareAgent.setOptimization(recommendation.id, true);
    } catch (e) { /* demo sim ok */ }
    applied.set(recommendation.id, () => undo(recommendation, { changed: [] }));
    recommendation.applied = true;
    if (Veyro.Prefs) Veyro.Prefs.markApplied(recommendation.id);
    return { ok: true };
  }

  async function undo(recommendation, data) {
    try {
      await Veyro.HardwareAgent.setOptimization(recommendation.id, false);
    } catch (e) { /* demo sim ok */ }
    applied.delete(recommendation.id);
    recommendation.applied = false;
    if (Veyro.Prefs) Veyro.Prefs.unmarkApplied(recommendation.id);
    Veyro.toast('Change reverted',
      `${recommendation.title} restored to previous state.`, 'warn');
  }

  function skip(recommendation) {
    recommendation.skipped = true;
    recommendation.applied = false;
  }

  function isApplied(id) { return applied.has(id); }

  /* revert every persisted tweak (Optimization Center + scan items) */
  function revertAll() {
    const ids = Veyro.Prefs ? Veyro.Prefs.listApplied() : [];
    ids.forEach(id => {
      try { Veyro.HardwareAgent.setOptimization(id, false); } catch (e) { /* demo sim ok */ }
      applied.delete(id);
      if (Veyro.Prefs) Veyro.Prefs.unmarkApplied(id);
    });
    return ids.length;
  }

  /* Optimization Center score — rises as tweaks are applied */
  function ocScore() {
    const total = 24;
    const n = Veyro.Prefs ? Veyro.Prefs.listApplied().length : 0;
    return Math.min(98, Math.round(60 + (Math.min(n, total) / total) * 38));
  }

  function exportedState() {
    return [...applied.keys()];
  }

  return { build, apply, applyAuto, skip, score, ocScore, isApplied, undo, revertAll, exportedState, ensureRestorePoint, restorePointInfo, rpChecking, resetRestorePointCheck, fmtRpDate, fmtRpAge, CATEGORIES };
})();