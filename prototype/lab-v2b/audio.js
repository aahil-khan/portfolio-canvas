// The one AudioContext and its buses, the interface cues, and the mute owner.
//   master ─┬─ cue bus (interface level) → make-up ×2.5 → low-pass 1.85kHz ─┐
//           └─ ambience bus: limiter (−12dB, 8:1) ← noise level ← noise voices ┘→ destination
// Music (radio) plays through an <audio> element whose volume is master × music, as on the canvas.
// Nothing is created until the reader asks for sound: no context, no media on load.
// Stored with the canvas's own keys, so a visitor's choices carry between the desk and the Lab.
var Lab = window.Lab = window.Lab || {};
(function () {
  var store = Lab.look.store;
  var num = function (k, d) { var v = Number(store.get(k)); return isFinite(v) && store.get(k) !== null ? Math.min(1, Math.max(0, v)) : d; };
  var ctx = null, nodes = null;
  var A = Lab.audio = {
    interfaceOn: store.get('canvas.sound') === 'on',
    muted: false,
    levels: { master: num('canvas.masterVolume', 0.8), music: num('canvas.ambienceVolume', 0.5), noise: num('lab.noiseLevel', 0.35), interface: num('canvas.uiVolume', 1) },
    listeners: [],
  };

  A.context = function () {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return ctx; }
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    var master = ctx.createGain();
    var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1850;
    var makeup = ctx.createGain(); makeup.gain.value = 2.5;
    var cue = ctx.createGain();
    var limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -12; limiter.ratio.value = 8; limiter.knee.value = 0; limiter.attack.value = 0.003; limiter.release.value = 0.25;
    var noise = ctx.createGain();
    cue.connect(makeup); makeup.connect(lp); lp.connect(master);
    noise.connect(limiter); limiter.connect(master);
    master.connect(ctx.destination);
    nodes = { master: master, cue: cue, noise: noise, limiter: limiter };
    A.nodes = nodes;
    apply();
    return ctx;
  };

  function apply() {
    if (nodes) {
      nodes.master.gain.value = A.muted ? 0 : A.levels.master;
      nodes.cue.gain.value = A.levels.interface;
      nodes.noise.gain.value = A.levels.noise;   // voices peak at 0.25, so full level stays ≤ 0.25
    }
    A.listeners.forEach(function (f) { f(); });
  }
  A.setLevel = function (k, v) {
    A.levels[k] = v;
    store.set({ master: 'canvas.masterVolume', music: 'canvas.ambienceVolume', noise: 'lab.noiseLevel', interface: 'canvas.uiVolume' }[k], String(v));
    apply();
  };
  A.setMuted = function (m) { A.muted = m; apply(); };
  A.setInterface = function (on) { A.interfaceOn = on; store.set('canvas.sound', on ? 'on' : 'off'); if (on) A.context(); apply(); };
  A.onChange = function (f) { A.listeners.push(f); };

  // ---------- cues: each voice's peak is the number in the table; all ≤ 0.08 ----------
  var noiseBuf = null;
  function burstBuffer(c) {
    if (noiseBuf) return noiseBuf;
    noiseBuf = c.createBuffer(1, Math.floor(c.sampleRate * 0.2), c.sampleRate);
    var d = noiseBuf.getChannelData(0);
    for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return noiseBuf;
  }
  function tone(c, freq, peak, dur, type) {
    var t = c.currentTime + 0.005;
    var o = c.createOscillator(); o.type = type || 'sine'; o.frequency.value = freq;
    var g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(nodes.cue);
    o.start(t); o.stop(t + dur + 0.05);
  }
  var CUES = {
    peek: function (c) { tone(c, 1300, 0.02, 0.06); },
    turn: function (c) {
      var t = c.currentTime + 0.005;
      var s = c.createBufferSource(); s.buffer = burstBuffer(c);
      var bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1400; bp.Q.value = 1.1;
      var g = c.createGain();
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.03, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
      s.connect(bp); bp.connect(g); g.connect(nodes.cue); s.start(t); s.stop(t + 0.12);
    },
    counter: function (c) { tone(c, 740, 0.03, 0.12); tone(c, 1110, 0.012, 0.09); },
    deal: function (c) {
      [[880, 0.045], [882.6, 0.0225], [2041.6, 0.018], [3740, 0.0077], [5834.4, 0.0032], [7040, 0.0099]]
        .forEach(function (p) { tone(c, p[0], p[1], 1.1); });
    },
  };
  A.cueNames = Object.keys(CUES);
  A.cue = function (name) {
    if (!A.interfaceOn || A.muted) return;
    var c = A.context();
    if (!c) return;
    CUES[name](c);
  };
})();
