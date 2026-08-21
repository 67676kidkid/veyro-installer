/* ============================================================
   Veyro UI components — small reusable builders.
   ============================================================ */
console.log('[components.js] loading...');
Veyro.UI = (() => {
  'use strict';

  const { el, icon, esc } = Veyro;

  /* card wrapper */
  const card = (cls) => el('div', 'card' + (cls ? ' ' + cls : ''));

  /* primary / ghost button */
  function btn(label, primary, opts = {}) {
    const b = el('button', `btn ${primary ? 'btn-primary' : 'btn-ghost'} ${opts.sm ? 'btn-sm' : ''} ${opts.cls || ''}`);
    b.type = 'button';
    if (opts.ic) b.appendChild(iconEl(opts.ic));
    b.appendChild(document.createTextNode(label));
    if (opts.arrow) b.appendChild(iconEl('arrow'));
    if (opts.onClick) b.addEventListener('click', opts.onClick);
    if (opts.disabled) b.disabled = true;
    if (opts.title) b.title = opts.title;
    return b;
  }

  function iconEl(name, size) {
    const s = el('span');
    s.style.display = 'inline-flex';
    s.innerHTML = Veyro.icon(name, size);
    return s;
  }

  /* chip label */
  const chip = (text, tone) => el('span', `chip chip-${tone || 'gray'}`, esc(text));

  /* progress bar */
  function bar(pctNum, tone, w) {
    const b = el('div', `bar ${tone && tone !== 'green' ? tone : ''}`);
    const f = el('div');
    f.style.width = '0%';
    b.appendChild(f);
    requestAnimationFrame(() => requestAnimationFrame(() => { f.style.width = `${Math.min(100, pctNum)}%`; }));
    return b;
  }

  /* section heading */
  function secHead(title, rightHtml) {
    const row = el('div', 'sec-head');
    const h = el('div', 'h-sec');
    const h2 = el('span', undefined, esc(title));
    const rule = el('span', 'rule');
    h.appendChild(h2); h.appendChild(rule);
    row.appendChild(h);
    if (rightHtml) row.appendChild(rightHtml);
    return row;
  }

  /* metric tile */
  function metricTile(label, value, sub1, sub2, opts = {}) {
    const c = card('metric-tile' + (opts.cls ? ' ' + opts.cls : ''));
    const l = el('div', 'm-label', esc(label));
    const v = el('div', 'm-val' + (opts.tone === 'danger' ? ' text-danger' : opts.tone === 'warn' ? ' text-warn' : ''), value);
    const s = el('div', 'm-sub');
    if (sub1 !== undefined) {
      s.appendChild(el('span', undefined, esc(sub1)));
      if (sub2 !== undefined) {
        s.appendChild(el('span', 'text-muted', esc(sub2)));
      }
    }
    c.appendChild(l); c.appendChild(v); c.appendChild(s);
    return c;
  }

  /* circular score ring */
  function ring(score, size = 132, label = '/100') {
    const w = el('div', 'ring');
    w.style.width = size + 'px'; w.style.height = size + 'px';
    const r = (size / 2) - 6;
    const C = 2 * Math.PI * r;
    w.innerHTML = `
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
        <circle class="ring-bg" cx="${size / 2}" cy="${size / 2}" r="${r}"/>
        <circle class="ring-fg" cx="${size / 2}" cy="${size / 2}" r="${r}"
          stroke-dasharray="${C}" stroke-dashoffset="${C}" data-off="${C * (1 - score / 100)}"/>
      </svg>
      <div class="ring-txt">
        <div>
          <div class="ring-num">${score}</div>
          <div class="ring-den">${label}</div>
        </div>
      </div>`;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const fg = w.querySelector('.ring-fg');
      fg.style.strokeDashoffset = fg.dataset.off;
    }));
    return w;
  }

  /* horizontal score bar row (Performance / Optimization / Gaming / Health) */
  function scoreRow(label, value) {
    const row = el('div');
    row.style.display = 'grid'; row.style.gridTemplateColumns = '96px 1fr 34px';
    row.style.alignItems = 'center'; row.style.gap = '10px';
    const l = el('span', '', esc(label));
    l.style.fontSize = '11px'; l.style.color = 'var(--muted)'; l.style.fontWeight = '600';
    const b = bar(value, 'green');
    const v = el('span', 'num text-accent', String(value));
    v.style.fontSize = '11px';
    row.appendChild(l); row.appendChild(b); row.appendChild(v);
    return row;
  }

  /* hardware row inside a card */
  function kvRow(k, v) {
    const dd = el('dd', undefined, v);
    return { dt: el('dt', undefined, esc(k)), dd };
  }

  /* demo data callout */
  function demoCallout(text) {
    const c = el('div', 'badge-demo');
    c.innerHTML = `${icon('warn')}<span>${esc(text || 'Demo hardware data')}</span>`;
    return c;
  }

  /* empty / error state */
  function errorState(title, body, onRetry) {
    const c = el('div', 'err-state');
    const ic = el('div', '', icon('gear'));
    ic.style.color = 'var(--danger)';
    ic.style.display = 'inline-flex';
    const t = el('div', 'e-title', esc(title));
    const b = el('div', 'e-body', esc(body));
    c.appendChild(ic); c.appendChild(t); c.appendChild(b);
    if (onRetry) {
      const bt = btn('RETRY', true, { onClick: onRetry, cls: 'mt-12' });
      bt.style.margin = '14px auto 0';
      c.appendChild(bt);
    }
    return c;
  }

  /* toggle switch */
  function toggle(checked, onChange) {
    const w = el('label', 'switch');
    const inp = el('input');
    inp.type = 'checkbox';
    inp.checked = !!checked;
    inp.addEventListener('change', () => onChange(inp.checked));
    const sl = el('span', 'sl');
    w.appendChild(inp); w.appendChild(sl);
    return w;
  }

  /* segmented control */
  function segmented(options, active, onChange) {
    const s = el('div', 'seg');
    options.forEach((o) => {
      const b = el('button', 'seg-btn' + (o === active ? ' active' : ''), esc(o));
      b.type = 'button';
      b.addEventListener('click', () => {
        s.querySelectorAll('.seg-btn').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        onChange(o);
      });
      s.appendChild(b);
    });
    return s;
  }

  /* tab/group system — top-level tabs, each with its own group selector and content area */
  function tabGroup(options) {
    /*
      options = {
        tabs: [
          {
            id: 'tab1',
            label: 'Tab Label',
            icon: 'icon-name', // optional
            groups: [
              { id: 'group1', label: 'Group 1', icon: 'icon', content: (container) => { ... } }
            ]
          }
        ],
        defaultTab: 0,
        defaultGroup: 0,
        onTabChange: (tabId) => {},
        onGroupChange: (tabId, groupId) => {}
      }
    */
    const root = el('div', 'tab-group');
    const tabs = options.tabs || [];
    let activeTabIdx = options.defaultTab || 0;
    let activeGroupIdx = options.defaultGroup || 0;

    // Tab bar
    const tabBar = el('div', 'tab-group-tabs');
    tabs.forEach((tab, i) => {
      const btn = el('button', 'tab-group-tab' + (i === activeTabIdx ? ' active' : ''));
      btn.type = 'button';
      if (tab.icon) {
        const ic = el('span', 'ic-14');
        ic.innerHTML = Veyro.icon(tab.icon, 14);
        ic.style.marginRight = '6px';
        btn.appendChild(ic);
      }
      btn.appendChild(document.createTextNode(esc(tab.label)));
      btn.addEventListener('click', () => setTab(i));
      tabBar.appendChild(btn);
    });
    root.appendChild(tabBar);

    // Content area
    const content = el('div', 'tab-group-content');
    root.appendChild(content);

    function renderTab() {
      const tab = tabs[activeTabIdx];
      content.innerHTML = '';

      if (!tab.groups || !tab.groups.length) {
        content.appendChild(el('div', 'meta', 'No groups available.'));
        return;
      }

      // Group selector (pills)
      const groupSelector = el('div', 'tab-group-selector');
      tab.groups.forEach((g, i) => {
        const btn = el('button', 'tab-group-pill' + (i === activeGroupIdx ? ' active' : ''));
        btn.type = 'button';
        if (g.icon) {
          const ic = el('span', 'ic-12');
          ic.innerHTML = Veyro.icon(g.icon, 12);
          ic.style.marginRight = '4px';
          btn.appendChild(ic);
        }
        btn.appendChild(document.createTextNode(esc(g.label)));
        btn.addEventListener('click', () => setGroup(i));
        groupSelector.appendChild(btn);
      });
      content.appendChild(groupSelector);

      // Group content area
      const groupContent = el('div', 'tab-group-panel');
      content.appendChild(groupContent);

      renderGroup(tab);
    }

    function renderGroup(tab) {
      const group = tab.groups[activeGroupIdx];
      const panel = content.querySelector('.tab-group-panel');
      if (!panel || !group) return;
      panel.innerHTML = '';
      if (typeof group.content === 'function') {
        group.content(panel);
      } else if (typeof group.render === 'function') {
        group.render(panel);
      }
    }

    function setTab(idx) {
      if (idx === activeTabIdx) return;
      activeTabIdx = idx;
      activeGroupIdx = 0;
      tabBar.querySelectorAll('.tab-group-tab').forEach((b, i) => b.classList.toggle('active', i === idx));
      renderTab();
      options.onTabChange && options.onTabChange(tabs[idx].id);
    }

    function setGroup(idx) {
      if (idx === activeGroupIdx) return;
      activeGroupIdx = idx;
      const tab = tabs[activeTabIdx];
      content.querySelectorAll('.tab-group-pill').forEach((b, i) => b.classList.toggle('active', i === idx));
      renderGroup(tab);
      options.onGroupChange && options.onGroupChange(tab.id, tab.groups[idx].id);
    }

    renderTab();

    return {
      root,
      setTab,
      setGroup,
      getActiveTab: () => tabs[activeTabIdx]?.id,
      getActiveGroup: () => tabs[activeTabIdx]?.groups[activeGroupIdx]?.id
    };
  }

  return { card, btn, iconEl, chip, bar, secHead, metricTile, ring, scoreRow, kvRow, demoCallout, errorState, toggle, segmented, el, tabGroup };
})();