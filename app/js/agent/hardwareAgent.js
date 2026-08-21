/* ============================================================
   Veyro Hardware Agent — abstraction layer.

   Two implementations behind one interface:

     NativeAgent      — talks to the Electron main-process agent
                        (native/agent.js) through the secure
                        preload IPC bridge. Real WMI/CIM data.
     DemoAgent        — static demo PC, ALWAYS labeled "Demo
                        hardware data" in the UI.

   The UI never knows where data comes from; it only reads the
   PC snapshot model. Any field the OS cannot provide is null
   and renders as "Unavailable" — values are never invented.

   Snapshot fields that may be null:
     cpu  {manufacturer, model, baseClock, clock, cores,
           threads, temp, usage, power, tdp}
     gpu  {manufacturer, model, vram, clock, temp, usage,
           driver, driverDate}
     ram  {total, used, type, speed, sticks}
     storage[0] {label, kind, model, total, used, temp, health}
mobo {manufacturer, model, bios, biosDate, chipset}
      net  {adapter, download, upload}
      os   {name, version, build, arch, uptimeHours}
    ============================================================ */
console.log('[hardwareAgent.js] loading...');
Veyro.HardwareAgent = (() => {
  'use strict';

  const MEM_TYPE = {
    20: 'DDR', 21: 'DDR2', 24: 'DDR3', 26: 'DDR4', 34: 'DDR5'
  };

  const cleanCaption = (cap) => (cap || '').replace(/^Microsoft\s+/i, '').trim() || null;

  /* ---------------- native agent ---------------- */

  class NativeAgent {
    constructor() {
      this.kind = 'native';
      this.connected = !!(window.veyroAgent && window.veyroAgent.connected);
      this._scanCache = { at: 0, raw: null };
      this._scanInflight = null;
      this.CACHE_TTL = 30000; /* static WMI scan is slow (~3.5s) — cache it */
    }

    async _scanCached() {
      const now = Date.now();
      if (this._scanCache.raw && now - this._scanCache.at < this.CACHE_TTL) {
        return this._scanCache.raw;
      }
      if (this._scanInflight) return this._scanInflight;
      this._scanInflight = window.veyroAgent.scan()
        .then(raw => {
          this._scanCache = { at: Date.now(), raw };
          return raw;
        })
        .finally(() => { this._scanInflight = null; });
      return this._scanInflight;
    }

    async getSnapshot() {
      if (!this.connected) {
        throw new Error('Native hardware agent not connected');
      }
      let raw, live;
      try {
        [raw, live] = await Promise.all([
          this._scanCached(),
          window.veyroAgent.metrics()
        ]);
      } catch (e) {
        throw { code: 'HW_UNAVAILABLE', message: 'Unable to access hardware information.', cause: e };
      }
      return normalize(raw || {}, live || {});
    }

    async detectGames() {
      return []; /* native game detection reserved for a future agent module */
    }

    async getOptimizations() {
      try { return await window.veyroAgent.metrics(); } catch (e) { return {}; }
    }

    async setOptimization(id, on) {
      return window.veyroAgent.applyOptimization(id, on);
    }

    async listSettings() {
      return {};
    }
  }

  function normalize(r, l) {
    const cpu = r.cpu || {};
    const gpu0 = (r.gpu || [])[0] || {};
    const os = r.os || {};
    const ram = r.ram || {};
    const mb = r.mobo || {};
    const st = r.storage || {};
    const vols = st.volumes || [];
    const disks = st.disks || [];
    const sysVol = vols.find(v => v.system) || vols[0] || null;
    const nets = r.network || [];

    const liveGpu = (l && typeof l === 'object' && l.gpu && Object.keys(l.gpu).length) ? l.gpu : null;

    const totalMB = (os.totalMemKB != null && os.totalMemKB > 0) ? Math.round(os.totalMemKB / 1024) : null;
    const usedMB = (l && typeof l.memUsedMB === 'number') ? l.memUsedMB
      : ((os.totalMemKB != null && os.freeMemKB != null) ? Math.round((os.totalMemKB - os.freeMemKB) / 1024) : null);

    return {
      demo: false,
      pc: {
        name: (r.pc && r.pc.name) ? r.pc.name : 'This PC',
        platform: `${cleanCaption(os.caption) || 'Windows'}${os.displayVersion ? ' ' + os.displayVersion : ''}`.trim() || null,
        lastScan: r.scannedAt || new Date().toISOString()
      },
      cpu: {
        manufacturer: cpu.manufacturer || null,
        model: cpu.model || null,
        clock: cpu.baseClockMhz || null,
        baseClock: cpu.baseClockMhz || null,
        cores: (cpu.cores !== undefined && cpu.cores !== null) ? cpu.cores : null,
        threads: (cpu.threads !== undefined && cpu.threads !== null) ? cpu.threads : null,
        temp: null, /* CPU temp needs a sensor module — not exposed by default */
        usage: (l && typeof l.cpu === 'number') ? l.cpu : null,
        power: null,
        tdp: null
      },
      gpu: {
        manufacturer: gpu0.name ? gpu0.name.split(' ')[0] : null,
        model: gpu0.name || null,
        vram: gpu0.vramMB || null,
        clock: null,
        temp: liveGpu && typeof liveGpu.temp === 'number' ? liveGpu.temp : null,
        usage: liveGpu && typeof liveGpu.usage === 'number' ? liveGpu.usage : null,
        driver: gpu0.driver || (liveGpu && liveGpu.driver) || null,
        driverDate: gpu0.driverDate || null
      },
      ram: {
        total: totalMB,
        used: usedMB,
        type: MEM_TYPE[ram.smbiosType] || (ram.manufacturer && ram.manufacturer.match(/DDR[0-9]/i) ? ram.manufacturer.match(/DDR[0-9]/i)[0].toUpperCase() : null),
        speed: ram.speedMts || ram.configuredMts || null,
        sticks: (ram.sticks !== undefined && ram.sticks !== null) ? ram.sticks : null
      },
      storage: [{
        label: sysVol ? (sysVol.device + (sysVol.label ? ' · ' + sysVol.label : '')) : null,
        kind: sysVol ? null : null,
        model: sysVol ? (disks[0] ? disks[0].model : null) : null,
        total: sysVol ? sysVol.totalMB : null,
        used: sysVol ? Math.round(sysVol.totalMB - sysVol.freeMB) : null,
        temp: null,
        health: null
      }],
      motherboard: {
        manufacturer: mb.manufacturer || null,
        model: mb.product || null,
        bios: mb.bios || null,
        biosDate: mb.biosDate || null,
        chipset: null
      },
      network: {
        adapter: nets[0] ? nets[0].name : null,
        download: (nets[0] && nets[0].speedMbps) ? nets[0].speedMbps : null,
        upload: null
      },
      os: {
        name: cleanCaption(os.caption),
        version: os.displayVersion || null,
        build: os.build || null,
        arch: os.arch || null,
        uptimeHours: os.uptimeHours != null ? os.uptimeHours : null
      },
      battery: null,
      errors: []
    };
  }

  /* ---------------- demo agent (clearly labeled) ---------------- */

  class DemoAgent {
    constructor() {
      this.kind = 'demo';
      this.connected = true;
      this._jitter = {};
    }

    jitter(key, base, spread) {
      const prev = this._jitter[key] !== undefined ? this._jitter[key] : base;
      const next = prev + (Math.random() - 0.5) * spread * 2;
      const lo = Math.max(0, base - spread * 2.2);
      const hi = base + spread * 2.2;
      this._jitter[key] = Math.min(hi, Math.max(lo, next));
      return this._jitter[key];
    }

    _clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

    async getSnapshot() {
      const cpuUsage = this.jitter('cpu', 27, 9);
      const gpuUsage = this.jitter('gpu', 63, 16);
      const gpuTemp = this.jitter('gpuTemp', 54, 7);
      return {
        demo: true,
        pc: {
          name: 'Demo PC (Veyro Gaming PC)',
          platform: 'Windows 11 Pro · Demo hardware',
          lastScan: new Date().toISOString()
        },
        cpu: {
          manufacturer: 'Intel', model: 'Core i5-12400F', baseClock: 2500, clock: 4400,
          cores: 6, threads: 12, temp: this.jitter('cpuTemp', 52, 6),
          usage: this._clamp(cpuUsage, 2, 99), power: null, tdp: 65
        },
        gpu: {
          manufacturer: 'NVIDIA', model: 'GeForce RTX 3060', vram: 12288,
          clock: null, temp: gpuTemp, usage: this._clamp(gpuUsage, 1, 99),
          driver: '572.83 (Game Ready)', driverDate: '2026-07-22'
        },
        ram: {
          total: 16384, used: Math.round(this.jitter('ram', 9.4, 0.8) * 1024),
          type: 'DDR4', speed: 3200, sticks: 2
        },
        storage: [{
          label: 'System Drive', kind: 'NVMe SSD', model: 'Crucial P3 Plus 1TB',
          total: 1000000, used: 820000, temp: 41, health: 98
        }],
        motherboard: {
          manufacturer: 'MSI', model: 'PRO B660M-A DDR4 (MS-7D43)',
          bios: 'E7D43IMS.140', biosDate: '2025-11-18', chipset: 'Intel B660'
        },
        network: { adapter: 'Realtek Gaming 2.5GbE Family Controller', download: 920, upload: 110 },
        os: { name: 'Windows 11 Pro', version: '23H2', build: '22631.3155', arch: '64-bit', uptimeHours: 47.3 },
        battery: null,
        errors: []
      };
    }

    async detectGames() { return []; }
    async getOptimizations() { return {}; }
    async setOptimization() { return { ok: true, tracked: true }; }
    async listSettings() { return {}; }
  }

  /* ---------------- factory ---------------- */

  let current = null;

  function get() {
    if (!current) {
      const settings = (Veyro.Store && Veyro.Store.get()) ? Veyro.Store.get().settings : { demoMode: true };
      const nativeAvailable = !!(window.veyroAgent && window.veyroAgent.connected);
      if (nativeAvailable && settings.demoMode === false) {
        current = new NativeAgent();
      } else {
        current = new DemoAgent();
      }
    }
    return current;
  }

  function reconnect() {
    current = null;
    return get();
  }

  function activeKind() {
    if (!current) get();
    return current ? current.kind : 'none';
  }

  async function withGuard(fn) {
    const agent = get();
    try {
      return await fn(agent);
    } catch (e) {
      if (e && e.code === 'HW_UNAVAILABLE') throw e;
      throw { code: 'HW_UNAVAILABLE', message: 'Unable to access hardware information.', cause: e };
    }
  }

  return {
    kind: () => activeKind(),
    isNative: () => activeKind() === 'native',
    isDemo: () => activeKind() === 'demo',
    getSnapshot: () => withGuard(a => a.getSnapshot()),
    detectGames: () => withGuard(a => a.detectGames()),
    getOptimizations: () => withGuard(a => a.getOptimizations()),
    setOptimization: (id, on) => withGuard(a => a.setOptimization(id, on)),
    listSettings: () => withGuard(a => a.listSettings()),
    reconnect
  };
})();