// The side player: the bar's Sound control and its panel. Modelled on the canvas's Sound menu.
// Collapsed by default, silent until tapped (a stored "on" is never auto-resumed), and it lives
// outside the routed page, so it keeps playing as the reader moves between Lab pages.
var Lab = window.Lab = window.Lab || {};
(function () {
  var esc = Lab.esc, A = Lab.audio, store = Lab.look.store;
  var P = Lab.player = { open: false, music: 'off', tab: 'radio', el: null };
  var stations = Lab.data.stations;
  var stationId = stations.some(function (s) { return s.id === store.get('canvas.station'); }) ? store.get('canvas.station') : stations[0].id;
  var under = store.get('lab.noiseUnder') === 'on';
  var panel, btn, connectTimer;
  var phone = function () { return window.matchMedia('(max-width: 760px)').matches; };
  var station = function () { return stations.find(function (s) { return s.id === stationId; }); };

  function sw(name, on, label) {
    return '<button type="button" class="switch" role="switch" data-sw="' + name + '" aria-checked="' + on + '" aria-label="' + esc(label) + '"></button>';
  }
  function range(name, label, v) {
    return '<label class="level"><span>' + esc(label) + '</span><input type="range" min="0" max="1" step="0.05" value="' + v + '" data-level="' + name + '"></label>';
  }

  P.mount = function (button) {
    btn = button;
    var noise = Lab.noise.textures;
    panel = Lab.html(
      '<aside class="player" id="player" aria-label="Sound and music" hidden>' +
        '<div class="pl-head"><h2>Sound and music</h2><button type="button" class="ctl" data-close>Close</button></div>' +
        '<div class="pl-sec"><div class="switch-row"><span><span class="label">Music</span><span class="status" data-status aria-live="polite">off</span></span>' + sw('music', false, 'Music') + '</div></div>' +
        '<div class="pl-sec">' +
          '<div class="tabs" role="tablist" aria-label="Source">' +
            ['radio', 'tracks', 'noise'].map(function (t, i) {
              return '<button type="button" role="tab" id="tab-' + t + '" aria-controls="tp-' + t + '" aria-selected="' + (i === 0) + '" data-tab="' + t + '">' + t.charAt(0).toUpperCase() + t.slice(1) + '</button>';
            }).join('') +
          '</div>' +
          '<div role="tabpanel" id="tp-radio" aria-labelledby="tab-radio"><ul class="picks">' +
            stations.map(function (s) { return '<li><button type="button" class="pick" data-station="' + s.id + '" aria-pressed="false"><span class="name">' + esc(s.label) + '</span><span class="blurb">' + esc(s.blurb) + '</span><span class="eq" aria-hidden="true"><i></i><i></i><i></i></span></button></li>'; }).join('') +
          '</ul><div class="pl-row-actions"><button type="button" class="ctl" data-shuffle>Shuffle</button></div></div>' +
          '<div role="tabpanel" id="tp-tracks" aria-labelledby="tab-tracks" hidden><p class="pl-empty">' + Lab.t('pl.tracks') + '</p></div>' +
          '<div role="tabpanel" id="tp-noise" aria-labelledby="tab-noise" hidden><ul class="picks">' +
            Object.keys(noise).map(function (id) { return '<li><button type="button" class="pick" data-noise="' + id + '" aria-pressed="false"><span class="name">' + esc(noise[id].label) + '</span><span class="blurb">' + esc(noise[id].blurb) + '</span><span class="eq" aria-hidden="true"><i></i><i></i><i></i></span></button></li>'; }).join('') +
          '</ul>' +
          '<div class="switch-row"><span class="label">Add under the music</span>' + sw('under', under, 'Add the noise under the music') + '</div>' +
          range('noise', 'Noise', A.levels.noise) +
          '<div class="pl-row-actions"><button type="button" class="ctl" data-noise-stop>Stop the noise</button></div></div>' +
        '</div>' +
        '<div class="pl-sec"><div class="switch-row"><span class="label">Interface sounds</span>' + sw('ui', A.interfaceOn, 'Interface sounds') + '</div></div>' +
        '<div class="pl-sec"><details class="levels"><summary>Levels<span class="chev" aria-hidden="true"></span></summary>' +
          range('master', 'Master', A.levels.master) + range('music', 'Music', A.levels.music) + range('interface', 'Interface', A.levels.interface) +
          '<div class="switch-row"><span class="label">Mute everything</span>' + sw('mute', false, 'Mute everything') + '</div>' +
        '</details></div>' +
      '</aside>');
    document.body.appendChild(panel);

    btn.addEventListener('click', function (e) { P.toggle(e.detail === 0); });
    panel.querySelector('[data-close]').addEventListener('click', function () { P.close(true); });
    panel.addEventListener('click', function (e) {
      var t = e.target.closest('button');
      if (!t) return;
      if (t.dataset.tab) return selectTab(t.dataset.tab);
      if (t.dataset.station) { pickStation(t.dataset.station); if (phone()) P.close(false); return; }
      if (t.dataset.noise) { pickNoise(t.dataset.noise); if (phone()) P.close(false); return; }
      if (t.hasAttribute('data-shuffle')) { var others = stations.filter(function (s) { return s.id !== stationId; }); pickStation(others[Math.floor(Math.random() * others.length)].id); return; }
      if (t.hasAttribute('data-noise-stop')) { Lab.noise.stop(); sync(); return; }
      var s = t.dataset.sw;
      if (s === 'music') return P.music === 'off' || P.music === 'error' ? playStation() : stopMusic();
      if (s === 'under') { under = t.getAttribute('aria-checked') !== 'true'; store.set('lab.noiseUnder', under ? 'on' : 'off'); return sync(); }
      if (s === 'ui') { A.setInterface(!A.interfaceOn); return sync(); }
      if (s === 'mute') { A.setMuted(!A.muted); return sync(); }
    });
    panel.addEventListener('input', function (e) {
      var k = e.target.dataset.level;
      if (k) { A.setLevel(k, Number(e.target.value)); applyVolume(); }
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && P.open) P.close(true); });
    document.addEventListener('pointerdown', function (e) {
      if (P.open && phone() && !panel.contains(e.target) && !btn.contains(e.target)) P.close(false);
    }, true);
    window.addEventListener('scroll', function () { if (P.open && phone() && Math.abs(window.scrollY - P.openedAt) > 24) P.close(false); }, { passive: true });
    window.addEventListener('resize', layout);
    A.onChange(applyVolume);
    sync();
  };

  function layout() {
    var push = P.open && !phone() && window.innerWidth < 1800;
    document.documentElement.classList.toggle('player-pushed', push);
  }
  P.toggle = function (byKeyboard) { if (P.open) P.close(true); else P.show(byKeyboard); };
  P.show = function (byKeyboard) {
    P.open = true; P.openedAt = window.scrollY;
    panel.hidden = false; btn.setAttribute('aria-expanded', 'true');
    layout();
    var first = panel.querySelector('[data-close]');
    if (byKeyboard && !phone()) first.focus({ preventScroll: true });
  };
  P.close = function (refocus) {
    if (!P.open) return;
    P.open = false; panel.hidden = true; btn.setAttribute('aria-expanded', 'false');
    layout();
    if (refocus) btn.focus({ preventScroll: true });
  };

  function selectTab(t) {
    P.tab = t;
    panel.querySelectorAll('[role=tab]').forEach(function (b) { b.setAttribute('aria-selected', String(b.dataset.tab === t)); });
    panel.querySelectorAll('[role=tabpanel]').forEach(function (p) { p.hidden = p.id !== 'tp-' + t; });
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
    var s = station(), n = Lab.noise.playing();
    var status = { off: 'off', connecting: 'connecting…', playing: 'playing · ' + s.label, error: Lab.raw('pl.error') }[P.music];
    panel.querySelector('[data-status]').textContent = status;
    panel.querySelector('[data-sw=music]').setAttribute('aria-checked', String(P.music === 'playing' || P.music === 'connecting'));
    panel.querySelector('[data-sw=under]').setAttribute('aria-checked', String(under));
    panel.querySelector('[data-sw=ui]').setAttribute('aria-checked', String(A.interfaceOn));
    panel.querySelector('[data-sw=mute]').setAttribute('aria-checked', String(A.muted));
    panel.querySelectorAll('[data-station]').forEach(function (b) {
      var on = b.dataset.station === stationId && P.music !== 'off';
      b.setAttribute('aria-pressed', String(on));
      b.classList.toggle('is-playing', on && P.music === 'playing');
    });
    panel.querySelectorAll('[data-noise]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.noise === n));
      b.classList.toggle('is-playing', b.dataset.noise === n);
    });
    var playing = P.music === 'playing' || !!n;
    btn.classList.toggle('is-playing', playing);
    var name = P.music === 'playing' ? s.label : n ? Lab.noise.textures[n].label : '';
    btn.querySelector('.now-name').textContent = name;
    btn.querySelector('.sound-word').hidden = !!name;
  }
  P.sync = function () { if (panel) sync(); };
})();
