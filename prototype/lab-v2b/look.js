// The one owner of the look, the theme, Aa and reduced motion. Runs in <head>, before first
// paint, so there is no flash and nothing for a later render to disagree with.
//   localStorage lab.look        paper | premium        (default paper)
//   localStorage lab.premiumMode day | night            (first switch: night unless the system prefers light)
//   localStorage lab.theme       any site theme id      (Paper only; the bar toggles cream <-> tokyo-night)
//   localStorage lab.aa          {"measure":"wide|comfortable","size":"16|17|19"}
// Query params override for one visit: ?look= ?mode=light|dark ?theme=
var Lab = window.Lab = window.Lab || {};
(function () {
  var root = document.documentElement;
  var q = new URLSearchParams(location.search);
  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
  };
  var themes = (Lab.data && Lab.data.themes) || [];
  var byId = {};
  themes.forEach(function (t) { byId[t.id] = t; });

  // Paper's tokens: one rule per site theme, generated from content/themes.ts by import.mjs.
  var css = themes.map(function (t) {
    var k = t.tokens;
    return '[data-look="paper"][data-theme="' + t.id + '"]{color-scheme:' + (t.dark ? 'dark' : 'light') +
      ';--canvas-base:' + k.canvas + ';--canvas-grid:' + k.grid + ';--surface:' + k.surface + ';--ink:' + k.ink +
      ';--ink-muted:' + k.inkMuted + ';--ink-subtle:' + k.inkSubtle + ';--accent:' + k.accent +
      ';--accent-ink:' + k.accentInk + ';--border:' + k.border + '}';
  }).join('\n');
  var style = document.createElement('style');
  style.id = 'lab-themes';
  style.textContent = css;
  document.head.appendChild(style);

  var prefersLight = window.matchMedia && matchMedia('(prefers-color-scheme: light)').matches;
  var reducedQuery = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

  var state = {
    look: store.get('lab.look') === 'premium' ? 'premium' : 'paper',
    premiumMode: store.get('lab.premiumMode') || null,
    theme: byId[store.get('lab.theme')] ? store.get('lab.theme') : 'cream',
    aa: (function () { try { return JSON.parse(store.get('lab.aa')) || {}; } catch { return {}; } })(),
  };
  if (q.get('look') === 'premium' || q.get('look') === 'paper') state.look = q.get('look');
  if (q.get('theme') && byId[q.get('theme')]) state.theme = q.get('theme');
  var qMode = q.get('mode');
  if (qMode === 'light' || qMode === 'dark') {
    if (state.look === 'premium') state.premiumMode = qMode === 'dark' ? 'night' : 'day';
    else if (!q.get('theme')) state.theme = qMode === 'dark' ? 'tokyo-night' : 'cream';
  }

  function apply() {
    var mode = state.premiumMode || (prefersLight ? 'day' : 'night');
    root.setAttribute('data-look', state.look);
    root.setAttribute('data-theme', state.theme);
    root.setAttribute('data-mode', mode);
    var dark = state.look === 'premium' ? mode === 'night' : !!(byId[state.theme] && byId[state.theme].dark);
    root.setAttribute('data-dark', dark ? '1' : '0');
    root.setAttribute('data-aa-measure', state.aa.measure === 'comfortable' ? 'comfortable' : 'wide');
    root.setAttribute('data-aa-size', String(state.aa.size || 17));
    root.setAttribute('data-reduced', reducedQuery.matches ? '1' : '0');
  }
  apply();
  if (reducedQuery.addEventListener) reducedQuery.addEventListener('change', apply);

  function fade() {
    if (Lab.look.reduced()) return;
    root.classList.add('look-fade');
    clearTimeout(fade.t);
    fade.t = setTimeout(function () { root.classList.remove('look-fade'); }, 360);
  }
  function emit() { document.dispatchEvent(new CustomEvent('lab:look')); }

  Lab.look = {
    get: function () { return { look: state.look, theme: state.theme, mode: root.getAttribute('data-mode'), dark: root.getAttribute('data-dark') === '1', aa: state.aa }; },
    reduced: function () { return root.getAttribute('data-reduced') === '1'; },
    setLook: function (look) {
      if (look === state.look) return;
      fade();
      state.look = look;
      if (look === 'premium' && !state.premiumMode) state.premiumMode = prefersLight ? 'day' : 'night';
      store.set('lab.look', look);
      if (state.premiumMode) store.set('lab.premiumMode', state.premiumMode);
      apply(); emit();
    },
    toggleDark: function () {
      fade();
      if (state.look === 'premium') {
        state.premiumMode = root.getAttribute('data-mode') === 'night' ? 'day' : 'night';
        store.set('lab.premiumMode', state.premiumMode);
      } else {
        state.theme = byId[state.theme] && byId[state.theme].dark ? 'cream' : 'tokyo-night';
        store.set('lab.theme', state.theme);
      }
      apply(); emit();
    },
    setTheme: function (id) { if (byId[id]) { state.theme = id; store.set('lab.theme', id); apply(); emit(); } },
    setAa: function (patch) {
      for (var k in patch) state.aa[k] = patch[k];
      store.set('lab.aa', JSON.stringify(state.aa));
      apply(); emit();
    },
    store: store,
  };
})();
