/* ============================================================
   Veyro Backend — REST API + static site + license authority.
   Zero dependencies: runs inside the Electron app (main.js)
   or standalone:  node server/server.js  (port 9175).
   DB: server/db.json (or %APPDATA%\VEYRO\server-db.json in-app).
   ============================================================ */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/* ---------------- key codec (byte-for-byte copy of KeyGen) ---------------- */

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const KEY_RE = /^VEYR0-([A-Z2-9]{5})-([A-Z2-9]{5})-([A-Z2-9]{5})$/;
const DURATIONS = [
  { id: 'h3', label: '3 HOURS', hours: 3 },
  { id: 'h24', label: '24 HOURS', hours: 24 },
  { id: 'd3', label: '3 DAYS', hours: 72 },
  { id: 'w1', label: '1 WEEK', hours: 168 },
  { id: 'm1', label: '1 MONTH', hours: 720 },
  { id: 'y1', label: '1 YEAR', hours: 8760 },
  { id: 'life', label: 'LIFETIME', hours: null }
];
const DUR_BY_ID = new Map(DURATIONS.map(d => [d.id, d]));

function toBase32(num) {
  let s = '';
  do { s = CHARS[num % 32] + s; num = Math.floor(num / 32); } while (num > 0);
  return s.padStart(8, 'A');
}

function fromBase32(str) {
  let num = 0;
  for (let i = 0; i < str.length; i++) num = num * 32 + CHARS.indexOf(str[i]);
  return num;
}

function checksumChar(str) {
  let sum = 0;
  for (let i = 0; i < str.length; i++) sum += CHARS.indexOf(str[i]);
  return CHARS[sum % 32];
}

function seed() {
  const buf = crypto.randomBytes(5);
  let s = '';
  for (let i = 0; i < buf.length; i++) s += CHARS[buf[i] % CHARS.length];
  return s;
}

function buildKey(expiresAt) {
  const exp = toBase32(expiresAt === null ? 0 : Math.floor(expiresAt / 1000));
  const filler = (seed() + seed()).slice(0, 6);
  const body = (exp + checksumChar(exp + filler) + filler).toUpperCase();
  return `VEYR0-${body.slice(0, 5)}-${body.slice(5, 10)}-${body.slice(10, 15)}`;
}

/* Decode + validate. Returns { ok:true, code, expiresAt(ms|null), expSecs }
   or { ok:false, reason }. This is the SERVER-side authority — the app's
   local decoder is only used for instant UI feedback; the server re-checks.
   Security note: body[0..7]=expiry base32 ('AAAAAAAA'=lifetime),
   body[8]=checksum over exp+filler, body[9..14]=filler. */
function decodeKey(raw) {
  const code = String(raw || '').trim().toUpperCase();
  const m = KEY_RE.exec(code);
  if (!m) return { ok: false, reason: 'format' };
  const body = (m[1] + m[2] + m[3]).toUpperCase();
  if (body.length !== 15) return { ok: false, reason: 'format' };
  for (const c of body) if (CHARS.indexOf(c) === -1) return { ok: false, reason: 'format' };
  const exp = body.slice(0, 8);
  const filler = body.slice(9, 15);
  const ck = body[8];
  const expSecs = fromBase32(exp);
  if (expSecs === 0) {
    if (checksumChar(exp + filler) !== ck) return { ok: false, reason: 'checksum' };
    return { ok: true, code, expiresAt: null, expSecs: null };
  }
  if (checksumChar(exp + filler) !== ck) return { ok: false, reason: 'checksum' };
  const expiresAt = expSecs * 1000;
  return { ok: true, code, expiresAt, expSecs };
}

/* detect duration label from embedded expiry vs generation window */
function durationOf(expiresAt, createdAt) {
  if (expiresAt === null) return DUR_BY_ID.get('life');
  const hours = Math.max(0, Math.round((expiresAt - createdAt) / 3600000));
  let best = DURATIONS[0], bestDiff = Infinity;
  for (const d of DURATIONS) {
    const ref = d.hours === null ? Infinity : d.hours;
    const diff = Math.abs(hours - ref);
    if (diff < bestDiff) { bestDiff = diff; best = d; }
  }
  return best;
}

/* ---------------- tiny db (atomic JSON) ---------------- */

