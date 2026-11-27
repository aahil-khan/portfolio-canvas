// Figures for builds and notes, registered by id.
var Lab = window.Lab = window.Lab || {};
(function () {
  var I = Lab.instruments = Lab.instruments || {};

  // pass@k against pass^k (note T02's lead). Arithmetic, not results: for runs that succeed
  // independently with chance p, pass@k = 1 - (1 - p)^k and pass^k = p^k. One control, a slider
  // for p; the card size shows k = 5 at p = 0.9 with no control.
  var KS = [1, 3, 5, 8];
  var pct = function (v) { var x = v * 100, s = x >= 99.95 && x < 100 ? x.toFixed(3) : x.toFixed(1); return s.replace(/\.?0+$/, '') + '%'; };
  I.passk = function (entry, size) {
    var full = size !== 'card';
    var ks = full ? KS : [5];
    var rows = ks.map(function (k) {
      return '<div class="pk-row" data-k="' + k + '">' +
        '<span class="pk-k"><span data-num>k = ' + k + '</span></span>' +
        '<span class="pk-bars"><span class="pk-bar pk-at"><i></i></span><span class="pk-bar pk-hat"><i></i></span></span>' +
        '<span class="pk-vals"><span class="pk-v"><span class="muted">' + Lab.t('passk.at') + '</span> <span data-num class="pk-at-v"></span></span>' +
        '<span class="pk-v"><span class="muted">' + Lab.t('passk.hat') + '</span> <span data-num class="pk-hat-v"></span></span></span></div>';
    }).join('');
    var el = Lab.html('<div class="panel passk' + (full ? '' : ' passk-card') + '">' +
      (full ? '<label class="pk-p"><span class="pk-p-label">' + Lab.t('passk.p') + ' <span data-num class="pk-p-v"></span></span>' +
        '<input type="range" min="50" max="99" step="1" value="90" aria-valuetext="90%"></label>' : '<p class="pk-p-label">' + Lab.t('passk.p') + ' <span data-num>90%</span></p>') +
      '<div class="pk-rows">' + rows + '</div>' +
      '<p class="pk-key muted"><span class="pk-swatch pk-at"></span>' + Lab.t('passk.atKey') + '<span class="pk-swatch pk-hat"></span>' + Lab.t('passk.hatKey') + '</p></div>');
    var input = el.querySelector('input');
    function draw(p) {
      el.querySelectorAll('.pk-row').forEach(function (r) {
        var k = Number(r.dataset.k), at = 1 - Math.pow(1 - p, k), hat = Math.pow(p, k);
        r.querySelector('.pk-at i').style.width = (at * 100).toFixed(2) + '%';
        r.querySelector('.pk-hat i').style.width = (hat * 100).toFixed(2) + '%';
        r.querySelector('.pk-at-v').textContent = pct(at);
        r.querySelector('.pk-hat-v').textContent = pct(hat);
      });
      var pv = el.querySelector('.pk-p-v');
      if (pv) pv.textContent = Math.round(p * 100) + '%';
      if (input) input.setAttribute('aria-valuetext', Math.round(p * 100) + '%');
    }
    if (input) input.addEventListener('input', function () { draw(Number(input.value) / 100); });
    draw(0.9);
    return el;
  };
})();
