/* ============================================================
   Veyro site — shared app logic: api, auth, header, toast.
   ============================================================ */
'use strict';

const SITE = {
  API: '/api',
  TOKEN_KEY: 'veyro.site.token',
  token: localStorage.getItem('veyro.site.token') || '',
  me: null
};

SITE.api = async function api(path, method, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (SITE.token) headers.Authorization = 'Bearer ' + SITE.token;
  const res = await fetch(SITE.API + path, {
    method: method || 'GET',
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  let data = null;
  try { data = await res.json(); } catch (e) { data = null; }
  if (!res.ok && !data) throw new Error('HTTP ' + res.status);
  return data;
};

SITE.auth = async function auth() {
  if (!SITE.token) return null;
  try {
    const r = await SITE.api('/me');
    SITE.me = r && r.ok ? r.user : null;
    if (!SITE.me) { SITE.logout(true); }
    return SITE.me;
  } catch (e) {
    return null;
  }
};

SITE.login = function login(token, user) {
  SITE.token = token;
  localStorage.setItem(SITE.TOKEN_KEY, token);
  SITE.me = user;
  location.href = 'dashboard.html';
};

SITE.logout = function logout(silent) {
  if (SITE.token) { try { SITE.api('/account/logout', 'POST'); } catch (e) {} }
  SITE.token = '';
  localStorage.removeItem(SITE.TOKEN_KEY);
  SITE.me = null;
  if (!silent) location.href = 'index.html';
};

SITE.toast = function toast(text, tone) {
  let box = document.querySelector('.toast-box');
  if (!box) {
    box = document.createElement('div');
    box.className = 'toast-box';
    document.body.appendChild(box);
  }
  const t = document.createElement('div');
  t.className = 'toast' + (tone ? ' ' + tone : '');
  t.textContent = text;
  box.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .25s'; }, 2400);
  setTimeout(() => t.remove(), 2700);
};

SITE.esc = function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
};

SITE.fmtDate = function fmtDate(ms) {
  if (!ms) return '—';
  return new Date(ms).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

SITE.until = function until(ms) {
  if (ms === null || ms === undefined) return 'Never expires';
  const left = ms - Date.now();
  if (left <= 0) return 'Expired';
  if (left < 3600000) return Math.floor(left / 60000) + ' min left';
  if (left < 86400000) return Math.round(left / 3600000) + ' h left';
  return Math.round(left / 86400000) + ' d left';
};

SITE.chip = function chip(label, tone) {
  const c = document.createElement('span');
  c.className = 'chip' + (tone ? ' ' + tone : '');
  c.innerHTML = '<span class="dot"></span>' + SITE.esc(label);
  return c;
};

SITE.copy = function copy(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); SITE.toast('Copied to clipboard.', 'good'); }
  catch (e) { SITE.toast('Copy failed — select and press Ctrl+C.', 'err'); }
  document.body.removeChild(ta);
};

SITE.statusChip = function statusChip(st) {
  const map = {
    ACTIVE: ['green', 'ACTIVE'],
    AVAILABLE: ['green', 'AVAILABLE'],
    IN_USE: ['yellow', 'IN USE'],
    EXPIRED: ['red', 'EXPIRED'],
    REVOKED: ['red', 'REVOKED'],
    INVALID: ['red', 'INVALID'],
    UNKNOWN: ['red', 'NOT ISSUED']
  };
  const [tone, label] = map[st] || ['yellow', st];
  return SITE.chip(label, tone);
};

/* ---------- shared header / shell ---------- */

const DUR_OPTIONS = [
  ['h3', '3 HOURS'], ['h24', '24 HOURS'], ['d3', '3 DAYS'],
  ['w1', '1 WEEK'], ['m1', '1 MONTH'], ['y1', '1 YEAR'], ['life', 'LIFETIME']
];

SITE.renderHeader = function renderHeader(active) {
  const me = SITE.me;
  const nav = document.getElementById('nav');
  if (!nav) return;
  const pages = [
    ['index.html', 'Home'],
    ['dashboard.html', 'Dashboard'],
    ['docs.html', 'Docs']
  ];
  if (me && me.admin) pages.push(['admin.html', 'Admin']);
  nav.innerHTML = '';
  pages.forEach(([href, label]) => {
    const a = document.createElement('a');
    a.href = href;
    a.textContent = label;
    if (href === active) a.className = 'active';
    nav.appendChild(a);
  });
  const right = document.getElementById('header-right');
  right.innerHTML = '';
  if (me) {
    const who = document.createElement('span');
    who.className = 'muted';
    who.style.fontSize = '12.5px';
    who.textContent = me.name + (me.admin ? ' · admin' : '');
    right.appendChild(who);
    const out = document.createElement('button');
    out.className = 'btn btn-sm';
    out.textContent = 'LOG OUT';
    out.addEventListener('click', () => SITE.logout(false));
    right.appendChild(out);
  } else if (active !== 'login.html' && active !== 'register.html') {
    const l = document.createElement('a');
    l.className = 'btn btn-sm';
    l.href = 'login.html';
    l.textContent = 'LOG IN';
    right.appendChild(l);
    const r = document.createElement('a');
    r.className = 'btn btn-primary btn-sm';
    r.href = 'register.html';
    r.textContent = 'CREATE ACCOUNT';
    right.appendChild(r);
  }
  const burger = document.getElementById('burger');
  if (burger) {
    burger.onclick = () => nav.classList.toggle('open');
    document.body.addEventListener('click', (e) => {
      if (!burger.contains(e.target) && !nav.contains(e.target)) nav.classList.remove('open');
    });
  }
};

SITE.boot = async function boot(active) {
  await SITE.auth();
  SITE.renderHeader(active);
};