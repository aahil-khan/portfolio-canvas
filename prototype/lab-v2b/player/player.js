// The Sound menu: the canvas's own menu (components/desktop/sound-menu.tsx), row for row. A compact
// drop-down under the bar's Sound pill: Interface sounds, Ambience, the station list with shuffle and
// the now-playing equaliser, the mixer (Master, with Music, Noise and Interface folded away), a credit.
// The Lab's extras, five noises and Tracks, share the station list's slot behind a small segmented
// row, so the menu keeps the canvas's footprint. Silent until tapped (a stored "on" is never resumed),
// and it lives outside the routed page, so it keeps playing as the reader moves between Lab pages.
// Stored under the canvas's keys (canvas.sound, canvas.station, canvas.ambience, the levels).
var Lab = window.Lab = window.Lab || {};
(function () {
  var esc = Lab.esc, A = Lab.audio, store = Lab.look.store;
  var P = Lab.player = { open: false, music: 'off', tab: 'radio', el: null };
  var stations = Lab.data.stations;
  var stationId = stations.some(function (s) { return s.id === store.get('canvas.station'); }) ? store.get('canvas.station') : stations[0].id;
  var under = store.get('lab.noiseUnder') === 'on';
  var menu, btn, connectTimer;
  var phone = function () { return window.matchMedia('(max-width: 760px)').matches; };
  var station = function () { return stations.find(function (s) { return s.id === stationId; }); };
  var r = Lab.raw;

  function item(sw, label, hint) {
    return '<button type="button" class="sm-item" role="switch" aria-checked="false" data-sw="' + sw + '"><span class="sm-row"><span class="sm-label">' + esc(label) + '</span><span class="sw" aria-hidden="true"></span></span>' +
      (hint ? '<span class="sm-hint"' + (sw === 'music' ? ' data-status aria-live="polite"' : '') + '>' + esc(hint) + '</span>' : '') + '</button>';
  }
  function row(attr, label, hint) {
    return '<button type="button" class="station" ' + attr + ' aria-pressed="false"><span class="sm-row"><span class="sm-label">' + esc(label) + '</span><span class="sm-hint">' + esc(hint) + '</span>' +
      '<span class="eq" aria-label="' + esc(r('pl.now')) + '"><i></i><i></i><i></i></span></span></button>';
  }
  function fader(name, label, v, primary) {
    var pct = Math.round(v * 100);
    return '<label class="fader' + (primary ? ' is-primary' : '') + '"><span class="fader-name">' + esc(label) + '</span>' +
      '<input type="range" min="0" max="100" value="' + pct + '" data-level="' + name + '" aria-label="' + esc(label) + ' volume" style="--fill:' + pct + '%"><span class="fader-pct">' + pct + '</span></label>';
  }
  var SVG = function (d) { return '<svg viewBox="0 0 24 24" aria-hidden="true">' + d + '</svg>'; };

  P.mount = function (button) {
    btn = button;
    var noise = Lab.noise.textures;
    menu = Lab.html(
      '<div class="sm player" id="player" role="dialog" aria-label="' + esc(r('pl.title')) + '" hidden>' +
        item('ui', r('pl.ui'), r('pl.ui.hint')) +
        item('music', r('pl.amb'), r('pl.amb.off')) +
        '<div class="sm-sources">' +
          '<div class="sm-head"><div class="sm-seg" role="tablist" aria-label="' + esc(r('pl.source')) + '">' +
            ['radio', 'noise', 'tracks'].map(function (t, i) { return '<button type="button" role="tab" id="tab-' + t + '" aria-controls="tp-' + t + '" aria-selected="' + (i === 0) + '" data-tab="' + t + '">' + esc(r('pl.tab.' + t)) + '</button>'; }).join('') +
          '</div><button type="button" class="sm-shuffle" data-shuffle>' + esc(r('pl.shuffle')) + '</button></div>' +
          '<div class="sm-lists">' +
            '<div role="tabpanel" id="tp-radio" aria-labelledby="tab-radio" data-panel="radio" class="is-on">' + stations.map(function (s) { return row('data-station="' + s.id + '"', s.label, s.blurb); }).join('') + '</div>' +
            '<div role="tabpanel" id="tp-noise" aria-labelledby="tab-noise" data-panel="noise" inert>' + Object.keys(noise).map(function (id) { return row('data-noise="' + id + '"', noise[id].label, noise[id].blurb); }).join('') +
              item('under', r('pl.under'), '') + '</div>' +
            '<div role="tabpanel" id="tp-tracks" aria-labelledby="tab-tracks" data-panel="tracks" inert><p class="sm-empty">' + Lab.t('pl.tracks') + '</p></div>' +
          '</div>' +
        '</div>' +
        '<div class="mix">' +
          '<div class="mix-master">' + fader('master', r('pl.master'), A.levels.master, true) +
            '<button type="button" class="mix-btn" data-sw="mute" aria-pressed="false" aria-label="' + esc(r('pl.mute')) + '">' +
              SVG('<path d="M11 5 6.5 9H3v6h3.5L11 19V5Z"/><g class="off"><path d="M15.5 9.5a3.5 3.5 0 0 1 0 5"/></g><g class="on"><path d="m16 10 4 4m0-4-4 4"/></g>') + '</button>' +
            '<button type="button" class="mix-btn" data-mix aria-expanded="false" aria-controls="mix-detail" aria-label="' + esc(r('pl.mix.show')) + '">' + SVG('<path d="m6 9 6 6 6-6"/>') + '</button>' +
          '</div>' +
          '<div class="mix-detail" id="mix-detail"><div class="mix-detail-inner">' +
            fader('music', r('pl.music'), A.levels.music) + fader('noise', r('pl.noise'), A.levels.noise) + fader('interface', r('pl.interface'), A.levels.interface) +
          '</div></div>' +
        '</div>' +
        '<p class="sm-credit">' + Lab.t('pl.credit') + '</p>' +
      '</div>');
    document.body.appendChild(menu);

    btn.addEventListener('click', function (e) { P.toggle(e.detail === 0); });
    menu.addEventListener('click', function (e) {
      var t = e.target.closest('button');
      if (!t) return;
      if (t.dataset.tab) return selectTab(t.dataset.tab);
      if (t.dataset.station) { pickStation(t.dataset.station); if (phone()) P.close(false); return; }
      if (t.dataset.noise) { pickNoise(t.dataset.noise); if (phone()) P.close(false); return; }
      if (t.hasAttribute('data-shuffle')) { var others = stations.filter(function (s) { return s.id !== stationId; }); pickStation(others[Math.floor(Math.random() * others.length)].id); return; }
      if (t.hasAttribute('data-mix')) {
        var open = t.getAttribute('aria-expanded') !== 'true';
        t.setAttribute('aria-expanded', String(open));
        t.setAttribute('aria-label', r(open ? 'pl.mix.hide' : 'pl.mix.show'));
        menu.querySelector('.mix-detail').classList.toggle('is-open', open);
        return;
      }
      var s = t.dataset.sw;
      if (s === 'music') return P.music === 'off' || P.music === 'error' ? playStation() : stopMusic();
      if (s === 'under') { under = !under; store.set('lab.noiseUnder', under ? 'on' : 'off'); return sync(); }
      if (s === 'ui') { A.setInterface(!A.interfaceOn); if (A.interfaceOn) A.cue('peek'); return sync(); }
      if (s === 'mute') { A.setMuted(!A.muted); return sync(); }
    });
    menu.addEventListener('input', function (e) {
      var k = e.target.dataset.level;
      if (!k) return;
      var v = Number(e.target.value) / 100;
      e.target.style.setProperty('--fill', e.target.value + '%');
      e.target.nextElementSibling.textContent = e.target.value;
      A.setLevel(k, v);
      if (k === 'interface' && A.interfaceOn) A.cue('peek');
    });
    // as on the canvas: Esc or a press anywhere outside closes it; on a phone a pick or a scroll does too
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && P.open) P.close(true); });
    document.addEventListener('pointerdown', function (e) {
      if (P.open && !menu.contains(e.target) && !btn.contains(e.target)) P.close(false);
    }, true);
    window.addEventListener('scroll', function () { if (P.open && phone() && Math.abs(window.scrollY - P.openedAt) > 24) P.close(false); }, { passive: true });
    A.onChange(function () { applyVolume(); sync(); });
    sync();
  };

  P.toggle = function (byKeyboard) { if (P.open) P.close(true); else P.show(byKeyboard); };
  P.show = function (byKeyboard) {
    P.open = true; P.openedAt = window.scrollY;
    menu.hidden = false; btn.setAttribute('aria-expanded', 'true');
    if (byKeyboard) menu.querySelector('.sm-item').focus({ preventScroll: true });
  };
  P.close = function (refocus) {
    if (!P.open) return;
    P.open = false; menu.hidden = true; btn.setAttribute('aria-expanded', 'false');
    if (refocus) btn.focus({ preventScroll: true });
  };

  function selectTab(t) {
    P.tab = t;
    menu.querySelectorAll('[role=tab]').forEach(function (b) { b.setAttribute('aria-selected', String(b.dataset.tab === t)); });
    menu.querySelectorAll('[data-panel]').forEach(function (p) { var on = p.dataset.panel === t; p.classList.toggle('is-on', on); p.inert = !on; });
    menu.querySelector('[data-shuffle]').hidden = t !== 'radio';
  }

  function element() {
    if (P.el) return P.el;
    var a = P.el = document.createElement('audio');
    a.preload = 'none';
    a.setAttribute('data-lab-player', '');
    a.addEventListener('playing', function () { clearTimeout(connectTimer); P.music = 'playing'; sync(); });
    a.addEventListener('waiting', function () { if (P.music === 'playing') { P.music = 'connecting'; sync(); } });
    a.addEventListener('error', function () { if (P.music !== 'off') { P.music = 'error'; sync(); } });
    document.body.appendChild(a);
    return a;
  }
  function applyVolume() {
    if (P.el) { P.el.volume = A.muted ? 0 : A.levels.master * A.levels.music; P.el.muted = A.muted; }
  }
  function pickStation(id) {
    stationId = id; store.set('canvas.station', id);
    playStation();
  }
  function playStation() {
    var a = element(), s = station();
    if (!under && Lab.noise.playing()) Lab.noise.stop();
    P.music = 'connecting'; sync();
    store.set('canvas.ambience', 'on');
    a.src = s.url;
    applyVolume();
    var p = a.play();
    if (p && p.catch) p.catch(function () { if (P.music !== 'off') { P.music = 'error'; sync(); } });
    clearTimeout(connectTimer);
    connectTimer = setTimeout(function () { if (P.music === 'connecting') { P.music = 'error'; sync(); } }, 15000);
    if ('mediaSession' in navigator && window.MediaMetadata) {
      try { navigator.mediaSession.metadata = new MediaMetadata({ title: s.label, artist: s.blurb, album: 'The Lab' }); } catch { /* best effort */ }
    }
  }
  function stopMusic() {
    clearTimeout(connectTimer);
    if (P.el) { P.el.pause(); P.el.removeAttribute('src'); P.el.load(); }
    P.music = 'off'; store.set('canvas.ambience', 'off'); sync();
  }
  function pickNoise(id) {
    if (Lab.noise.playing() === id) { Lab.noise.stop(); return sync(); }
    if (!under && P.music !== 'off') stopMusic();
    Lab.noise.start(id);
    sync();
  }

  function sync() {
    if (!menu) return;
    var s = station(), n = Lab.noise.playing();
    var status = { off: r('pl.amb.off'), connecting: r('pl.connecting'), playing: r('pl.playing') + ' · ' + s.label, error: r('pl.error') }[P.music];
    menu.querySelector('[data-status]').textContent = status;
    menu.querySelector('[data-sw=music]').setAttribute('aria-checked', String(P.music === 'playing' || P.music === 'connecting'));
    menu.querySelector('[data-sw=under]').setAttribute('aria-checked', String(under));
    menu.querySelector('[data-sw=ui]').setAttribute('aria-checked', String(A.interfaceOn));
    menu.querySelector('[data-sw=mute]').setAttribute('aria-pressed', String(A.muted));
    menu.querySelectorAll('[data-station]').forEach(function (b) {
      var on = b.dataset.station === stationId;
      b.setAttribute('aria-pressed', String(on));
      b.classList.toggle('is-playing', on && P.music === 'playing');
    });
    menu.querySelectorAll('[data-noise]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.noise === n));
      b.classList.toggle('is-playing', b.dataset.noise === n);
    });
    var playing = P.music === 'playing' || !!n;
    btn.classList.toggle('is-playing', playing);
    var name = P.music === 'playing' ? s.label : n ? Lab.noise.textures[n].label : '';
    btn.querySelector('.now-name').textContent = name;
    btn.querySelector('.sound-word').hidden = !!name;
  }
  P.sync = function () { sync(); };
})();
