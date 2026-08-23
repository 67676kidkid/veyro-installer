/* ============================================================
   Veyro router — sidebar, top bar, page switching.
   ============================================================ */
console.log('[router.js] loading...');
Veyro.Router = (() => {
  'use strict';

  const { el, esc, icon } = Veyro;
  const U = Veyro.UI;

  const NAV = [
    { id: 'dashboard', label: 'Dashboard', icon: 'dash' },
    { id: 'optimize', label: 'Optimize', icon: 'bolt' },
    { id: 'optcenter', label: 'Optimization Center', icon: 'spark' },
    { id: 'performance', label: 'Performance', icon: 'clock' },
    { id: 'hardware', label: 'Hardware', icon: 'cpu' },
    { id: 'upgrades', label: 'Upgrades', icon: 'up' },
    { id: 'games', label: 'Games', icon: 'game' },
    { id: 'health', label: 'Health', icon: 'heart' },
    { id: 'tips', label: 'Tips', icon: 'bulb' },
    { id: 'tools', label: 'Power Tools', icon: 'wrench' },
    { id: 'finder', label: 'Our Website', icon: 'find' },
    { id: 'fpscalc', label: 'FPS Calculator', icon: 'bolt' }
  ];

  const TITLES = {
    dashboard: 'Dashboard',
    optimize: 'PC Optimization',
    optcenter: 'Optimization Center',
    performance: 'Live Performance',
    hardware: 'Hardware',
    upgrades: 'Upgrades',
    games: 'Game Performance',
    health: 'PC Health',
    tips: 'PC Tips',
    tools: 'Power Tools',
    finder: 'Our Website',
    fpscalc: 'FPS Calculator',
    settings: 'Settings',
    driver: 'Driver Check',
    report: 'System Report'
  };

  const PREMIUM_NAV = [
    { id: 'driver', label: 'Driver Check', icon: 'shield' },
    { id: 'report', label: 'System Report', icon: 'copy' }
  ];

  let currentPage = null;
  let currentId = 'dashboard';
  let routeState = null;

  /* ---------------- sidebar ---------------- */

  function buildSidebar() {
    const sb = Veyro.$('#sidebar');
    sb.innerHTML = '';

    /* brand */
    const brand = el('div', 'brand');
    const mark = el('div', 'brand-mark');
    mark.innerHTML = icon('v', 22);
    const names = el('div');
    names.appendChild(el('div', 'brand-name', 'Veyro'));
    names.appendChild(el('div', 'brand-sub', 'PC PERFORMANCE'));
    brand.appendChild(mark); brand.appendChild(names);
    sb.appendChild(brand);

    /* nav */
    const nav = el('div', 'nav');
    nav.appendChild(el('div', 'nav-label', 'OPTIMIZE'));
    NAV.forEach(n => {
      const item = el('div', 'nav-item');
      item.dataset.page = n.id;
      const ic = el('span', 'ic-16');
      ic.innerHTML = icon(n.icon, 16);
      item.appendChild(ic);
      item.appendChild(el('span', undefined, esc(n.label)));
      item.addEventListener('click', () => go(n.id));
      nav.appendChild(item);
    });
    nav.appendChild(el('div', 'nav-sep'));
    const setItem = el('div', 'nav-item');
    setItem.dataset.page = 'settings';
    const sic = el('span', 'ic-16');
    sic.innerHTML = icon('gear', 16);
    setItem.appendChild(sic);
    setItem.appendChild(el('span', undefined, 'Settings'));
    setItem.addEventListener('click', () => go('settings'));
    nav.appendChild(setItem);
    sb.appendChild(nav);

    /* premium section — only when premium is active */
    if (Veyro.License.isPremium()) {
      const nav2 = el('div', 'nav');
      const lbl = el('div', 'nav-label nav-label-premium', 'PREMIUM');
      lbl.innerHTML = 'PREMIUM';
      nav2.appendChild(lbl);
      PREMIUM_NAV.forEach(n => {
        const item = el('div', 'nav-item nav-item-premium');
        item.dataset.page = n.id;
        const ic = el('span', 'ic-16');
        ic.innerHTML = icon(n.icon, 16);
        item.appendChild(ic);
        item.appendChild(el('span', undefined, esc(n.label)));
        const star = el('span', 'nav-premium-star');
        star.textContent = '★';
        item.appendChild(star);
        item.addEventListener('click', () => go(n.id));
        nav2.appendChild(item);
      });
      sb.appendChild(nav2);
    }

    /* status */
    const status = el('div', 'side-status', null);
    status.appendChild(el('div', 'dot'));
    status.appendChild(el('span', undefined, esc(Veyro.isDemo() ? 'DEMO MODE' : 'PC CONNECTED')));
    if (Veyro.isDemo()) {
      status.appendChild(el('div', 'chip-demo', 'DEMO'));
    }
    sb.appendChild(status);
  }

  /* ---------------- top bar ---------------- */

  function buildTopBar() {
    const tb = Veyro.$('#topbar');
    tb.innerHTML = '';
    const title = el('div', 'top-title', esc(TITLES[currentId] || 'Veyro'));
    tb.appendChild(title);

    const right = el('div', 'top-right');
    right.appendChild(el('div', 'conn',
      `<div class="dot"></div><span>${esc(Veyro.isDemo() ? 'DEMO MODE' : 'PC CONNECTED')}</span>`));

    /* discord — join the server where keys are sold */
    const dBtn = el('button', 'icon-btn');
    dBtn.type = 'button';
    dBtn.title = 'Join our Discord';
    dBtn.innerHTML = icon('discord', 16);
    dBtn.addEventListener('click', () => Veyro.open(Veyro.DISCORD));
    right.appendChild(dBtn);

    /* notifications */
    const nBtn = el('button', 'icon-btn has-badge');
    nBtn.type = 'button';
    nBtn.title = 'Notifications';
    nBtn.innerHTML = icon('bell', 16);
    const pop = el('div', 'alerts-pop');
    pop.innerHTML = `<div class="alerts-head">ALERTS · ${new Date().toLocaleDateString()}</div><div class="alerts-list"></div>`;
    right.appendChild(nBtn);
    right.appendChild(pop);
    nBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = pop.classList.toggle('open');
      if (open) refreshAlerts(pop);
    });
    document.addEventListener('click', () => pop.classList.remove('open'));

    /* settings + profile */
    const sBtn = el('button', 'icon-btn');
    sBtn.type = 'button';
    sBtn.title = 'Settings';
    sBtn.innerHTML = icon('gear', 16);
    sBtn.addEventListener('click', () => go('settings'));
    right.appendChild(sBtn);

    const pBtn = el('button', 'icon-btn');
    pBtn.type = 'button';
    pBtn.title = 'Profile';
    pBtn.innerHTML = icon('user', 16);
    pBtn.addEventListener('click', () => { Veyro.toast('Veyro account', 'Profiles arrive in a later update.', 'warn'); });
    right.appendChild(pBtn);

    tb.appendChild(right);
  }

  function refreshAlerts(pop) {
    const list = pop.querySelector('.alerts-list');
    if (!list) return;
    Veyro.HardwareAgent.getSnapshot()
      .then(snap => {
        list.innerHTML = '';
        const alerts = Veyro.Health.alerts(snap);
        if (Veyro.Store.get().settings.notifications === false) {
          list.appendChild(el('div', 'meta', 'Notifications are disabled in Settings.'));
          return;
        }
        alerts.slice(0, 6).forEach(a => {
          const row = el('div', 'alert-item');
          const d = el('div', 'a-dot ' + (a.severity === 'crit' ? 'a-crit' : a.severity === 'warn' ? 'a-warn' : 'a-good'));
          const t = el('div');
          t.appendChild(el('div', 'a-txt', esc(a.title)));
          t.appendChild(el('div', 'a-sub', esc(a.body)));
          row.appendChild(d); row.appendChild(t);
          list.appendChild(row);
        });
      })
      .catch(() => {
        list.appendChild(el('div', 'meta', 'Hardware agent unavailable.'));
      });
  }

  /* ---------------- navigation ---------------- */

  function go(id, state) {
    if (!NAV.find(n => n.id === id) && !PREMIUM_NAV.find(n => n.id === id) && id !== 'settings') return;
    if (PREMIUM_NAV.find(n => n.id === id) && !Veyro.License.isPremium()) {
      return go('settings');
    }
    routeState = state || null;

    currentId = id;
    currentPage && currentPage.destroy && currentPage.destroy();

    /* nav highlighting */
    Veyro.$$('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.page === id));

    const content = Veyro.$('#content');
    content.innerHTML = '';
    currentPage = render(id, content);
    buildTopBar();
    content.scrollTop = 0;
  }

  function render(id, container) {
    switch (id) {
      case 'dashboard': return Veyro.Pages.dashboard(container);
      case 'optimize': return Veyro.Pages.optimize(container);
      case 'optcenter': return Veyro.Pages.optcenter(container);
      case 'performance': return Veyro.Pages.performance(container);
      case 'hardware': return Veyro.Pages.hardware(container);
      case 'upgrades': return Veyro.Pages.upgrades(container);
      case 'games':
        return routeState && routeState.game
          ? Veyro.Pages.gameDetail(routeState.game, container)
          : Veyro.Pages.games(container);
      case 'health': return Veyro.Pages.health(container);
      case 'tips': return Veyro.Pages.tips(container);
      case 'tools': return Veyro.Pages.tools(container);
      case 'finder': return Veyro.Pages.finder(container);
      case 'fpscalc': return Veyro.Pages.fpscalc(container);
      case 'settings': return Veyro.Pages.settings(container);
      case 'driver': return Veyro.Pages.driver(container);
      case 'report': return Veyro.Pages.report(container);
      default: return Veyro.Pages.dashboard(container);
    }
  }

  function refreshTopBar() { buildTopBar(); }

  /* license changed (activated/expired) → rebuild sidebar + bounce off premium pages */
  document.addEventListener('veyro:license', () => {
    buildSidebar();
    if (PREMIUM_NAV.find(n => n.id === currentId) && !Veyro.License.isPremium()) {
      go('dashboard');
    }
  });

  function current() { return currentId; }

  return { go, buildSidebar, buildTopBar, refreshTopBar, current };
})();