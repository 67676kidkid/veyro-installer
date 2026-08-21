/* ============================================================
   Veyro bootstrap — startup sequence.
   ============================================================ */
(function () {
  'use strict';

  /* store first (applies theme + demo body class) */
  Veyro.Store.load();

  /* applied-state persistence (optimizations stay applied across restarts) */
  Veyro.Prefs.load();

  /* license (premium grant) + account session restore */
  Veyro.Account.boot();
  Veyro.License.refresh();
  setInterval(() => {
    Veyro.License.refresh();
    Veyro.License.verifyServer();
    if (Veyro.Account.state().token) Veyro.Account.me();
  }, 20000);

  /* build chrome */
  Veyro.Router.buildSidebar();
  Veyro.Router.buildTopBar();

  /* start live performance sampling */
  Veyro.Performance.start();

  /* deep links from outside (veyro://finder etc.) */
  if (window.veyroAgent && typeof window.veyroAgent.onNav === 'function') {
    window.veyroAgent.onNav((page) => {
      if (page && Veyro.Router && Veyro.Router.go) {
        Veyro.Router.go(page);
        Veyro.toast('Opened from link', page === 'finder' ? 'Our Website loaded from VeyronFinderAi.' : 'Veyro opened for you.', 'warn');
      }
    });
  }

  /* first start experience */
  if (!Veyro.Store.get('onboarded')) {
    Veyro.Pages.welcome(() => {
      Veyro.Router.go('dashboard');
    });
  } else {
    Veyro.Router.go('dashboard');
  }

  /* ---- auto-scan: every launch + again when premium activates ---- */
  function autoScanNow(prefix) {
    if (!Veyro.Store.get().settings.autoScan) return;
    Veyro.HardwareAgent.getSnapshot()
      .then(snap => {
        if (!snap || !snap.cpu) return;
        const alerts = Veyro.Health.alerts(snap);
        const crits = alerts.filter(a => a.severity === 'crit');
        const warns = alerts.filter(a => a.severity === 'warn');
        if (Veyro.Store.get().settings.notifications) {
          if (crits.length) Veyro.toast('PC health scan', crits[0].title, 'error');
          else if (warns.length) Veyro.toast('PC health scan', warns[0].title, 'warn');
          else Veyro.toast('PC health scan', prefix + 'all clear.', 'good');
        }
        try { localStorage.setItem('veyro.lastScan', JSON.stringify({ at: Date.now(), crits: crits.length, warns: warns.length })); } catch (e) {}
      })
      .catch(() => { /* agent busy — scan happens on the Health page too */ });
  }

  /* every launch (after first onboarding) */
  setTimeout(() => autoScanNow('Launch scan: '), 2500);

  /* re-scan the moment a user upgrades to premium */
  document.addEventListener('veyro:license', (e) => {
    if (e.detail === 'premium') autoScanNow('Premium active — ');
  });
})();