/* ============================================================
   Veyro store — persistent settings + app state (localStorage).
   ============================================================ */
Veyro.Store = (() => {
  const KEY = 'veyro.v2';

  const DEFAULTS = {
    onboarded: false,
    scanCompleted: false,
    settings: {
      startWithWindows: false,
      autoScan: true,
      autoOptimize: false,
      notifications: true,
      animationIntensity: 1,   // 0.5 / 1 / 1.5
      greenAccentIntensity: 1, // 0.6 – 1.4
      demoMode: false,         // real hardware detection is the default
      privacyTelemetry: false,
      auroraTheme: false,      // premium-only visual theme
      accentColor: ''          // UI Designer — custom accent (empty = Veyro Green)
    }
  };

  let state = null;

  function load() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
      state = raw && typeof raw === 'object'
        ? { ...DEFAULTS, ...raw, settings: { ...DEFAULTS.settings, ...(raw.settings || {}) } }
        : JSON.parse(JSON.stringify(DEFAULTS));
    } catch (e) {
      state = JSON.parse(JSON.stringify(DEFAULTS));
    }
    applyTheme(state.settings);
    return state;
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) { /* storage unavailable — non-fatal */ }
  }

  function get(k) {
    return k ? state[k] : state;
  }

  function setSettings(patch) {
    Object.assign(state.settings, patch);
    applyTheme(state.settings);
    save();
  }

  function set(k, v) {
    state[k] = v;
    save();
  }

  function applyTheme(s) {
    const root = document.documentElement;
    root.style.setProperty('--accent-strength', s.greenAccentIntensity);
    root.style.setProperty('--anim', s.animationIntensity);
    if (s.accentColor) {
      root.style.setProperty('--accent', s.accentColor);
    } else {
      const f = s.greenAccentIntensity; // 0.6 – 1.4
      const clamp = (v) => Math.round(Math.min(255, Math.max(0, v)));
      root.style.setProperty('--accent', `rgb(${clamp(57 * f)},${clamp(255 * f)},${clamp(136 * f)})`);
    }
    root.style.setProperty('--anim-speed', `${(0.24 * (1.5 - s.animationIntensity) + 0.05).toFixed(2)}s`);
    document.body.classList.toggle('veyro-demo', !!s.demoMode);
    const prem = !!(window.Veyro && Veyro.License && Veyro.License.isPremium());
    document.body.classList.toggle('veyro-aurora', !!s.auroraTheme && prem);
  }

  return {
    load, save, get, set, setSettings
  };
})();