function createDb(file) {
  let data = null;
  function load() {
    try {
      data = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (e) {
      data = { users: [], sessions: [], keys: [] };
    }
    data.users = data.users || [];
    data.sessions = data.sessions || [];
    data.keys = data.keys || [];
    return data;
  }
  function save() {
    const tmp = file + '.tmp';
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
    fs.renameSync(tmp, file);
  }
  load();
  return { data, save, file };
}

/* KV-backed db for serverless (Vercel). The whole data document lives under a
   single key (veyro:data). load() is async (REST fetch) and merges into the
   SAME live object so route closures keep working unchanged. save() mirrors
   the in-memory state to KV as fire-and-forget (mutations are already applied
   to the live object synchronously). */
function createKvDb() {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  const KEY = 'veyro:data';
  const data = { users: [], sessions: [], keys: [] };
  let loaded = false;
  let loading = null;
  async function ensureLoaded() {
    if (loaded) return;
    if (!loading) {
      loading = (async () => {
        try {
          const r = await fetch(url + '/get/' + KEY, { headers: { Authorization: 'Bearer ' + token } });
          const j = await r.json();
          if (j && typeof j.result === 'string' && j.result) {
            const d = JSON.parse(j.result);
            if (d && typeof d === 'object') Object.assign(data, { users: d.users || [], sessions: d.sessions || [], keys: d.keys || [] });
            loaded = true;
          }
        } catch (e) { /* keep empty doc fallback */ }
        finally { loading = null; }
      })();
    }
    await loading.catch(() => {});
    loaded = true;
  }
  function save() {
    if (!loaded) return;
    try {
      fetch(url + '/set/' + KEY, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      }).catch(() => {});
    } catch (e) { /* ignore */ }
  }
  return { data, save, file: 'vercel-kv:' + KEY, ensureLoaded };
}

/* GitHub-repo-backed db for serverless (Vercel). The whole data document
   lives as db.json in a private repo (default 67676kidkid/veyro-persist).
   Reads use the contents API (cached in the warm lambda); writes PUT the
   file with optimistic concurrency (sha) and a small retry loop. */
function createGhDb() {
  const token = process.env.GH_PERSIST_TOKEN;
  const owner = process.env.GH_PERSIST_OWNER || '67676kidkid';
  const repo = process.env.GH_PERSIST_REPO || 'veyro-persist';
  const filePath = 'db.json';
  const data = { users: [], sessions: [], keys: [] };
  let loaded = false;
  let loading = null;
  let versionSha = null;
  let saveChain = Promise.resolve();

  const headers = { Accept: 'application/vnd.github+json', Authorization: 'Bearer ' + token, 'X-GitHub-Api-Version': '2022-11-28' };
  async function rawGet() {
    const r = await fetch('https://api.github.com/repos/' + owner + '/' + repo + '/contents/' + filePath, { headers });
    if (!r.ok) throw new Error('gh get ' + r.status);
    return await r.json();
  }
  async function rawPut(content, sha) {
    const r = await fetch('https://api.github.com/repos/' + owner + '/' + repo + '/contents/' + filePath, {
      method: 'PUT',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'update', content: Buffer.from(content).toString('base64'), sha: sha || undefined })
    });
    return r;
  }
  async function ensureLoaded() {
    if (loaded) return;
    if (!loading) {
      loading = (async () => {
        try {
          const m = await rawGet();
          const d = JSON.parse(Buffer.from(m.content, 'base64').toString('utf8'));
          if (d && typeof d === 'object') Object.assign(data, { users: d.users || [], sessions: d.sessions || [], keys: d.keys || [] });
          versionSha = m.sha;
          loaded = true;
        } catch (e) { /* keep empty doc fallback */ }
        finally { loading = null; }
      })();
    }
    await loading.catch(() => {});
    loaded = true;
  }
  function save() {
    if (!loaded) return;
    const snap = JSON.stringify(data);
    saveChain = saveChain.then(async () => {
      for (let i = 0; i < 3; i++) {
        let sha = versionSha;
        if (!sha) { try { const m = await rawGet(); sha = m.sha; } catch (e) { return; } }
        try {
          const r = await rawPut(snap, sha);
          if (r.status === 409 || r.status === 422) { versionSha = null; continue; }
          if (r.ok) { const j = await r.json().catch(() => null); versionSha = j && j.content ? j.content.sha : sha; return; }
          return;
        } catch (e) { return; }
      }
    }).catch(() => {});
  }
  return { data, save, file: 'github:' + owner + '/' + repo + '/' + filePath, ensureLoaded };
}

/* ---------------- auth helpers ---------------- */

function hashPassword(pw, salt) {
  return crypto.scryptSync(String(pw), salt, 64).toString('base64');
}

function newSalt() { return crypto.randomBytes(16).toString('hex'); }

function newToken() { return crypto.randomBytes(32).toString('hex'); }

