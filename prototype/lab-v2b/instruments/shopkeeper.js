// Instruments for the Shopkeeper chapters: the scenario browser (chapter 07's lead), the
// concession schedule (chapter 04's lead) and a plain table figure for the spec's own tables.
// Data lives in content/bodies-shopkeeper.js (Lab.scenarios, Lab.specTables).
var Lab = window.Lab = window.Lab || {};
(function () {
  var esc = Lab.esc;

  // ---------- the scenario browser ----------
  // Three group buttons (words, aria-pressed) and one list of cards. The list is one tab stop:
  // the current card has tabindex 0, the rest -1, and the arrow keys move between them, so the
  // first screen keeps its control budget however many scenarios a group holds.
  Lab.instruments.scenarios = function (entry, size) {
    var S = Lab.scenarios, full = size !== 'card';
    var group = S.groups[0].id;
    var root = Lab.html('<div class="panel scn' + (full ? '' : ' scn-card') + '">' +
      '<div class="scn-top"><div class="scn-groups" role="group" aria-label="' + Lab.t('scn.groups') + '">' +
        S.groups.map(function (g) {
          var n = S.items.filter(function (x) { return x.g === g.id; }).length;
          return '<button type="button" data-scn-group="' + g.id + '" aria-pressed="' + (g.id === group) + '">' + esc(g.name) + ' <span class="scn-n" data-num>' + n + '</span></button>';
        }).join('') + '</div>' +
        '<p class="scn-line muted" aria-live="polite"></p></div>' +
      '<ul class="scn-list" aria-label="' + Lab.t('scn.list') + '"></ul>' +
      (full ? '<p class="scn-foot muted">' + Lab.t('scn.foot') + '</p>' : '') +
      '</div>');
    var list = root.querySelector('.scn-list');
    function card(x) {
      var checks = full && x.checks ? '<p class="scn-meta"><span class="scn-k">' + Lab.t('scn.checked') + '</span> ' + esc(x.checks) + '</p>' : '';
      return '<li class="scn-item" tabindex="-1" data-scn="' + x.id + '" aria-label="' + esc(x.id + ': ' + Lab.raw('scn.' + x.expected) + '. ' + x.who) + '">' +
        '<p class="scn-head"><span class="scn-id" data-num>' + esc(x.id) + '</span><span class="scn-out">' + Lab.t('scn.' + x.expected) + '</span></p>' +
        '<p class="scn-who">' + esc(x.who) + '</p>' +
        '<p class="scn-meta"><span class="scn-k">' + Lab.t('scn.wants') + '</span> ' + esc(x.wants) + '</p>' +
        (x.pays ? '<p class="scn-meta"><span class="scn-k">' + Lab.t('scn.pays') + '</span> ' + esc(x.pays) + '</p>' : '') +
        checks +
        (full && x.note ? '<p class="scn-meta scn-note">' + esc(x.note) + '</p>' : '') +
        (full && !x.v0 ? '<p class="scn-meta scn-later">' + Lab.t('scn.deferred') + '</p>' : '') +
        '</li>';
    }
    function show(id) {
      group = id;
      root.querySelectorAll('[data-scn-group]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.scnGroup === id)); });
      var g = S.groups.find(function (x) { return x.id === id; });
      root.querySelector('.scn-line').textContent = Lab.raw(g.lineKey);
      var items = S.items.filter(function (x) { return x.g === id; });
      list.innerHTML = (full ? items : items.slice(0, 2)).map(card).join('');
      var first = list.querySelector('.scn-item');
      if (first) first.tabIndex = 0;
    }
    root.addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-scn-group]');
      if (b) show(b.dataset.scnGroup);
    });
    list.addEventListener('keydown', function (ev) {
      var items = [].slice.call(list.querySelectorAll('.scn-item'));
      var i = items.indexOf(document.activeElement); if (i < 0) return;
      var step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1, Home: -i, End: items.length - 1 - i }[ev.key];
      if (step == null) return;
      ev.preventDefault();
      var j = Math.max(0, Math.min(items.length - 1, i + step));
      items[i].tabIndex = -1; items[j].tabIndex = 0; items[j].focus();
    });
    list.addEventListener('focusin', function (ev) {
      var li = ev.target.closest('.scn-item'); if (!li) return;
      list.querySelectorAll('.scn-item').forEach(function (x) { x.tabIndex = x === li ? 0 : -1; });
    });
    show(group);
    return root;
  };

  // ---------- the concession schedule ----------
  // List price, then each counter, as columns over a ₹600-₹900 scale, with the floor drawn as a
  // dashed line it never reaches. The numbers come from the spec's rules 1-3 for the charger.
  Lab.instruments.schedule = function (entry, size) {
    var item = Lab.data.items['CHG-20W'];
    var steps = [item.list, 859, 829, 809, 799];
    var lo = 600, hi = item.list;
    var h = function (v) { return (100 * (v - lo) / (hi - lo)).toFixed(1) + '%'; };
    var cols = steps.map(function (v, i) {
      return '<li class="sch-col"><span class="sch-bar" style="height:' + h(v) + '"><span class="sch-v" data-num>₹' + v + '</span></span>' +
        '<span class="sch-label">' + (i === 0 ? Lab.t('sch.list') : Lab.t('sch.counter', { n: i })) + '</span>' +
        (i ? '<span class="sch-step meta" data-num>−' + (steps[i - 1] - v) + '</span>' : '<span class="sch-step meta" aria-hidden="true"></span>') + '</li>';
    }).join('');
    return Lab.html('<figure class="figure sch' + (size === 'card' ? ' sch-card' : '') + '">' +
      '<div class="sch-plot box"><ol class="sch-cols" aria-label="' + Lab.t('sch.label') + '">' + cols + '</ol>' +
        '<div class="sch-floor" style="--f:' + ((item.floor - lo) / (hi - lo)).toFixed(3) + '"><span class="sch-floor-label">' + Lab.t('sch.floor', { f: item.floor }) + '</span></div></div>' +
      (size === 'card' ? '' : '<figcaption class="caption">' + Lab.t('sch.caption') + '</figcaption>') + '</figure>');
  };

  // ---------- a table from the spec ----------
  // Lab.specTables[key] = { head: [...], rows: [[...]], num: [column indexes], caption }
  // On a phone each row becomes a small block, every cell labelled by its column.
  Lab.instruments['spec-table'] = function (entry, size, key) {
    var T = Lab.specTables[key];
    var num = T.num || [];
    var cls = function (i) { return num.indexOf(i) >= 0 ? ' class="n"' : ''; };
    return Lab.html('<figure class="figure wide spec-fig"><div class="spec-wrap box"><table class="spec-table">' +
      '<thead><tr>' + T.head.map(function (h, i) { return '<th scope="col"' + cls(i) + '>' + Lab.inline(h) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      T.rows.map(function (r) {
        return '<tr>' + r.map(function (v, i) { return (i === 0 ? '<th scope="row"' : '<td' + cls(i)) + ' data-col="' + esc(Lab.plain(T.head[i])) + '">' + Lab.inline(v) + (i === 0 ? '</th>' : '</td>'); }).join('') + '</tr>';
      }).join('') + '</tbody></table></div>' +
      '<figcaption class="caption">' + Lab.inline(T.caption.text || T.caption) + '</figcaption></figure>');
  };
})();
