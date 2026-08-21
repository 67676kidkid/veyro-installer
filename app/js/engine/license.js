/* ============================================================
   Veyro License — premium state.
   Activation: the owner generates keys in Veyro-KeyGen; the user
   pastes a key in Settings → Premium. Keys embed their own expiry
   timestamp + checksum, so Veyro validates them fully offline.
   Stored in %APPDATA%\VEYRO\license.json  =>  { key, grantedAt, expiresAt }.
   expiresAt null means lifetime. Expired grants fall back to free.
   ============================================================ */
console.log('[license.js] loading...');
Veyro.License = (() => {
  'use strict';

  const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const KEY_RE = /^VEYR0-([A-Z2-9]{5})-([A-Z2-9]{5})-([A-Z2-9]{5})$/;

  let state = { tier: 'free' };

  /* ---- key validation (format + checksum) ---- */
  function decodeKey(raw) {
    const key = String(raw || '').trim().toUpperCase();
    const m = KEY_RE.exec(key);
    if (!m) return { ok: false, msg: 'Invalid key format. Expected VEYR0-XXXXX-XXXXX-XXXXX.' };
    const body = m[1] + m[2] + m[3];
    const exp = body.slice(0, 8);
    const filler = body.slice(9);
    const payload = exp + filler;
    let sum = 0;
    for (let i = 0; i < payload.length; i++) sum += CHARS.indexOf(payload[i]);
    if (CHARS[sum % 32] !== body[8]) {
      return { ok: false, msg: 'Invalid key checksum.' };
    }
    let secs = 0;
    for (let i = 0; i < 8; i++) secs = secs * 32 + CHARS.indexOf(exp[i]);
    return {
      ok: true,
      key,
      expiresAt: secs === 0 ? null : new Date(secs * 1000)
    };
  }

  function refresh() {
    const bridge = window.veyroAgent && typeof window.veyroAgent.license === 'function'
      ? window.veyroAgent.license()
      : Promise.resolve({ ok: false });
    return bridge
      .then(res => {
        const prev = state.tier;
        if (res && res.ok && res.key) {
          const exp = res.expiresAt ? new Date(res.expiresAt) : null;
          if (exp && exp.getTime() <= Date.now()) {
            state = { tier: 'free' };
        } else {
          state = { tier: 'premium', key: res.key, grantedAt: res.grantedAt, expiresAt: exp };
          /* warn once per launch when the license runs out soon */
          if (!window.__veyroExpiryWarned && exp && exp.getTime() - Date.now() <= 7 * 86400000) {
            window.__veyroExpiryWarned = true;
            const days = Math.max(1, Math.ceil((exp.getTime() - Date.now()) / 86400000));
            Veyro.toast('Premium expiring soon',
              'Your license runs out in ' + days + (days === 1 ? ' day' : ' days') + '. Renew on our Discord to keep premium.', 'warn');
          }
        }
        } else {
          state = { tier: 'free' };
        }
        applyClass();
        if (state.tier !== prev) {
          document.dispatchEvent(new CustomEvent('veyro:license', { detail: state.tier }));
        }
        return state;
      })
      .catch(() => { state = { tier: 'free' }; applyClass(); return state; });
  }

  /* write the grant via the native bridge (persists to %APPDATA%\VEYRO\license.json) */
  function bridgeSave(key, grantedAt, expiresAt) {
    const bridge = window.veyroAgent && typeof window.veyroAgent.activateLicense === 'function'
      ? window.veyroAgent.activateLicense(key, grantedAt, expiresAt)
      : Promise.resolve({ ok: false, msg: 'Native bridge unavailable.' });
    return bridge;
  }

  /* local decode (format + checksum) only — used for fast-fail and read-only
     status; it is deliberately NOT enough to grant premium anymore. */
  function activate(rawKey) {
    const dec = decodeKey(rawKey);
    if (!dec.ok) return Promise.resolve(dec);
    const acct = window.Veyro && Veyro.Account ? Veyro.Account : null;
    if (!acct) return Promise.resolve({ ok: false, msg: 'Account services unavailable.' });
    /* server-authoritative activation: revoked/expired/in-use keys are rejected */
    return acct.activateOnline(dec.key).then(res => {
      if (!res.ok) return { ok: false, msg: res.msg || 'Activation failed.' };
      const serverExp = res.expiresAt ? new Date(res.expiresAt) : null;
      return bridgeSave(dec.key, Date.now(), serverExp ? serverExp.getTime() : null)
        .then(b => b.ok ? refresh().then(() => ({ ok: true, key: dec.key, expiresAt: serverExp }))
                          : { ok: false, msg: b.msg || 'Could not save the license.' });
    });
  }

  /* server trust check — drop or re-sync a grant that the backend flags. */
  function verifyServer() {
    if (state.tier !== 'premium' || !state.key) return Promise.resolve(true);
    const acct = window.Veyro && Veyro.Account ? Veyro.Account : null;
    if (!acct || !acct.state().token || !acct.isOnline()) return Promise.resolve(true);
    return acct.statusFor(state.key).then(r => {
      if (!r.ok) return true;
      const st = String(r.status || '').toUpperCase();
      if (st === 'REVOKED' || st === 'EXPIRED') {
        return remove();
      }
      if (st === 'ACTIVE' && r.expiresAt) {
        const serverExp = new Date(r.expiresAt);
        if (serverExp.getTime() <= Date.now()) return remove();
        if (state.expiresAt && Math.abs(state.expiresAt.getTime() - serverExp.getTime()) > 60000) {
          const granted = state.grantedAt ? (state.grantedAt.getTime ? state.grantedAt.getTime() : state.grantedAt) : Date.now();
          return bridgeSave(state.key, granted, serverExp.getTime()).then(() => refresh());
        }
      }
      return true;
    }).catch(() => true);
  }

  function applyClass() {
    document.body.classList.toggle('veyro-premium', state.tier === 'premium');
    /* aurora theme is premium-only — strip it when premium goes away */
    if (window.Veyro && Veyro.Store && Veyro.Store.get) {
      const s = Veyro.Store.get().settings;
      document.body.classList.toggle('veyro-aurora', !!(s.auroraTheme && state.tier === 'premium'));
    }
  }

  function remove() {
    const bridge = window.veyroAgent && typeof window.veyroAgent.removeLicense === 'function'
      ? window.veyroAgent.removeLicense()
      : Promise.resolve({ ok: false, msg: 'Native bridge unavailable.' });
    return bridge.then(res => {
      state = { tier: 'free' };
      applyClass();
      document.dispatchEvent(new CustomEvent('veyro:license', { detail: 'free' }));
      return res;
    });
  }

  function isPremium() { return state.tier === 'premium'; }

  function status() { return state; }

  function untilText() {
    if (state.tier !== 'premium') return '';
    if (!state.expiresAt) return 'Lifetime';
    const days = Math.ceil((state.expiresAt.getTime() - Date.now()) / 86400000);
    if (days <= 0) return 'expired';
    if (days === 1) return '1 day left';
    if (days < 30) return days + ' days left';
    if (days < 365) return state.expiresAt.toLocaleDateString();
    return state.expiresAt.toLocaleDateString() + ' · ' + Math.round(days / 365) + 'y';
  }

  return { refresh, activate, verifyServer, remove, decodeKey, isPremium, status, untilText };
})();