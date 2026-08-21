/* ============================================================
   Veyro Prefs — persisted user state.
   Lives in %APPDATA%\VEYRO\settings.json  =>  { applied: [ids], favorites: [ids] }.
   Keeps applied optimizations and favorite games across restarts.
   ============================================================ */
console.log('[prefs.js] loading...');
Veyro.Prefs = (() => {
  'use strict';

  let data = { applied: [], favorites: [] };

  function load() {
    const bridge = window.veyroAgent && typeof window.veyroAgent.prefs === 'function'
      ? window.veyroAgent.prefs()
      : Promise.resolve({ ok: false });
    return bridge
      .then(res => {
        if (res && res.ok && res.data && typeof res.data === 'object') {
          data = {
            applied: Array.isArray(res.data.applied) ? res.data.applied.filter(id => typeof id === 'string') : [],
            favorites: Array.isArray(res.data.favorites) ? res.data.favorites.filter(id => typeof id === 'string') : []
          };
        }
        return data;
      })
      .catch(() => data);
  }

  function save() {
    const bridge = window.veyroAgent && typeof window.veyroAgent.savePrefs === 'function'
      ? window.veyroAgent.savePrefs({ applied: data.applied, favorites: data.favorites })
      : Promise.resolve({ ok: false });
    return bridge.catch(() => ({ ok: false }));
  }

  function isApplied(id) { return data.applied.indexOf(id) !== -1; }

  function markApplied(id) {
    if (!isApplied(id)) {
      data.applied.push(id);
      save();
    }
  }

  function unmarkApplied(id) {
    const i = data.applied.indexOf(id);
    if (i !== -1) {
      data.applied.splice(i, 1);
      save();
    }
  }

  function isFavorite(id) { return data.favorites.indexOf(id) !== -1; }

  function toggleFavorite(id) {
    const i = data.favorites.indexOf(id);
    if (i !== -1) data.favorites.splice(i, 1);
    else data.favorites.push(id);
    save();
    return isFavorite(id);
  }

  function listApplied() { return data.applied.slice(); }

  function listFavorites() { return data.favorites.slice(); }

  return { load, isApplied, markApplied, unmarkApplied, isFavorite, toggleFavorite, listApplied, listFavorites };
})();