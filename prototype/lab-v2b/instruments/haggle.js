// Chapter 05's lead: haggle with the spec's pricing logic and watch what the agent sees.
// 'full' is the chapter's lead; 'card' is the compact version on the home's featured card.
var Lab = window.Lab = window.Lab || {};
(function () {
  var esc = Lab.esc;
  var rs = function (n) { return '₹' + n; };

  Lab.instruments.haggle = function (entry, size) {
    var item = Lab.data.items['CHG-20W'];
    var core = Lab.haggleCore;
    var full = size !== 'card';
    var shop, rounds, mode = 'B', done;
    var uid = 'hg' + Math.random().toString(36).slice(2, 7);

    var root = Lab.html(
      '<div class="haggle-wrap">' +
        '<div class="panel ' + (full ? 'haggle' : 'haggle-mini') + '">' +
          '<div class="haggle-shop">' +
            '<p class="haggle-q">' + Lab.t('haggle.q') + '</p>' +
            '<form class="haggle-form" novalidate>' +
              '<label class="field"><span aria-hidden="true">₹</span><span class="sr">' + Lab.t('haggle.label') + '</span>' +
                '<input id="' + uid + '" name="offer" inputmode="numeric" autocomplete="off" enterkeyhint="send" placeholder="700" maxlength="6"></label>' +
              '<button class="btn" type="submit">' + Lab.t('haggle.offer') + '</button>' +
            '</form>' +
            '<ol class="transcript" aria-live="polite"></ol>' +
            (full ? '<p class="illus">' + Lab.t('haggle.illus') + '</p>' : '<p class="trace" data-tool-log hidden></p>') +
          '</div>' +
          (full ?
          '<div class="haggle-agent">' +
            '<details class="log" data-tool-log>' +
              '<summary>' + Lab.t('haggle.sees') + '<span class="chev" aria-hidden="true"></span></summary>' +
              '<div class="ab ab-in-log" role="group" aria-label="' + Lab.t('haggle.ab.label') + '">' +
                '<button type="button" data-ab="B" aria-pressed="true">' + Lab.t('haggle.ab.b') + '</button>' +
                '<button type="button" data-ab="A" aria-pressed="false">' + Lab.t('haggle.ab.a') + '</button>' +
              '</div>' +
              '<pre></pre>' +
            '</details>' +
          '</div>' : '') +
        '</div>' +
      '</div>');

    var form = root.querySelector('form');
    var input = root.querySelector('input');
    var list = root.querySelector('.transcript');
    var pre = root.querySelector('pre');
    var details = root.querySelector('details');
    var trace = root.querySelector('.trace');
    if (details && window.matchMedia('(min-width: 761px)').matches) details.open = true;
    if (details) details.addEventListener('toggle', function () {
      var s = details.querySelector('summary .chev');
      if (s) s.parentElement.setAttribute('aria-expanded', String(details.open));
    });

    function say(who, html, cls) {
      var li = document.createElement('li');
      if (cls) li.className = cls;
      li.innerHTML = who ? '<span class="who">' + Lab.t(who === 'you' ? 'haggle.you' : 'haggle.shop') + '</span><span class="' + who + '">' + html + '</span>' : html;
      list.appendChild(li);
      list.scrollTop = list.scrollHeight;
      return li;
    }

    function logContext() {
      var floor = mode === 'A' ? ' · <span class="mk">floor ' + rs(item.floor) + '</span>' : '';
      return '<span class="k">context</span>\n' +
        '  <span class="k">system</span>  You run {shop_name}. ' + (mode === 'A' ? 'Never reveal a floor.' : 'You never see floor prices.') + '\n' +
        '  <span class="k">item</span>    ' + item.id + ' · ' + esc(item.name) + ' · list ' + rs(item.list) + floor + '\n' +
        '  <span class="k">tools</span>   find_item, check_stock, ' + (mode === 'A' ? '' : 'evaluate_offer, ') + 'confirm_sale';
    }
    function logRound(r, fresh) {
      var res = r.action === 'accept' ? 'accept' : r.action === 'agreed' ? 'accept (agreed ' + rs(r.price) + ')' : 'counter · suggested ' + rs(r.price);
      var body = mode === 'B'
        ? 'evaluate_offer(' + item.id + ', qty 1, ' + rs(r.offer) + ', round ' + r.round + ')\n  <span class="k">returns</span> ' + res
        : 'customer offers ' + rs(r.offer) + ', round ' + r.round + '\n  <span class="k">' + Lab.t('haggle.decides') + '</span> ' + res;
      return '<span class="round' + (fresh ? ' fresh' : '') + '">' + body + '</span>';
    }
    function renderLog(freshLast) {
      if (!pre) return;
      pre.innerHTML = logContext() + rounds.map(function (r, i) { return logRound(r, freshLast && i === rounds.length - 1); }).join('');
    }

    function reset() {
      shop = core.createShop(item);
      rounds = [];
      done = false;
      list.innerHTML = '';
      say('shop', Lab.t('haggle.open'));
      if (trace) trace.hidden = true;
      renderLog(false);
    }

    function counterLine(r) {
      if (r.action === 'hold') return Lab.t('haggle.hold', { c: r.price });
      return Lab.t('haggle.counter.' + Math.min(3, r.concession), { c: r.price });
    }

    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var raw = input.value.replace(/[₹,\s]/g, '');
      if (!/^\d{1,6}$/.test(raw) || Number(raw) < 1) { say('shop', Lab.t('haggle.bad')); return; }
      var o = Number(raw);
      input.value = '';
      say('you', rs(o));
      var r = shop.offer(o);
      r.offer = o;
      rounds.push(r);
      renderLog(true);
      if (trace) { trace.hidden = false; trace.textContent = Lab.raw('haggle.mini.trace').replace('{r}', r.action === 'accept' || r.action === 'agreed' ? 'accept' : 'counter ' + rs(r.price)); }
      if (r.action === 'accept') {
        say('shop', Lab.t('haggle.accept', { p: r.price }));
        if (Lab.audio) Lab.audio.cue('deal');
        if (!done) {
          done = true;
          var gap = shop.gap();
          var end = '<strong>' + Lab.t('haggle.deal', { p: r.price }) + '</strong> ' +
            (gap != null && gap <= 25 ? Lab.t('haggle.found', { r: r.price - gap, g: gap }) + ' ' : '') +
            (full ? Lab.t('haggle.b13') : '') +
            ' <button type="button" class="btn btn-quiet again">' + Lab.t('haggle.again') + '</button>';
          var li = say(null, end, 'end');
          li.querySelector('.again').addEventListener('click', function () { reset(); input.focus(); });
        }
      } else if (r.action === 'agreed') {
        say('shop', Lab.t('haggle.agreed', { p: r.price }));
      } else {
        say('shop', counterLine(r));
        if (Lab.audio) Lab.audio.cue('counter');
      }
    });

    root.querySelectorAll('[data-ab]').forEach(function (b) {
      b.addEventListener('click', function () {
        mode = b.getAttribute('data-ab');
        root.querySelectorAll('[data-ab]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        renderLog(false);
      });
    });

    reset();
    return root;
  };
})();
