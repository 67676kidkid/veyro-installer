/* ============================================================
   Veyro Account — online accounts + server-verified license.
   Talks to the embedded local backend on http://127.0.0.1:9175 .
   Activation post goes to the server, which is the source of
   truth for expiry / revocation / device binding. When the
   backend is unreachable the app keeps working, but new key
   activation requires the server (offline activation is gone).
   ============================================================ */
console.log('[account.js] loading...');
Veyro.Account = (() => {
  'use strict';

  const BASE = 'http://127.0.0.1:9175';

  let state = { token: null, user: null, online: false };

  function deviceId() {
    const s = Veyro.Store.get();
    const acc = (s && s.account) || {};
    if (!acc.deviceId) {
      acc.deviceId = 'dev-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
      Veyro.Store.set('account', acc);
    }
    return acc.deviceId;
  }

  function setToken(tok) {
    const s = Veyro.Store.get();
    const acc = (s && s.account) || {};
    acc.token = tok || null;
    state.token = tok || null;
    if (!tok) state.user = null;
    Veyro.Store.set('account', acc);
  }

  function emit() {
    document.dispatchEvent(new CustomEvent('veyro:account', { detail: { online: state.online, user: state.user, token: state.token } }));
  }

  function api(path, method, body) {
    const headers = { 'Accept': 'application/json' };
    if (body !== undefined && body !== null) headers['Content-Type'] = 'application/json';
    if (state.token) headers['Authorization'] = 'Bearer ' + state.token;
    return fetch(BASE + path, {
      method: method || 'GET',
      headers,
      body: body !== undefined && body !== null ? JSON.stringify(body) : undefined
    }).then(res => {
      return res.json().catch(() => ({ ok: false, msg: 'Bad response from backend (' + res.status + ').' }));
    }).catch(() => {
      state.online = false;
      return { ok: false, msg: 'Backend offline — start Veyro to sign in.' };
    });
  }

  function serverHealth() {
    state.online = false;
    return api('/api/health', 'GET')
      .then(h => {
        state.online = !!(h && h.ok);
        emit();
        return state.online;
      })
      .catch(() => { state.online = false; emit(); return false; });
  }

  function me() {
    return api('/api/me', 'GET').then(d => {
      if (d && d.ok && d.user) { state.user = d.user; emit(); return d.user; }
      if (d && d.msg === 'Backend offline — start Veyro to sign in.') { return null; }
      setToken(null); emit(); return null;
    });
  }

  function boot() {
    const s = Veyro.Store.get();
    if (s && s.account && s.account.token) state.token = s.account.token;
    serverHealth();
    if (state.token) {
      document.dispatchEvent(new CustomEvent('veyro:account', { detail: { restoring: true } }));
      return me();
    }
    emit();
    return Promise.resolve(null);
  }

  function login(email, pass) {
    return api('/api/auth/login', 'POST', { email, password: pass }).then(d => {
      if (d && d.ok && d.token) { setToken(d.token); return me().then(u => u ? { ok: true, user: u } : { ok: false, msg: 'Account could not be loaded.' }); }
      return { ok: false, msg: (d && d.msg) || 'Login failed.' };
    });
  }

  function register(name, email, pass) {
    return api('/api/auth/register', 'POST', { name: name || 'Player', email, password: pass }).then(d => {
      if (d && d.ok && d.token) { setToken(d.token); return me().then(u => u ? { ok: true, user: u } : { ok: false, msg: 'Account could not be loaded.' }); }
      return { ok: false, msg: (d && d.msg) || 'Registration failed.' };
    });
  }

  function logout() {
    const t = state.token;
    setToken(null); emit();
    if (t) { api('/api/auth/logout', 'POST', {}).catch(() => {}); }
    return Promise.resolve({ ok: true });
  }

  function myKeys() {
    return api('/api/keys', 'GET').then(d => {
      return (d && d.ok && d.keys) ? d.keys : [];
    }).catch(() => []);
  }

  /* activate is server-authoritative: it checks revoked/expired/device */
  function activateOnline(key) {
    return api('/api/keys/activate', 'POST', { key, deviceId: deviceId() }).then(d => {
      if (d && d.ok) return { ok: true, key, expiresAt: d.expiresAt || null, durationId: d.durationId || null };
      return { ok: false, msg: (d && d.msg) || 'Activation failed.' };
    });
  }

  function statusFor(key) {
    return api('/api/keys/status', 'POST', { key }).then(d => {
      if (d && d.ok) return { ok: true, key, status: d.status, expiresAt: d.expiresAt || null };
      return { ok: false, msg: (d && d.msg) || 'Status unavailable.' };
    });
  }

  return {
    boot, deviceId, api, serverHealth,
    login, register, logout, me, myKeys, activateOnline, statusFor,
    state: () => state,
    isOnline: () => !!state.online,
    isLoggedIn: () => !!(state.token && state.user)
  };
})();