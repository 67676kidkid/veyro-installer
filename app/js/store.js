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

  /* UI Designer presets */
  const BG_PRESETS = {
    '': null,
    black:  { bg: '#000000', bg2: '#060606', card: '#0b0b0b' },
    navy:   { bg: '#070b14', bg2: '#0b1220', card: '#101a2b' },
    warm:   { bg: '#131009', bg2: '#1b160c', card: '#241d10' },
    forest: { bg: '#06110c', bg2: '#0a1a12', card: '#0f241a' },
    slate:  { bg: '#0d1117', bg2: '#161b22', card: '#1c2128' }
  };
  const RADIUS_PRESETS = {
    '': null,
    sharp: { card: '0px', btn: '0px', input: '0px' },
    round: { card: '16px', btn: '12px', input: '12px' },
    pill:  { card: '22px', btn: '999px', input: '999px' }
  };
  const FONT_PRESETS = {
    '': null,
    mono: '"JetBrains Mono", ui-monospace, monospace',
    system: 'system-ui, -apple-system, "Segoe UI", sans-serif',
    rounded: '"Segoe UI Variable", "Nunito", system-ui, sans-serif'
  };

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
    const bg = BG_PRESETS[s.bgColor] || null;
    if (bg) {
      root.style.setProperty('--bg', bg.bg);
      root.style.setProperty('--bg-2', bg.bg2);
      root.style.setProperty('--card', bg.card);
    } else {
      root.style.removeProperty('--bg');
      root.style.removeProperty('--bg-2');
      root.style.removeProperty('--card');
    }
    const rad = RADIUS_PRESETS[s.radius] || null;
    if (rad) {
      root.style.setProperty('--r-card', rad.card);
      root.style.setProperty('--r-btn', rad.btn);
      root.style.setProperty('--r-input', rad.input);
    } else {
      root.style.removeProperty('--r-card');
      root.style.removeProperty('--r-btn');
      root.style.removeProperty('--r-input');
    }
    const fam = FONT_PRESETS[s.fontFamily] || null;
    if (fam) root.style.setProperty('--font', fam);
    else root.style.removeProperty('--font');
    root.style.setProperty('--anim-speed', `${(0.24 * (1.5 - s.animationIntensity) + 0.05).toFixed(2)}s`);
    document.body.classList.toggle('veyro-demo', !!s.demoMode);
    const prem = !!(window.Veyro && Veyro.License && Veyro.License.isPremium());
    document.body.classList.toggle('veyro-aurora', !!s.auroraTheme && prem);
  }

  return {
    load, save, get, set, setSettings
  };
})();