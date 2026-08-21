/* ============================================================
   Veyro Power Tools — thin renderer API over the native agent.
   Real tools talk to real Windows via native/agent.js (spawns
   PowerShell). When the agent is unavailable (e.g. plain-browser
   dev) the same calls fall back to clearly-labeled demo data so
   the UI stays testable. Nothing is invented for live installs.
   ============================================================ */
console.log('[tools.js] loading...');
Veyro.Tools = (() => {
  'use strict';

  const bridge = () => window.veyroAgent && typeof window.veyroAgent.tool === 'function' ? window.veyroAgent.tool : null;

  async function call(name, arg) {
    const b = bridge();
    if (!b) return { ok: false, noBridge: true };
    try {
      const r = await b(name, arg);
      if (r && r.ok) return { ok: true, data: r.data };
      return { ok: false, msg: r && r.msg ? r.msg : 'The tool did not return data.' };
    } catch (e) {
      return { ok: false, msg: (e && e.message) || 'Tool failed.' };
    }
  }

  const now = Date.now();
  const demo = {
    startup: [
      { name: 'Discord', command: 'C:\\Users\\you\\AppData\\Local\\Discord\\Update.exe --processStart Discord.exe', scope: 'USER', enabled: true },
      { name: 'Steam', command: '"C:\\Program Files (x86)\\Steam\\steam.exe" -silent', scope: 'MACHINE', enabled: true },
      { name: 'OneDrive', command: '%SystemRoot%\\System32\\OneDriveSetup.exe /background', scope: 'USER', enabled: false },
      { name: 'Spotify', command: '"C:\\Users\\you\\AppData\\Roaming\\Spotify\\Spotify.exe" --minimized', scope: 'USER', enabled: false }
    ],
    junk: {
      items: [
        { name: 'Windows Temp', path: 'C:\\Windows\\Temp', bytes: 1842 * 1048576 },
        { name: 'User Temp', path: '.', bytes: 512 * 1048576 },
        { name: 'Chrome Cache', path: '.', bytes: 340 * 1048576 },
        { name: 'Recycle Bin', path: 'C:\\$Recycle.Bin\\', bytes: 197 * 1048576 }
      ],
      total: 2891 * 1048576
    },
    storage: [
      { name: 'Windows', path: 'C:\\Windows', bytes: 22 * 1073741824 },
      { name: 'Program Files', path: 'C:\\Program Files', bytes: 14 * 1073741824 },
      { name: 'Users', path: 'C:\\Users', bytes: 48 * 1073741824 },
      { name: 'ProgramData', path: 'C:\\ProgramData', bytes: 6 * 1073741824 }
    ],
    dupes: [
      { hash: 'A1B2', count: 3, files: ['C:\\Users\\you\\Desktop\\backup.png', 'C:\\Users\\you\\Downloads\\backup.png', 'C:\\Users\\you\\Pictures\\backup.png'] },
      { hash: 'C3D4', count: 2, files: ['C:\\Users\\you\\Music\\track.mp3', 'C:\\Users\\you\\Downloads\\track (copy).mp3'] }
    ],
    power: {
      activeRaw: 'Power Scheme GUID: 381b4222-f694-41f0-9685-ff5bb260df2e  (Balanced) *',
      plans: [
        { guid: '381b4222-f694-41f0-9685-ff5bb260df2e', name: 'Balanced', active: true },
        { guid: '8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c', name: 'High performance', active: false }
      ]
    },
    net: {
      pings: [
        { host: 'one.one.one.one', ms: 12, ok: true },
        { host: 'dns.google', ms: 15, ok: true },
        { host: 'cloudflare.com', ms: 14, ok: true },
        { host: 'example.com', ms: 18, ok: true }
      ],
      adapters: [{ name: 'Ethernet', ip: '192.168.1.24', gateway: '192.168.1.1' }]
    },
    uninstall: [
      { name: 'Google Chrome', version: '124.0.6367.62', publisher: 'Google LLC', sizeBytes: 482 * 1048576 },
      { name: 'Steam', version: '3.0', publisher: 'Valve', sizeBytes: 310 * 1048576 },
      { name: 'Visual Studio Code', version: '1.88.0', publisher: 'Microsoft Corporation', sizeBytes: 620 * 1048576 }
    ],
    services: [
      { name: 'WinDefend', display: 'Windows Defender Antivirus', status: 'Running', startType: 'Automatic' },
      { name: 'wuauserv', display: 'Windows Update', status: 'Running', startType: 'Manual' },
      { name: 'OneSyncSvc', display: 'Sync Host', status: 'Stopped', startType: 'Manual' },
      { name: 'SysMain', display: 'SysMain', status: 'Running', startType: 'Automatic' }
    ],
    processes: [
      { name: 'chrome', pid: 4482, memMB: 812, cpuSec: 4210 },
      { name: 'explorer', pid: 3104, memMB: 210, cpuSec: 8230 },
      { name: 'VSCode', pid: 1602, memMB: 540, cpuSec: 3401 },
      { name: 'Steam', pid: 6620, memMB: 480, cpuSec: 1210 }
    ]
  };

  /* load(name, arg) → { ok, demo, data | msg } — demo only when NO agent at all */
  async function load(name, arg) {
    if (Veyro.isDemo()) return { ok: true, demo: true, data: demo[name] || [] };
    const r = await call(name, arg);
    if (r.ok) return { ok: true, demo: false, data: r.data };
    return { ok: false, msg: r.msg || 'Could not load tool data.' };
  }

  /* run(name, arg) → { ok, demo, data | msg } — actions always need the agent */
  async function run(name, arg) {
    if (Veyro.isDemo()) return { ok: false, demo: true, msg: 'Demo mode — the real action only runs with the native agent.' };
    return call(name, arg);
  }

  function fmtBytes(v) { return v == null ? '—' : Veyro.fmt.bytes(Math.max(0, v)); }

  return { load, run, fmtBytes };
})();