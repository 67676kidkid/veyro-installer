/* ============================================================
   Veyro pages — renderer for every screen.
   Each page returns { destroy } so timers/listeners can be
   cleaned up when navigating away.
   ============================================================ */
console.log('[pages.js] loading...');
Veyro.Pages = (() => {
  'use strict';

  const { el, esc, icon } = Veyro;
  const U = Veyro.UI;

  /* ---------- helpers ---------- */

function snapshotOrError(container, render, retry) {
    const ph = el('div', 'meta');
    ph.style.textAlign = 'center';
    ph.style.padding = '40px 0';
    ph.innerHTML = '<span class="s-spin" style="display:inline-flex;vertical-align:-3px;margin-right:8px">' + icon('scan', 14) + '</span>Loading hardware data…';
    container.appendChild(ph);
    return Veyro.HardwareAgent.getSnapshot()
      .then(snap => {
        ph.remove();
        container.appendChild(render(snap));
      })
      .catch(err => {
        ph.remove();
        container.appendChild(U.errorState(
          err.message || 'Unable to access hardware information.',
          'The hardware agent could not read this system. If Demo Mode is off, connect the native agent and retry.',
          retry
        ));
        if (!Veyro.isDemo()) {
          const row = el('div', 'row mt-12');
          row.style.justifyContent = 'center';
          row.appendChild(el('div', 'meta', 'or use demo hardware data for preview &nbsp;'));
          const demoBtn = U.btn('ENABLE DEMO MODE', false, { sm: true, onClick: () => {
            Veyro.Store.setSettings({ demoMode: true });
            Veyro.HardwareAgent.reconnect();
            retry && retry();
          } });
          row.appendChild(demoBtn);
          container.appendChild(row);
        }
      });
  }

  function scrollTop() { Veyro.$('#content').scrollTop = 0; }

  function demoBanner() {
    if (!Veyro.isDemo()) return null;
    const b = U.demoCallout('Demo hardware data \u2014 not your real PC');
    const wrap = el('div');
    wrap.style.marginBottom = '14px';
    wrap.appendChild(b);
    return wrap;
  }

  function hwBar(label, pct, toneId) {
    const row = el('div');
    row.appendChild(el('div', 'row-between mb-8'));
    const l = el('span', 'meta', esc(label));
    const v = el('span', 'num', String(Math.round(pct)) + '%');
    v.style.fontSize = '11px';
    row.innerHTML = '';
    const b = U.bar(pct, toneId);
    const inner = el('div');
    inner.style.display = 'flex'; inner.style.justifyContent = 'space-between'; inner.style.marginBottom = '4px';
    inner.appendChild(l); inner.appendChild(v);
    row.appendChild(inner); row.appendChild(b);
    return row;
  }

  function hwMiniCard(tag, name, temp, usage, iconName, big) {
    const c = U.card('hw-card card-hover' + (big ? ' ' : ''));
    if (big) { c.style.gridColumn = 'span 2'; }
    const top = el('div', 'hw-top');
    const ic = el('span', 'ic-18 text-accent');
    ic.innerHTML = icon(iconName, 18);
    const t = el('div');
    t.appendChild(el('div', 'hw-tag', esc(tag)));
    t.appendChild(el('div', 'hw-name', esc(name)));
    top.appendChild(ic); top.appendChild(t);
    c.appendChild(top);
    const vals = el('div', 'row');
    vals.style.gap = '16px';
const tempDiv = el('div');
    tempDiv.appendChild(el('div', 'meta', 'TEMP'));
    tempDiv.appendChild(el('div', 'num text-lg', temp === null || temp === undefined ? '\u2014' : Math.round(temp) + '\u00B0C'));
    const useDiv = el('div');
    useDiv.appendChild(el('div', 'meta', 'USAGE'));
    useDiv.appendChild(el('div', 'num text-lg', usage === null || usage === undefined ? '\u2014' : Math.round(usage) + '%'));
    vals.appendChild(tempDiv); vals.appendChild(useDiv);
    c.appendChild(vals);
    return c;
  }

  /* ============================================================
     DASHBOARD
     ============================================================ */
  function dashboard(container) {
    const c = el('div', 'page-anim');
    container.appendChild(c);

    snapshotOrError(c, (snap) => {
      const root = el('div', 'page-anim');
      const b = demoBanner(); if (b) root.appendChild(b);

      const warn = el('div', 'eyebrow', 'GOOD EVENING');
      const h1 = el('h1', 'h-page', 'Welcome to Veyro — my first change!');
      const gpuShort = (snap.gpu.model || '').split(' ').slice(0, 2).join(' ') || 'GPU';
const pcName = el('div', 'sub-page',
        esc(snap.pc.name) + ' · ' + esc(Veyro.av(snap.cpu.model)) + ' · ' + esc(gpuShort));
      root.appendChild(warn); root.appendChild(h1); root.appendChild(pcName);

      const licRow = el('div', 'row mt-8');
      licRow.style.gap = '8px';
      licRow.style.flexWrap = 'wrap';
      const lc = U.chip(Veyro.License.isPremium() ? 'PREMIUM · ' + Veyro.License.untilText().toUpperCase() : 'FREE PLAN', Veyro.License.isPremium() ? 'green' : 'yellow');
      lc.style.cursor = 'pointer';
      lc.title = Veyro.License.isPremium() ? 'Premium active — manage in Settings' : 'Upgrade — manage in Settings';
      lc.addEventListener('click', () => Veyro.Router.go('settings'));
      licRow.appendChild(lc);
      if (snap.os && snap.os.uptimeHours != null) {
        licRow.appendChild(U.chip('UPTIME ' + Math.round(snap.os.uptimeHours) + 'h', 'gray'));
      }
      root.appendChild(licRow);

      const disk0 = snap.storage[0] || {};
      const dTot = disk0.total, dUsed = disk0.used;
      const diskUse = dTot ? dUsed / dTot * 100 : null;
      const ramPct = snap.ram.total ? snap.ram.used / snap.ram.total * 100 : null;

      /* ---- Veyro SCORE ---- */
      const perf = 84, opt = Veyro.Optimizer.ocScore(), gam = 81, heal = Veyro.Health.score(snap);
      const overall = 87;
      const scoreCard = U.card('mt-16');
      scoreCard.style.padding = '20px 24px';
      const scoreRow = el('div', 'row');
      const ringBox = U.ring(overall, 128);
      const mid = el('div', 'col', null);
      mid.style.flex = '1'; mid.style.minWidth = '220px';
      mid.appendChild(U.scoreRow('Performance', perf));
      mid.appendChild(U.scoreRow('Optimization', opt));
      mid.appendChild(U.scoreRow('Gaming', gam));
      mid.appendChild(U.scoreRow('Health', heal));
      const right = el('div', 'col');
      right.style.flex = '1'; right.style.minWidth = '250px';
      right.appendChild(el('div', 'font-bold', 'Your PC is performing well.'));
      const bn2 = Veyro.Upgrades.bottleneck(snap);
      const dTot2 = disk0.total, dUsed2 = disk0.used;
      const fullness2 = (dTot2 && dUsed2 != null) ? dUsed2 / dTot2 : null;
      const oList = Veyro.Optimizer.build(snap);
      const attention = oList.filter(o => !o.applied && (o.status === 'warn' || o.status === 'crit')).length;
      const recs = [
        { t: (bn2.kind === 'GPU' ? 'GPU' : 'CPU') + ' is your biggest upgrade opportunity', tone: 'chip-green' },
        { t: fullness2 !== null ? 'Storage is ' + Math.round(fullness2 * 100) + '% used' : 'Storage usage unknown', tone: fullness2 !== null && fullness2 > 0.8 ? 'chip-yellow' : 'chip-green' },
        { t: attention > 0 ? attention + ' optimization items need attention' : 'No optimization items need attention', tone: attention > 0 ? 'chip-yellow' : 'chip-green' }
      ];
      recs.forEach(r => {
        const ch = U.chip(r.t, r.tone.split('-')[1]);
        right.appendChild(ch);
      });
scoreRow.appendChild(ringBox); scoreRow.appendChild(mid); scoreRow.appendChild(right);
      scoreCard.appendChild(scoreRow);
      root.appendChild(scoreCard);

      /* ---- PREMIUM SUMMARY (premium only) ---- */
      if (Veyro.License.isPremium()) {
        const pre = U.card('mt-16');
        pre.style.padding = '16px 20px';
        const pRow = el('div', 'row');
        const pIc = el('span', 'ic-24 text-accent');
        pIc.innerHTML = icon('spark', 24);
        const pT = el('div', 'col');
        pT.style.gap = '2px';
        const nT = Veyro.Prefs ? Veyro.Prefs.listApplied().length : 0;
        pT.appendChild(el('div', 'font-bold text-sm', 'PREMIUM · ' + Veyro.License.untilText().toUpperCase()));
        pT.appendChild(el('div', 'meta', nT + ' optimization tweak(s) active · ' + Veyro.Games.all().length + ' game profiles · Driver Check & System Report unlocked.'));
        pRow.appendChild(pIc); pRow.appendChild(pT);
        pRow.appendChild(el('div', 'flex-1'));
        pRow.appendChild(U.btn('OPTIMIZATION CENTER', true, { sm: true, arrow: true, onClick: () => Veyro.Router.go('optcenter') }));
        pRow.appendChild(U.btn('MANAGE', false, { sm: true, onClick: () => Veyro.Router.go('settings') }));
        pre.appendChild(pRow);
        root.appendChild(pre);
      }

      /* ---- QUICK ACTIONS ---- */
      const qa = el('div', 'grid g-4 mt-16');
      const actions = [
        { k: 'optimize', t: 'OPTIMIZE', d: 'Find safe performance improvements.', ic: 'bolt' },
        { k: 'upgrades', t: 'UPGRADE', d: 'Find the upgrade that matters most.', ic: 'up' },
        { k: 'games', t: 'GAME BOOST', d: 'Optimize your games.', ic: 'game' },
        { k: 'health', t: 'HEALTH', d: 'Check your PC health.', ic: 'heart' }
      ];
      actions.forEach(a => {
        const card = U.card('card-hover');
        card.style.padding = '14px 16px';
        card.style.cursor = 'pointer';
        card.addEventListener('click', () => Veyro.Router.go(a.k));
        const head = el('div', 'row', null);
        const ic = el('span', 'ic-16 text-accent');
        ic.innerHTML = icon(a.ic, 16);
        const t = el('span', 'font-bold', a.t);
        t.style.fontSize = '12px'; t.style.letterSpacing = '.08em';
        const arr = el('span', 'text-accent', '');
        arr.style.marginLeft = 'auto';
        arr.innerHTML = icon('arrow', 14);
        head.appendChild(ic); head.appendChild(t); head.appendChild(arr);
        card.appendChild(head);
        card.appendChild(el('div', 'meta mt-8', a.d));
        qa.appendChild(card);
      });
      root.appendChild(qa);

/* ---- HARDWARE OVERVIEW ---- */
      root.appendChild(U.secHead('HARDWARE OVERVIEW'));
      const hg = el('div', 'grid g-3 mt-12');
      hg.appendChild(hwMiniCard('CPU', Veyro.av(snap.cpu.model), null, null, 'cpu'));
      hg.appendChild(hwMiniCard('GPU', Veyro.av(snap.gpu.model), null, null, 'gpu', true));
      hg.appendChild(hwMiniCard('RAM', (snap.ram.total ? Veyro.fmt.gb(snap.ram.total / 1024) : 'Unavailable') + (snap.ram.type ? ' ' + snap.ram.type : ''), null, null, 'ram'));
      hg.appendChild(hwMiniCard('STORAGE', Veyro.av(disk0.model), null, null, 'disk'));
      root.appendChild(hg);

/* ---- BOTTLENECK ---- */
      const bn = Veyro.Upgrades.bottleneck(snap);
      root.appendChild(U.secHead('PERFORMANCE BOTTLENECK'));
      const bc = U.card('mt-12');
      bc.style.padding = '18px 20px';
      const brow = el('div', 'row');
      const bic = el('span', 'ic-24 text-accent');
      bic.innerHTML = icon(bn.kind === 'CPU' ? 'cpu' : 'gpu', 24);
      const bt = el('div', 'col', null);
      bt.style.gap = '2px';
      bt.appendChild(el('div', 'font-bold text-sm', `${bn.kind} is your biggest bottleneck.`));
      bt.appendChild(el('div', 'meta', bn.kind === 'GPU'
        ? 'Your graphics card is currently limiting gaming performance.'
        : 'Your processor is currently limiting gaming performance.'));
      brow.appendChild(bic); brow.appendChild(bt);
      brow.appendChild(el('div', 'flex-1'));
      brow.appendChild(U.btn('VIEW UPGRADE', true, { arrow: true, onClick: () => Veyro.Router.go('upgrades') }));
      bc.appendChild(brow);
      root.appendChild(bc);

      return root;
    }, () => Veyro.Router.go('dashboard'));

    return { destroy() { c.innerHTML = ''; } };
  }

  /* ============================================================
     OPTIMIZE
     ============================================================ */
  function scanOverlay(container, steps, onDone, onCancel) {
    const overlay = Veyro.$('#scan-overlay');
    const fill = Veyro.$('#scan-progress-fill');
    const pctEl = Veyro.$('#scan-progress-text');
    const stepsEl = Veyro.$('#scan-steps');
    overlay.classList.remove('hidden');
    stepsEl.innerHTML = '';
    steps.forEach(s => {
      const row = el('div', 'scan-step');
      row.innerHTML = `<span class="s-ic"></span><span>${esc(s)}</span>`;
      stepsEl.appendChild(row);
    });
    let i = 0;
    const all = Veyro.$$('.scan-step', stepsEl);
    function tick() {
      if (i > 0) all[i - 1].classList.add('done');
      if (i < all.length) {
        all[i].classList.add('on');
        all[i].querySelector('.s-ic').innerHTML = '<span class="s-spin">' + icon('scan', 14) + '</span>';
      }
    }
    tick();
    const iv = setInterval(() => {
      i++;
      const pct = Math.min(100, Math.round((i / steps.length) * 100));
      fill.style.width = pct + '%';
      pctEl.textContent = pct + '%';
      if (i >= all.length) {
        clearInterval(iv);
        Veyro.$$('.scan-step', stepsEl).forEach(r => { r.classList.remove('on'); r.classList.add('done'); r.querySelector('.s-ic').innerHTML = icon('check', 14); });
        setTimeout(() => {
          overlay.classList.add('hidden');
          onDone();
        }, 550);
      } else {
        tick();
      }
    }, 620);
    /* allow early finish for very long scans \u2014 progress never stalls */
    return () => { clearInterval(iv); overlay.classList.add('hidden'); };
  }

  function optimize(container) {
    const c = el('div', 'page-anim');
    container.appendChild(c);
    const head = el('div', undefined);
    head.appendChild(el('div', 'eyebrow', 'PC OPTIMIZATION'));
    head.appendChild(el('h1', 'h-page', 'Find safe ways to improve your PC.'));
const bar = el('div', 'sub-page');
    bar.style.marginBottom = '18px';
    bar.style.display = 'flex';
    bar.style.gap = '8px';
    bar.style.alignItems = 'center';
    bar.appendChild(U.btn('SCAN MY PC', true, { ic: 'scan', arrow: true, onClick: runScan }));
    const boostBtn = U.btn('BOOST', false, { ic: 'bolt', arrow: true, onClick: runBoost });
    bar.appendChild(boostBtn);
    head.appendChild(bar);
    c.appendChild(head);

    let opts = [];
    let filter = 'All';

    function runScan() {
      scanOverlay(c, [
        'Checking startup programs...',
        'Checking background processes...',
        'Checking storage...',
        'Checking Windows settings...',
        'Checking power settings...',
        'Checking gaming configuration...'
      ], () => {
        Veyro.HardwareAgent.getSnapshot()
          .then(snap => {
            opts = Veyro.Optimizer.build(snap);
            Veyro.Store.set('scanCompleted', true);
            renderResults();
            Veyro.Router.refreshTopBar();
          })
          .catch(() => {
            Veyro.$$('.scan-results', c).forEach(n => n.remove());
            c.appendChild(U.errorState(
              'Scan incomplete',
              'The hardware agent could not read this system.',
              runScan
            ));
            if (!Veyro.isDemo()) {
              const row = el('div', 'row mt-12');
              row.style.justifyContent = 'center';
              const demoBtn = U.btn('ENABLE DEMO MODE', false, { sm: true, onClick: () => {
                Veyro.Store.setSettings({ demoMode: true });
                Veyro.HardwareAgent.reconnect();
                runScan();
              } });
              row.appendChild(demoBtn);
              c.appendChild(row);
            }
          });
      });
    }

    function runBoost() {
      if (!Veyro.License.isPremium()) {
        Veyro.toast('One-Click Boost is premium', 'Activate premium to apply every safe improvement at once.', 'warn');
        Veyro.Router.go('settings');
        return;
      }
      if (!opts.length) {
        Veyro.toast('One-Click Boost', 'Run a scan first, then boost.', 'warn');
        return;
      }
      const todo = opts.filter(o => !o.applied && o.risk !== 'HIGH');
      if (!todo.length) {
        Veyro.toast('One-Click Boost', 'Everything safe is already applied.', 'good');
        return;
      }
      boostBtn.disabled = true;
      const label = 'BOOST ' + todo.length + ' ITEMS';
      boostBtn.textContent = label;
      (async () => {
        let n = 0;
        for (const o of todo) {
          await Veyro.Optimizer.applyAuto(o);
          n++;
          boostBtn.textContent = label + ' · ' + n + '/' + todo.length;
        }
        boostBtn.disabled = false;
        boostBtn.textContent = 'BOOST';
        Veyro.toast('Boost complete', n + ' optimization(s) applied.', 'good');
        renderResults();
        Veyro.Router.refreshTopBar();
      })();
    }

function renderResults() {
      Veyro.$$('.scan-results', c).forEach(n => n.remove());
      const out = el('div', 'scan-results mt-16');
      const stats = el('div', 'row');
      const good = opts.filter(o => !o.applied && o.status === 'good').length;
      const warnN = opts.filter(o => !o.applied && o.status === 'warn').length;
      const crit = opts.filter(o => !o.applied && o.status === 'crit').length;
      stats.appendChild(U.chip(`GOOD ${good}`, 'green'));
      stats.appendChild(U.chip(`CAN IMPROVE ${warnN}`, 'yellow'));
      stats.appendChild(U.chip(`NEEDS ATTENTION ${crit}`, 'red'));
      out.appendChild(U.secHead('OPTIMIZATION RESULTS', stats));

      const categories = ['All'].concat(Veyro.Optimizer.CATEGORIES);
      const tabGroup = U.tabGroup({
        tabs: categories.map((cat, idx) => ({
          id: cat.toLowerCase(),
          label: cat,
          icon: idx === 0 ? 'dash' : cat === 'Performance' ? 'bolt' : cat === 'Startup' ? 'power' : cat === 'Storage' ? 'disk' : cat === 'Windows' ? 'gear' : cat === 'Gaming' ? 'game' : 'net',
          groups: [{ id: cat.toLowerCase(), label: cat, content: (panel) => renderCategoryList(panel, cat) }]
        })),
        defaultTab: 0,
        onTabChange: (tabId) => { filter = tabId === 'all' ? 'All' : tabId.charAt(0).toUpperCase() + tabId.slice(1); }
      });
      out.appendChild(tabGroup.root);

      function renderCategoryList(panel, category) {
        const list = el('div', 'col');
        list.style.gap = '10px';
        const visible = opts.filter(o => category === 'All' || o.category === category);
        if (!visible.length) {
          list.appendChild(el('div', 'meta', 'Nothing to show in this category — good.'));
        }
        visible.forEach(o => {
          const row = el('div', 'result-row' + (o.applied ? ' applied' : ''));
          row.style.alignItems = 'center';
          const dot = el('div', 'r-dot ' + (o.status === 'crit' ? 'r-crit' : o.status === 'warn' ? 'r-warn' : 'r-good'));
          const body = el('div');
          body.style.flex = '1';
          const t = el('div', 'r-title', esc(o.title));
          t.appendChild(U.chip(o.risk, o.risk === 'HIGH' ? 'red' : o.risk === 'MEDIUM' ? 'yellow' : 'gray'));
          if (o.applied) {
            t.appendChild(U.chip('APPLIED', 'green'));
            const undoBtn = U.btn('', false, { cls: 'btn-sm', onClick: () => { Veyro.Optimizer.undo(o, null).then(renderResults); } });
            undoBtn.style.marginLeft = '8px';
            undoBtn.innerHTML = icon('undo', 13);
            undoBtn.title = 'Undo change';
            t.appendChild(undoBtn);
          }
          body.appendChild(t);
          body.appendChild(el('div', 'r-desc', esc(o.desc) + ' Why it matters: ' + esc(o.why)));
          const meta = el('div', 'r-meta');
          meta.appendChild(U.chip('RISK: ' + o.risk, o.risk === 'HIGH' ? 'red' : o.risk === 'MEDIUM' ? 'yellow' : 'gray'));
          meta.appendChild(U.chip('BENEFIT: ' + o.benefit.toUpperCase(), 'green'));
          body.appendChild(meta);
          row.appendChild(dot); row.appendChild(body);

          const acts = el('div', 'r-actions');
          if (!o.applied) {
            acts.appendChild(U.btn('SKIP', false, { sm: true, onClick: () => { Veyro.Optimizer.skip(o); renderResults(); } }));
            acts.appendChild(U.btn('APPLY', true, { sm: true, onClick: async () => {
              const res = await Veyro.Optimizer.apply(o);
              if (res.ok && !res.cancelled) {
                Veyro.toast('Optimization applied', o.benefit + '.', 'good');
                renderResults();
                Veyro.Router.refreshTopBar();
              }
            } }));
          } else {
            acts.appendChild(U.btn('UNDO', false, { sm: true, onClick: () => { Veyro.Optimizer.undo(o, null).then(renderResults); } }));
}
        row.appendChild(acts);
        list.appendChild(row);
      });
      panel.appendChild(list);
    }
    }

    if (Veyro.Store.get('scanCompleted')) {
      Veyro.HardwareAgent.getSnapshot().then(snap => {
        opts = Veyro.Optimizer.build(snap);
        renderResults();
      });
    }

    return { destroy() { c.innerHTML = ''; } };
  }

  /* ============================================================
     PERFORMANCE (live)
     ============================================================ */
  function performance(container) {
    const c = el('div', 'page-anim');
    container.appendChild(c);
    const head = el('div');
    head.appendChild(el('div', 'eyebrow', 'LIVE PERFORMANCE'));
    head.appendChild(el('h1', 'h-page', 'Live system monitoring.'));
head.appendChild(el('div', 'sub-page', 'Sampled every 2 seconds from the hardware agent.'));
    c.appendChild(head);

    if (Veyro.License.isPremium()) {
      const bar = el('div', 'row mt-12');
      bar.appendChild(U.btn('QUICK MEMORY CLEAN', false, { ic: 'ram', onClick: () => {
        try { Veyro.HardwareAgent.setOptimization('oc_ram_cleaner', true); } catch (e) { /* demo sim ok */ }
        Veyro.toast('Memory cleaner', 'Standby memory trimmed — RAM pressure reduced.', 'good');
      } }));
      c.appendChild(bar);
    }

    const b = demoBanner(); if (b) c.appendChild(b);

    /* metric tiles */
    const tiles = el('div', 'grid g-4 mt-16');
    const tileDefs = [
      { k: 'cpu', label: 'CPU', unit: '%' },
      { k: 'gpu', label: 'GPU', unit: '%' },
      { k: 'ram', label: 'RAM', unit: '%' },
      { k: 'fps', label: 'FPS', unit: '', lowerBetter: false }
    ];
    const tileEls = {};
    tileDefs.forEach(d => {
      const t = U.metricTile(d.label, '\u2014', 'AVG \u2014', 'PEAK \u2014');
      tiles.appendChild(t);
      tileEls[d.k] = t;
    });
    c.appendChild(tiles);

    function updateTiles() {
      tileDefs.forEach(d => {
        const m = Veyro.Performance.metrics(d.k, minutes);
        const t = tileEls[d.k];
        const fmt = (v) => v === null || v === undefined ? null : Math.round(v);
        const cur = fmt(m.cur), avg = fmt(m.avg), peak = fmt(m.peak);
        t.querySelector('.m-val').textContent = cur === null ? '\u2014' : cur + d.unit;
        const subs = t.querySelectorAll('.m-sub span');
        if (subs.length === 2) {
subs[0].textContent = 'AVG ' + (avg === null ? '\u2014' : avg + d.unit);
subs[1].textContent = 'PEAK ' + (peak === null ? '\u2014' : peak + d.unit);
        }
      });
    }

    /* chart */
    const chartCard = U.card('mt-16');
    chartCard.style.padding = '14px 16px';
    const chartHead = el('div', 'row-between mb-12');
    const metricSeg = U.segmented(['CPU', 'GPU', 'RAM', 'TEMP', 'FPS'], 'CPU', (m) => { metric = m; draw(); });
    const winSeg = U.segmented(['5 min', '15 min', '30 min'], '15 min', (w) => { minutes = parseInt(w); updateTiles(); draw(); });
    const left = el('div', 'row', null);
    left.appendChild(el('div', 'h-sec', 'HISTORY'));
    left.appendChild(metricSeg);
    chartHead.appendChild(left);
    chartHead.appendChild(winSeg);
    chartCard.appendChild(chartHead);
    const box = el('div', 'chart-box');
    const cnv = el('canvas', 'chart');
    box.appendChild(cnv);
    chartCard.appendChild(box);
    c.appendChild(chartCard);

    let metric = 'CPU';
    let minutes = 15;
    const keyOf = { CPU: 'cpu', GPU: 'gpu', RAM: 'ram', TEMP: 'temp', FPS: 'fps' };

    function draw() {
      const key = keyOf[metric];
      let last = null;
      const data = Veyro.Performance.series(minutes)
        .map(s => ({ t: s.t, v: s[key] !== null && s[key] !== undefined ? s[key] : last }))
        .filter(p => p.v !== null);
      data.forEach(p => { last = p.v; });
      Veyro.Charts.line(cnv, data, { unit: metric === 'TEMP' ? 'Â°C' : key === 'fps' ? ' fps' : '%' });
    }

    draw(); updateTiles();
    const unsub = Veyro.Performance.subscribe(() => { updateTiles(); draw(); });

    return { destroy() { unsub(); c.innerHTML = ''; } };
  }

  /* ============================================================
     HARDWARE
     ============================================================ */
  function hardware(container) {
    const c = el('div', 'page-anim');
    container.appendChild(c);
    const head = el('div', 'row-between');
    const l = el('div');
    l.appendChild(el('div', 'eyebrow', 'SYSTEM INFORMATION'));
    l.appendChild(el('h1', 'h-page', 'Your hardware.'));
    head.appendChild(l);
    const act = el('div', 'row');
    act.appendChild(U.btn('COPY SYSTEM INFORMATION', false, { ic: 'copy', onClick: copyInfo }));
    head.appendChild(act);
    c.appendChild(head);

function copyInfo() {
      Veyro.HardwareAgent.getSnapshot().then(snap => {
        const txt = Veyro.Report.build(snap);
        const ta = document.createElement('textarea');
        ta.value = txt;
        ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select();
        try { document.execCommand('copy'); Veyro.toast('System information copied', 'Paste it anywhere to share PC details.'); } catch (e) {}
        document.body.removeChild(ta);
      });
    }

    const wrap = el('div');
    c.appendChild(wrap);
    snapshotOrError(wrap, (snap) => {
      const root = el('div', 'page-anim');
      const b = demoBanner(); if (b) root.appendChild(b);
      root.appendChild(U.secHead('COMPONENTS'));
      const grid = el('div', 'grid g-2 mt-12');
      const av = Veyro.av;
      const rd = v => (v == null ? null : Math.round(v));
      const d0 = snap.storage[0] || {};
      const dTot = d0.total, dUsed = d0.used;
      const ramSticks = snap.ram.sticks;
      const rows = {
        CPU: [
          ['Manufacturer', av(snap.cpu.manufacturer)], ['Model', av(snap.cpu.model)],
          ['Base clock', av(snap.cpu.clock, '', Veyro.fmt.mhz)],
          ['Cores / threads', (snap.cpu.cores != null ? snap.cpu.cores : '?') + ' / ' + (snap.cpu.threads != null ? snap.cpu.threads : '?')],
          ['Temperature', av(snap.cpu.temp, 'Â°C', rd)], ['Usage', av(snap.cpu.usage, '%', rd)],
          ['TDP', av(snap.cpu.tdp, ' W')]
        ],
        GPU: [
          ['Manufacturer', av(snap.gpu.manufacturer)], ['Model', av(snap.gpu.model)],
          ['Memory', av(snap.gpu.vram ? Math.round(snap.gpu.vram / 1024) : null, ' GB VRAM')],
          ['Temperature', av(snap.gpu.temp, 'Â°C', rd)], ['Usage', av(snap.gpu.usage, '%', rd)],
          ['Driver version', av(snap.gpu.driver)], ['Driver date', av(snap.gpu.driverDate)]
        ],
        RAM: [
          ['Total memory', av(snap.ram.total ? Veyro.fmt.gb(snap.ram.total / 1024) : null)],
          ['In use', av(snap.ram.used != null ? Veyro.fmt.gb(snap.ram.used / 1024) : null)],
          ['Type', av(snap.ram.type)], ['Speed', av(snap.ram.speed, ' MT/s')],
          ['Sticks', ramSticks != null ? ramSticks + 'Ã—' + (snap.ram.total ? Veyro.fmt.gb(snap.ram.total / ramSticks / 1024) : ' ? GB') : 'Unavailable']
        ],
        'Motherboard': [
          ['Manufacturer', av(snap.motherboard.manufacturer)], ['Model', av(snap.motherboard.model)],
          ['BIOS version', av(snap.motherboard.bios)], ['BIOS date', av(snap.motherboard.biosDate)]
        ],
        'Storage': [
          ['Model', av(d0.model)],
          ['Total', dTot ? Veyro.fmt.tb(dTot) : 'Unavailable'],
          ['Used', dUsed != null ? Veyro.fmt.tb(dUsed) : 'Unavailable'],
          ['Free', (dTot && dUsed != null) ? Veyro.fmt.tb(dTot - dUsed) : 'Unavailable']
        ],
        'Network': [
          ['Adapter', av(snap.network.adapter)],
          ['Link speed', av(snap.network.download, ' Mbps')]
        ],
        'Operating System': [
          ['Name', av(snap.os.name)], ['Version', av(snap.os.version)], ['Build', av(snap.os.build)],
          ['Architecture', av(snap.os.arch)],
          ['Uptime', av(snap.os.uptimeHours, ' hours', Math.round)]
        ]
      };
      Object.keys(rows).forEach(section => {
        const card = U.card();
        card.style.padding = '14px 16px';
        card.appendChild(U.secHead(section));
        const dl = el('dl', 'kv mt-12');
        rows[section].forEach(r => {
          const dt = el('dt', undefined, esc(r[0]));
          const dd = el('dd', undefined, esc(r[1]));
          dl.appendChild(dt); dl.appendChild(dd);
        });
        card.appendChild(dl);
        grid.appendChild(card);
      });
      root.appendChild(grid);
      return root;
    }, () => Veyro.Router.go('hardware'));

    return { destroy() { c.innerHTML = ''; } };
  }

  /* ============================================================
     UPGRADES
     ============================================================ */
  function upgrades(container) {
    const c = el('div', 'page-anim');
    container.appendChild(c);
    const head = el('div');
    head.appendChild(el('div', 'eyebrow', 'HARDWARE ADVISOR'));
    head.appendChild(el('h1', 'h-page', 'What should you upgrade?'));
    c.appendChild(head);

    const wrap = el('div');
    c.appendChild(wrap);
    snapshotOrError(wrap, (snap) => {
      const root = el('div');
      const b = demoBanner(); if (b) root.appendChild(b);
      const bn = Veyro.Upgrades.bottleneck(snap);
      const main = Veyro.Upgrades.mainRecommendation(snap);

      /* ---- big recommendation ---- */
      const big = U.card('mt-16');
      big.style.padding = '20px 24px';
      const bigIn = el('div', 'row');
      const icBox = el('span', 'ic-24 text-accent');
      icBox.innerHTML = icon(bn.kind === 'GPU' ? 'gpu' : 'cpu', 24);
      const info = el('div', 'col');
      info.style.gap = '4px';
      info.appendChild(el('div', 'eyebrow', 'YOUR BIGGEST UPGRADE OPPORTUNITY'));
      if (main) {
        const cur = main.item.part === 'GPU' ? snap.gpu.model : snap.cpu.model;
        const src = el('div');
        src.appendChild(el('span', 'meta ls-wide', 'CURRENT &nbsp;'));
        src.appendChild(el('span', 'font-bold', esc(cur)));
        info.appendChild(src);
        const dst = el('div');
        dst.appendChild(el('span', 'meta ls-wide', 'RECOMMENDED &nbsp;'));
        dst.appendChild(el('span', 'font-bold text-accent', esc(main.item.name)));
        info.appendChild(dst);
        const imp = el('div');
        imp.appendChild(el('span', 'meta ls-wide', 'ESTIMATED IMPROVEMENT &nbsp;'));
        imp.appendChild(el('span', 'num text-lg', '+' + main.gain + '%'));
        info.appendChild(imp);
        info.appendChild(el('div', 'meta', esc(main.item.vram !== '\u2014' ? main.item.vram + ' VRAM \u00B7 ' : '') + main.item.power + ' \u00B7 ' + main.item.compat + '. ' +
          (bn.kind === 'GPU' ? 'Your GPU is currently the biggest limitation for gaming performance.' : 'Your CPU is currently the biggest limitation for gaming performance.')));
      }
      bigIn.appendChild(icBox); bigIn.appendChild(info);
      bigIn.appendChild(el('div', 'flex-1'));
      bigIn.appendChild(U.btn('VIEW RECOMMENDED UPGRADES', true, { arrow: true, onClick: () => {
        const elR = big.querySelector('.upg-grid'); if (elR) elR.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } }));
      big.appendChild(bigIn);
      root.appendChild(big);

      /* ---- three options ---- */
      const recs = Veyro.Upgrades.allRecommendations(snap);
      const tags = ['BEST VALUE', 'BEST PERFORMANCE', 'BEST BUDGET'];
      const bestValue = [...recs].sort((a, b) => b.item.value - a.item.value)[0];
      const bestPerf = [...recs].sort((a, b) => b.item.fps - a.item.fps)[0];
      const bestBud = [...recs].sort((a, b) => a.item.price - b.item.price)[0];
      const cards = [bestValue, bestPerf, bestBud];

      root.appendChild(U.secHead('RECOMMENDED UPGRADES'));
      const grid3 = el('div', 'grid g-3 mt-12 upg-grid');
      cards.forEach((r, i) => {
        const card = U.card('upg-card card-hover');
        card.appendChild(U.chip(tags[i], i === 1 ? 'green' : i === 0 ? 'yellow' : 'gray'));
        card.appendChild(el('div', 'u-tag text-muted', r.item.part));
        card.appendChild(el('div', 'u-name', esc(r.item.name)));
        card.appendChild(el('div', 'u-price', Veyro.fmt.eur(r.item.price)));
        card.appendChild(el('div', 'u-dim', `+${r.gain}% estimated gaming performance`));
        card.appendChild(el('div', 'u-dim', `${r.item.vram}${r.item.vram !== '\u2014' ? ' VRAM' : ''} \u00B7 ${r.item.power} \u00B7 ${r.item.compat}`));
        const val = el('div', 'u-value');
        val.appendChild(el('div', 'v-num', r.item.value.toFixed(1)));
        val.appendChild(el('div', 'v-out', '/10'));
        val.appendChild(el('span', 'meta', 'VALUE'));
        card.appendChild(val);
        card.appendChild(U.btn('VIEW DEAL', false, { sm: true, arrow: true, onClick: () => {
          Veyro.open('https://www.google.com/search?q=' + encodeURIComponent(r.item.name + ' price'));
        } }));
        grid3.appendChild(card);
      });
      root.appendChild(grid3);

      /* ---- budget planner ---- */
      root.appendChild(U.secHead('WHAT\'S YOUR UPGRADE BUDGET?', U.chip('PLANNER', 'green')));
      const bp = U.card('mt-12');
      bp.style.padding = '16px 20px';
      const bpRow = el('div', 'row');
      const input = el('input', 'field');
      input.type = 'number'; input.value = '300'; input.min = '50'; input.step = '10';
      input.style.width = '120px';
      const findBtn = U.btn('FIND MY UPGRADE', true, { arrow: true, onClick: () => planFromBudget() });
      const bpStatus = el('div', 'meta', '');
      bpRow.appendChild(input); bpRow.appendChild(findBtn); bpRow.appendChild(bpStatus);
      bp.appendChild(bpRow);
      const planOut = el('div', 'mt-12');
      bp.appendChild(planOut);
      root.appendChild(bp);

      function planFromBudget() {
        const budget = Math.max(1, parseInt(input.value, 10) || 0);
        const plan = Veyro.Upgrades.plan(budget, snap);
        planOut.innerHTML = '';
        if (!plan) {
          planOut.appendChild(el('div', 'meta', `No meaningful upgrade fits within â‚¬${budget}. Recommended minimum: â‚¬${bestBud.item.price}.`));
          return;
        }
        const pGrid = el('div', 'grid g-3');
        const defs = [
          ['BEST PERFORMANCE', plan.bestPerf], ['BEST VALUE', plan.bestValue], ['CHEAPEST GOOD OPTION', plan.cheapest]
        ];
        defs.forEach(([label, r]) => {
          const card = U.card('upg-card');
          card.appendChild(U.chip(label, 'green'));
          card.appendChild(el('div', 'u-tag text-muted', r.item.part));
          card.appendChild(el('div', 'u-name', esc(r.item.name)));
          card.appendChild(el('div', 'u-price', Veyro.fmt.eur(r.item.price)));
          card.appendChild(el('div', 'u-dim', `+${r.gain}% estimated Â· value ${r.item.value}/10`));
          card.appendChild(el('div', 'u-dim', r.item.compat));
          pGrid.appendChild(card);
        });
        planOut.appendChild(pGrid);
        bpStatus.textContent = `${plan.pool.length} options within â‚¬${budget}`;
      }

      /* ---- priority ---- */
      root.appendChild(U.secHead('UPGRADE PRIORITY'));
      const prio = el('div', 'col mt-12');
      prio.style.gap = '8px';
      const pList = Veyro.Upgrades.priority(snap);
      pList.forEach(p => {
        const row = el('div', 'prio-row');
        const num = el('div', 'prio-num');
        if (p.rank === 1) { num.style.background = 'rgba(57,255,136,.12)'; num.style.color = 'var(--accent)'; num.style.border = '1px solid rgba(57,255,136,.3)'; }
        else { num.style.background = 'var(--bg-2)'; num.style.color = 'var(--muted)'; num.style.border = '1px solid var(--border)'; }
        num.textContent = p.rank;
        const body = el('div', 'flex-1');
        const t = el('div', 'p-title', esc(p.part));
        t.appendChild(U.chip(p.level, p.level === 'HIGH' ? 'red' : p.level === 'MEDIUM' ? 'yellow' : 'gray'));
        body.appendChild(t);
        body.appendChild(el('div', 'p-why', esc(p.why)));
        row.appendChild(num); row.appendChild(body);
        prio.appendChild(row);
      });
      root.appendChild(prio);

      return root;
    }, () => Veyro.Router.go('upgrades'));

    return { destroy() { c.innerHTML = ''; } };
  }

/* ============================================================
     GAMES
     ============================================================ */
  function games(container) {
    const c = el('div', 'page-anim');
    container.appendChild(c);
    const head = el('div');
    head.appendChild(el('div', 'eyebrow', 'ESPORTS & AAA'));
    head.appendChild(el('h1', 'h-page', 'Game performance.'));
    head.appendChild(el('div', 'sub-page', 'FPS values are estimates based on your hardware.'));
    c.appendChild(head);
    const b = demoBanner(); if (b) c.appendChild(b);

    const search = el('input', 'field');
    search.type = 'text';
    search.placeholder = 'Search games…';
    search.style.width = '240px';
    search.style.height = '30px';
    search.style.fontSize = '12px';
    search.style.padding = '0 10px';
    search.style.marginTop = '12px';
    c.appendChild(search);

    const genres = ['All', ...Veyro.Games.genres()];
    const tabGroup = U.tabGroup({
      tabs: genres.map((genre, idx) => ({
        id: genre.toLowerCase().replace(/\s+/g, '-'),
        label: genre,
        icon: idx === 0 ? 'dash' : genre === 'Battle Royale' ? 'game' : genre === 'Tactical Shooter' ? 'crosshair' : genre === 'Open World' ? 'map' : genre === 'Sandbox' ? 'cube' : genre === 'Hero Shooter' ? 'user' : genre === 'Sports' ? 'trophy' : genre === 'Action RPG' ? 'sword' : genre === 'Racing' ? 'flag' : genre === 'MOBA' ? 'shield' : 'game',
        groups: [{ id: genre.toLowerCase().replace(/\s+/g, '-'), label: genre, content: (panel) => renderGenreGames(panel, genre) }]
      })),
      defaultTab: 0,
      onTabChange: () => {}
    });
    c.appendChild(tabGroup.root);

    function renderGenreGames(panel, genre) {
      panel.innerHTML = '';
      const q = search.value.trim().toLowerCase();

      const grid = el('div', 'grid g-4');
      grid.style.marginTop = '16px';
      panel.appendChild(grid);

      Veyro.HardwareAgent.getSnapshot().then(snap => {
        let games = Veyro.License.isPremium() ? Veyro.Games.all() : Veyro.Games.all().slice(0, 3);
        if (genre !== 'All') games = games.filter(g => g.genre === genre);
        if (q) games = games.filter(g => g.name.toLowerCase().includes(q));
        games = [...games].sort((a, z) => (Veyro.Prefs.isFavorite(z.id) ? 1 : 0) - (Veyro.Prefs.isFavorite(a.id) ? 1 : 0));
        games.forEach(g => {
          const est = Veyro.Upgrades.estimateFps(snap, g);
          const perfHi = Math.round(est.hi * 1.15);
          const hiLo = Math.round(est.hi * 0.7);
          const card = U.card('game-card card-hover');
          const head = el('div', 'row');
          const d = el('div', 'g-dot', esc(g.name[0]));
          const info = el('div');
          info.appendChild(el('div', 'g-name', esc(g.name)));
          info.appendChild(el('div', 'g-meta', g.res + ' · ' + g.settings.length + ' recommended settings'));
          head.appendChild(d); head.appendChild(info); head.appendChild(el('div', 'flex-1'));
          const fav = Veyro.Prefs.isFavorite(g.id);
          const starBtn = U.btn('', false, { sm: true, title: fav ? 'Remove from favorites' : 'Add to favorites' });
          starBtn.innerHTML = '';
          starBtn.appendChild(document.createTextNode('★'));
          starBtn.style.color = fav ? '#FFD54A' : 'var(--muted)';
          starBtn.style.fontSize = '13px';
          starBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            Veyro.Prefs.toggleFavorite(g.id);
            Veyro.toast(fav ? 'Removed from favorites' : 'Added to favorites', g.name + (fav ? ' unfavorited.' : ' pinned to the top.'), fav ? 'warn' : 'good');
            renderGenreGames(panel, genre);
          });
          head.appendChild(starBtn);
          card.appendChild(head);
          const pLine = el('div', 'g-meta', null);
          pLine.style.marginTop = '10px';
          pLine.innerHTML = `<span class="ls-wide" style="font-size:9px;color:var(--muted)">PERFORMANCE MODE</span> &nbsp;<span class="num" style="color:var(--accent);font-size:13px">${Veyro.fmt.range(est.hi, perfHi)}</span>`;
          const hLine = el('div', 'g-meta mt-8', null);
          hLine.innerHTML = `<span class="ls-wide" style="font-size:9px;color:var(--muted)">HIGH</span> &nbsp;<span class="num" style="color:var(--warn);font-size:13px">${Veyro.fmt.range(hiLo, est.hi)}</span>`;
          card.appendChild(pLine);
          card.appendChild(hLine);
          card.appendChild(el('div', 'g-meta mt-8', 'FPS values are estimates · tap to optimize'));
          card.addEventListener('click', () => {
            Veyro.Router.go('games', { game: g.id });
          });
          grid.appendChild(card);
        });
        if (!Veyro.License.isPremium() && genre === 'All') {
          const card = U.card('game-card');
          card.style.display = 'flex';
          card.style.flexDirection = 'column';
          card.style.alignItems = 'center';
          card.style.justifyContent = 'center';
          card.style.gap = '8px';
          card.style.textAlign = 'center';
          const lock = el('div');
          lock.style.cssText = 'width:36px;height:36px;border-radius:10px;background:rgba(57,255,136,.1);color:var(--accent);display:flex;align-items:center;justify-content:center';
          lock.innerHTML = icon('shield', 18);
          card.appendChild(lock);
          card.appendChild(el('div', 'g-name', 'FULL GAME CATALOG'));
          card.appendChild(el('div', 'g-meta', 'FPS estimates and profiles for every title.'));
          card.appendChild(U.btn('GO PREMIUM', true, { sm: true, onClick: (e) => {
            e.stopPropagation();
            Veyro.Router.go('settings');
          } }));
          grid.appendChild(card);
        }
        if (!games.length) {
          grid.appendChild(el('div', 'meta', 'No games found in this genre.'));
        }
      }).catch(() => {});
    }

search.addEventListener('input', () => {
      const activeTab = tabGroup.getActiveTab();
      const genre = genres.find(g => g.toLowerCase().replace(/\s+/g, '-') === activeTab) || 'All';
      renderGenreGames(c.querySelector('.tab-group-panel'), genre);
    });

    return { destroy() { c.innerHTML = ''; } };
  }

  /* ---- game detail ---- */
  function gameDetail(gameId, container) {
    const c = el('div', 'page-anim');
    container.appendChild(c);
    const game = Veyro.Games.get(gameId);
    if (!game) { c.appendChild(el('div', 'meta', 'Game not found.')); return { destroy() { c.innerHTML = ''; } }; }

    const back = el('div', 'gd-back');
    back.innerHTML = icon('back', 14) + 'All games';
    back.addEventListener('click', () => Veyro.Router.go('games'));
    c.appendChild(back);

    const wrap = el('div');
    c.appendChild(wrap);

    Veyro.HardwareAgent.getSnapshot().then(snap => {
      const gd = el('div', 'mt-16');
      const bann = demoBannerEl();
      if (bann) gd.appendChild(bann);

      const head = el('div', 'gd-head');
      const d = el('span', 'g-dot', esc(game.name[0]));
      d.style.width = '36px'; d.style.height = '36px'; d.style.fontSize = '14px';
      const t = el('div');
      t.appendChild(el('div', 'h-page', 'Optimize ' + esc(game.name) + '.'));
      t.appendChild(el('div', 'sub-page', 'Recommended settings for maximum stable performance.'));
      head.appendChild(d); head.appendChild(t);
      gd.appendChild(head);

      const est = Veyro.Upgrades.estimateFps(snap, game);
      const perf = Math.round(est.hi * 1.08);
      const high = est.lo;

      const estCard = U.card('mt-16');
      estCard.style.padding = '16px 20px';
      const er = el('div', 'row');
      const eCol = el('div', 'col');
      eCol.appendChild(el('div', 'eyebrow', 'ESTIMATED PERFORMANCE'));
      eCol.appendChild(el('div', 'meta', `${esc(snap.gpu.model)} @ ${game.res}`));
      er.appendChild(eCol);
      er.appendChild(el('div', 'flex-1'));
      const perfBox = el('div');
      perfBox.appendChild(el('div', 'meta', 'PERFORMANCE MODE'));
      perfBox.appendChild(el('div', 'num text-lg', Veyro.fmt.range(perf, perf + 55)));
      const highBox = el('div');
      highBox.appendChild(el('div', 'meta', 'HIGH'));
      highBox.appendChild(el('div', 'num text-lg text-warn', Veyro.fmt.range(high, Math.round(high * 1.35))));
      er.appendChild(perfBox); er.appendChild(highBox);
      estCard.appendChild(er);
      gd.appendChild(estCard);

      const isApplied = Veyro.Games.isApplied(game.id);
      const sTable = U.card('mt-16');
      sTable.style.padding = '16px 20px';
      const stHead = el('div', 'row-between mb-12');
      const stL = el('div', 'h-sec', 'RECOMMENDED SETTINGS');
      const stBtnWrap = el('div');
      const applyBtn = U.btn(isApplied ? 'APPLIED \u2014 UNDO' : 'APPLY RECOMMENDED SETTINGS', true, {
        onClick: () => {
          if (Veyro.Games.isApplied(game.id)) {
            Veyro.Games.undo(game);
            Veyro.toast('Game settings reverted', game.name + ' restored.', 'warn');
            Veyro.Router.go('games', { game: game.id });
          } else {
            const result = { game: game.name, changed: game.settings.map(s => ({ setting: s.k, from: s.cur, to: s.rec })) };
            applyResult(result, () => {
              Veyro.Games.apply(game, snap).then(() => {
                Veyro.toast('Settings applied', game.name + ' profile saved.', 'good');
                Veyro.Router.refreshTopBar();
                Veyro.Router.go('games', { game: game.id });
              });
            });
          }
        }
      });
      stBtnWrap.appendChild(applyBtn);
      stHead.appendChild(stL);
      stHead.appendChild(stBtnWrap);
      sTable.appendChild(stHead);

      const chg = el('div', 'meta mb-12');
      chg.innerHTML = '<span style="color:var(--warn)">Before applying, Veyro shows exactly what will change:</span> below.';
      sTable.appendChild(chg);

      const table = el('table', 'settings-table');
      game.settings.forEach(s => {
        const tr = el('tr');
        const td1 = el('td', undefined, esc(s.k));
        const td2 = el('td');
        td2.appendChild(el('span', 'cur', esc(s.cur)));
        td2.appendChild(el('span', 'new', esc(s.rec)));
        tr.appendChild(td1); tr.appendChild(td2);
        table.appendChild(tr);
      });
      sTable.appendChild(table);
      gd.appendChild(sTable);

      const note = el('div', 'meta mt-12', 'FPS values are estimates. Actual results depend on drivers, background load and in-game scene.');
      gd.appendChild(note);

      wrap.appendChild(gd);
    });

    function demoBannerEl() { if (Veyro.isDemo()) return U.demoCallout('Demo hardware data'); return null; }

    function applyResult(result, onConfirm) {
      /* confirmation modal \u2014 show what will change */
      const overlay = el('div', 'scan-overlay');
      overlay.style.zIndex = '90';
      const panel = el('div', 'scan-panel');
      panel.style.background = 'var(--card)';
      panel.style.border = '1px solid var(--border)';
      panel.style.borderRadius = 'var(--r-card)';
      panel.style.padding = '20px';
      const t = el('div', 'eyebrow', 'APPLY CHANGES TO ' + result.game.toUpperCase());
      const l = el('div', 'col mt-12');
      l.style.gap = '6px';
      result.changed.forEach(ch => {
        const rowEl = el('div', 'meta');
        rowEl.innerHTML = `<span>${esc(ch.setting)}:</span> <span class="cur">${esc(ch.from)}</span> <span class="new">${esc(ch.to)}</span>`;
        l.appendChild(rowEl);
      });
      const body = el('div');
      body.appendChild(t); body.appendChild(l);
      const btns = el('div', 'row mt-16');
      btns.appendChild(U.btn('CANCEL', false, { onClick: () => overlay.remove() }));
      btns.appendChild(U.btn('APPLY ALL', true, { onClick: () => { overlay.remove(); onConfirm && onConfirm(); } }));
      body.appendChild(btns);
      panel.appendChild(body);
      overlay.appendChild(panel);
      document.body.appendChild(overlay);
    }

    return { destroy() { c.innerHTML = ''; } };
  }

  /* ============================================================
     PC TIPS (free) — quick safe habits with deep links.
     ============================================================ */
  function tips(container) {
    const c = el('div', 'page-anim');
    container.appendChild(c);
    const head = el('div');
    head.appendChild(el('div', 'eyebrow', 'KNOWLEDGE BASE'));
    head.appendChild(el('h1', 'h-page', 'PC tips that actually work.'));
    head.appendChild(el('div', 'sub-page', 'Quick, safe habits that keep a PC fast. Every tip links to the right place in Veyro.'));
    c.appendChild(head);

    const grid = el('div', 'grid g-2 mt-16');
    const TIPS = [
      { t: 'Keep Windows updated', b: 'Feature updates bring speed and security fixes. Let Windows install them outside gaming hours.', act: { label: 'GO TO HEALTH', to: 'health' } },
      { t: 'Use Game Mode', b: 'Windows Game Mode keeps background tasks quiet while you play — Veyro can also enable GPU scheduling for lower latency.', act: { label: 'OPTIMIZATION CENTER', to: 'optcenter' } },
      { t: 'Watch your temperatures', b: 'Sustained heat throttles CPU and GPU clocks. Keep an eye on temps during long sessions.', act: { label: 'LIVE PERFORMANCE', to: 'performance' } },
      { t: 'Free up disk space', b: 'A nearly-full drive slows app launches and installs. Clean temp files every few weeks.', act: { label: 'DEEP JUNK CLEANER', to: 'optcenter' } },
      { t: 'Update your GPU driver', b: 'Game-ready drivers fix crashes and add day-one optimizations. Download only from the manufacturer.', act: { label: 'DRIVER CHECK', to: 'driver' } },
      { t: 'Never disable your antivirus', b: 'Veyro never touches security software — and neither should you. Real-time protection is not the bottleneck.', act: null },
      { t: 'Use the High Performance power plan', b: 'Balanced plans cap CPU clocks when idle. A performance plan keeps response times consistent.', act: { label: 'OPTIMIZATION CENTER', to: 'optcenter' } },
      { t: 'Install games on an SSD', b: 'Load times and open-world streaming improve drastically on NVMe storage compared to a spinning drive.', act: null },
      { t: 'Restart your PC regularly', b: 'A fresh boot clears memory leaks from apps and finishes pending driver updates that need a restart.', act: null },
      { t: 'Set competitive games to 1080p', b: 'Lowering resolution is the single biggest FPS gain on any GPU — check a game profile for the full list.', act: { label: 'GAME BOOST', to: 'games' } }
    ];
    TIPS.forEach(tip => {
      const card = U.card('card-hover');
      card.style.padding = '14px 16px';
      card.appendChild(el('div', 'r-title', esc(tip.t)));
      card.appendChild(el('div', 'r-desc mt-8', esc(tip.b)));
      if (tip.act) {
        card.appendChild(U.btn(tip.act.label, false, { sm: true, arrow: true, cls: 'mt-12', onClick: () => Veyro.Router.go(tip.act.to) }));
      }
      grid.appendChild(card);
    });
    c.appendChild(grid);
    return { destroy() { c.innerHTML = ''; } };
  }

  /* ============================================================
     MARKET FINDER (free) — VeyronFinderAi embedded in the app.
     Served from app/finder/ via the veyro:// custom scheme.
     ============================================================ */
  function finder(container) {
    const c = el('div', 'page-anim');
    container.appendChild(c);
    const head = el('div');
    head.appendChild(el('div', 'eyebrow', 'MARKET FINDER · POWERED BY THE Veyro WEBSITE'));
    head.appendChild(el('h1', 'h-page', 'Find the best price for anything.'));
    head.appendChild(el('div', 'sub-page', 'Search new or used items and compare the best prices. The Finder now runs on the Veyro website — the bundled page is only a fallback when the site is offline.'));
    c.appendChild(head);

    const actions = el('div', 'row');
    actions.style.gap = '8px';
    actions.style.marginTop = '8px';
    const site = 'http://127.0.0.1:9175/index.html';
    const openBtn = U.btn('OPEN Veyro WEBSITE IN BROWSER', false, { sm: true, ic: 'external', onClick: () => Veyro.open(site) });
    actions.appendChild(openBtn);
    c.appendChild(actions);

    const frame = el('iframe');
    frame.style.width = '100%';
    frame.style.height = 'calc(100vh - 320px)';
    frame.style.minHeight = '540px';
    frame.style.border = '1px solid var(--border)';
    frame.style.borderRadius = '12px';
    frame.style.background = '#09090b';
    frame.style.marginTop = '16px';
    frame.style.display = 'block';

    /* prefer the live Veyro website; fall back to the embedded landing page */
    fetch(site, { method: 'GET', mode: 'no-cors' })
      .then(() => { frame.src = site; })
      .catch(() => { frame.src = 'veyro://finder/index.html'; });

    c.appendChild(frame);
    return { destroy() { c.innerHTML = ''; } };
  }

  /* ============================================================
     OPTIMIZATION CENTER (premium one-click tweaks)
     Free plan: browse every tweak with a full description —
     applying is locked. Premium: apply with one click, state
     persists across restarts (Veyro.Prefs).
     ============================================================ */

  const OPT_TWEAKS = [
    /* ---------- 25 FREE ---------- */
    { id:'oc_gamemode', t:'GAME MODE', risk:'LOW', benefit:'Stable frame pacing', cat:'Gaming', fps:[1,3], free:true,
      what:'Windows Game Mode prioritizes your game over background tasks — free frames with zero downside.' },
    { id:'oc_hags', t:'GPU HARDWARE SCHEDULING', risk:'LOW', benefit:'Lower frame latency', cat:'Gaming', fps:[1,4], free:true,
      what:'Lets the GPU schedule its own frames instead of waiting on the CPU — reduces input lag and stutter.' },
    { id:'oc_xboxbar', t:'DISABLE XBOX GAME BAR', risk:'LOW', benefit:'Recover GPU headroom', cat:'Gaming', fps:[1,3], free:true,
      what:'The Game Bar overlay and background recorder permanently reserve GPU/CPU resources. Turn it off.' },
    { id:'oc_bgrefresh', t:'STOP BACKGROUND APP REFRESH', risk:'LOW', benefit:'Lower idle RAM/CPU', cat:'Gaming', fps:[1,2], free:true,
      what:'Store apps stop refreshing in the background — no more surprise CPU spikes mid-game.' },
    { id:'oc_focusassist', t:'FOCUS ASSIST IN GAMES', risk:'LOW', benefit:'No focus-stealing popups', cat:'Gaming', fps:[0,1], free:true,
      what:'Silences notifications while a game is in the foreground — no toast steals your focus.' },
    { id:'oc_visualfx', t:'REDUCE VISUAL EFFECTS', risk:'LOW', benefit:'Snappier UI', cat:'Performance', fps:[0,2], free:true,
      what:'Disables window shadows and fade animations — small CPU savings, snappier alt-tab.' },
    { id:'oc_transparency', t:'DISABLE TRANSPARENCY', risk:'LOW', benefit:'Less GPU compositing', cat:'Performance', fps:[0,1], free:true,
      what:'Windows transparency effects use GPU compositing — turning them off frees a tiny bit of GPU.' },
    { id:'oc_tips', t:'DISABLE WINDOWS TIPS', risk:'LOW', benefit:'Less background noise', cat:'System', fps:[0,1], free:true,
      what:'Windows tips and suggestions run background processes — disable them.' },
    { id:'oc_widgets', t:'DISABLE WIDGETS', risk:'LOW', benefit:'Free RAM', cat:'System', fps:[0,2], free:true,
      what:'The Widgets panel (news, weather) runs a WebView process that eats RAM and GPU — kill it.' },
    { id:'oc_startup', t:'SMART STARTUP TRIM', risk:'LOW', benefit:'Faster boot + more free RAM', cat:'System', fps:[1,3], free:true,
      what:'Disables startup apps that slow sign-in and pin memory in the background. Nothing is deleted.' },
    { id:'oc_telemetry', t:'REDUCE TELEMETRY', risk:'MEDIUM', benefit:'Quieter background', cat:'System', fps:[0,2], free:true,
      what:'Windows diagnostic data drops to minimum — less background CPU and network chatter.' },
    { id:'oc_advid', t:'DISABLE ADVERTISING ID', risk:'LOW', benefit:'Less tracking', cat:'System', fps:[0,1], free:true,
      what:'Windows advertising ID tracks you across apps — disable it for privacy and less background noise.' },
    { id:'oc_cortana', t:'DISABLE CORTANA', risk:'LOW', benefit:'Free RAM', cat:'System', fps:[0,1], free:true,
      what:'Cortana runs in the background even when unused — disable it to free RAM.' },
    { id:'oc_sticky', t:'DISABLE STICKY KEYS PROMPT', risk:'LOW', benefit:'No mid-game popup', cat:'Gaming', fps:[0,1], free:true,
      what:'The Sticky Keys popup (Shift x5) can steal focus mid-match — disable the prompt.' },
    { id:'oc_mouseaccel', t:'DISABLE MOUSE ACCELERATION', risk:'MEDIUM', benefit:'Raw aim input', cat:'Gaming', fps:[0,1], free:true,
      what:'Windows mouse acceleration curves your aim — raw 1:1 input for competitive play. Reversible.' },
    { id:'oc_hiber', t:'SHRINK HIBERNATION FILE', risk:'MEDIUM', benefit:'Frees GB of disk', cat:'Storage', fps:[0,1], free:true,
      what:'hiberfil.sys shrinks from a full RAM copy to minimum — frees several GB. Reversible.' },
    { id:'oc_trim', t:'VERIFY SSD TRIM', risk:'LOW', benefit:'SSD stays fast', cat:'Storage', fps:[0,1], free:true,
      what:'TRIM keeps your SSD fast by cleaning deleted data. Verify it is active.' },
    { id:'oc_searchindex', t:'REDUCE SEARCH INDEXING', risk:'LOW', benefit:'Lower disk activity', cat:'Storage', fps:[0,1], free:true,
      what:'Windows Search indexing hammers the drive on idle — limit it to used folders.' },
    { id:'oc_usbpower', t:'STOP USB POWER SAVING', risk:'MEDIUM', benefit:'No device dropouts', cat:'System', fps:[0,1], free:true,
      what:'Windows sleeps USB devices to save power — the reason mice/headsets disconnect mid-game. Reversible.' },
    { id:'oc_awake', t:'GAMING AWAKE MODE', risk:'LOW', benefit:'Never sleeps mid-game', cat:'Gaming', fps:[0,1], free:true,
      what:'Prevents sleep and pauses updates during gameplay sessions.' },
    { id:'oc_dns', t:'FAST DNS', risk:'MEDIUM', benefit:'Faster game connection', cat:'Network', fps:[0,1], free:true,
      what:'Cloudflare 1.1.1.1 DNS for faster game server connections. Reversible.' },
    { id:'oc_qos', t:'REMOVE NETWORK THROTTLING', risk:'LOW', benefit:'Lower ping spikes', cat:'Network', fps:[0,1], free:true,
      what:'Windows reserves 20% of bandwidth for background services — disable it for lower ping.' },
    { id:'oc_cloudsync', t:'PAUSE CLOUD SYNC IN GAME', risk:'LOW', benefit:'No sync contention', cat:'Network', fps:[0,1], free:true,
      what:'OneDrive/cloud sync pauses during gameplay — no disk or network contention.' },
    { id:'oc_defer_updates', t:'DEFER FEATURE UPDATES', risk:'MEDIUM', benefit:'No mid-match restarts', cat:'System', fps:[0,1], free:true,
      what:'Windows feature updates defer for weeks — no forced restart mid-match. Reversible.' },
    { id:'oc_fso', t:'DISABLE FULLSCREEN OPTIMIZATIONS', risk:'LOW', benefit:'Better fullscreen FPS', cat:'Gaming', fps:[1,3], free:true,
      what:'Windows fullscreen optimizations add a compositor layer — disable for true exclusive fullscreen.' },

    /* ---------- 25 PREMIUM ---------- */
    { id:'oc_power_ult', t:'ULTIMATE PERFORMANCE PLAN', risk:'LOW', benefit:'Max sustained clocks', cat:'Performance', fps:[2,6], prem:true,
      what:'Unlocks the hidden Ultimate Performance power plan — CPU never throttles down between inputs.' },
    { id:'oc_corepark', t:'DISABLE CORE PARKING', risk:'LOW', benefit:'All cores active', cat:'Performance', fps:[2,5], prem:true,
      what:'Windows parks CPU cores to save power — unpark them so every core is ready for your game.' },
    { id:'oc_timerres', t:'TIMER RESOLUTION 0.5MS', risk:'LOW', benefit:'Smoother frame delivery', cat:'Performance', fps:[1,4], prem:true,
      what:'Sets the system timer to 0.5ms for smoother frame delivery and lower input lag.' },
    { id:'oc_hpet', t:'DISABLE HPET', risk:'MEDIUM', benefit:'Lower DPC latency', cat:'Performance', fps:[1,5], prem:true,
      what:'High Precision Event Timer adds DPC latency — disable it for lower frame time variance. Reversible.' },
    { id:'oc_msigpu', t:'MSI MODE FOR GPU', risk:'MEDIUM', benefit:'Lower GPU interrupt latency', cat:'Performance', fps:[1,4], prem:true,
      what:'Message Signaled Interrupts give the GPU a dedicated interrupt line — lower latency. Reversible.' },
    { id:'oc_pcie', t:'PCIE LINK POWER OFF', risk:'LOW', benefit:'GPU runs at full link speed', cat:'Performance', fps:[1,3], prem:true,
      what:'PCIe link speed power management throttles GPU-to-CPU bandwidth — disable it.' },
    { id:'oc_gpupower', t:'GPU MAX PERFORMANCE', risk:'LOW', benefit:'GPU never downclocks', cat:'Gaming', fps:[2,8], prem:true,
      what:'NVIDIA/AMD power management set to Prefer Maximum Performance — GPU clocks stay pinned in games.' },
    { id:'oc_lowlatency', t:'GPU LOW LATENCY MODE', risk:'LOW', benefit:'Lower input lag', cat:'Gaming', fps:[1,4], prem:true,
      what:'NVIDIA Low Latency / AMD Anti-Lag — queues frames tighter for lower input lag.' },
    { id:'oc_shadercache', t:'DIRECTX SHADER CACHE', risk:'LOW', benefit:'Faster shader loading', cat:'Gaming', fps:[1,3], prem:true,
      what:'Enables the Windows shader cache — games load shaders faster, less stutter.' },
    { id:'oc_overlays', t:'DISABLE ALL OVERLAYS', risk:'LOW', benefit:'Free GPU/CPU', cat:'Gaming', fps:[1,4], prem:true,
      what:'Discord, GeForce Experience, Steam overlays all hook into your game and eat frames — disable them all.' },
    { id:'oc_ramcleaner', t:'MEMORY CLEANER BEFORE GAME', risk:'LOW', benefit:'More free RAM', cat:'Performance', fps:[1,4], prem:true,
      what:'Trims standby memory before a gaming session — more usable RAM for your game.' },
    { id:'oc_pagefile', t:'OPTIMIZE PAGEFILE', risk:'MEDIUM', benefit:'Fewer stutters', cat:'Performance', fps:[1,3], prem:true,
      what:'Fixed pagefile on your fastest drive avoids fragmentation and resize stutters. Reversible.' },
    { id:'oc_priority', t:'GAME PROCESS PRIORITY', risk:'LOW', benefit:'Game gets CPU first', cat:'Gaming', fps:[2,6], prem:true,
      what:'Sets game processes to High priority — the CPU serves your game before anything else.' },
    { id:'oc_responsiveness', t:'SYSTEM RESPONSIVENESS 0%', risk:'LOW', benefit:'CPU serves games not background', cat:'Performance', fps:[1,4], prem:true,
      what:'System responsiveness drops from 20% to 0% — the CPU serves games, not background tasks.' },
    { id:'oc_nagle', t:'DISABLE NAGLE ALGORITHM', risk:'LOW', benefit:'Lower network latency', cat:'Network', fps:[0,2], prem:true,
      what:'Nagle batches small network packets — disabling it sends them instantly for lower game latency.' },
    { id:'oc_netthrottle', t:'NETWORK THROTTLING INDEX', risk:'LOW', benefit:'No network stutter', cat:'Network', fps:[0,2], prem:true,
      what:'Sets network throttling index to max — no multimedia packets delay your game traffic.' },
    { id:'oc_defender', t:'GAME FOLDER EXCLUSIONS', risk:'MEDIUM', benefit:'No scan stutter', cat:'Gaming', fps:[1,5], prem:true,
      what:'Adds your game folders to Defender exclusions — real-time scanning stops causing stutter. Reversible.' },
    { id:'oc_wupdate', t:'PAUSE UPDATES IN GAME', risk:'LOW', benefit:'No update CPU spike', cat:'Gaming', fps:[0,2], prem:true,
      what:'Windows Update service pauses while a game is running — no background CPU spikes.' },
    { id:'oc_sysmain', t:'DISABLE SYSMAIN ON SSD', risk:'LOW', benefit:'Less disk contention', cat:'Storage', fps:[0,2], prem:true,
      what:'SysMain (Superfetch) pre-loads apps into RAM — on an SSD it causes more harm than good.' },
    { id:'oc_writecache', t:'DISK WRITE CACHING', risk:'MEDIUM', benefit:'Faster game file writes', cat:'Storage', fps:[0,2], prem:true,
      what:'Write caching speeds up game file saves and installs. Drive flushes safely. Reversible.' },
    { id:'oc_unused_svc', t:'DISABLE UNUSED SERVICES', risk:'MEDIUM', benefit:'Lower RAM & CPU', cat:'System', fps:[1,3], prem:true,
      what:'Stops Fax, XPS printing, sync bloat — services most PCs never use. Reversible.' },
    { id:'oc_fsoall', t:'DISABLE FSO GLOBAL', risk:'MEDIUM', benefit:'True exclusive fullscreen', cat:'Gaming', fps:[2,8], prem:true,
      what:'Disables fullscreen optimizations globally via registry — every game gets true exclusive fullscreen.' },
    { id:'oc_interrupt', t:'GPU INTERRUPT AFFINITY', risk:'MEDIUM', benefit:'GPU interrupts on dedicated core', cat:'Performance', fps:[1,6], prem:true,
      what:'GPU interrupts are pinned to a dedicated CPU core — the rest serve your game. Reversible.' },
    { id:'oc_dpc', t:'DPC LATENCY OPTIMIZATION', risk:'MEDIUM', benefit:'Smooth frame times', cat:'Performance', fps:[1,6], prem:true,
      what:'Reduces Deferred Procedure Call latency — smoother frame times, less micro-stutter. Reversible.' },
    { id:'oc_boost', t:'ONE-CLICK FPS BOOST', risk:'LOW', benefit:'All free tweaks at once', cat:'Performance', fps:[5,15], prem:true,
      what:'Applies every safe free tweak in one click — the fastest way to gain FPS.' }
  ];


  function optcenter(container) {
    const c = el('div', 'page-anim');
    container.appendChild(c);
    const head = el('div');
    head.appendChild(el('div', 'eyebrow', Veyro.License.isPremium() ? 'PREMIUM OPTIMIZATION CENTER' : 'OPTIMIZATION CENTER · PREMIUM'));
    head.appendChild(el('h1', 'h-page', 'One-click system optimizations.'));
    head.appendChild(el('div', 'sub-page', 'Every tweak explains exactly what it does. Applied tweaks stay active across restarts, can be undone anytime, and Veyro saves a Windows System Restore point before applying.'));
    c.appendChild(head);

    const prem = Veyro.License.isPremium();
    const score = Veyro.Optimizer.ocScore();
    const premChip = U.chip(prem ? 'PREMIUM · ACTIVE' : 'PREMIUM ONLY', prem ? 'green' : 'yellow');
    const scoreChip = U.chip('OPTIMIZATION SCORE ' + score + '/100', score >= 85 ? 'green' : score >= 70 ? 'yellow' : 'gray');
    const chipRow = el('div', 'row mt-8');
    chipRow.style.gap = '8px';
    chipRow.style.flexWrap = 'wrap';
    chipRow.style.alignItems = 'center';
    chipRow.appendChild(premChip);
    chipRow.appendChild(scoreChip);

    /* real Windows System Restore point status */
    const rp = Veyro.Optimizer.restorePointInfo();
    if (!rp && !Veyro.Optimizer.rpChecking()) {
      Veyro.Optimizer.ensureRestorePoint().then(() => {
        if (Veyro.Router.current() === 'optcenter') Veyro.Router.go('optcenter');
      });
    }
    const rpAge = (rp && rp.reason && rp.reason.indexOf('recent:') === 0) ? Veyro.Optimizer.fmtRpAge(rp.reason) : null;
    if (rp && rp.created) {
      chipRow.appendChild(U.chip('RESTORE POINT: CREATED', 'green'));
    } else if (rpAge) {
      chipRow.appendChild(U.chip('RESTORE POINT: ' + rpAge.toUpperCase() + ' AGO', 'green'));
    } else if (rp) {
      chipRow.appendChild(U.chip('RESTORE POINT: ' + (rp.reason === 'exists' ? 'EXISTS (AGE UNKNOWN)' : 'UNAVAILABLE'), rp.reason === 'exists' ? 'green' : 'red'));
    } else {
      chipRow.appendChild(U.chip('RESTORE POINT: NOT CHECKED', 'gray'));
    }
    const rpExists = rp && (rp.created || !!rpAge || rp.reason === 'exists' || (rp.reason || '').indexOf('recent:') === 0 || (rp.reason || '').indexOf('old:') === 0);
    if (!rpExists) {
      chipRow.appendChild(U.btn('CREATE NOW', false, { sm: true, ic: 'shield', title: 'Create a Windows System Restore point before applying tweaks', onClick: async () => {
        chipRow.appendChild(U.chip('CREATING…', 'gray'));
        await Veyro.Optimizer.ensureRestorePoint();
        Veyro.Router.go('optcenter');
      } }));
    }

    if (prem) chipRow.appendChild(el('span', 'meta', 'Unlocked — apply any tweak below.'));
    else chipRow.appendChild(el('span', 'meta', 'Free plan — browse everything, applying is locked.'));
    c.appendChild(chipRow);

    /* upsell card for free users */
    if (!prem) {
      const up = U.card('mt-16');
      up.style.padding = '16px 20px';
      const rowU = el('div', 'row');
      const icU = el('span', 'ic-24 text-accent');
      icU.innerHTML = icon('spark', 24);
      const tU = el('div', 'col');
      tU.style.gap = '2px';
      tU.appendChild(el('div', 'font-bold text-sm', OPT_TWEAKS.length + ' one-click optimizations. ' + OPT_TWEAKS.length + ' reasons to go premium.'));
      tU.appendChild(el('div', 'meta', 'Premium keys are sold on our Discord server. Join, grab your key, paste it in Settings — done.'));
      rowU.appendChild(icU); rowU.appendChild(tU);
      rowU.appendChild(el('div', 'flex-1'));
      rowU.appendChild(U.btn('GO PREMIUM', true, { ic: 'discord', arrow: true, onClick: () => {
        Veyro.toast('Opening Discord', 'Join the server, get your key and paste it in Settings.', 'warn');
        Veyro.open(Veyro.DISCORD);
      } }));
      up.appendChild(rowU);
      c.appendChild(up);
    }

    /* revert-all bar — visible whenever tweaks are active */
    const activeIds = Veyro.Prefs ? Veyro.Prefs.listApplied() : [];
    if (activeIds.length) {
      const rb = el('div', 'row mt-16');
      rb.style.gap = '10px';
      rb.style.alignItems = 'center';
      rb.appendChild(el('span', 'meta', activeIds.length + ' tweak(s) active — restore everything to its previous state:'));
      let arming = false;
      const revBtn = U.btn('REVERT ALL OPTIMIZATIONS', false, { ic: 'undo', cls: 'btn-danger-ghost', onClick: () => {
        if (!arming) {
          arming = true;
          revBtn.textContent = 'CLICK AGAIN TO CONFIRM';
          setTimeout(() => {
            arming = false;
            revBtn.innerHTML = '';
            revBtn.appendChild(U.iconEl('undo', 12));
            revBtn.appendChild(document.createTextNode('REVERT ALL OPTIMIZATIONS'));
          }, 4000);
          return;
        }
        const n = Veyro.Optimizer.revertAll();
        Veyro.toast('All optimizations reverted', n + ' tweak(s) restored to their previous state.', 'warn');
        Veyro.Router.go('optcenter');
      } });
      rb.appendChild(revBtn);
      c.appendChild(rb);
    }

    let busy = false;

    function renderRow(t, panel) {
      const applied = Veyro.Prefs.isApplied(t.id);
      const row = el('div', 'result-row' + (applied ? ' applied' : ''));
      row.style.alignItems = 'center';
      const body = el('div');
      body.style.flex = '1';
      const tt = el('div', 'r-title', esc(t.t));
      tt.appendChild(U.chip(t.risk, t.risk === 'MEDIUM' ? 'yellow' : 'gray'));
      if (t.fps) tt.appendChild(U.chip('+' + t.fps[0] + '-' + t.fps[1] + ' FPS', 'green'));
      tt.appendChild(U.chip('BENEFIT: ' + t.benefit.toUpperCase(), 'green'));
      if (t.prem && !prem) tt.appendChild(U.chip('PREMIUM', 'green'));
      tt.appendChild(U.chip(applied ? 'APPLIED — STAYS ACTIVE' : 'READY', applied ? 'green' : 'gray'));
      body.appendChild(tt);
      const wl = el('div', 'r-desc', null);
      wl.innerHTML = '<span class="meta ls-wide" style="font-size:9px">WHAT IT DOES</span>  ' + esc(t.what);
      wl.style.marginTop = '7px';
      body.appendChild(wl);
      row.appendChild(body);
      const acts = el('div', 'r-actions');

      const undoBtn = () => U.btn('UNDO', false, { sm: true, onClick: async () => {
        try { await Veyro.HardwareAgent.setOptimization(t.id, false); } catch (e) { /* demo sim ok */ }
        Veyro.Prefs.unmarkApplied(t.id);
        Veyro.toast('Tweak reverted', t.t + ' restored to previous state.', 'warn');
        renderCategory(t.cat);
      } });

      const locked = t.prem && !prem;
      if (locked && !applied) {
        const lb = U.btn('APPLY', false, { sm: true, cls: 'btn-sm', onClick: () => {
          Veyro.toast('Premium tweak', '"' + t.t + '" is premium. Buy a key on our Discord and paste it in Settings.', 'warn');
          Veyro.Router.go('settings');
        } });
        lb.innerHTML = '';
        lb.appendChild(U.iconEl('lock', 12));
        lb.appendChild(document.createTextNode(' APPLY'));
        acts.appendChild(lb);
      } else if (applied) {
        acts.appendChild(undoBtn());
      } else {
        acts.appendChild(U.btn('APPLY', true, { sm: true, onClick: async () => {
          if (busy) return;
          busy = true;
          try {
            await Veyro.HardwareAgent.setOptimization(t.id, true);
            Veyro.Prefs.markApplied(t.id);
            Veyro.toast('Optimization applied', t.t + ' — stays active until you undo it.', 'good');
            renderCategory(t.cat);
          } catch (e) {
            Veyro.toast('Could not apply', e.message || 'The tweak could not be applied.', 'error');
          } finally { busy = false; }
        } }));
      }
      row.appendChild(acts);
      return row;
    }

    const categories = [
      { id: 'performance', label: 'Performance', icon: 'bolt' },
      { id: 'gaming', label: 'Gaming', icon: 'game' },
      { id: 'network', label: 'Network', icon: 'net' },
      { id: 'storage', label: 'Storage', icon: 'disk' },
      { id: 'system', label: 'System', icon: 'gear' }
    ];

    function renderCategory(catId) {
      const panel = c.querySelector('.tab-group-panel');
      if (!panel) return;
      panel.innerHTML = '';
      const list = el('div', 'col');
      list.style.gap = '10px';
      let tweaks;
      if (catId === 'free') tweaks = OPT_TWEAKS.filter(t => t.free);
      else if (catId === 'premium') tweaks = OPT_TWEAKS.filter(t => t.prem);
      else if (catId === 'allfps') tweaks = OPT_TWEAKS;
      else tweaks = OPT_TWEAKS.filter(t => t.cat.toLowerCase() === catId);
      if (!tweaks.length) {
        panel.appendChild(el('div', 'meta', 'No tweaks in this category.'));
        return;
      }
      tweaks.forEach(t => list.appendChild(renderRow(t, panel)));
      panel.appendChild(list);
    }

    const tabGroup = U.tabGroup({
      tabs: [
        ...categories.map(cat => ({
          id: cat.id,
          label: cat.label,
          icon: cat.icon,
          groups: [{ id: cat.id, label: cat.label, content: (panel) => renderCategory(cat.id) }]
        })),
        { id: 'free', label: 'FREE (25)', icon: 'check', groups: [{ id: 'free', label: 'FREE — 25 tweaks', content: (panel) => renderCategory('free') }] },
        { id: 'premium', label: 'PREMIUM (25)', icon: 'spark', groups: [{ id: 'premium', label: 'PREMIUM — 25 tweaks', content: (panel) => renderCategory('premium') }] },
        { id: 'allfps', label: 'ALL 50', icon: 'layers', groups: [{ id: 'allfps', label: 'ALL 50 FPS Tweaks', content: (panel) => renderCategory('allfps') }] }
      ],
      defaultTab: 0,
      onTabChange: () => {}
    });
    c.appendChild(tabGroup.root);

    /* FPS potential calculator */
    const freeMin = OPT_TWEAKS.filter(t => t.free).reduce((s, t) => s + t.fps[0], 0);
    const freeMax = OPT_TWEAKS.filter(t => t.free).reduce((s, t) => s + t.fps[1], 0);
    const premMin = OPT_TWEAKS.filter(t => t.prem).reduce((s, t) => s + t.fps[0], 0);
    const premMax = OPT_TWEAKS.filter(t => t.prem).reduce((s, t) => s + t.fps[1], 0);
    const fpsCard = U.card('mt-16');
    fpsCard.style.padding = '16px 20px';
    const fpsRow = el('div', 'row');
    const fpsIc = el('span', 'ic-24 text-accent');
    fpsIc.innerHTML = icon('bolt', 24);
    const fpsInfo = el('div', 'col');
    fpsInfo.style.gap = '2px';
    fpsInfo.appendChild(el('div', 'font-bold text-sm', 'TOTAL FPS POTENTIAL'));
    fpsInfo.appendChild(el('div', 'meta', 'Free: +' + freeMin + '-' + freeMax + ' FPS · Premium adds: +' + premMin + '-' + premMax + ' FPS · Combined: +' + (freeMin + premMin) + '-' + (freeMax + premMax) + ' FPS'));
    fpsRow.appendChild(fpsIc); fpsRow.appendChild(fpsInfo);
    fpsRow.appendChild(el('div', 'flex-1'));
    fpsRow.appendChild(U.chip('+' + (freeMin + premMin) + '-' + (freeMax + premMax) + ' FPS TOTAL', 'green'));
    fpsCard.appendChild(fpsRow);
    c.appendChild(fpsCard);

    return { destroy() { c.innerHTML = ''; } };
  }

  /* ============================================================
     DRIVER CHECK (premium)
     ============================================================ */
  function driver(container) {
    const c = el('div', 'page-anim');
    container.appendChild(c);
    const head = el('div');
    head.appendChild(el('div', 'eyebrow', 'DRIVER CHECK · PREMIUM'));
    head.appendChild(el('h1', 'h-page', 'GPU driver status.'));
    head.appendChild(el('div', 'sub-page', 'Veyro inspects the installed graphics driver and tells you when it is time to update.'));
    c.appendChild(head);

    const wrap = el('div');
    c.appendChild(wrap);
    snapshotOrError(wrap, (snap) => {
      const root = el('div', 'page-anim');
      const b = demoBanner(); if (b) root.appendChild(b);
      const gpu = snap.gpu;
      const drv = gpu.driver ? String(gpu.driver) : null;
      const drvDate = gpu.driverDate ? new Date(gpu.driverDate) : null;
      const ageMonths = drvDate ? Math.max(0, Math.floor((Date.now() - drvDate.getTime()) / (30 * 86400000))) : null;
      const tone = ageMonths === null ? 'yellow' : ageMonths > 12 ? 'red' : ageMonths > 6 ? 'yellow' : 'green';
      const label = ageMonths === null ? 'UNKNOWN AGE' : ageMonths > 12 ? 'OUTDATED' : ageMonths > 6 ? 'GETTING OLD' : 'UP TO DATE';

      const big = U.card('mt-16');
      big.style.padding = '20px 24px';
      const row = el('div', 'row');
      const icBox = el('span', 'ic-24 text-accent');
      icBox.innerHTML = icon('gpu', 24);
      const info = el('div', 'col');
      info.style.gap = '4px';
      info.appendChild(el('div', 'eyebrow', 'GRAPHICS DRIVER'));
      info.appendChild(el('div', 'font-bold', esc(Veyro.av(gpu.model))));
      const dline = el('div');
      dline.appendChild(el('span', 'meta ls-wide', 'VERSION &nbsp;'));
      dline.appendChild(el('span', 'font-bold num', esc(Veyro.av(drv))));
      info.appendChild(dline);
      const dateLine = el('div');
      dateLine.appendChild(el('span', 'meta ls-wide', 'RELEASED &nbsp;'));
      dateLine.appendChild(el('span', 'font-bold', drvDate ? drvDate.toLocaleDateString() : 'Unavailable'));
      info.appendChild(dateLine);
      const ageLine = el('div');
      ageLine.appendChild(el('span', 'meta ls-wide', 'AGE &nbsp;'));
      ageLine.appendChild(U.chip(label, tone));
      if (ageMonths !== null) ageLine.appendChild(el('span', 'meta', ' · ' + (ageMonths < 1 ? 'less than a month' : ageMonths + (ageMonths === 1 ? ' month' : ' months'))));
      info.appendChild(ageLine);
      row.appendChild(icBox); row.appendChild(info);
      row.appendChild(el('div', 'flex-1'));
      row.appendChild(U.btn('CHECK FOR UPDATES', true, { ic: 'search', arrow: true, onClick: () => {
        Veyro.open('https://www.google.com/search?q=' + encodeURIComponent((gpu.model || 'GPU') + ' driver download official'));
      } }));
      big.appendChild(row);
      root.appendChild(big);

      root.appendChild(U.secHead('WHY DRIVERS MATTER'));
      const tips = U.card('mt-12');
      tips.style.padding = '16px 20px';
      const list = el('div', 'col');
      list.style.gap = '10px';
      [
        'New driver versions fix game crashes, visual glitches and security issues.',
        'Game-ready drivers often include day-one optimizations for new titles.',
        'Always download drivers from the official manufacturer website — never from pop-up ads.',
        'After installing a driver update, restart the PC and re-run a Veyro scan.'
      ].forEach(t => {
        const r = el('div', 'row');
        r.style.gap = '8px';
        const d = el('span', 'r-dot r-good');
        const s = el('span', 'meta', t);
        r.appendChild(d); r.appendChild(s);
        list.appendChild(r);
      });
      tips.appendChild(list);
      root.appendChild(tips);
      return root;
    }, () => Veyro.Router.go('driver'));

    return { destroy() { c.innerHTML = ''; } };
  }

  /* ============================================================
     SYSTEM REPORT (premium)
     ============================================================ */
  function report(container) {
    const c = el('div', 'page-anim');
    container.appendChild(c);
    const head = el('div', 'row-between');
    const l = el('div');
    l.appendChild(el('div', 'eyebrow', 'SYSTEM REPORT · PREMIUM'));
    l.appendChild(el('h1', 'h-page', 'Your full PC report.'));
    head.appendChild(l);
    head.appendChild(U.btn('COPY REPORT', true, { ic: 'copy', onClick: () => {
      Veyro.HardwareAgent.getSnapshot().then(snap => {
        const txt = Veyro.Report.build(snap);
        const ta = document.createElement('textarea');
        ta.value = txt;
        ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select();
        try { document.execCommand('copy'); Veyro.toast('Report copied', 'Paste it anywhere to share your PC details.'); } catch (e) {}
        document.body.removeChild(ta);
      });
    } }));
    c.appendChild(head);

    const wrap = el('div');
    c.appendChild(wrap);
    snapshotOrError(wrap, (snap) => {
      const root = el('div', 'page-anim');
      const b = demoBanner(); if (b) root.appendChild(b);
      const card = U.card('mt-16');
      card.style.padding = '18px 22px';
      const pre = el('pre', 'report-pre');
      pre.textContent = Veyro.Report.build(snap);
      card.appendChild(pre);
      root.appendChild(card);
      const note = el('div', 'meta mt-12', 'Includes health score, bottleneck analysis and open optimization count.');
      root.appendChild(note);
      return root;
    }, () => Veyro.Router.go('report'));

    return { destroy() { c.innerHTML = ''; } };
  }

  /* ============================================================
     HEALTH
     ============================================================ */
  function health(container) {
    const c = el('div', 'page-anim');
    container.appendChild(c);
    const head = el('div');
    head.appendChild(el('div', 'eyebrow', 'SYSTEM DIAGNOSTICS'));
    head.appendChild(el('h1', 'h-page', 'PC health.'));
    c.appendChild(head);

    const wrap = el('div');
    c.appendChild(wrap);
    snapshotOrError(wrap, (snap) => {
      const root = el('div', 'page-anim');
      const b = demoBanner(); if (b) root.appendChild(b);
      const score = Veyro.Health.score(snap);
      const checks = Veyro.Health.check(snap);

      const top = el('div', 'row mt-16');
      top.style.alignItems = 'flex-start';
      const ringBox = U.ring(score, 132);
      const status = el('div', 'col');
      status.style.gap = '4px';
      status.appendChild(el('div', 'eyebrow', score >= 80 ? 'VERY GOOD' : score >= 65 ? 'FAIR' : 'NEEDS ATTENTION'));
      status.appendChild(el('div', 'text-lg font-bold', score >= 80
        ? 'Your PC is in good shape.'
        : 'A few items need your attention.'));
      status.appendChild(el('div', 'meta', `Last scan: ${new Date(snap.pc.lastScan).toLocaleString()}`));
top.appendChild(ringBox); top.appendChild(status);
      root.appendChild(top);

      const actRow = el('div', 'row mt-12');
      actRow.appendChild(U.btn('RUN OPTIMIZATION PLAN', true, { ic: 'bolt', arrow: true, onClick: () => Veyro.Router.go('optimize') }));
      actRow.appendChild(U.btn('PC TIPS', false, { ic: 'bulb', onClick: () => Veyro.Router.go('tips') }));
      root.appendChild(actRow);

      root.appendChild(U.secHead('CHECK RESULTS'));
      const list = el('div', 'col mt-12');
      list.style.gap = '8px';
      Veyro.Health.CHECKS.forEach(ck => {
        const r = checks[ck.key];
        const row = el('div', 'result-row');
        const dot = el('div', 'r-dot ' + (r.status === 'crit' ? 'r-crit' : r.status === 'warn' ? 'r-warn' : 'r-good'));
        const body = el('div', 'flex-1');
        const t = el('div', 'r-title', esc(ck.label));
        t.appendChild(U.chip(Veyro.statusLabel[r.status], r.status === 'crit' ? 'red' : r.status === 'warn' ? 'yellow' : 'green'));
        body.appendChild(t);
        body.appendChild(el('div', 'r-desc', esc(r.message) + ' \u2014 ' + esc(r.detail)));
        row.appendChild(dot); row.appendChild(body);
        list.appendChild(row);
      });
      root.appendChild(list);

      root.appendChild(U.secHead('ACTIVE ALERTS'));
      const al = el('div', 'col mt-12');
      al.style.gap = '8px';
      Veyro.Health.alerts(snap).forEach(a => {
        const row = el('div', 'result-row');
        const dot = el('div', 'r-dot ' + (a.severity === 'crit' ? 'r-crit' : a.severity === 'warn' ? 'r-warn' : 'r-good'));
        const body = el('div', 'flex-1');
        body.appendChild(el('div', 'r-title', esc(a.title)));
        body.appendChild(el('div', 'r-desc', esc(a.body)));
        row.appendChild(dot); row.appendChild(body);
        al.appendChild(row);
      });
      root.appendChild(al);

      return root;
    }, () => Veyro.Router.go('health'));

    return { destroy() { c.innerHTML = ''; } };
  }

  /* ============================================================
     SETTINGS
     ============================================================ */
  function settings(container) {
    const c = el('div', 'page-anim');
    container.appendChild(c);
    const head = el('div');
    head.appendChild(el('div', 'eyebrow', 'PREFERENCES'));
    head.appendChild(el('h1', 'h-page', 'Settings.'));
    c.appendChild(head);

    const s = Veyro.Store.get().settings;

    function group(name, rowsHtml) {
      const g = U.card('set-group mt-16');
      g.appendChild(el('div', 'sg-name', esc(name)));
      g.appendChild(rowsHtml);
      return g;
    }

    function selectCtl(options, val, onChange, width) {
      const sel = el('select', 'field');
      sel.style.width = width || '150px';
      sel.style.height = '30px';
      sel.style.fontSize = '12px';
      sel.style.padding = '0 8px';
      options.forEach(o => {
        const op = el('option', undefined, esc(o.label));
        op.value = o.value;
        if (o.value === val) op.selected = true;
        sel.appendChild(op);
      });
      sel.addEventListener('change', () => onChange(sel.value));
      return sel;
    }

const rowCfg = (title, desc, control) => {
      const r = el('div', 'set-row');
      const l = el('div');
      l.appendChild(el('div', 'set-title', esc(title)));
      l.appendChild(el('div', 'set-desc', esc(desc)));
      r.appendChild(l); r.appendChild(control);
      return r;
    };

    const reRender = () => Veyro.Router.go('settings');
    let premEl = null;

    /* locked control for premium-only settings */
    const gate = (title, desc, val, onToggle) => {
      if (Veyro.License.isPremium()) {
        return rowCfg(title, desc, U.toggle(!!val, onToggle));
      }
      const control = el('div', 'row');
      control.style.gap = '8px';
      const t = U.toggle(false, () => {});
      t.style.opacity = '.45';
      t.style.pointerEvents = 'none';
      control.appendChild(U.chip('PREMIUM', 'green'));
      control.appendChild(t);
      const r = rowCfg(title, desc, control);
      r.style.cursor = 'pointer';
      r.addEventListener('click', () => {
        Veyro.toast('Premium feature', 'Keys are sold on our Discord — or paste an existing key in the PREMIUM section below.', 'warn');
        premEl && premEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
      return r;
    };

    /* Premium */
    const prem = el('div');
    premEl = prem;
    const premRow = el('div', 'set-row');
    const pL = el('div');
    pL.appendChild(el('div', 'set-title', 'Veyro Premium'));
    pL.appendChild(el('div', 'set-desc', Veyro.License.isPremium()
      ? 'Premium is active on this PC' + (Veyro.License.status().expiresAt ? ' until ' + Veyro.License.status().expiresAt.toLocaleString() + '.' : ' — lifetime.') +
        (Veyro.License.status().key ? ' Key ' + Veyro.License.status().key : '')
      : 'Free plan. Enter a license key below to unlock premium.'));
    const pR = el('div', 'row');
    pR.style.gap = '8px';
    pR.appendChild(U.chip(Veyro.License.isPremium() ? 'PREMIUM · ' + Veyro.License.untilText().toUpperCase() : 'FREE PLAN', Veyro.License.isPremium() ? 'green' : 'yellow'));
    premRow.appendChild(pL); premRow.appendChild(pR);
    prem.appendChild(premRow);
    const discRow = el('div', 'set-row');
    const dL = el('div');
    dL.appendChild(el('div', 'set-title', 'Buy premium on Discord'));
    dL.appendChild(el('div', 'set-desc', 'Join the official Veyro server to buy keys and get support. Your key unlocks in Settings in seconds.'));
    discRow.appendChild(dL);
    discRow.appendChild(U.btn('JOIN DISCORD', Veyro.License.isPremium() ? false : true, { ic: 'discord', onClick: () => {
      Veyro.toast('Opening Discord', 'Join the server to buy keys and get support.', 'warn');
      Veyro.open(Veyro.DISCORD);
    } }));
    prem.appendChild(discRow);
    const keyRow = el('div', 'set-row');
    const kL = el('div');
    kL.appendChild(el('div', 'set-title', 'Activate a license key'));
    kL.appendChild(el('div', 'set-desc', 'Paste the key you received (format VEYR0-XXXXX-XXXXX-XXXXX). It unlocks premium until the key expires.'));
    keyRow.appendChild(kL);
    const kCtl = el('div', 'col');
    kCtl.style.gap = '6px';
    const kRow2 = el('div', 'row');
    kRow2.style.gap = '8px';
    const keyInp = el('input', 'field');
    keyInp.type = 'text';
    keyInp.placeholder = 'VEYR0-XXXXX-XXXXX-XXXXX';
    keyInp.style.width = '260px';
    keyInp.style.fontFamily = 'JetBrains Mono, monospace';
    keyInp.value = '';
    const keyBtn = U.btn(Veyro.License.isPremium() ? 'REPLACE KEY' : 'ACTIVATE', true, { sm: true, onClick: () => {
      const key = keyInp.value.trim();
      if (!key) { Veyro.toast('License key', 'Paste a key first.', 'warn'); return; }
      Veyro.License.activate(key).then(res => {
        if (res.ok) {
          Veyro.toast('Premium activated', res.expiresAt ? 'Until ' + res.expiresAt.toLocaleString() + '.' : 'Lifetime. Welcome!', 'good');
          keyInp.value = '';
          reRender();
        } else {
          Veyro.toast('License key invalid', res.msg || 'Could not activate.', 'error');
        }
      });
    } });
    kRow2.appendChild(keyInp);
    kRow2.appendChild(keyBtn);
    kCtl.appendChild(kRow2);
    const kMsg = el('div', 'meta');
    kCtl.appendChild(kMsg);
    keyRow.appendChild(kCtl);
    prem.appendChild(keyRow);
    const featRow = el('div', 'set-row');
    const fL = el('div');
    fL.appendChild(el('div', 'set-title', 'Premium features'));
    fL.appendChild(el('div', 'set-desc', 'Optimization Center (24 one-click tweaks) · One-Click Boost · In-game FPS overlay · High temperature alerts · Full game catalog · Driver Check · System Report · Aurora theme.'));
    featRow.appendChild(fL);
    prem.appendChild(featRow);
    prem.appendChild(gate('Aurora theme', 'Exclusive premium visual theme with a violet accent and aurora glow.', !!s.auroraTheme, (v) => {
      Veyro.Store.setSettings({ auroraTheme: v });
      Veyro.toast('Aurora theme', v ? 'Enabled.' : 'Disabled.', 'good');
    }));

    /* Remove premium — requires typing CONFIRM */
    if (Veyro.License.isPremium()) {
      const rmCard = U.card('danger-zone mt-16');
      rmCard.style.padding = '14px 16px';
      rmCard.appendChild(el('div', 'set-title text-danger', 'Remove premium from this PC'));
      rmCard.appendChild(el('div', 'set-desc', 'Drops back to the free plan: premium pages and toggles lock again. Optimizations you already applied stay applied. This is instant and local.'));
      const rmWrap = el('div', 'col mt-8');
      rmWrap.style.gap = '8px';
      const rmRow = el('div', 'row');
      rmRow.style.gap = '8px';
      const rmInp = el('input', 'field');
      rmInp.type = 'text';
      rmInp.placeholder = 'Type CONFIRM to remove premium';
      rmInp.style.width = '280px';
      const rmBtn = U.btn('REMOVE PREMIUM', false, { cls: 'btn-danger-ghost', disabled: true, onClick: () => {
        if (rmInp.value.trim().toUpperCase() !== 'CONFIRM') return;
        rmBtn.disabled = true;
        Veyro.License.remove().then(res => {
          if (res.ok) {
            Veyro.toast('Premium removed', 'You are back on the free plan.', 'warn');
            reRender();
          } else {
            Veyro.toast('Could not remove premium', res.msg || 'Please try again.', 'error');
            rmBtn.disabled = false;
          }
        });
      } });
      rmInp.addEventListener('input', () => {
        rmBtn.disabled = rmInp.value.trim().toUpperCase() !== 'CONFIRM';
      });
      rmRow.appendChild(rmInp);
      rmRow.appendChild(rmBtn);
      rmWrap.appendChild(el('div', 'meta', 'Type CONFIRM (any casing) to continue.'));
      rmWrap.appendChild(rmRow);
      rmCard.appendChild(rmWrap);
      prem.appendChild(rmCard);
    }
    c.appendChild(group('PREMIUM', prem));

    /* Account */
    const A = Veyro.Account;
    const stA = A.state();
    const acct = el('div');
    const accRow = el('div', 'set-row');
    const aL = el('div');
    aL.appendChild(el('div', 'set-title', 'Veyro Account'));
    const aR = el('div', 'row');
    aR.style.gap = '8px';
    if (stA.user) {
      aL.appendChild(el('div', 'set-desc',
        'Signed in as ' + esc(stA.user.name) + ' (' + esc(stA.user.email) + ')' +
        (stA.user.admin ? ' — administrator' : '') +
        '. Your license keys are bound to this account on the local Veyro server.'));
      aR.appendChild(U.chip('ADMIN', 'green'));
      aR.appendChild(U.chip('ONLINE', 'green'));
    } else {
      aL.appendChild(el('div', 'set-desc', stA.online
        ? 'Not signed in. Create an account or sign in to activate and manage license keys on the local Veyro server.'
        : 'The local Veyro server is offline. Restart Veyro to sign in and activate keys.'));
      aR.appendChild(U.chip(stA.online ? 'SERVER ONLINE' : 'SERVER OFFLINE', stA.online ? 'green' : 'red'));
    }
    accRow.appendChild(aL); accRow.appendChild(aR);
    acct.appendChild(accRow);

    if (stA.user) {
      const keysRow = el('div', 'set-row');
      const kL = el('div');
      kL.appendChild(el('div', 'set-title', 'My keys'));
      const keysBox = el('div', 'col mt-8');
      keysBox.style.gap = '6px';
      A.myKeys().then(keys => {
        if (!keys.length) {
          keysBox.appendChild(el('div', 'meta', 'No keys on this account yet. Activate a key in the PREMIUM section above.'));
          return;
        }
        keys.slice(0, 5).forEach(k => {
          const row = el('div', 'row');
          row.style.gap = '8px';
          const mono = el('span', undefined, esc(k.code));
          mono.style.fontFamily = 'JetBrains Mono, monospace';
          mono.style.fontSize = '12px';
          const stat = k.status;
          const tone = stat === 'active' ? 'green' : stat === 'revoked' ? 'red' : stat === 'expired' ? 'yellow' : 'gray';
          row.appendChild(mono);
          row.appendChild(U.chip((k.status || 'unused').toUpperCase(), tone));
          if (k.expiresAt) row.appendChild(el('span', 'meta', 'until ' + new Date(k.expiresAt).toLocaleDateString()));
          keysBox.appendChild(row);
        });
      });
      kL.appendChild(keysBox);
      keysRow.appendChild(kL);
      acct.appendChild(keysRow);
      const actRow = el('div', 'row');
      actRow.style.gap = '8px';
      actRow.style.padding = '12px 0 4px';
      actRow.appendChild(U.btn('OPEN DASHBOARD', false, { arrow: true, onClick: () => Veyro.open('http://127.0.0.1:9175/dashboard.html') }));
      actRow.appendChild(U.btn('SIGN OUT', false, { cls: 'btn-danger-ghost', onClick: () => {
        A.logout().then(() => {
          Veyro.toast('Signed out', 'You are signed out on this PC.', 'warn');
          reRender();
        });
      } }));
      acct.appendChild(actRow);
    } else {
      const loginRow = el('div', 'set-row');
      const fL = el('div');
      fL.appendChild(el('div', 'set-title', 'Sign in or create an account'));
      const ctl = el('div', 'col');
      ctl.style.gap = '6px';
      const eInp = el('input', 'field');
      eInp.type = 'email';
      eInp.placeholder = 'email';
      eInp.style.width = '240px';
      const pInp = el('input', 'field');
      pInp.type = 'password';
      pInp.placeholder = 'password';
      pInp.style.width = '240px';
      const bRow = el('div', 'row');
      bRow.style.gap = '8px';
      const doLogin = () => {
        const email = eInp.value.trim();
        const pass = pInp.value;
        if (!email || !pass) { Veyro.toast('Account', 'Enter an email and password first.', 'warn'); return; }
        A.login(email, pass).then(r => {
          if (r.ok) { Veyro.toast('Welcome back', 'Signed in as ' + r.user.name + '.', 'good'); reRender(); }
          else Veyro.toast('Sign in failed', r.msg || 'Could not sign in.', 'error');
        });
      };
      const doRegister = () => {
        const email = eInp.value.trim();
        const pass = pInp.value;
        if (!email || !pass) { Veyro.toast('Account', 'Enter an email and password first.', 'warn'); return; }
        A.register('', email, pass).then(r => {
          if (r.ok) {
            if (r.gift && r.gift.code) Veyro.toast('FREE 3-hour trial activated!', 'Thanks for registering — premium is live until ' + new Date(r.gift.expiresAt).toLocaleTimeString() + '.', 'good');
            else Veyro.toast('Account created', 'Welcome, ' + r.user.name + '!', 'good');
            reRender();
          }
          else Veyro.toast('Registration failed', r.msg || 'Could not create the account.', 'error');
        });
      };
      const sBtn = U.btn('SIGN IN', true, { sm: true, onClick: doLogin });
      const rBtn = U.btn('CREATE ACCOUNT', false, { sm: true, onClick: doRegister });
      const goBtn = U.btn('OPEN DASHBOARD', false, { sm: true, onClick: () => Veyro.open('http://127.0.0.1:9175/register.html') });
      const rows = el('div', 'col');
      rows.style.gap = '6px';
      rows.appendChild(eInp);
      rows.appendChild(pInp);
      bRow.appendChild(sBtn); bRow.appendChild(rBtn); bRow.appendChild(goBtn);
      ctl.appendChild(rows); ctl.appendChild(bRow);
      fL.appendChild(ctl);
      loginRow.appendChild(fL);
      acct.appendChild(loginRow);
    }
    c.appendChild(group('ACCOUNT', acct));

    /* General */
    const gen = el('div');
    gen.appendChild(rowCfg('Start with Windows', 'Launch Veyro automatically when you sign in.', U.toggle(s.startWithWindows, (v) => { Veyro.Store.setSettings({ startWithWindows: v }); Veyro.toast('Start with Windows', v ? 'Enabled.' : 'Disabled.', 'good'); })));
    gen.appendChild(rowCfg('Automatic scanning', 'Run a health scan in the background on launch.', U.toggle(s.autoScan, (v) => Veyro.Store.setSettings({ autoScan: v }))));
    gen.appendChild(rowCfg('Automatic optimization', 'Apply low-risk optimizations without asking (only LOW risk items).', U.toggle(s.autoOptimize, (v) => Veyro.Store.setSettings({ autoOptimize: v }))));
    gen.appendChild(rowCfg('Scan frequency', 'How often Veyro re-checks your system.', selectCtl([
      { label: 'On launch', value: 'launch' },
      { label: 'Daily', value: 'daily' },
      { label: 'Weekly', value: 'weekly' }
    ], s.scanFrequency || 'daily', (v) => { Veyro.Store.setSettings({ scanFrequency: v }); Veyro.toast('Scan frequency', 'Set to ' + v + '.', 'good'); })));
    c.appendChild(group('GENERAL', gen));

    /* Appearance */
    const appr = el('div');
    appr.appendChild(rowCfg('Animation intensity', 'UI motion speed and effects.', rangeCtl(s.animationIntensity, 0.5, 1.5, 0.25, (v) => {
      Veyro.Store.setSettings({ animationIntensity: v });
    })));
    appr.appendChild(rowCfg('Green accent intensity', 'Brightness of the Veyro accent color.', rangeCtl(s.greenAccentIntensity, 0.6, 1.4, 0.1, (v) => {
      Veyro.Store.setSettings({ greenAccentIntensity: v });
    })));

    /* UI Designer — accent color */
    const PRESETS = [
      ['Veyro Green', '#39FF88'], ['Violet', '#A78BFA'], ['Blue', '#38BDF8'],
      ['Red', '#FF5C5C'], ['Orange', '#FB923C'], ['Pink', '#F472B6'], ['Gold', '#F4C95D']
    ];
    const swWrap = el('div', 'row');
    swWrap.style.gap = '6px';
    swWrap.style.flexWrap = 'wrap';
    const swDots = [];
    const paintDots = () => swDots.forEach(d => {
      d.style.outline = (d.dataset.color === (s.accentColor || '')) ? '2px solid #fff' : 'none';
      d.style.outlineOffset = '2px';
    });
    PRESETS.forEach(([name, hex]) => {
      const b = el('button');
      b.type = 'button';
      b.title = name;
      b.dataset.color = hex;
      b.style.cssText = 'width:26px;height:26px;border-radius:50%;border:1px solid rgba(255,255,255,.25);cursor:pointer;background:' + hex;
      b.addEventListener('click', () => {
        s.accentColor = hex;
        Veyro.Store.setSettings({ accentColor: hex });
        Veyro.toast('Accent color', name + ' applied.', 'good');
        paintDots();
      });
      swDots.push(b);
      swWrap.appendChild(b);
    });
    const custom = el('input');
    custom.type = 'color';
    custom.value = s.accentColor || '#39ff88';
    custom.title = 'Custom color';
    custom.style.cssText = 'width:34px;height:26px;padding:0;border:1px solid var(--border);border-radius:6px;background:transparent;cursor:pointer';
    custom.addEventListener('input', () => {
      s.accentColor = custom.value;
      Veyro.Store.setSettings({ accentColor: custom.value });
      paintDots();
    });
    swWrap.appendChild(custom);
    const resetBtn = U.btn('RESET', false, { sm: true, onClick: () => {
      s.accentColor = '';
      Veyro.Store.setSettings({ accentColor: '' });
      custom.value = '#39ff88';
      Veyro.toast('Accent color', 'Back to Veyro Green.', 'good');
      paintDots();
    } });
    swWrap.appendChild(resetBtn);
    paintDots();
    appr.appendChild(rowCfg('Accent color', 'UI Designer — pick your accent. Applies everywhere instantly.', swWrap));

    /* UI Designer — full theme */
    const uiWrap = el('div', 'row');
    uiWrap.style.gap = '8px';
    uiWrap.style.flexWrap = 'wrap';
    const uiBtn = (label, active, onClick) => {
      const b = U.btn(label, !!active, { sm: true });
      b.addEventListener('click', onClick);
      return b;
    };
    const refresh = () => { Veyro.Store.setSettings({}); reRender(); };

    /* Theme presets */
    const THEME_PRESETS = [
      ['Veyro Dark',  { accentColor: '', bgColor: '', radius: '', fontFamily: '' }],
      ['Midnight',    { accentColor: '#38BDF8', bgColor: 'black',  radius: '',     fontFamily: '' }],
      ['Ocean',       { accentColor: '#22D3EE', bgColor: 'navy',   radius: 'round', fontFamily: '' }],
      ['Sunset',      { accentColor: '#FB923C', bgColor: 'warm',   radius: 'round', fontFamily: '' }],
      ['Forest',      { accentColor: '#4ADE80', bgColor: 'forest', radius: 'round', fontFamily: '' }],
      ['Slate Mono',  { accentColor: '#94A3B8', bgColor: 'slate',  radius: 'sharp', fontFamily: 'mono' }]
    ];
    const tpRow = el('div', 'row');
    tpRow.style.gap = '6px';
    tpRow.style.flexWrap = 'wrap';
    THEME_PRESETS.forEach(([name, patch]) => {
      tpRow.appendChild(uiBtn(name, false, () => {
        Veyro.Store.setSettings(patch);
        Veyro.toast('UI Designer', name + ' theme applied.', 'good');
        reRender();
      }));
    });
    appr.appendChild(rowCfg('Theme presets', 'One-click full-app themes.', tpRow));

    /* Background */
    const bgRow = el('div', 'row');
    bgRow.style.gap = '6px';
    bgRow.style.flexWrap = 'wrap';
    const BGS = [['Default', ''], ['Black', 'black'], ['Navy', 'navy'], ['Warm', 'warm'], ['Forest', 'forest'], ['Slate', 'slate']];
    BGS.forEach(([name, id]) => {
      const b = uiBtn(name, s.bgColor === id, () => { Veyro.Store.setSettings({ bgColor: id }); reRender(); });
      bgRow.appendChild(b);
    });
    appr.appendChild(rowCfg('Background', 'App-wide background palette.', bgRow));

    /* Corners */
    const radRow = el('div', 'row');
    radRow.style.gap = '6px';
    const RADS = [['Default', ''], ['Sharp', 'sharp'], ['Rounded', 'round'], ['Pill', 'pill']];
    RADS.forEach(([name, id]) => {
      radRow.appendChild(uiBtn(name, s.radius === id, () => { Veyro.Store.setSettings({ radius: id }); reRender(); }));
    });
    appr.appendChild(rowCfg('Corners', 'Button and card rounding.', radRow));

    /* Font */
    const fontSel = el('select', 'field');
    fontSel.style.width = '180px';
    fontSel.style.height = '30px';
    fontSel.style.fontSize = '12px';
    [['Inter (default)', ''], ['JetBrains Mono', 'mono'], ['System UI', 'system'], ['Rounded', 'rounded']].forEach(([label, id]) => {
      const op = el('option', undefined, label);
      op.value = id;
      if (s.fontFamily === id) op.selected = true;
      fontSel.appendChild(op);
    });
    fontSel.addEventListener('change', () => { Veyro.Store.setSettings({ fontFamily: fontSel.value }); reRender(); });
    appr.appendChild(rowCfg('Font', 'App-wide typeface.', fontSel));

    /* Text sizes */
    appr.appendChild(rowCfg('Sidebar text size', 'Scale menu text in the sidebar.', rangeCtl(s.sidebarTextSize || 1, 0.85, 1.3, 0.05, (v) => {
      Veyro.Store.setSettings({ sidebarTextSize: v });
    })));
    appr.appendChild(rowCfg('Content text size', 'Scale text in the main area.', rangeCtl(s.textSize || 1, 0.85, 1.3, 0.05, (v) => {
      Veyro.Store.setSettings({ textSize: v });
    })));

    c.appendChild(group('APPEARANCE', appr));

    /* Optimization */
    const opt = el('div');
    const srcRow = el('div', 'set-row');
    const srcL = el('div');
    srcL.appendChild(el('div', 'set-title', 'Hardware source'));
    srcL.appendChild(el('div', 'set-desc', Veyro.isDemo()
      ? 'Demo hardware data is active. Turn Demo Mode off to read real hardware through the native agent.'
      : 'Native agent connected \u2014 real hardware data is live.'));
    const srcR = el('div', 'row');
    srcR.style.gap = '8px';
    srcR.appendChild(U.chip(Veyro.isDemo() ? 'DEMO MODE' : 'LIVE SYSTEM', Veyro.isDemo() ? 'yellow' : 'green'));
    const recBtn = U.btn('RECONNECT', false, { sm: true, onClick: () => {
      Veyro.HardwareAgent.reconnect();
      Veyro.toast('Hardware agent', 'Reconnecting \u2014 ' + (Veyro.isDemo() ? 'demo data is active.' : 'native agent active.'), 'good');
      Veyro.Router.refreshTopBar();
    } });
    srcR.appendChild(recBtn);
    srcRow.appendChild(srcL); srcRow.appendChild(srcR);
    opt.appendChild(srcRow);
    opt.appendChild(rowCfg('Demo mode', 'Use clearly labeled demo hardware data when the native agent is not connected. When off, Veyro requires the native hardware agent and shows an error state if unavailable.', U.toggle(s.demoMode, (v) => {
      Veyro.Store.setSettings({ demoMode: v });
      Veyro.HardwareAgent.reconnect();
      Veyro.toast('Demo mode', v ? 'Demo hardware data active.' : 'Real hardware detection active.', 'warn');
      Veyro.Router.refreshTopBar();
      Veyro.Router.go('dashboard');
    })));
    c.appendChild(group('OPTIMIZATION', opt));

    /* Gaming */
    const gmc = el('div');
    gmc.appendChild(gate('In-game FPS overlay', 'Show a compact FPS overlay inside supported games.', !!s.fpsOverlay, (v) => { Veyro.Store.setSettings({ fpsOverlay: v }); Veyro.toast('FPS overlay', v ? 'Enabled.' : 'Disabled.', 'good'); }));
    gmc.appendChild(rowCfg('Game profile auto-detect', 'Automatically detect installed games and apply saved profiles.', U.toggle(!!s.autoDetectGames, (v) => Veyro.Store.setSettings({ autoDetectGames: v }))));
    gmc.appendChild(rowCfg('Default graphics preset', 'Baseline used when generating game optimizations.', selectCtl([
      { label: 'Performance', value: 'perf' },
      { label: 'Balanced', value: 'balanced' },
      { label: 'Quality', value: 'quality' }
    ], s.gamePreset || 'perf', (v) => { Veyro.Store.setSettings({ gamePreset: v }); Veyro.toast('Default preset', 'Set to ' + v.toUpperCase() + '.', 'good'); })));
    c.appendChild(group('GAMING', gmc));

    /* Notifications */
    const not = el('div');
    not.appendChild(rowCfg('Notifications', 'Show alerts for health issues, drivers and high temperatures.', U.toggle(s.notifications, (v) => Veyro.Store.setSettings({ notifications: v }))));
    not.appendChild(gate('High temperature alerts', 'Notify when CPU or GPU exceeds safe thresholds.', !!s.tempAlerts, (v) => Veyro.Store.setSettings({ tempAlerts: v })));
    c.appendChild(group('NOTIFICATIONS', not));

    /* Privacy */
    const prv = el('div');
    prv.appendChild(rowCfg('Anonymous telemetry', 'Share anonymous performance data to improve recommendations.', U.toggle(s.privacyTelemetry, (v) => Veyro.Store.setSettings({ privacyTelemetry: v }))));
    prv.appendChild(rowCfg('Local data only', 'All scans, keys and settings stay on this PC.', U.toggle(!!s.localOnly, (v) => Veyro.Store.setSettings({ localOnly: v }))));
    c.appendChild(group('PRIVACY', prv));

/* About */
    const ab = el('div');
    const aCard = U.card('set-group');
    aCard.appendChild(el('div', 'sg-name', 'Veyro'));
    const row1 = el('div');
    const brand = el('div', 'row');
    const mark = el('span', 'brand-mark');
    mark.style.width = '30px'; mark.style.height = '30px';
    mark.innerHTML = icon('v', 16);
    const bi = el('div');
    bi.appendChild(el('div', 'font-bold', 'Veyro  Â·  Optimize. Upgrade. Perform.'));
    bi.appendChild(el('div', 'meta', 'PC PERFORMANCE Â· version ' + Veyro.VERSION));
    brand.appendChild(mark); brand.appendChild(bi); brand.appendChild(el('div', 'flex-1'));
    brand.appendChild(U.chip(Veyro.isDemo() ? 'DEMO MODE' : 'AGENT CONNECTED', Veyro.isDemo() ? 'yellow' : 'green'));
    row1.appendChild(brand);
    aCard.appendChild(row1);
    const row2 = el('div', 'set-row');
    row2.appendChild(el('div', null, ''));
    row2.innerHTML = '';
    const r2l = el('div');
    r2l.appendChild(el('div', 'set-title', 'Safety policy'));
    r2l.appendChild(el('div', 'set-desc', 'Veyro never disables security software, modifies BIOS/firmware, or overclocks hardware. Every change is reversible and protected by a restore point where possible.'));
    row2.appendChild(r2l);
    aCard.appendChild(row2);
    c.appendChild(aCard);

    /* Updates */
    const upd = el('div');
    const updCard = U.card('set-group');
    updCard.appendChild(el('div', 'sg-name', 'Updates'));
    const updInfo = el('div', 'set-row');
    const uL = el('div');
    uL.appendChild(el('div', 'set-title', 'Version'));
    uL.appendChild(el('div', 'set-desc', 'Current version ' + Veyro.VERSION + '. Updates are published on GitHub. Veyro checks automatically on launch.'));
    const uR = el('div', 'row');
    uR.style.gap = '8px';
    const checkBtn = U.btn('CHECK NOW', false, { sm: true, ic: 'scan', onClick: () => {
      checkBtn.disabled = true;
      checkBtn.textContent = 'CHECKING…';
      Veyro.IPC('veyro:check-update').then(res => {
        checkBtn.disabled = false;
        checkBtn.textContent = 'CHECK NOW';
        if (res.ok && res.hasUpdate) {
          Veyro.toast('Update available', 'Version ' + res.version + ' is ready. Click to download.', 'good');
          updateMsg.textContent = 'Update available: v' + res.version + (res.notes ? ' — ' + res.notes : '');
          dlBtn.disabled = false;
        } else if (res.ok) {
          Veyro.toast('Up to date', 'You are on the latest version.', 'good');
          updateMsg.textContent = 'You are on the latest version (' + Veyro.VERSION + ').';
        } else {
          Veyro.toast('Update check failed', res.msg || 'Could not reach update server.', 'error');
          updateMsg.textContent = 'Check failed: ' + (res.msg || 'unknown error');
        }
      });
    } });
    uR.appendChild(checkBtn);
    const dlBtn = U.btn('DOWNLOAD', false, { sm: true, disabled: true, ic: 'down', onClick: () => {
      dlBtn.disabled = true;
      dlBtn.textContent = 'DOWNLOADING…';
      Veyro.IPC('veyro:download-update').then(res => {
        if (res.ok) {
          Veyro.toast('Downloaded', 'Update ready. Install now?', 'good');
          installBtn.disabled = false;
        } else {
          dlBtn.disabled = false;
          dlBtn.textContent = 'DOWNLOAD';
          Veyro.toast('Download failed', res.msg || 'Could not download update.', 'error');
        }
      });
    } });
    const installBtn = U.btn('INSTALL', false, { sm: true, disabled: true, cls: 'btn-danger-ghost', ic: 'check', onClick: () => {
      Veyro.toast('Installing', 'Veyro will restart to apply the update.', 'warn');
      Veyro.IPC('veyro:install-update');
    } });
    uR.appendChild(dlBtn);
    uR.appendChild(installBtn);
    updInfo.appendChild(uL);
    updInfo.appendChild(uR);
    updCard.appendChild(updInfo);
    const updateMsg = el('div', 'meta mt-8');
    updCard.appendChild(updateMsg);
    c.appendChild(group('UPDATES', updCard));

    function rangeCtl(val, min, max, step, onChange) {
      const wrap = el('div', 'row');
      const inp = el('input');
      inp.type = 'range'; inp.min = min; inp.max = max; inp.step = step; inp.value = val;
      inp.addEventListener('input', () => { onChange(parseFloat(inp.value)); });
      const out = el('span', 'meta num', String(val));
      inp.addEventListener('input', () => { out.textContent = parseFloat(inp.value).toFixed(2); });
      wrap.appendChild(inp); wrap.appendChild(out);
      return wrap;
    }

    return { destroy() { c.innerHTML = ''; } };
  }

  /* ============================================================
     WELCOME (first start) \u2014 real hardware scan
     ============================================================ */
  function welcome(onDone) {
    const ov = el('div', 'welcome');
    const panelEl = el('div', 'welcome-panel');
    const logoWrap = el('div', 'welcome-logo');
    const mark = el('span', 'brand-mark');
    mark.style.width = '56px'; mark.style.height = '56px';
    mark.style.borderRadius = '10px';
    mark.innerHTML = icon('v', 26);
    logoWrap.appendChild(mark);
    panelEl.appendChild(logoWrap);
    panelEl.appendChild(el('div', 'eyebrow', 'Veyro Â· PC PERFORMANCE'));
    panelEl.appendChild(el('h1', undefined, 'Welcome to Veyro.'));
    panelEl.appendChild(el('div', 'sub', 'Let\'s scan your PC and see what it\'s capable of.'));
    const feat = el('div', 'feature-row');
    feat.appendChild(U.chip('REAL HARDWARE DETECTION', 'green'));
    feat.appendChild(U.chip('PERFORMANCE', 'green'));
    feat.appendChild(U.chip('UPGRADE ADVISOR', 'green'));
    panelEl.appendChild(feat);
    const scanBtnWrap = el('div', 'mt-16');
    scanBtnWrap.appendChild(U.btn('SCAN MY PC', true, { ic: 'scan', arrow: true, onClick: runScan }));
    panelEl.appendChild(scanBtnWrap);
    ov.appendChild(panelEl);
    document.body.appendChild(ov);

    const STAGES = [
      'Detecting CPU...',
      'Detecting GPU...',
      'Detecting RAM...',
      'Detecting storage...',
      'Detecting motherboard...',
      'Detecting Windows...',
      'Checking drivers...'
    ];

    function runScan() {
      const overlay = Veyro.$('#scan-overlay');
      const fill = Veyro.$('#scan-progress-fill');
      const pctEl = Veyro.$('#scan-progress-text');
      const stepsEl = Veyro.$('#scan-steps');
      fill.style.width = '0%';
      stepsEl.innerHTML = '';
      STAGES.forEach(s => {
        const row = el('div', 'scan-step');
        row.innerHTML = `<span class="s-ic"></span><span>${esc(s)}</span>`;
        stepsEl.appendChild(row);
      });
      overlay.classList.remove('hidden');
      const all = Veyro.$$('.scan-step', stepsEl);

      const scanPromise = Veyro.HardwareAgent.getSnapshot().catch(err => ({ __err: err }));

      let i = 0;
      const tick = () => {
        if (i > 0) all[i - 1].classList.add('done');
        if (i < all.length) {
          all[i].classList.add('on');
          all[i].querySelector('.s-ic').innerHTML = '<span class="s-spin">' + icon('scan', 14) + '</span>';
        }
      };
      tick();
      const iv = setInterval(() => {
        i++;
        fill.style.width = Math.round((i / all.length) * 100) + '%';
        pctEl.textContent = Math.round((i / all.length) * 100) + '%';
        if (i >= all.length) {
          clearInterval(iv);
        } else tick();
      }, 560);

      Promise.all([scanPromise, new Promise(r => {
        const chk = () => (i >= all.length ? r() : setTimeout(chk, 120));
        chk();
      })]).then(([snap]) => {
        Veyro.$$('.scan-step', stepsEl).forEach(r2 => { r2.classList.remove('on'); r2.classList.add('done'); r2.querySelector('.s-ic').innerHTML = icon('check', 14); });
        fill.style.width = '100%';
        pctEl.textContent = '100%';
        setTimeout(() => { overlay.classList.add('hidden'); done(snap); }, 450);
      });
    }

    function done(snapOrErr) {
      const failed = !snapOrErr || snapOrErr.__err;

      /* fresh agent state */
      Veyro.HardwareAgent.reconnect();

      /* DEV/DEMO fallback \u2014 never for native users */
      if (failed && !Veyro.isDemo()) {
        ov.innerHTML = '';
        const p = el('div', 'welcome-panel');
        p.appendChild(el('div', 'eyebrow', 'Veyro'));
        p.appendChild(el('h1', undefined, 'Unable to access hardware information.'));
        p.appendChild(el('div', 'sub', failed ? String(snapOrErr.__err.message || '') : 'The native agent could not read this system.'));
        const btns = el('div', 'col mt-16');
        btns.style.alignItems = 'center';
        const retry = U.btn('RETRY', true, { ic: 'scan', onClick: runScan });
        const devDemo = U.btn('Use demo data for development', false, { onClick: () => {
          Veyro.Store.setSettings({ demoMode: true });
          Veyro.HardwareAgent.reconnect();
          done(null); /* now demo is active */
        } });
        btns.appendChild(retry); btns.appendChild(devDemo);
        p.appendChild(btns);
        ov.appendChild(p);
        return;
      }

      /* reveal YOUR PC */
      const snap = failed ? null : snapOrErr;
      ov.innerHTML = '';
      const p = el('div', 'welcome-panel');
      p.appendChild(el('div', 'eyebrow', 'YOUR PC'));
      const badge = U.chip(Veyro.isDemo() ? 'DEMO MODE \u2014 demo hardware data' : 'LIVE SYSTEM \u2014 real hardware detected',
        Veyro.isDemo() ? 'yellow' : 'green');
      const badgeWrap = el('div');
      badgeWrap.style.margin = '12px 0';
      badgeWrap.appendChild(badge);
      p.appendChild(badgeWrap);

      const rows = el('div', 'col');
      rows.style.textAlign = 'left';
      rows.style.maxWidth = '420px';
      rows.style.margin = '0 auto';
      rows.style.gap = '7px';
      const rr = (k, v) => {
        const r = el('div', 'row');
        const kk = el('span', 'meta ls-wide', k);
        kk.style.flex = '1';
        const vv = el('span', 'font-bold num', esc(v));
        vv.style.fontSize = '12px';
        r.appendChild(kk); r.appendChild(vv);
        rows.appendChild(r);
      };
      if (snap) {
        rr('CPU', Veyro.av(snap.cpu.model) + (snap.cpu.cores ? ` Â· ${snap.cpu.cores}C/${snap.cpu.threads}T` : ''));
        rr('GPU', Veyro.av(snap.gpu.model) + (snap.gpu.vram ? ` Â· ${Math.round(snap.gpu.vram / 1024)} GB` : ''));
        rr('RAM', Veyro.av(snap.ram.total, ' GB') + (snap.ram.type ? ' ' + snap.ram.type : ''));
        rr('STORAGE', snap.storage[0] && snap.storage[0].total ? Veyro.fmt.tb(snap.storage[0].total) : 'Unavailable');
        rr('MOTHERBOARD', Veyro.av(snap.motherboard.manufacturer) + (snap.motherboard.model ? ' ' + snap.motherboard.model : ''));
        rr('WINDOWS', Veyro.av(snap.os.name) + (snap.os.build ? ' Â· build ' + snap.os.build : ''));
      } else {
        rr('STATUS', 'No data returned.');
      }
      p.appendChild(rows);

      const enter = el('div', 'mt-16');
      enter.appendChild(U.btn('ENTER Veyro', true, { arrow: true, onClick: () => {
        Veyro.Store.set('onboarded', true);
        ov.remove();
        onDone();
      } }));
      p.appendChild(enter);
ov.appendChild(p);
    }
  }

/* ---------- Power Tools ---------- */

  const tools = (container) => {
    const T = Veyro.Tools;
    const c = el('div');

    const head = el('div');
    head.appendChild(el('div', 'eyebrow', 'UTILITIES'));
    head.appendChild(el('h1', 'h-page', 'Power Tools.'));
    head.appendChild(el('div', 'meta', 'Small real Windows utilities. With the native agent connected these act on your PC; in demo mode they show sample data.'));
    c.appendChild(head);

    const grid = el('div');
    grid.style.display = 'grid';
    grid.style.gridTemplateColumns = 'repeat(auto-fill,minmax(430px,1fr))';
    grid.style.gap = '14px';
    grid.style.marginTop = '18px';

    const spin = () => '<span class="s-spin" style="display:inline-flex;vertical-align:-3px">' + icon('scan', 13) + '</span>';

    const makeRow = (title, sub, rightHtml) => {
      const r = el('div', 'set-row');
      const l = el('div');
      l.appendChild(el('div', 'set-title', esc(title)));
      if (sub) l.appendChild(el('div', 'set-desc', sub));
      r.appendChild(l);
      const rr = el('div', 'row');
      rr.style.gap = '8px';
      if (rightHtml) rr.innerHTML = rightHtml;
      r.appendChild(rr);
      return r;
    };

    const stateLine = (body) => {
      const s = el('div', 'meta');
      s.style.marginTop = '6px';
      body.appendChild(s);
      return s;
    };

    const toolCard = (def) => {
      const card = U.card('tools-card');
      card.style.padding = '16px';
      const headRow = el('div', 'row');
      headRow.style.gap = '10px';
      const ico = el('div', 'tools-ico');
      ico.style.cssText = 'width:34px;height:34px;border-radius:9px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);display:flex;align-items:center;justify-content:center;color:var(--accent);flex:none';
      ico.innerHTML = icon(def.icon, 16);
      const tt = el('div');
      tt.appendChild(el('div', 'font-bold', esc(def.title)));
      tt.appendChild(el('div', 'meta', esc(def.desc)));
      headRow.appendChild(ico); headRow.appendChild(tt);
      headRow.style.marginBottom = '10px';
      card.appendChild(headRow);
      const body = el('div', 'col');
      body.style.gap = '6px';
      card.appendChild(body);
      def.mount(body, card);
      return card;
    };

    const loadInto = (def, body, btn, arg) => {
      const stl = stateLine(body);
      if (btn) btn.disabled = true;
      stl.innerHTML = spin() + ' Loading…';
      T.load(def.id, arg).then(res => {
        stl.remove();
        if (btn) btn.disabled = false;
        if (!res.ok) { stateLine(body).textContent = 'Error: ' + (res.msg || 'could not load.'); return; }
        const demoTag = res.demo ? ' · SAMPLE DATA' : '';
        if (res.demo) stateLine(body).textContent = 'Live agent unavailable — showing sample data.';
        try { def.render(res.data, body, demoTag, arg); }
        catch (err) { stateLine(body).textContent = 'Render error: ' + err.message; }
      });
    };

    const defs = [
      /* 1 — Startup Manager */
      {
        id: 'startup', title: 'Startup Manager', icon: 'gear', cat: 'System',
        desc: 'See what launches with Windows and toggle entries on/off.',
        mount: (body) => {
          const btn = U.btn('LOAD STARTUP ITEMS', true, { sm: true });
          const wrap = el('div'); wrap.style.display = 'contents';
          body.appendChild(btn);
          const render = (data) => {
            const sorted = (data || []).slice().sort((a, b) => a.enabled === b.enabled ? 0 : a.enabled ? -1 : 1);
            body.querySelectorAll('.tools-row').forEach(r => r.remove());
            (sorted || []).forEach(it => {
              const row = makeRow(it.name, (it.scope || '') + ' · ' + (it.command || '').slice(0, 90), '');
              row.classList.add('tools-row');
              row.querySelector('.row').appendChild(U.chip(it.enabled ? 'ON' : 'OFF', it.enabled ? 'green' : 'gray'));
              row.querySelector('.row').appendChild(U.btn(it.enabled ? 'DISABLE' : 'ENABLE', false, { sm: true, title: it.name + (it.enabled ? ' disabled' : ' enabled'), onClick: () => {
                T.run('startupToggle', { name: it.name, command: it.command, scope: it.scope, enable: !it.enabled }).then(() => {
                  Veyro.toast('Startup Manager', it.name + (it.enabled ? ' disabled.' : ' enabled.'), 'warn');
                  loadInto({ id: 'startup', render }, body);
                });
              } }));
              body.appendChild(row);
            });
          };
          btn.addEventListener('click', () => loadInto({ id: 'startup', render }, body, btn));
        }
      },
      /* 2 — Junk Cleaner */
      {
        id: 'junk', title: 'Junk Cleaner', icon: 'trash', cat: 'Storage',
        desc: 'Measure temp/cache/recycle-bin space and clear it safely.',
        mount: (body) => {
          const btn = U.btn('ANALYZE JUNK', true, { sm: true });
          body.appendChild(btn);
          const render = (data) => {
            body.querySelectorAll('.tools-row').forEach(r => r.remove());
            (data.items || []).forEach(it => {
              const row = makeRow(it.name, it.path, '');
              row.classList.add('tools-row');
              row.querySelector('.row').appendChild(el('span', 'meta', T.fmtBytes(it.bytes)));
              row.querySelector('.row').appendChild(U.btn('CLEAN', false, { sm: true, onClick: () => {
                T.run('junkClean', it.path).then(r2 => {
                  if (r2.ok) { Veyro.toast('Junk Cleaner', 'Freed ' + T.fmtBytes(r2.data.freed), 'good'); loadInto({ id: 'junk', render }, body); }
                  else Veyro.toast('Junk Cleaner', r2.msg || 'Could not clean.', 'error');
                });
              } }));
              body.appendChild(row);
            });
            if (data.total) body.querySelector('.tools-row:last-child .set-title').textContent = 'TOTAL RECLAIMABLE';
          };
          btn.addEventListener('click', () => loadInto({ id: 'junk', render }, body, btn));
        }
      },
      /* 3 — Storage Analyzer */
      {
        id: 'storage', title: 'Storage Analyzer', icon: 'folder', cat: 'Storage',
        desc: 'See which folders on a drive use the most space.',
        mount: (body) => {
          const inp = el('input', 'field'); inp.type = 'text'; inp.placeholder = 'C:\\'; inp.value = ''; inp.style.width = '150px';
          const btn = U.btn('ANALYZE', true, { sm: true });
          const row0 = el('div', 'row'); row0.style.gap = '8px';
          row0.appendChild(inp); row0.appendChild(btn);
          body.appendChild(row0);
          const render = (data) => {
            body.querySelectorAll('.tools-row').forEach(r => r.remove());
            const max = Math.max(1, ...(data || []).map(f => f.bytes || 0));
            (data || []).forEach(f => {
              const row = el('div', 'set-row tools-row');
              const l = el('div');
              l.appendChild(el('div', 'set-title', esc(f.name)));
              l.appendChild(el('div', 'set-desc', esc(f.path)));
              const pct = Math.round(((f.bytes || 0) / max) * 100);
              l.appendChild(el('div', 'set-desc', '<span style="color:var(--accent)">' + '█'.repeat(Math.max(1, Math.round(pct / 6))) + '</span> ' + T.fmtBytes(f.bytes)));
              row.appendChild(l);
              body.appendChild(row);
            });
          };
          btn.addEventListener('click', () => loadInto({ id: 'storage', render }, body, btn, inp.value.trim() || (Veyro.Store.get().settings.demoMode ? null : null)));
        }
      },
      /* 4 — Duplicate Finder */
      {
        id: 'dupes', title: 'Duplicate Finder', icon: 'layers', cat: 'Storage',
        desc: 'Find duplicate files (by hash) inside a folder.',
        mount: (body) => {
          const inp = el('input', 'field'); inp.type = 'text'; inp.placeholder = 'Folder to scan (e.g. C:\\Users\\you\\Downloads)'; inp.style.width = '240px';
          const btn = U.btn('FIND DUPLICATES', true, { sm: true });
          const row0 = el('div', 'row'); row0.style.gap = '8px';
          row0.appendChild(inp); row0.appendChild(btn);
          body.appendChild(row0);
          const render = (data) => {
            body.querySelectorAll('.tools-row').forEach(r => r.remove());
            if (!data || !data.length) { stateLine(body).textContent = 'No duplicates found in the scanned range.'; return; }
            (data || []).forEach(g => {
              const row = makeRow(g.count + ' copies · ' + (g.hash || '').slice(0, 10), (g.files || []).join('\n'), '');
              row.classList.add('tools-row');
              body.appendChild(row);
            });
          };
          btn.addEventListener('click', () => loadInto({ id: 'dupes', render }, body, btn, inp.value.trim() || ''));
        }
      },
      /* 5 — Power Plan Manager */
      {
        id: 'power', title: 'Power Plan Manager', icon: 'power', cat: 'System',
        desc: 'Switch, inspect or recreate Windows power plans.',
        mount: (body) => {
          const btn = U.btn('LOAD PLANS', true, { sm: true });
          const hp = U.btn('＋ HIGH PERFORMANCE', false, { sm: true, onClick: () => {
            T.run('powerHp').then(r2 => {
              if (r2.ok && r2.data.ok) { Veyro.toast('Power', 'High performance plan created and activated.', 'good'); loadInto({ id: 'power', render }, body); }
              else Veyro.toast('Power', (r2.data && r2.data.raw) || r2.msg || 'Could not create plan.', 'error');
            });
          } });
          const row0 = el('div', 'row'); row0.style.gap = '8px';
          row0.appendChild(btn); row0.appendChild(hp);
          body.appendChild(row0);
          const render = (data) => {
            body.querySelectorAll('.tools-row').forEach(r => r.remove());
            (data.plans || []).forEach(p => {
              const row = makeRow(p.name, p.guid, '');
              row.classList.add('tools-row');
              row.querySelector('.row').appendChild(U.chip(p.active ? 'ACTIVE' : '', p.active ? 'green' : 'gray'));
              if (!p.active) {
                row.querySelector('.row').appendChild(U.btn('SET ACTIVE', false, { sm: true, onClick: () => {
                  T.run('powerSet', p.guid).then(r2 => {
                    if (r2.ok && r2.data.ok) { Veyro.toast('Power', p.name + ' is now the active plan.', 'good'); loadInto({ id: 'power', render }, body); }
                    else Veyro.toast('Power', (r2.data && r2.data.raw) || 'Could not switch plan.', 'error');
                  });
                } }));
              }
              body.appendChild(row);
            });
          };
          btn.addEventListener('click', () => loadInto({ id: 'power', render }, body, btn));
        }
      },
      /* 6 — Network Tools */
      {
        id: 'net', title: 'Network Tools', icon: 'net', cat: 'Network',
        desc: 'Latency to popular hosts, adapters and one-click DNS flush.',
        mount: (body) => {
          const btn = U.btn('RUN TESTS', true, { sm: true });
          const flush = U.btn('FLUSH DNS', false, { sm: true, onClick: () => {
            T.run('netFlush').then(r2 => {
              if (r2.ok) { Veyro.toast('Network', 'DNS resolver cache flushed.', 'good'); }
              else Veyro.toast('Network', r2.msg || 'Could not flush DNS.', 'error');
            });
          } });
          const row0 = el('div', 'row'); row0.style.gap = '8px';
          row0.appendChild(btn); row0.appendChild(flush);
          body.appendChild(row0);
          const render = (data) => {
            body.querySelectorAll('.tools-row').forEach(r => r.remove());
            (data.pings || []).forEach(p => {
              const row = makeRow(p.host, '', '');
              row.classList.add('tools-row');
              row.querySelector('.row').appendChild(U.chip(p.ok ? (p.ms + ' ms') : 'FAIL', p.ok ? 'green' : 'red'));
              body.appendChild(row);
            });
            (data.adapters || []).forEach(a => {
              const row = makeRow(a.name, 'IP ' + (a.ip || '—') + (a.gateway ? ' · GW ' + a.gateway : ''), '');
              row.classList.add('tools-row');
              body.appendChild(row);
            });
          };
          btn.addEventListener('click', () => loadInto({ id: 'net', render }, body, btn));
        }
      },
      /* 7 — Uninstall Helper */
      {
        id: 'uninstall', title: 'Uninstall Helper', icon: 'trash', cat: 'Apps',
        desc: 'Browse installed programs and their footprint.',
        mount: (body) => {
          const btn = U.btn('LIST PROGRAMS', true, { sm: true });
          body.appendChild(btn);
          const render = (data) => {
            body.querySelectorAll('.tools-row').forEach(r => r.remove());
            (data || []).slice(0, 40).forEach(p => {
              const row = makeRow(p.name, (p.publisher || 'Unknown') + (p.version ? ' · ' + p.version : ''), '');
              row.classList.add('tools-row');
              row.querySelector('.row').appendChild(el('span', 'meta', p.sizeBytes ? T.fmtBytes(p.sizeBytes) : ''));
              if (p.uninstallString) {
                row.querySelector('.row').appendChild(U.btn('COPY CMD', false, { sm: true, onClick: () => {
                  navigator.clipboard && navigator.clipboard.writeText(p.uninstallString).then(() => Veyro.toast('Uninstall', 'Uninstall command copied.', 'good'), () => {});
                } }));
              }
              body.appendChild(row);
            });
          };
          btn.addEventListener('click', () => loadInto({ id: 'uninstall', render }, body, btn));
        }
      },
      /* 8 — Services Manager */
      {
        id: 'services', title: 'Services Manager', icon: 'gear', cat: 'System',
        desc: 'Start, stop or change startup type of Windows services.',
        mount: (body) => {
          const btn = U.btn('LIST SERVICES', true, { sm: true });
          body.appendChild(btn);
          const render = (data) => {
            body.querySelectorAll('.tools-row').forEach(r => r.remove());
            (data || []).slice(0, 30).forEach(s => {
              const row = makeRow(s.display, s.name + ' · ' + (s.startType || ''), '');
              row.classList.add('tools-row');
              row.querySelector('.row').appendChild(U.chip(s.status, s.status === 'Running' ? 'green' : s.status === 'Stopped' ? 'gray' : 'yellow'));
              const act = s.status === 'Running' ? 'STOP' : 'START';
              row.querySelector('.row').appendChild(U.btn(act, false, { sm: true, onClick: () => {
                T.run('serviceSet', { name: s.name, action: act.toLowerCase() }).then(r2 => {
                  if (r2.ok && r2.data.ok) { Veyro.toast('Services', s.name + ' is now ' + r2.data.status + '.', 'warn'); loadInto({ id: 'services', render }, body); }
                  else Veyro.toast('Services', (r2.data && r2.data.why) || r2.msg || 'Action failed.', 'error');
                });
              } }));
              body.appendChild(row);
            });
          };
          btn.addEventListener('click', () => loadInto({ id: 'services', render }, body, btn));
        }
      },
      /* 9 — Shutdown Timer */
      {
        id: 'shutdown', title: 'Shutdown Timer', icon: 'timer', cat: 'System',
        desc: 'Schedule a shutdown or restart, or cancel a scheduled one.',
        mount: (body) => {
          const sel = el('select', 'field');
          [5, 15, 30, 60, 120].forEach(m => { const op = el('option', undefined, m + ' minutes'); op.value = m; if (m === 30) op.selected = true; sel.appendChild(op); });
          sel.style.width = '120px'; sel.style.height = '30px';
          const sd = U.btn('SHUT DOWN', false, { sm: true, onClick: () => T.run('shutdown', { cmd: 'shutdown', mins: +sel.value }).then(r2 => r2.ok ? Veyro.toast('Shutdown', 'Scheduled in ' + sel.value + ' minutes.', 'warn') : Veyro.toast('Shutdown', r2.msg || 'Failed.', 'error')) });
          const rs = U.btn('RESTART', false, { sm: true, onClick: () => T.run('shutdown', { cmd: 'restart', mins: +sel.value }).then(r2 => r2.ok ? Veyro.toast('Shutdown', 'Restart scheduled in ' + sel.value + ' minutes.', 'warn') : Veyro.toast('Shutdown', r2.msg || 'Failed.', 'error')) });
          const cn = U.btn('CANCEL', false, { sm: true, cls: 'btn-danger-ghost', onClick: () => T.run('shutdown', { cmd: 'cancel' }).then(r2 => r2.ok ? Veyro.toast('Shutdown', 'Shutdown cancelled.', 'good') : Veyro.toast('Shutdown', r2.msg || 'Nothing scheduled?', 'warn')) });
          const row0 = el('div', 'row'); row0.style.gap = '8px';
          row0.appendChild(sel); row0.appendChild(sd); row0.appendChild(rs); row0.appendChild(cn);
          body.appendChild(row0);
        }
      },
      /* 10 — Process Manager */
      {
        id: 'processes', title: 'Process Manager', icon: 'cpu', cat: 'System',
        desc: 'Top processes by memory use, with one-click terminate.',
        mount: (body) => {
          const btn = U.btn('LIST PROCESSES', true, { sm: true });
          body.appendChild(btn);
          const render = (data) => {
            body.querySelectorAll('.tools-row').forEach(r => r.remove());
            (data || []).forEach(p => {
              const row = makeRow(p.name, 'PID ' + p.pid + (p.desc ? ' · ' + p.desc : ''), '');
              row.classList.add('tools-row');
              row.querySelector('.row').appendChild(el('span', 'meta', T.fmtBytes(p.memMB * 1048576)));
              row.querySelector('.row').appendChild(U.btn('END', false, { sm: true, cls: 'btn-danger-ghost', onClick: () => {
                T.run('processKill', p.pid).then(r2 => {
                  if (r2.ok && r2.data.ok) { Veyro.toast('Process', p.name + ' ended.', 'warn'); loadInto({ id: 'processes', render }, body); }
                  else Veyro.toast('Process', (r2.data && r2.data.why) || r2.msg || 'Could not end process.', 'error');
                });
              } }));
              body.appendChild(row);
            });
          };
          btn.addEventListener('click', () => loadInto({ id: 'processes', render }, body, btn));
        }
      }
    ];

    // Get unique categories
    const categories = [...new Set(defs.map(d => d.cat))].sort();
    const categoryIcons = {
      'System': 'gear',
      'Storage': 'disk',
      'Network': 'net',
      'Apps': 'folder'
    };

    const tabGroup = U.tabGroup({
      tabs: categories.map((cat, idx) => ({
        id: cat.toLowerCase(),
        label: cat,
        icon: categoryIcons[cat] || 'gear',
        groups: [{ id: cat.toLowerCase(), label: cat, content: (panel) => renderCategoryTools(panel, cat) }]
      })),
      defaultTab: 0,
      onTabChange: () => {}
    });
    c.appendChild(tabGroup.root);

    function renderCategoryTools(panel, category) {
      panel.innerHTML = '';
      const grid = el('div');
      grid.style.display = 'grid';
      grid.style.gridTemplateColumns = 'repeat(auto-fill,minmax(430px,1fr))';
      grid.style.gap = '14px';
      grid.style.marginTop = '18px';
      panel.appendChild(grid);

      const catDefs = defs.filter(d => d.cat === category);
      catDefs.forEach(d => grid.appendChild(toolCard(d)));
    }

    container.appendChild(c);
    return {};
  }

  /* ---------- exports ---------- */
  return { dashboard, optimize, optcenter, performance, hardware, upgrades, games, gameDetail, health, settings, driver, report, welcome, scanOverlay, tips, finder, tools };
})();
