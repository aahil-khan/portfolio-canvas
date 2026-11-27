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

  I.board = function (entry, size) {
    var s = Lab.data.study;
    var counts = { done: 0, doing: 0 };
    var rows = s.tracks.map(function (track) {
      var sq = s.topics.filter(function (t) { return t.track === track; }).map(function (t) {
        if (counts[t.status] != null) counts[t.status] += 1;
        var fill = t.status === 'doing' && t.est ? Math.min(100, Math.round((t.spent / t.est) * 100)) : 0;
        var words = { done: 'done', doing: 'under way', todo: 'not started', parked: 'parked', later: 'later' }[t.status];
        return '<span class="sq ' + t.status + '" style="--fill:' + fill + '%" title="' + esc(t.id + ' · ' + t.topic + ' · ' + words) + '"><i></i></span>';
      }).join('');
      return '<div class="board-row"><span class="meta">' + esc(track) + '</span><span class="squares" role="img" aria-label="' + esc(track) + '">' + sq + '</span></div>';
    }).join('');
    return Lab.html('<div class="board' + (size === 'card' ? ' board-card' : '') + '">' + rows +
      '<p class="meta board-key">' + counts.done + ' done, ' + counts.doing + ' under way, ' + (s.topics.length - counts.done - counts.doing) + ' to go. Filled is done; dashed is under way; faint is parked or later.</p></div>');
  };

  I.compare = function () {
    var c = Lab.compare;
    var cells = c.head.map(function (h, i) { return '<div class="h' + (i === 0 ? ' corner' : '') + (i === 2 ? ' chosen' : '') + '">' + Lab.inline(h.replace('evaluate_offer', '`evaluate_offer`')) + '</div>'; }).join('');
    c.rows.forEach(function (r) { cells += '<div class="rowhead">' + esc(r[0]) + '</div><div>' + esc(r[1]) + '</div><div class="chosen">' + esc(r[2]) + '</div>'; });
    return Lab.html('<figure class="figure wide"><div class="compare box">' + cells + '</div><figcaption class="caption">' + Lab.t('cmp.caption') + '</figcaption></figure>');
  };

  I.demo = function (entry) {
    var d = entry.lead.demo;
    var src = Lab.look.reduced() ? d.poster : d.src;
    return Lab.html('<div class="frame" style="--ar:' + d.w + '/' + d.h + '"><img src="' + Lab.asset(src) + '" width="' + d.w + '" height="' + d.h + '" alt="' + esc(d.alt) + '" decoding="async"></div>');
  };

  I.screens = function (entry) {
    var imgs = entry.lead.images;
    var alt = entry.imagesAltKey ? Lab.raw(entry.imagesAltKey) : '';
    var img = function (im, i) { return '<div class="frame" style="--ar:16/9"><img src="' + Lab.asset(im.src) + '" width="' + im.w + '" height="' + im.h + '" alt="' + (i === 0 ? esc(alt) : '') + '" decoding="async"></div>'; };
    if (imgs.length === 1) return Lab.html(img(imgs[0], 0));
    return Lab.html('<div class="screens">' + img(imgs[0], 0) + '<div class="stack">' + imgs.slice(1, 3).map(function (m, i) { return img(m, i + 1); }).join('') + '</div></div>');
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
