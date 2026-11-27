// Shared DOM helpers, copy lookup, and the instrument registry. Most instruments are generic and
// take their data from the entry; bespoke ones (the haggle toy) register themselves by id.
var Lab = window.Lab = window.Lab || {};
(function () {
  var esc = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
  Lab.esc = esc;

  /** Copy by key, with {var} substitution. Escaped. */
  Lab.t = function (key, vars) {
    var c = Lab.copy[key];
    if (!c) throw new Error('copy missing: ' + key);
    return esc(c.text).replace(/\{(\w+)\}/g, function (_, k) { return vars && vars[k] != null ? esc(vars[k]) : '{' + k + '}'; });
  };
  Lab.raw = function (key) { return Lab.copy[key].text; };

  /**
   * Inline markup, the Wikipedia model: every link previews.
   *   [[id|text]]      an entry        [[t:id|text]]   a glossary term (content/terms.js)
   *   [[tag:id|text]]  a tag           [^key]          a numbered reference, from refs.key
   *   `code`           ==mark==
   * Input is escaped first. refs is the entry's { key: ref } map plus an `order` array that
   * numbers the references by first use; pass the same object for every block of one entry.
   */
  Lab.inline = function (text, refs) {
    return esc(text)
      .replace(/\[\[t:([\w-]+)\|([^\]]+)\]\]/g, function (_, id, label) { return Lab.termLink(id, label); })
      .replace(/\[\[tag:([\w-]+)\|([^\]]+)\]\]/g, function (_, id, label) { return Lab.tagLink(id, label); })
      .replace(/\[\[([\w-]+)\|([^\]]+)\]\]/g, function (_, id, label) { return Lab.linkTo(id, label); })
      .replace(/\[\^([\w-]+)\]/g, function (_, key) { return Lab.refMark(key, refs); })
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/==([^=]+)==/g, '<mark>$1</mark>');
  };
  /** The same text with the markup taken out, for previews and meta descriptions. */
  Lab.plain = function (text) {
    return String(text || '').replace(/\[\[(?:t:|tag:)?[\w-]+\|([^\]]+)\]\]/g, '$1').replace(/\[\^[\w-]+\]/g, '').replace(/==|`/g, '');
  };

  Lab.html = function (s) { var t = document.createElement('template'); t.innerHTML = s.trim(); return t.content.firstElementChild; };

  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  /**
   * A handwritten date: a real <time>, always absolute, with the full date in words for screen
   * readers. Day and month are joined by a no-break space (and time is nowrap), so a date never
   * splits across lines. year: true adds the year.
   */
  Lab.date = function (iso, year) {
    if (!iso) return '';
    var d = iso.split('-').map(Number);
    var shown = d[2] + '\u00a0' + MONTHS[d[1] - 1] + (year ? '\u00a0' + d[0] : '');
    return '<time datetime="' + iso + '" aria-label="' + d[2] + ' ' + LONG[d[1] - 1] + ' ' + d[0] + '">' + shown + '</time>';
  };

  // ---------- instruments ----------
  var I = Lab.instruments = {};

  // The study's board: one square per topic, a row per track. Fill is hours over the estimate;
  // a solid edge is done, a dashed one is under way. Hover or tap a square for its card (the
  // preview system's topic: cards). One tab stop for the whole board; arrow keys move between squares.
  I.board = function (entry, size) {
    var s = Lab.data.study;
    var counts = { done: 0, doing: 0 };
    var rows = s.tracks.map(function (track) {
      var sq = s.topics.filter(function (t) { return t.track === track; }).map(function (t) {
        if (counts[t.status] != null) counts[t.status] += 1;
        var fill = t.status === 'done' ? 100 : t.est ? Math.min(100, Math.round((t.spent / t.est) * 100)) : 0;
        return '<span class="sq ' + t.status + '" style="--fill:' + fill + '%" id="sq-' + esc(t.id) + '" data-sq data-preview="topic:' + esc(t.id) + '" role="gridcell" aria-label="' + esc(t.topic + ', ' + Lab.t('status.' + t.status)) + '"><i></i></span>';
      }).join('');
      return '<div class="board-row" role="row"><span class="meta" role="rowheader">' + esc(track) + '</span><span class="squares">' + sq + '</span></div>';
    }).join('');
    var el = Lab.html('<div class="board' + (size === 'card' ? ' board-card' : '') + '"><div class="board-grid" role="grid"' + (size === 'card' ? '' : ' tabindex="0"') + ' aria-label="' + esc(Lab.t('board.label')) + '">' + rows + '</div>' +
      '<p class="meta board-key">' + Lab.t('board.key', { done: counts.done, doing: counts.doing, rest: s.topics.length - counts.done - counts.doing }) + '</p></div>');
    if (size === 'card') { el.querySelectorAll('[data-sq]').forEach(function (q) { q.removeAttribute('data-preview'); q.removeAttribute('id'); }); return el; }
    // one tab stop: the grid itself; arrow keys move the active square (aria-activedescendant) and open its card
    var grid = el.querySelector('.board-grid'), sqs = [].slice.call(el.querySelectorAll('[data-sq]')), cur = -1;
    var activate = function (j) {
      if (cur >= 0) sqs[cur].classList.remove('is-active');
      cur = j; sqs[j].classList.add('is-active');
      grid.setAttribute('aria-activedescendant', sqs[j].id);
      if (Lab.preview) Lab.preview.open(sqs[j], 'focus');
    };
    grid.addEventListener('focus', function () { if (grid.matches(':focus-visible')) activate(cur < 0 ? 0 : cur); });
    grid.addEventListener('blur', function () { if (cur >= 0) sqs[cur].classList.remove('is-active'); if (Lab.preview) Lab.preview.close(); });
    grid.addEventListener('keydown', function (ev) {
      var i = Math.max(0, cur);
      var step = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 8, ArrowUp: -8, Home: -i, End: sqs.length - 1 - i }[ev.key];
      if (step == null) return;
      ev.preventDefault();
      activate(Math.max(0, Math.min(sqs.length - 1, i + step)));
    });
    return el;
  };

  /** A against B, from Lab.compares[key] (the entry id by default). The chosen column is marked. */
  I.compare = function (entry, size, key) {
    var c = (Lab.compares || {})[key || entry.id] || Lab.compare;
    var cols = c.head.length;
    var cells = c.head.map(function (h, i) { return '<div class="h' + (i === 0 ? ' corner' : '') + (i === c.chosen ? ' chosen' : '') + '">' + Lab.inline(h) + '</div>'; }).join('');
    c.rows.forEach(function (r) { cells += r.map(function (v, i) { return '<div class="' + (i === 0 ? 'rowhead' : i === c.chosen ? 'chosen' : '') + '">' + Lab.inline(v) + '</div>'; }).join(''); });
    return Lab.html('<figure class="figure wide"><div class="compare box" style="--cols:' + (cols - 1) + '">' + cells + '</div><figcaption class="caption">' + Lab.inline(c.caption.text || c.caption) + '</figcaption></figure>');
  };

  /** Bars against a baseline, from Lab.charts[key]: { caption, max, rows: [{ label, lo, hi, note, base }] }. */
  I.chart = function (entry, size, key) {
    var c = Lab.charts[key || entry.id];
    var pct = function (v) { return (100 * v / c.max).toFixed(1) + '%'; };
    var rows = c.rows.map(function (r) {
      var hi = r.hi != null ? r.hi : r.lo;
      return '<div class="bar-row' + (r.base ? ' is-base' : '') + '"><span class="bar-label">' + Lab.inline(r.label) + '</span>' +
        '<span class="bar-track"><span class="bar-fill" style="width:' + pct(r.lo) + '"></span>' + (hi > r.lo ? '<span class="bar-range" style="left:' + pct(r.lo) + ';width:calc(' + pct(hi) + ' - ' + pct(r.lo) + ')"></span>' : '') + '</span>' +
        '<span class="bar-value" data-num>' + esc(r.lo === hi ? String(r.lo) : r.lo + '–' + hi) + '</span>' + (r.note ? '<span class="bar-note meta">' + Lab.inline(r.note) + '</span>' : '') + '</div>';
    }).join('');
    return Lab.html('<figure class="figure wide chart"><div class="bars box">' + rows + '</div><figcaption class="caption">' + Lab.inline(c.caption.text || c.caption) + '</figcaption></figure>');
  };

  I.demo = function (entry) {
    var d = entry.lead.demo;
    var src = Lab.look.reduced() ? d.poster : d.src;
    return Lab.html('<div class="frame" style="--ar:' + d.w + '/' + d.h + '"><img src="' + Lab.asset(src) + '" width="' + d.w + '" height="' + d.h + '" alt="' + esc(d.alt) + '" decoding="async"></div>');
  };

  /** One screenshot renders as a frame; several as a carousel with words for its two controls. A card shows the first. */
  I.screens = function (entry, size) {
    var imgs = entry.lead.images;
    var alts = entry.imagesAltKey ? Lab.raw(entry.imagesAltKey).split(' | ') : [];
    var img = function (im, i) { return '<div class="frame" style="--ar:' + im.w + '/' + im.h + '"><img src="' + Lab.asset(im.src) + '" width="' + im.w + '" height="' + im.h + '" alt="' + esc(alts[i] || alts[0] || '') + '" decoding="async"' + '></div>'; };
    if (imgs.length === 1 || size === 'card') return Lab.html(img(imgs[0], 0));
    var el = Lab.html('<div class="carousel" role="group" aria-roledescription="carousel" aria-label="' + esc(Lab.t('car.label', { title: entry.title })) + '">' +
      '<div class="car-track" tabindex="-1">' + imgs.map(img).join('') + '</div>' +
      '<div class="car-nav"><span class="meta" aria-live="polite" data-car-pos></span>' +
      '<button type="button" data-car="-1">' + Lab.t('car.prev') + '</button><button type="button" data-car="1">' + Lab.t('car.next') + '</button></div></div>');
    var track = el.querySelector('.car-track'), pos = el.querySelector('[data-car-pos]');
    var at = function () { return Math.round(track.scrollLeft / Math.max(1, track.clientWidth)); };
    var sync = function () {
      var i = Math.min(imgs.length - 1, Math.max(0, at()));
      pos.textContent = Lab.t('car.pos', { i: i + 1, n: imgs.length });
      el.querySelector('[data-car="-1"]').disabled = i === 0;
      el.querySelector('[data-car="1"]').disabled = i === imgs.length - 1;
    };
    el.addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-car]'); if (!b) return;
      var i = Math.min(imgs.length - 1, Math.max(0, at() + Number(b.dataset.car)));
      track.scrollTo({ left: i * track.clientWidth, behavior: Lab.look.reduced() ? 'auto' : 'smooth' });
    });
    track.addEventListener('scroll', function () { requestAnimationFrame(sync); }, { passive: true });
    requestAnimationFrame(sync);
    return el;
  };

  I.result = function (entry) {
    var r = entry.result;
    return Lab.html('<div class="result"><p class="q">' + esc(r.question) + '</p><p class="meta">' + esc(r.setup) + '</p>' +
      '<p><span class="num-big">' + esc(r.value) + '</span> <span class="vs">against ' + esc(r.baseline) + '</span></p></div>');
  };

  I.keyline = function (entry) {
    var text = entry.keyLineKey ? Lab.raw(entry.keyLineKey) : entry.keyLine;
    return Lab.html('<p class="keyline">' + Lab.inline(text) + '</p>');
  };

  I.opening = function (entry) { return Lab.html('<p class="opening">' + esc(entry.opening) + '</p>'); };

  I.install = function (entry) {
    return Lab.html('<div><p class="meta">' + esc(entry.lede || '') + '</p><pre class="install"><code>' + esc(entry.install) + '</code></pre></div>');
  };

  I.datesheet = function () {
    return Lab.html('<div class="before-after"><div><p class="meta">Before</p><p>' + Lab.t('datesheet.before') + '</p></div><div><p class="meta">After</p><p>' + Lab.t('datesheet.after') + '</p></div></div>');
  };

  I.progress = function (entry) {
    var ch = Lab.childrenOf(entry.id);
    var done = ch.filter(function (c) { return !c.draft; }).length;
    if (!done) return Lab.html('<p class="keyline">' + esc(entry.premise || Lab.ledeOf(entry)) + '</p>');
    return Lab.html('<div><p class="lede">' + Lab.t('progress.series', { done: done, total: ch.length }) + '</p><p class="meta">01 · ' + esc(ch[0].title) + '</p></div>');
  };

  I.logline = function (entry) {
    var last = (entry.log || Lab.data.study.log).slice(-1)[0];
    return Lab.html('<div><p class="meta">' + Lab.date(last.date) + '</p><p class="keyline">' + esc(last.did) + '</p></div>');
  };

  /** Resolves an entry's lead by its kind's chain. Every chain ends in something always present. */
  Lab.leadOf = function (entry) {
    var L = entry.lead || {};
    var pick = function (name) { return { name: name, render: function (size) { return I[name](entry, size); } }; };
    switch (entry.kind) {
      case 'study': return L.instrument === 'board' ? pick('board') : pick('logline');
      case 'note':
      case 'chapter': return L.instrument && I[L.instrument] ? pick(L.instrument) : pick('keyline');
      case 'series': return pick('progress');
      case 'build': return L.demo ? pick('demo') : L.images ? pick('screens') : L.figure && I[L.figure] ? pick(L.figure) : pick('install');
      case 'experiment': return L.figure && I[L.figure] ? pick(L.figure) : pick('result');
      case 'essay': return L.cover ? pick('cover') : pick('opening');
      default: throw new Error('unknown kind ' + entry.kind);
    }
  };
})();
