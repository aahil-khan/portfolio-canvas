// Five synthesised textures, zero files. Each is built from one shared 2s buffer per colour,
// routed under the ambience bus (never the interface cue bus), peaks at 0.25 at full level,
// and fades in and out over 0.8s so nothing clicks.
var Lab = window.Lab = window.Lab || {};
(function () {
  var PEAK = 0.24, FADE = 0.8;   // 0.24 leaves a margin under the 0.25 ceiling
  var bufs = {};
  function buffer(c, colour) {
    if (bufs[colour]) return bufs[colour];
    var len = c.sampleRate * 2, b = c.createBuffer(1, len, c.sampleRate), d = b.getChannelData(0);
    var b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0, max = 0, i, w;
    for (i = 0; i < len; i++) {
      w = Math.random() * 2 - 1;
      if (colour === 'pink') { // Paul Kellet's filter
        b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
        b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
        d[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362; b6 = w * 0.115926;
      } else if (colour === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last; }
      else d[i] = w;
      max = Math.max(max, Math.abs(d[i]));
    }
    for (i = 0; i < len; i++) d[i] /= max;   // normalise, so the voice gain is the peak
    // crossfade the loop seam
    var x = Math.floor(c.sampleRate * 0.05);
    for (i = 0; i < x; i++) { var k = i / x; d[i] = d[i] * k + d[len - x + i] * (1 - k); }
    return (bufs[colour] = b);
  }
  function loop(c, colour) { var s = c.createBufferSource(); s.buffer = buffer(c, colour); s.loop = true; return s; }
  function filter(c, type, f, q) { var n = c.createBiquadFilter(); n.type = type; n.frequency.value = f; if (q) n.Q.value = q; return n; }

  var TEXTURES = {
    brown: { label: 'Brown', blurb: 'deep and even, like a far-off waterfall', build: function (c, out) { var s = loop(c, 'brown'); s.connect(out); return [s]; } },
    pink: { label: 'Pink', blurb: 'softer than white, steady', build: function (c, out) { var s = loop(c, 'pink'); var lp = filter(c, 'lowpass', 6000); s.connect(lp); lp.connect(out); return [s]; } },
    rain: { label: 'Rain', blurb: 'band-passed hiss with sparse drops', build: function (c, out, voice) {
      var s = loop(c, 'pink'); var bp = filter(c, 'bandpass', 2400, 0.6); s.connect(bp); bp.connect(out);
      var timer = null, alive = true;
      (function drop() {
        if (!alive) return;
        var t = c.currentTime + 0.02, g = c.createGain(), d = loop(c, 'white'), hp = filter(c, 'bandpass', 3000 + Math.random() * 2500, 4);
        var peak = PEAK * (0.2 + Math.random() * 0.25);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
        d.connect(hp); hp.connect(g); g.connect(voice.drops); d.start(t, Math.random()); d.stop(t + 0.07);
        timer = setTimeout(drop, 60 + Math.random() * 220);
      })();
      return [s, { stop: function () { alive = false; clearTimeout(timer); } }];
    } },
    fan: { label: 'Room fan', blurb: 'a low hum under filtered air', build: function (c, out) {
      var s = loop(c, 'brown'); var lp = filter(c, 'lowpass', 520); var bg = c.createGain(); bg.gain.value = 0.8; s.connect(lp); lp.connect(bg); bg.connect(out);
      var hum = c.createOscillator(); hum.frequency.value = 58; var hg = c.createGain(); hg.gain.value = 0.12; hum.connect(hg); hg.connect(out);
      var hum2 = c.createOscillator(); hum2.frequency.value = 116; var hg2 = c.createGain(); hg2.gain.value = 0.05; hum2.connect(hg2); hg2.connect(out);
      return [s, hum, hum2];
    } },
    waves: { label: 'Waves', blurb: 'brown noise that swells every 7 to 11 seconds', build: function (c, out) {
      var s = loop(c, 'brown'); var lp = filter(c, 'lowpass', 900); var swell = c.createGain(); swell.gain.value = 0.35;
      s.connect(lp); lp.connect(swell); swell.connect(out);
      var timer = null, alive = true;
      (function wave() {
        if (!alive) return;
        var t = c.currentTime, len = 7 + Math.random() * 4;
        swell.gain.cancelScheduledValues(t);
        swell.gain.setValueAtTime(swell.gain.value, t);
        swell.gain.linearRampToValueAtTime(1, t + len * 0.45);
        swell.gain.linearRampToValueAtTime(0.3, t + len);
        timer = setTimeout(wave, len * 1000);
      })();
      return [s, { stop: function () { alive = false; clearTimeout(timer); } }];
    } },
  };

  var current = null;
  Lab.noise = {
    textures: TEXTURES,
    PEAK: PEAK, FADE: FADE,
    playing: function () { return current && current.id; },
    start: function (id) {
      var c = Lab.audio.context();
      if (!c) return false;
      if (current && current.id === id) return true;
      Lab.noise.stop();
      var t = c.currentTime;
      var g = c.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(PEAK, t + FADE);
      g.connect(Lab.audio.nodes.noise);
      var drops = c.createGain(); drops.gain.value = 1; drops.connect(Lab.audio.nodes.noise);
      var voice = { id: id, gain: g, drops: drops };
      voice.parts = TEXTURES[id].build(c, g, voice);
      voice.parts.forEach(function (p) { if (p.start) p.start(t); });
      current = voice;
      return true;
    },
    stop: function () {
      if (!current) return;
      var v = current, c = Lab.audio.context(), t = c.currentTime;
      current = null;
      v.gain.gain.cancelScheduledValues(t);
      v.gain.gain.setValueAtTime(v.gain.gain.value, t);
      v.gain.gain.linearRampToValueAtTime(0, t + FADE);
      v.drops.gain.setValueAtTime(1, t); v.drops.gain.linearRampToValueAtTime(0, t + FADE);
      setTimeout(function () { v.parts.forEach(function (p) { try { p.stop(); } catch { /* already stopped */ } }); v.gain.disconnect(); v.drops.disconnect(); }, FADE * 1000 + 60);
    },
  };
})();