function keyStatus(userId, k) {
  if (k.revoked) return 'REVOKED';
  if (k.expiresAt !== null && k.expiresAt <= Date.now()) return 'EXPIRED';
  if (k.activatedBy) return k.activatedBy === userId ? 'ACTIVE' : 'IN_USE';
  return 'AVAILABLE';
}

/* ---------------- server factory ---------------- */

function createServer(opts = {}) {
  const useGh = !!process.env.GH_PERSIST_TOKEN;
  const useKv = !!(!useGh && process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
  const dbFile = opts.dbFile || path.join(__dirname, 'db.json');
  const db = useGh ? createGhDb() : useKv ? createKvDb() : createDb(dbFile);
  const { data } = db;
  const siteDir = opts.siteDir || path.join(__dirname, 'public');

  /* Bot authentication: the Veyro Discord bot authenticates with
     VEYRO_BOT_TOKEN (set in the environment, or in a local
     server-bot-token.txt file next to this file). Requests carrying the
     matching token act with admin rights against the SAME key database —
     the app, website and bot all share this single source of truth. */
  let botToken = process.env.VEYRO_BOT_TOKEN || opts.botToken || '';
  if (!botToken) {
    try {
      const tf = path.join(__dirname, 'server-bot-token.txt');
      if (fs.existsSync(tf)) botToken = fs.readFileSync(tf, 'utf8').trim();
    } catch (e) { /* ignore */ }
  }
  function authUser(auth) {
    const sess = findSession(auth);
    if (sess) return sess.user;
    if (botToken && auth === botToken) {
      return { id: 'bot-admin', name: 'Veyro Bot', email: 'bot@veyro.app', admin: true, isBot: true, createdAt: Date.now() };
    }
    return null;
  }
  
  function isKeyGenAuth(auth) {
    const keygenPin = process.env.KEYGEN_PIN || 'veyro-keygen-2025';
    return auth === keygenPin;
  }

  const rate = new Map();
  function rateCheck(ip) {
    const now = Date.now();
    const r = rate.get(ip) || [];
    const fresh = r.filter(t => now - t < 60000);
    return fresh.length < 10;
  }
  function rateHit(ip) {
    const now = Date.now();
    const r = rate.get(ip) || [];
    const fresh = r.filter(t => now - t < 60000);
    fresh.push(now);
    rate.set(ip, fresh);
  }
  function rateClear(ip) {
    rate.delete(ip);
  }

  function findSession(token) {
    const s = data.sessions.find(x => x.token === token);
    if (!s) return null;
    if (Date.now() - s.createdAt > 30 * 86400000) {
      data.sessions = data.sessions.filter(x => x.token !== token);
      db.save();
      return null;
    }
    const u = data.users.find(x => x.id === s.userId);
    return u ? { session: s, user: u } : null;
  }

  function publicUser(u) {
    return { id: u.id, name: u.name, email: u.email, admin: !!u.admin, createdAt: u.createdAt, discord: u.discord || null };
  }

  /* ---- Discord OAuth2 link (uses the Veyro bot application) ---- */
  function discordBase(req) {
    const h = req.headers;
    const proto = String(h['x-forwarded-proto'] || 'http').split(',')[0];
    const host = String(h['x-forwarded-host'] || h.host || '127.0.0.1:9175').split(',')[0];
    return proto + '://' + host;
  }
  async function handleDiscordStart(req, res, url) {
    const token = url.searchParams.get('token') || '';
    const sess = findSession(token);
    if (!sess) { bad(res, 'Not logged in.', 401); return true; }
    if (!process.env.DISCORD_CLIENT_ID || !process.env.DISCORD_CLIENT_SECRET) {
      res.writeHead(302, { Location: '/dashboard.html?discord=notconfigured' }); res.end(); return true;
    }
    const state = crypto.randomBytes(16).toString('hex');
    sess.user.discordPendingState = state;
    db.save();
    const redirectUri = discordBase(req) + '/api/discord/callback';
    const authUrl = 'https://discord.com/api/v10/oauth2/authorize'
      + '?client_id=' + encodeURIComponent(process.env.DISCORD_CLIENT_ID)
      + '&redirect_uri=' + encodeURIComponent(redirectUri)
      + '&response_type=code&scope=' + encodeURIComponent('identify')
      + '&state=' + state
      + '&prompt=consent';
    res.writeHead(302, { Location: authUrl }); res.end();
    return true;
  }
  async function handleDiscordCallback(req, res, url) {
    const code = url.searchParams.get('code') || '';
    const state = url.searchParams.get('state') || '';
    const back = (flag) => { res.writeHead(302, { Location: '/dashboard.html?discord=' + flag }); res.end(); };
    if (!code || !process.env.DISCORD_CLIENT_ID || !process.env.DISCORD_CLIENT_SECRET) return back('error');
    const sessUser = data.users.find(u => u.discordPendingState && u.discordPendingState === state);
    if (!sessUser) return back('state');
    delete sessUser.discordPendingState;
    try {
      const redirectUri = discordBase(req) + '/api/discord/callback';
      const body = new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID,
        client_secret: process.env.DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code', code, redirect_uri: redirectUri
      });
      const tr = await fetch('https://discord.com/api/v10/oauth2/token', {
        method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body
      });
      if (!tr.ok) return back('token');
      const du = await (await fetch('https://discord.com/api/v10/users/@me', {
        headers: { authorization: 'Bearer ' + (await tr.json()).access_token }
      })).json();
      if (!du || !du.id) return back('profile');
      if (data.users.some(u => u.discord && u.discord.id === du.id && u.id !== sessUser.id)) return back('taken');
      sessUser.discord = { id: du.id, username: du.username, globalName: du.global_name || du.username, avatar: du.avatar || null };
      db.save();
      back('linked');
    } catch (e) { back('error'); }
    return true;
  }

  function keyView(userId, k) {
    return {
      id: k.id,
      code: k.code,
      durationId: k.durationId,
      durationLabel: k.durationLabel,
      createdAt: k.createdAt,
      expiresAt: k.expiresAt,
      status: keyStatus(userId, k),
      activatedAt: k.activatedAt || null,
      deviceId: k.deviceId || null,
      revokedAt: k.revokedAt || null,
      owner: k.activatedBy
    };
  }

  function json(res, status, body) {
    const out = JSON.stringify(body);
    res.writeHead(status, {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Cache-Control': 'no-store'
    });
    res.end(out);
  }

  function bad(res, msg, code = 400) { json(res, code, { ok: false, error: msg }); }

  function ok(res, body) { json(res, 200, { ok: true, ...body }); }

  const MIME = {
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8', '.json': 'application/json',
    '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
    '.webp': 'image/webp', '.txt': 'text/plain; charset=utf-8',
    '.zip': 'application/zip'
  };

  function readBody(req, cb, limit = 65536) {
    /* On Vercel's serverless wrapper (@vercel/node) the body is already
       buffered and parsed into req.body before our stream listeners run. */
    if (req.body !== undefined && req.body !== null) {
      try { cb(typeof req.body === 'string' ? JSON.parse(req.body) : req.body); }
      catch (e) { cb(null); }
      return;
    }
    let size = 0;
    const chunks = [];
    req.on('data', c => {
      size += c.length;
      if (size > limit) { req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      try { cb(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); }
      catch (e) { cb(null); }
    });
    req.on('error', () => cb(null));
  }

  /* ---------------- API routes ---------------- */

  /* ---- welcome email (Brevo free tier, fire-and-forget) ----
     Set BREVO_API_KEY + MAIL_FROM in env to enable; silently skipped otherwise. */
  function sendWelcomeEmail(email, name, isNew) {
    const key = process.env.BREVO_API_KEY;
    const from = process.env.MAIL_FROM;
    if (!key || !from) return;
    const subject = isNew ? 'Welcome to Veyro — thanks for joining!' : 'New sign-in to your Veyro account';
    const html =
      '<div style="font-family:Segoe UI,Arial,sans-serif;max-width:520px;margin:0 auto;padding:28px;background:#0b110d;border-radius:12px;color:#f1f5f2">' +
      '<h2 style="color:#39ff88;margin:0 0 6px">Veyro</h2>' +
      '<p style="margin:0 0 14px;font-size:13px;letter-spacing:.08em;color:#89958e">OPTIMIZE. UPGRADE. PERFORM.</p>' +
      (isNew
        ? '<h3 style="margin:0 0 10px">Thanks for registering' + (name ? ', ' + name : '') + '!</h3>' +
          '<p style="line-height:1.6">Your account is ready. Activate a license key from the <a href="https://veyro-tawny.vercel.app/dashboard.html" style="color:#39ff88">dashboard</a> or inside the Veyro app.</p>'
        : '<h3 style="margin:0 0 10px">You just signed in' + (name ? ', ' + name : '') + '.</h3>' +
          '<p style="line-height:1.6">If this was you — enjoy! If not, change your password immediately.</p>') +
      '<p style="margin-top:22px;font-size:11px;color:#5c6a61">Veyro · PC Performance</p></div>';
    fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'accept': 'application/json', 'content-type': 'application/json', 'api-key': key },
      body: JSON.stringify({
        sender: { name: process.env.MAIL_FROM_NAME || 'Veyro', email: from },
        to: [{ email, name: name || email }],
        subject,
        htmlContent: html
      })
    }).then(r => { if (!r.ok) console.log('[mail] Brevo responded', r.status); })
      .catch(e => console.log('[mail] send failed:', e.message));
  }

  async function postRegister(body) {
    if (!body || typeof body.name !== 'string' || typeof body.email !== 'string' || typeof body.password !== 'string') {
      return { status: 400, body: { ok: false, error: 'name, email and password are required.' } };
    }
    const name = body.name.trim().slice(0, 60);
    const email = body.email.trim().toLowerCase().slice(0, 120);
    const pw = body.password;
    if (name.length < 2) return { status: 400, body: { ok: false, error: 'Name must be at least 2 characters.' } };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { status: 400, body: { ok: false, error: 'Email address is invalid.' } };
    if (pw.length < 6) return { status: 400, body: { ok: false, error: 'Password must be at least 6 characters.' } };
    if (data.users.some(u => u.email === email)) return { status: 409, body: { ok: false, error: 'An account with this email already exists.' } };
    const isFirst = data.users.length === 0;
    const salt = newSalt();
    const user = {
      id: crypto.randomBytes(8).toString('hex'),
      name, email,
      salt, passHash: hashPassword(pw, salt),
      admin: isFirst, createdAt: Date.now()
    };
    data.users.push(user);
    const session = { token: newToken(), userId: user.id, createdAt: Date.now() };
    data.sessions.push(session);
    db.save();
    try { sendWelcomeEmail(user.email, user.name, true); } catch (e) { /* never block signup */ }
    return { status: 200, body: { ok: true, token: session.token, user: publicUser(user), admin: user.admin, message: isFirst ? 'First account — you are the admin.' : 'Welcome!' } };
  }

  function postLogin(body, ip) {
    if (!body || typeof body.email !== 'string' || typeof body.password !== 'string') {
      return { status: 400, body: { ok: false, error: 'email and password are required.' } };
    }
    if (!rateCheck(ip)) return { status: 429, body: { ok: false, error: 'Too many attempts. Try again in a moment.' } };
    const email = body.email.trim().toLowerCase();
    const user = data.users.find(u => u.email === email);
    const pwHash = user ? hashPassword(body.password, user.salt) : hashPassword(body.password, newSalt());
    if (!user || pwHash !== user.passHash) {
      rateHit(ip);
      return { status: 401, body: { ok: false, error: 'Wrong email or password.' } };
    }
    rateClear(ip);
    const session = { token: newToken(), userId: user.id, createdAt: Date.now() };
    data.sessions = data.sessions.filter(s => s.userId !== user.id);
    data.sessions.push(session);
    db.save();
    try { sendWelcomeEmail(user.email, user.name, false); } catch (e) { /* never block login */ }
    return { status: 200, body: { ok: true, token: session.token, user: publicUser(user), admin: user.admin } };
  }

  function postActivate(body, user) {
    if (!body || typeof body.key !== 'string') return { status: 400, body: { ok: false, error: 'key is required.' } };
    const dec = decodeKey(body.key);
    if (!dec.ok) {
      const msg = dec.reason === 'checksum' ? 'The key is structurally broken.' : 'Format must be VEYR0-XXXXX-XXXXX-XXXXX.';
      return { status: 400, body: { ok: false, error: msg, status: 'INVALID' } };
    }
    const k = data.keys.find(x => x.code === dec.code);
    const now = Date.now();
    if (!k) {
      return {
        status: 404,
        body: { ok: false, error: 'This key was not issued by the Veyro server. Only admin-generated keys can be activated.', status: 'UNKNOWN' }
      };
    }
    if (k.revoked) return { status: 403, body: { ok: false, error: 'This key was revoked by the administrator.', status: 'REVOKED' } };
    if (k.expiresAt !== null && k.expiresAt <= now) {
      return { status: 400, body: { ok: false, error: 'This key expired on ' + new Date(k.expiresAt).toLocaleString() + '.', status: 'EXPIRED' } };
    }
    if (k.activatedBy && k.activatedBy !== user.id) {
      return { status: 409, body: { ok: false, error: 'This key is already activated by another account.', status: 'IN_USE' } };
    }
    const deviceId = typeof body.deviceId === 'string' ? body.deviceId.slice(0, 120) : 'unknown';
    if (!k.activatedBy) {
      k.activatedBy = user.id;
      k.activatedAt = now;
      k.deviceId = deviceId;
      db.save();
    }
    const dur = k.durationId ? DUR_BY_ID.get(k.durationId) : durationOf(k.expiresAt, k.createdAt);
    return {
      status: 200,
      body: {
        ok: true,
        key: dec.code,
        status: 'ACTIVE',
        expiresAt: k.expiresAt,
        durationId: dur ? dur.id : null,
        durationLabel: dur ? dur.label : null,
        activatedAt: k.activatedAt,
        deviceId: k.deviceId
      }
    };
  }

  function getKeyStatus(body, user) {
    const dec = decodeKey((body && body.key) || '');
    if (!dec.ok) return { status: 200, body: { ok: false, found: false, status: 'INVALID' } };
    const k = data.keys.find(x => x.code === dec.code);
    if (!k) return { status: 200, body: { ok: true, found: false, status: 'UNKNOWN' } };
    const st = keyStatus(user ? user.id : null, k);
    return {
      status: 200,
      body: {
        ok: true, found: true, status: st,
        owner: st === 'IN_USE' ? 'another account' : (k.activatedBy || null),
        expiresAt: k.expiresAt, revokedAt: k.revokedAt || null
      }
    };
  }

  function postPassword(body, user) {
    if (!user) return { status: 401, body: { ok: false, error: 'Not authenticated.' } };
    if (!body || typeof body.current !== 'string' || typeof body.next !== 'string') {
      return { status: 400, body: { ok: false, error: 'current and next are required.' } };
    }
    if (hashPassword(body.current, user.salt) !== user.passHash) {
      return { status: 401, body: { ok: false, error: 'Current password is wrong.' } };
    }
    if (body.next.length < 6) return { status: 400, body: { ok: false, error: 'New password must be at least 6 characters.' } };
    user.salt = newSalt();
    user.passHash = hashPassword(body.next, user.salt);
    db.save();
    return { status: 200, body: { ok: true, message: 'Password changed.' } };
  }

  function postGenerate(body, user) {
    if (!user.admin) return { status: 403, body: { ok: false, error: 'Admin only.' } };
    const durId = typeof body.durationId === 'string' ? body.durationId : 'h24';
    const dur = DUR_BY_ID.get(durId);
    if (!dur) return { status: 400, body: { ok: false, error: 'Unknown duration.' } };
    const count = Math.max(1, Math.min(20, (body.count | 0) || 1));
    const now = Date.now();
    const created = [];
    for (let i = 0; i < count; i++) {
      const expAt = dur.hours === null ? null : now + dur.hours * 3600000;
      const code = buildKey(expAt);
      const rec = {
        id: crypto.randomBytes(6).toString('hex'),
        code,
        durationId: dur.id,
        durationLabel: dur.label,
        hours: dur.hours,
        createdAt: now,
        expiresAt: expAt,
        revoked: false, revokedAt: null,
        activatedBy: null, activatedAt: null, deviceId: null
      };
      data.keys.unshift(rec);
      created.push(keyView(user.id, rec));
    }
    db.save();
    return { status: 200, body: { ok: true, keys: created } };
  }

  function postKeyGenSync(body) {
    const keys = body?.keys || [];
    if (!Array.isArray(keys) || !keys.length) {
      return { status: 400, body: { ok: false, error: 'keys array required' } };
    }
    const now = Date.now();
    const created = [];
    for (const k of keys) {
      const code = String(k.code || '').trim().toUpperCase();
      const durId = k.durationId || 'h24';
      const dur = DUR_BY_ID.get(durId);
      if (!code || !KEY_RE.test(code)) continue;
      const dec = decodeKey(code);
      if (!dec.ok) continue;
      const expAt = k.expiresAt || (dur ? (dur.hours === null ? null : now + dur.hours * 3600000) : null);
      const rec = {
        id: crypto.randomBytes(6).toString('hex'),
        code: dec.code,
        durationId: dur ? dur.id : durId,
        durationLabel: k.durationLabel || (dur ? dur.label : ''),
        hours: dur ? dur.hours : null,
        createdAt: k.createdAt || now,
        expiresAt: expAt,
        revoked: false, revokedAt: null,
        activatedBy: null, activatedAt: null, deviceId: null
      };
      data.keys.unshift(rec);
      created.push(keyView('keygen', rec));
    }
    db.save();
    return { status: 200, body: { ok: true, synced: created.length } };
  }

  function postRevoke(body, user) {
    if (!user.admin) return { status: 403, body: { ok: false, error: 'Admin only.' } };
    const k = data.keys.find(x => x.id === String(body.id || ''));
    if (!k) return { status: 404, body: { ok: false, error: 'Key not found.' } };
    k.revoked = true;
    k.revokedAt = Date.now();
    db.save();
    return { status: 200, body: { ok: true, key: keyView(user.id, k) } };
  }

  function postUnrevoke(body, user) {
    if (!user.admin) return { status: 403, body: { ok: false, error: 'Admin only.' } };
    const k = data.keys.find(x => x.id === String(body.id || ''));
    if (!k) return { status: 404, body: { ok: false, error: 'Key not found.' } };
    k.revoked = false;
    k.revokedAt = null;
    db.save();
    return { status: 200, body: { ok: true, key: keyView(user.id, k) } };
  }

  function getAdminKeys(req, user) {
    if (!user.admin) return { status: 403, body: { ok: false, error: 'Admin only.' } };
    const url = new URL(req.url, 'http://x');
    const q = (url.searchParams.get('q') || '').toUpperCase();
    const st = (url.searchParams.get('status') || '').toUpperCase();
    let list = data.keys.slice(0, 500);
    if (st) list = list.filter(k => keyStatus(user.id, k) === st);
    if (q) list = list.filter(k => k.code.includes(q) || (k.activatedBy || '').includes(q.toLowerCase()));
    return { status: 200, body: { ok: true, keys: list.map(k => keyView(user.id, k)), total: data.keys.length } };
  }

  function getAdminUsers(body, user) {
    if (!user.admin) return { status: 403, body: { ok: false, error: 'Admin only.' } };
    const users = data.users.map(u => {
      const owned = data.keys.filter(k => k.activatedBy === u.id);
      return {
        ...publicUser(u),
        keyCount: owned.length,
        activeKeys: owned.filter(k => keyStatus(u.id, k) === 'ACTIVE').length
      };
    });
    const allStatus = { AVAILABLE: 0, ACTIVE: 0, EXPIRED: 0, REVOKED: 0, IN_USE: 0 };
    data.keys.forEach(k => { allStatus[keyStatus(null, k)]++; });
    return {
      status: 200,
      body: {
        ok: true,
        users,
        keys: { total: data.keys.length, ...allStatus },
        now: Date.now(),
        dbPath: db.file
      }
    };
  }

  function postRole(body, user) {
    if (!user.admin) return { status: 403, body: { ok: false, error: 'Admin only.' } };
    const u = data.users.find(x => x.id === String(body.id || ''));
    if (!u) return { status: 404, body: { ok: false, error: 'User not found.' } };
    if (u.id === user.id && body.admin === false) {
      const otherAdmins = data.users.filter(x => x.admin && x.id !== user.id);
      if (!otherAdmins.length) return { status: 400, body: { ok: false, error: 'You are the last admin.' } };
    }
    u.admin = !!body.admin;
    db.save();
    return { status: 200, body: { ok: true, user: publicUser(u) } };
  }

  function getMyKeys(body, user) {
    const mine = data.keys
      .filter(k => k.activatedBy === user.id)
      .map(k => keyView(user.id, k))
      .sort((a, b) => (b.activatedAt || 0) - (a.activatedAt || 0));
    return { status: 200, body: { ok: true, keys: mine } };
  }

  /* ---------------- static site ---------------- */

  function serveStatic(req, res) {
    const url = new URL(req.url, 'http://x');
    let p = decodeURIComponent(url.pathname);
    if (p === '/') p = '/index.html';
    p = p.replace(/^\/+/, '');
    if (p.includes('..') || p.includes('\\')) { res.writeHead(403); res.end('Forbidden'); return; }
    const file = path.join(siteDir, p);
    if (!file.startsWith(siteDir)) { res.writeHead(403); res.end('Forbidden'); return; }
    fs.readFile(file, (err, buf) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not found. This server hosts the Veyro website + API on port ' + (opts.port || 9175) + '.');
        return;
      }
      res.writeHead(200, {
        'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
        'Cache-Control': 'no-cache'
      });
      res.end(buf);
    });
  }

  /* ---------------- router ---------------- */

  async function handler(req, res) {
    const url = new URL(req.url, 'http://x');
    const p = url.pathname;
    const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').replace(/^::ffff:/, '').split(',')[0].trim();
    const auth = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
    const user = authUser(auth);

    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400'
      });
      res.end();
      return true;
    }

    if (p.startsWith('/api/')) {
      let route = p.slice(5);
      /* /api/auth/* is reserved by the Vercel platform on *.vercel.app domains
         (their SSO flow), so the hosted site uses /api/account/* instead and we
         rewrite it back here. The desktop app keeps using /api/auth/* directly. */
      if (route.startsWith('account/')) route = 'auth/' + route.slice(8);
      const handle = (method, fn) => new Promise(resolve => {
        if (req.method !== method) { bad(res, 'Method not allowed', 405); resolve(true); return; }
        readBody(req, async body => {
          try {
            const r = await fn(body, user, ip, req);
            if (!r) { resolve(true); return; }
            res.writeHead(r.status, {
              'Content-Type': 'application/json; charset=utf-8',
              'Access-Control-Allow-Origin': '*',
              'Cache-Control': 'no-store'
            });
            res.end(JSON.stringify(r.body));
            resolve(true);
          } catch (e) {
            res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ ok: false, error: 'Server error: ' + e.message }));
            resolve(true);
          }
        });
      });

      if (route === 'auth/register') return await handle('POST', postRegister);
      if (route === 'auth/login') return await handle('POST', (b, u, i) => postLogin(b, i));
      if (route === 'auth/logout' && user) {
        data.sessions = data.sessions.filter(s => s.token !== auth);
        db.save();
        json(res, 200, { ok: true });
        return true;
      }
      if (route === 'auth/password' && user) return await handle('POST', postPassword);
      if (route === 'me' && user) { json(res, 200, { ok: true, user: publicUser(user) }); return true; }
      /* Discord linking — /api/auth/* is reserved on Vercel, so plain /api/discord/* */
      if (route === 'discord/start') return await handleDiscordStart(req, res, url);
      if (route === 'discord/callback') return await handleDiscordCallback(req, res, url);
      if (route === 'discord/unlink' && user) {
        delete user.discord; db.save();
        json(res, 200, { ok: true, user: publicUser(user) }); return true;
      }
      if (route === 'keys' && user) return await handle('GET', getMyKeys);
      if (route === 'keys/activate' && user) return await handle('POST', postActivate);
      if (route === 'keys/status') return await handle('POST', (b, u) => getKeyStatus(b, u));
      if (route.startsWith('admin/')) {
        if (!user || !user.admin) { bad(res, 'Admin only.', 403); return true; }
      }
      const USER_ROUTES = ['keys', 'keys/activate', 'me', 'auth/password', 'auth/logout'];
      if (!user && USER_ROUTES.includes(route)) { bad(res, 'Not logged in — please sign in again.', 401); return true; }
      if (route === 'admin/keys' && user) return await handle('GET', getAdminKeys);
      if (route === 'admin/keys/generate' && user) return await handle('POST', postGenerate);
      if (route === 'admin/keys/revoke' && user) return await handle('POST', postRevoke);
      if (route === 'keygen/sync' && isKeyGenAuth(auth)) return await handle('POST', postKeyGenSync);
      if (route === 'admin/keys/unrevoke' && user) return await handle('POST', postUnrevoke);
      if (route === 'admin/users' && user) return await handle('GET', getAdminUsers);
      if (route === 'admin/users/role' && user) return await handle('POST', postRole);
      if (route === 'health') { json(res, 200, { ok: true, name: 'Veyro Backend', port: opts.port || 9175, db: db.file, version: 1 }); return true; }
      if (route === '_debug') {
        json(res, 200, {
          user: user ? publicUser(user) : null,
          adminFlag: user ? (user.admin === true) : null,
          keysTotal: data.keys.length,
          sample: data.keys.slice(0, 3).map(k => ({ code: k.code, activatedBy: k.activatedBy, revoked: k.revoked }))
        });
        return true;
      }
      bad(res, 'Not found: /api/' + route, 404);
      return true;
    }

    return false;
  }

  const server = http.createServer(async (req, res) => {
    if (db.ensureLoaded) { try { await db.ensureLoaded(); } catch (e) {} }
    if (await handler(req, res)) return;
    serveStatic(req, res);
  });

  return { server, db, handler };
}

/* Vercel serverless entry — static files are served by the platform, so the
   function only handles /api/*. The DB lives in Vercel KV (Upstash-compatible
   REST endpoints exposed as KV_REST_API_URL / KV_REST_API_TOKEN). */
function createHandler() {
  const app = createServer({});
  return async function vercelHandler(req, res) {
    try { await app.db.ensureLoaded(); } catch (e) {}
    if (await app.handler(req, res)) return;
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ ok: false, error: 'Not found.' }));
  };
}

/* standalone mode */
if (require.main === module) {
  const port = Number(process.env.VEYRO_PORT || 9175);
  const instance = createServer({
    dbFile: process.env.VEYRO_DB || path.join(__dirname, 'db.json'),
    siteDir: path.join(__dirname, 'public')
  });
  instance.server.listen(port, '127.0.0.1', () => {
    console.log('Veyro Backend listening on http://127.0.0.1:' + port);
  });
}

module.exports = { createServer, createHandler, decodeKey, buildKey, DURATIONS, DUR_BY_ID };