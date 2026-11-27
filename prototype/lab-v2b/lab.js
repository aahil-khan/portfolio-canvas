// The Lab mockup: data helpers, the router, the bar, the pages, previews, the dot, Aa, the name.
// Pages are rendered from Lab.data (generated) and Lab.copy (written); nothing here names an
// entry, a section or the Shopkeeper, except the set of pages this round actually builds.
var Lab = window.Lab = window.Lab || {};
(function () {
  var esc = Lab.esc, t = Lab.t, D = Lab.data;
  var q = new URLSearchParams(location.search);
  var root = document.documentElement;

  // ---------- data ----------
  if (q.get('fixture') === 'kinds' && Lab.fixture) {
    D.sections = D.sections.concat(Lab.fixture.sections);
    D.entries = D.entries.concat(Lab.fixture.entries);
  }
  var byId = {};
  D.entries.forEach(function (e) { byId[e.id] = e; });
  var BUILT = { 'shopkeeper-05': true };   // pages this round builds; every other link goes to #/next
  Lab.entry = function (id) { return byId[id]; };
  /** The routes this round renders, for the check: the home plus every built entry. */
  Lab.routes = function () { return [{ name: 'home', hash: '#/' }].concat(Object.keys(BUILT).map(function (id) { return { name: id, hash: '#' + Lab.pathOf(byId[id]), entry: true }; })); };
  Lab.childrenOf = function (id) { return D.entries.filter(function (e) { return e.parent === id; }).sort(function (a, b) { return (a.order || 0) - (b.order || 0); }); };
  var isPublic = function (e) { return !e.draft; };
  var publicEntries = function () { return D.entries.filter(isPublic); };
  Lab.asset = function (src) { return (Lab.assets && Lab.assets[src]) || src; };
  Lab.pathOf = function (e) {
    var parent = e.parent && byId[e.parent];
    return '/' + e.section + '/' + (parent ? parent.slug + '/' : '') + e.slug;
  };
  Lab.href = function (e) { return BUILT[e.id] ? '#' + Lab.pathOf(e) : '#/next?to=' + encodeURIComponent('/lab' + Lab.pathOf(e)); };
  Lab.linkTo = function (id, label, cls) {
    var e = byId[id];
    return '<a href="' + Lab.href(e) + '" data-preview="' + id + '"' + (cls ? ' class="' + cls + '"' : '') + '>' + (label != null ? label : esc(e.title)) + '</a>';
  };
  Lab.ledeOf = function (e) { return e.ledeKey ? Lab.raw(e.ledeKey) : e.lede || e.opening || e.keyLine || ''; };
  Lab.kindWords = function (e) {
    var parent = e.parent && byId[e.parent];
    return t('kind.' + e.kind, { parent: parent ? parent.title : '' });
  };
  var byPublished = function (a, b) { return (b.published || '').localeCompare(a.published || ''); };

  // ---------- terms, tags, references: the inline links ----------
  var termById = {};
  (Lab.terms || []).forEach(function (x) { termById[x.id] = x; });
  Lab.term = function (id) { return termById[id]; };
  var glossaryHref = function (id) { return '#/next?to=' + encodeURIComponent('/lab/glossary#' + id); };
  var tagHref = function (tag) { return '#/next?to=' + encodeURIComponent('/lab/tags/' + tag); };
  /** Where a term's card goes further: its entry, its external source, or the glossary. */
  Lab.termTarget = function (x) {
    if (x.link && byId[x.link]) return { href: Lab.href(byId[x.link]), label: t('card.read', { title: byId[x.link].title }) };
    if (x.link && /^https:\/\//.test(x.link)) return { href: x.link, label: t('card.source'), ext: true };
    return { href: glossaryHref(x.id), label: t('card.glossary') };
  };
  Lab.termLink = function (id, label) {
    var x = termById[id];
    if (!x) throw new Error('unknown term ' + id);
    var to = Lab.termTarget(x);
    return '<a class="term" href="' + esc(to.href) + '"' + (to.ext ? ' rel="noopener"' : '') + ' data-preview="term:' + id + '">' + label + '</a>';
  };
  Lab.tagged = function (tag) { return publicEntries().filter(function (e) { return (e.tags || []).indexOf(tag) >= 0; }).sort(byPublished); };
  Lab.tagLink = function (tag, label) { return '<a class="term" href="' + tagHref(tag) + '" data-preview="tag:' + tag + '">' + (label || esc(tag)) + '</a>'; };
  /** A numbered citation. Numbers follow first use within one entry. */
  Lab.refMark = function (key, refs) {
    if (!refs || !refs.map[key]) throw new Error('unknown reference ' + key);
    if (refs.order.indexOf(key) < 0) refs.order.push(key);
    var n = refs.order.indexOf(key) + 1;
    return '<sup class="ref"><a href="#ref-' + key + '" data-jump="ref-' + key + '" data-preview="ref:' + refs.entry + ':' + key + '" aria-label="Reference ' + n + '">' + n + '</a></sup>';
  };
  /** Entries this one links to in its body, in order of first link. */
  function linkedFrom(e) {
    var body = Lab.bodies[e.id], out = [];
    if (!body) return out;
    var text = body.blocks.map(function (b) { return (b.p || b.h2 || {}).text || ''; }).join(' ') + ' ' + (e.ledeKey ? Lab.raw(e.ledeKey) : '');
    text.replace(/\[\[(t:)?([\w-]+)\|/g, function (_, isTerm, id) {
      var target = isTerm ? termById[id] && termById[id].link : id;
      if (target && byId[target] && target !== e.id && out.indexOf(target) < 0 && isPublic(byId[target])) out.push(target);
    });
    return out;
  }
  /** Links to this page: entries that mention it in data, or link to it in their body. */
  function linksTo(e) {
    return publicEntries().filter(function (x) { return x.id !== e.id && ((x.mentions || []).indexOf(e.id) >= 0 || linkedFrom(x).indexOf(e.id) >= 0); }).map(function (x) { return x.id; });
  }

  // ---------- the bar ----------
  var bar, main, dot;
  function renderBar() {
    var fromDesk = (function () { try { if (q.get('from') === 'desk') sessionStorage.setItem('lab.from', 'desk'); return sessionStorage.getItem('lab.from') === 'desk'; } catch { return false; } })();
    bar = Lab.html(
      '<header class="bar">' +
        '<div class="bar-left">' +
          (fromDesk ? '<a class="bar-back" href="#/next?to=%2Fcanvas">← ' + t('back.desk') + '</a>' : '') +
          '<a class="mark-ak" href="#/next?to=%2F" aria-label="Aahil Khan, home"><span>' + esc(D.owner.initials) + '</span></a>' +
          '<a class="bar-lab" href="#/">Lab</a>' +
        '</div>' +
        '<div class="bar-right">' +
          '<div class="look" role="group" aria-label="Look"><button type="button" data-look="paper">Paper</button><button type="button" data-look="premium">Premium</button></div>' +
          '<button type="button" class="ctl look-phone" data-look-toggle></button>' +
          '<button type="button" class="ctl ctl-icon" data-aa aria-expanded="false" aria-controls="aa" aria-label="Text: line length and size"><span class="i-aa" aria-hidden="true">Aa</span></button>' +
          '<button type="button" class="ctl ctl-icon" data-dark><svg class="i-theme" viewBox="0 0 20 20" aria-hidden="true"><g class="sun"><circle cx="10" cy="10" r="3.6"/><path d="M10 1.8v2.4M10 15.8v2.4M1.8 10h2.4M15.8 10h2.4M4.2 4.2l1.7 1.7M14.1 14.1l1.7 1.7M4.2 15.8l1.7-1.7M14.1 5.9l1.7-1.7"/></g><path class="moon" d="M15.6 12.6A6.6 6.6 0 0 1 7.4 4.4a6.6 6.6 0 1 0 8.2 8.2z"/></svg></button>' +
          '<button type="button" class="ctl" data-sound aria-expanded="false" aria-controls="player" aria-label="Sound and music"><span class="i-speaker" aria-hidden="true"></span><span class="eq" aria-hidden="true"><i></i><i></i><i></i></span><span class="sound-word">Sound</span><span class="now-name"></span><span class="chev" aria-hidden="true"></span></button>' +
        '</div>' +
        '<div class="dot" aria-hidden="true"><svg viewBox="0 0 22 22"><circle class="body" cx="11" cy="11" r="9.5"/><g class="look-at"><g class="eyes"><circle class="eye" cx="7.8" cy="10" r="1.45"/><circle class="eye" cx="14.2" cy="10" r="1.45"/></g></g><circle class="cheek" cx="5.6" cy="13.6" r="1.6"/><circle class="cheek" cx="16.4" cy="13.6" r="1.6"/></svg><span class="z" data-dot>z</span></div>' +
      '</header>');
    document.body.insertBefore(bar, document.body.firstChild);
    dot = bar.querySelector('.dot');

    bar.querySelectorAll('[data-look]').forEach(function (b) { b.addEventListener('click', function () { Lab.look.setLook(b.dataset.look); }); });
    bar.querySelector('[data-look-toggle]').addEventListener('click', function () { Lab.look.setLook(Lab.look.get().look === 'paper' ? 'premium' : 'paper'); });
    bar.querySelector('[data-dark]').addEventListener('click', function () { Lab.look.toggleDark(); });
    syncBar();
    document.addEventListener('lab:look', syncBar);
    Lab.player.mount(bar.querySelector('[data-sound]'));
    mountAa(bar.querySelector('[data-aa]'));
  }
  function syncBar() {
    var s = Lab.look.get();
    bar.querySelectorAll('.look [data-look]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.look === s.look)); });
    var lp = bar.querySelector('[data-look-toggle]');
    lp.textContent = s.look === 'paper' ? 'Premium' : 'Paper';
    lp.setAttribute('aria-pressed', String(s.look === 'premium'));
    lp.setAttribute('aria-label', 'Look: switch to ' + lp.textContent);
    bar.querySelector('[data-dark]').setAttribute('aria-label', s.dark ? t('theme.toLight') : t('theme.toDark'));
  }

  // ---------- Aa ----------
  function mountAa(btn) {
    var pop = Lab.html('<div class="pop" id="aa" role="dialog" aria-label="Text" hidden>' +
      '<div class="pop-row"><p class="pop-label">Line length</p><div class="seg"><button type="button" data-measure="wide">Wide</button><button type="button" data-measure="comfortable">Comfortable</button></div></div>' +
      '<div class="pop-row"><p class="pop-label">Text size</p><div class="seg"><button type="button" data-size="16">16</button><button type="button" data-size="17">17</button><button type="button" data-size="19">19</button></div></div>' +
      '</div>');
    document.body.appendChild(pop);
    function sync() {
      var aa = Lab.look.get().aa;
      pop.querySelectorAll('[data-measure]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.measure === (aa.measure || 'wide'))); });
      pop.querySelectorAll('[data-size]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.size === String(aa.size || 17))); });
    }
    function close() { pop.hidden = true; btn.setAttribute('aria-expanded', 'false'); }
    btn.addEventListener('click', function () { pop.hidden = !pop.hidden; btn.setAttribute('aria-expanded', String(!pop.hidden)); sync(); });
    pop.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.dataset.measure) Lab.look.setAa({ measure: b.dataset.measure });
      if (b.dataset.size) Lab.look.setAa({ size: Number(b.dataset.size) });
      sync();
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !pop.hidden) { close(); btn.focus(); } });
    document.addEventListener('pointerdown', function (e) { if (!pop.hidden && !pop.contains(e.target) && !btn.contains(e.target)) close(); }, true);
  }

  // ---------- pages ----------
  // The home names no entry in its own furniture. Entries appear only in Latest, so it reads the
  // same after a month with no new ones: no Now line, nothing pinned, no progress, no relative time.
  function home() {
    var pub = publicEntries();
    var page = Lab.html('<div class="page home"></div>');
    var intro = Lab.raw('home.intro').split('{name}');
    page.appendChild(Lab.html(
      '<section class="intro">' +
        '<p class="eyebrow">' + t('home.eyebrow') + '</p>' +
        '<h1 class="home-title">' + t('home.title') + '</h1>' +
        '<p class="intro-text">' + esc(intro[0]) + nameTrigger() + esc(intro[1]) + ' ' + t('home.brand') + '</p>' +
      '</section>'));

    page.appendChild(Lab.html('<section class="block newhere wide" aria-labelledby="new-title"><div class="block-head"><h2 id="new-title">' + t('new.title') + '</h2></div>' +
      '<div class="newhere-grid">' + ['what', 'read', 'start'].map(function (k) {
        return '<p><strong>' + t('new.' + k + '.h') + '.</strong> ' + Lab.inline(Lab.raw('new.' + k)) + '</p>';
      }).join('') + '</div></section>'));

    // Sections: one column per section that has public entries; thesis and count, nothing dated
    var secs = D.sections.filter(function (s) { return pub.some(function (e) { return e.section === s.id; }); });
    page.appendChild(Lab.html('<section class="block wide" aria-labelledby="sec-title"><div class="block-head"><h2 id="sec-title">' + t('home.sections') + '</h2></div><div class="sections">' +
      secs.map(function (s) {
        var n = pub.filter(function (e) { return e.section === s.id; }).length;
        return '<div><h3><a class="quiet" href="#/next?to=' + encodeURIComponent('/lab/' + s.id) + '">' + esc(s.title) + '</a></h3><p>' + (s.thesisKey ? t(s.thesisKey) : esc(s.thesis)) + '</p>' +
          '<p class="meta">' + (n === 1 ? t('count.one') : t('count.many', { n: n })) + '</p></div>';
      }).join('') + '</div></section>'));

    // Latest: the newest N, mixed kinds, absolute handwritten dates
    var all = pub.slice().sort(byPublished), shown = all.slice(0, LATEST);
    page.appendChild(Lab.html('<section class="block wide latest" aria-labelledby="latest-title"><div class="block-head"><h2 id="latest-title">' + t('home.latest') + '</h2></div>' +
      '<ul class="rows" data-latest>' + shown.map(function (e) {
        return '<li class="row">' + Lab.date(e.published, true) + '<span class="row-title">' + Lab.linkTo(e.id) + '</span><span class="row-kind">' + Lab.kindWords(e) + '</span></li>';
      }).join('') + '</ul>' +
      '<p class="all"><a href="#/next?to=%2Flab%2Findex">' + t('home.all', { n: all.length }) + ' →</a></p></section>'));
    return page;
  }
  var LATEST = 6;

  function entryPage(e) {
    var parent = e.parent && byId[e.parent];
    var siblings = parent ? Lab.childrenOf(parent.id) : [];
    var idx = siblings.indexOf(e);
    var pad = function (n) { return String(n).padStart(2, '0'); };
    var body = Lab.bodies[e.id] || { blocks: [] };
    var refs = { entry: e.id, map: body.refs || {}, order: [] };
    var page = Lab.html('<article class="page entry"></article>');
    var series = parent && e.kind === 'chapter' ?
      '<details class="series"><summary aria-expanded="false">' + esc(parent.title) + ' · <span data-num>' + pad(e.order) + '</span> of <span data-num>' + pad(siblings.length) + '</span>' +
        '<span class="ticks" aria-hidden="true">' + siblings.map(function (s) { return '<i' + (s === e ? ' class="on"' : '') + '></i>'; }).join('') + '</span><span class="chev" aria-hidden="true"></span></summary>' +
        '<ol class="chapters">' + siblings.map(function (s) { return '<li><span data-num>' + pad(s.order) + '</span>' + (s === e ? '<span>' + esc(s.title) + '</span>' : Lab.linkTo(s.id)) + '</li>'; }).join('') + '</ol>' +
        '<p class="meta">' + Lab.linkTo(parent.id, t('chapters.all')) + '</p></details>' : '';
    var updated = e.updated && e.updated !== e.published ? ' · ' + t('updated') + ' ' + Lab.date(e.updated) : '';
    page.appendChild(Lab.html('<div class="entry-head">' + series +
      (e.kind === 'chapter' ? '<span class="num" aria-hidden="true">' + pad(e.order) + '</span>' : '') +
      '<h1 class="entry-title">' + esc(e.title) + '</h1>' +
      '<p class="entry-meta meta">' + t('written') + ' ' + Lab.date(e.published) + updated + (e.read ? ' · ' + t('read', { n: e.read }) : '') + '</p></div>'));
    var det = page.querySelector('.series');
    if (det) det.addEventListener('toggle', function () { det.querySelector('summary').setAttribute('aria-expanded', String(det.open)); });

    var lead = Lab.leadOf(e);
    var leadBox = Lab.html('<div class="lead-block wide" data-lead data-lead-kind="' + lead.name + '"></div>');
    if (lead.name === 'haggle') leadBox.appendChild(Lab.html('<p class="lead-intro">' + t('haggle.intro') + '</p>'));
    leadBox.appendChild(lead.render('full'));
    if (lead.name === 'haggle') leadBox.appendChild(Lab.html('<p class="caption">' + t('haggle.caption') + '</p>'));
    page.appendChild(leadBox);

    var prose = Lab.html('<div class="entry-body prose"><p class="lede">' + Lab.inline(Lab.ledeOf(e), refs) + '</p></div>');
    if (lead.name === 'haggle') prose.appendChild(Lab.html('<div class="side sidenote"><p><strong>' + t('haggle.note') + '</strong> ' + t('haggle.schedule') + '</p></div>'));
    var pulled = false;
    body.blocks.forEach(function (b) {
      if (b.h2) prose.appendChild(Lab.html('<h2>' + esc(b.h2.text) + '</h2>'));
      if (b.p) {
        prose.appendChild(Lab.html('<p>' + Lab.inline(b.p.text, refs) + '</p>'));
        if (!pulled && body.pull && prose.querySelectorAll('h2').length === 1) { prose.appendChild(Lab.html('<div class="side"><p class="pull" aria-hidden="true">' + esc(body.pull) + '</p></div>')); pulled = true; }
      }
      if (b.figure) prose.appendChild(Lab.instruments[b.figure](e));
    });
    page.appendChild(prose);

    // References, numbered by first use
    if (refs.order.length) page.appendChild(Lab.html('<section class="refs-block" aria-labelledby="refs-title"><h2 id="refs-title" class="end-h">' + t('refs.title') + '</h2><ol class="refs">' +
      refs.order.map(function (k) { var r = refs.map[k]; return '<li id="ref-' + k + '">' + refLine(r) + '</li>'; }).join('') + '</ol></section>'));

    // Links to this page, beside Related (linked entries, then also related by shared tags)
    // Related never repeats what "Links to this page" already lists beside it
    var back = linksTo(e), linked = linkedFrom(e).filter(function (id) { return back.indexOf(id) < 0; });
    var also = [];
    (e.tags || []).forEach(function (tag) { Lab.tagged(tag).forEach(function (x) { if (x.id !== e.id && linked.indexOf(x.id) < 0 && back.indexOf(x.id) < 0 && also.indexOf(x.id) < 0) also.push(x.id); }); });
    var item = function (id) { return '<li>' + Lab.linkTo(id) + ' <span class="meta">' + Lab.kindWords(byId[id]) + '</span></li>'; };
    page.appendChild(Lab.html('<section class="ends" aria-label="Links">' +
      '<div class="backlinks"><h2 class="end-h">' + t('backlinks') + '</h2>' + (back.length ? '<ul class="end-list">' + back.map(item).join('') + '</ul>' : '') + '</div>' +
      '<div class="related" data-related><h2 class="end-h">' + t('related.title') + '</h2>' +
        (linked.length ? '<ul class="end-list" data-linked>' + linked.map(item).join('') + '</ul>' : '') +
        (also.length ? '<p class="meta also">' + t('related.also') + '</p><ul class="end-list" data-also>' + also.slice(0, 4).map(item).join('') + '</ul>' : '') +
        ((e.tags || []).length ? '<p class="meta tags">' + t('related.tags') + ' ' + e.tags.map(function (g) { return Lab.tagLink(g); }).join(', ') + '</p>' : '') +
      '</div></section>'));

    if (parent && idx >= 0) {
      var prev = siblings[idx - 1], next = siblings[idx + 1];
      page.appendChild(Lab.html('<nav class="nextprev" aria-label="Chapters">' +
        (prev ? '<a class="box" href="' + Lab.href(prev) + '" data-preview="' + prev.id + '"><span class="meta">' + t('prev') + ' · ' + pad(prev.order) + '</span><span class="np-title">' + esc(prev.title) + '</span></a>' : '<span></span>') +
        (next ? '<a class="box np-next" href="' + Lab.href(next) + '" data-preview="' + next.id + '"><span class="meta">' + t('nextch') + ' · ' + pad(next.order) + '</span><span class="np-title">' + esc(next.title) + '</span></a>' : '') +
        '</nav>'));
    }
    return page;
  }
  function refLine(r) {
    var title = r.url ? '<a class="ext" href="' + esc(r.url) + '" rel="noopener">' + esc(r.title) + '</a>' : '<span class="ref-title">' + esc(r.title) + '</span>';
    return title + ' <span class="meta">' + esc(r.site) + '</span><span class="ref-line">' + esc(r.line.text) + '</span>';
  }

  function holding(to) {
    return Lab.html('<div class="page holding" data-holding><h1 class="entry-title">' + t('next.title') + '</h1>' +
      '<p class="intro-text">' + t('next.body') + '</p>' + (to ? '<p class="meta" style="margin-top:12px"><code>' + esc(to) + '</code></p>' : '') +
      '<p style="margin-top:24px"><a href="#/">' + t('next.back') + '</a></p></div>');
  }

  function footer() {
    var f = Lab.html('<footer class="foot page"><p class="foot-line wide">' +
      '<span data-clock>' + esc(D.owner.city) + '</span>' +
      '<a href="#/next?to=%2F">' + t('foot.home') + '</a><a href="#/">' + t('foot.lab') + '</a><a href="#/next?to=%2Fcanvas">' + t('foot.desk') + '</a>' +
      '<a href="#/next?to=%2Fcolophon">' + t('foot.colophon') + '</a><a href="#/next?to=%2Fagents">' + t('foot.agents') + '</a>' +
      '<span>build <code>' + esc(D.build) + '</code></span></p></footer>');
    tick(f.querySelector('[data-clock]'));
    return f;
  }
  function tick(el) {
    var time = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: D.owner.tz }).format(new Date());
    el.textContent = D.owner.city + ' · ' + time + ' ' + D.owner.tzLabel;
  }
  setInterval(function () { var c = document.querySelector('[data-clock]'); if (c) tick(c); }, 30000);

  // ---------- router ----------
  function route() {
    var h = location.hash.replace(/^#/, '') || '/';
    var path = h.split('?')[0], hq = new URLSearchParams(h.split('?')[1] || '');
    if (path === '/' || path === '') return { page: home(), name: 'home' };
    if (path === '/next') return { page: holding(hq.get('to')), name: 'next' };
    var e = D.entries.find(function (x) { return Lab.pathOf(x) === path; });
    if (e && BUILT[e.id]) return { page: entryPage(e), name: 'entry' };
    return { page: holding('/lab' + path), name: 'next' };
  }
  var first = true;
  function render() {
    var swap = function () {
      closePreview(true);
      var r = route();
      main.innerHTML = '';
      main.setAttribute('data-route', r.name);
      main.appendChild(r.page);
      main.appendChild(footer());
      dotHome(false);
      window.scrollTo(0, 0);
      if (!first) { Lab.audio.cue('turn'); var h1 = main.querySelector('h1'); if (h1) { h1.tabIndex = -1; h1.focus({ preventScroll: true }); } }
      first = false;
      observeFooter();
      updateDot();
    };
    if (!first && document.startViewTransition && !Lab.look.reduced()) document.startViewTransition(swap);
    else swap();
  }

  // ---------- the name: underlined where it carries the voice; its card says it ----------
  function nameTrigger() {
    return '<button type="button" class="term name" data-preview="name" aria-haspopup="dialog" aria-expanded="false">' + esc(D.owner.short) + '</button>';
  }
  /** Speaks the name. Called only from the card's play button: a click, a tap or Enter. */
  function sayName(btn) {
    if (!('speechSynthesis' in window)) { var n = btn.parentNode.querySelector('.say-none'); if (n) n.hidden = false; return; }
    var u = new SpeechSynthesisUtterance(D.owner.name);
    u.lang = 'en-IN'; u.rate = 0.85;
    var voices = speechSynthesis.getVoices ? speechSynthesis.getVoices() : [];
    var v = voices.find(function (x) { return /en-IN/i.test(x.lang); });
    if (v) u.voice = v;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  }

  // ---------- previews: one card for entries, terms, tags, references and the name ----------
  // Desktop (a fine pointer that hovers): a mini canvas window by the link, after a hover-intent
  // delay, kept open while the pointer is on it, closed after a dismiss delay. Touch: the first tap
  // opens it as a sheet at the bottom with a Close button, scrolled so the tapped words stay in
  // view; the card's own link goes further, and a second tap on the same words follows the link.
  // Outside taps and Esc close it. No sound on hover; the peek cue plays only on a tap, click or focus.
  var INTENT = 300, DISMISS = 220;
  var pv = null, pvFor = null, pvMode = null, pvHow = null, openT = null, closeT = null, lastPointer = 'mouse';
  var hoverable = function () { return window.matchMedia('(hover: hover) and (pointer: fine)').matches; };
  function cardOf(key) {
    var more = null, bar, bodyHtml, label;
    if (key === 'name') {
      bar = '<span>' + t('name.bar') + '</span>';
      label = D.owner.name;
      bodyHtml = '<h3>' + esc(D.owner.name) + '</h3><p class="pron" lang="en">' + t('name.say') + '</p>' +
        '<p class="say-row"><button type="button" class="btn btn-say" data-say aria-label="' + t('name.playLabel') + '"><span class="i-speaker" aria-hidden="true"></span>' + t('name.play') + '</button></p>' +
        '<p class="meta say-none" hidden>' + t('name.none') + '</p>';
      more = { href: '#/next?to=%2F', label: t('name.more') };
    } else if (key.indexOf('term:') === 0) {
      var x = termById[key.slice(5)];
      bar = '<span>' + t('card.term') + '</span>';
      label = x.name;
      bodyHtml = '<h3>' + Lab.inline(x.name.replace(/^(\w+_\w+)$/, '`$1`')) + '</h3><p>' + esc(x.def) + '</p>';
      more = Lab.termTarget(x);
    } else if (key.indexOf('tag:') === 0) {
      var tag = key.slice(4), es = Lab.tagged(tag);
      bar = '<span>' + t('card.tag') + '</span><span class="meta">' + (es.length === 1 ? t('count.one') : t('count.many', { n: es.length })) + '</span>';
      label = tag;
      bodyHtml = '<h3>' + esc(tag) + '</h3><ul class="card-list">' + es.slice(0, 5).map(function (e) { return '<li>' + esc(e.title) + ' <span class="meta">' + Lab.kindWords(e) + '</span></li>'; }).join('') + '</ul>';
      more = { href: tagHref(tag), label: t('card.tagged', { tag: tag }) };
    } else if (key.indexOf('ref:') === 0) {
      var parts = key.split(':'), r = (Lab.bodies[parts[1]] || {}).refs[parts[2]];
      var mark = document.querySelector('[data-preview="' + key + '"]');
      bar = '<span>' + t('card.ref', { n: mark ? mark.textContent : '' }) + '</span>';
      label = r.title;
      bodyHtml = '<h3>' + esc(r.title) + '</h3><p class="meta">' + esc(r.site) + '</p><p>' + esc(r.line.text) + '</p>' + (r.url ? '' : '<p class="meta">' + t('card.internal') + '</p>');
      more = r.url ? { href: r.url, label: t('card.source'), ext: true } : { href: '#ref-' + parts[2], jump: 'ref-' + parts[2], label: t('card.refs') };
    } else {
      var e = byId[key];
      if (!e) return null;
      var b = Lab.bodies[e.id];
      var firstP = b && b.blocks.find(function (x) { return x.p; });
      var lede = Lab.plain(Lab.ledeOf(e));
      bar = '<span>' + Lab.kindWords(e) + '</span>' + Lab.date(e.updated || e.published);
      label = e.title;
      bodyHtml = '<h3>' + esc(e.title) + '</h3>' + (lede ? '<p>' + esc(lede) + '</p>' : '') + (firstP ? '<p>' + esc(Lab.plain(firstP.p.text)) + '</p>' : '');
      more = { href: Lab.href(e), label: t('card.open') };
    }
    return {
      label: label,
      html: '<div class="window-bar">' + bar + '<button type="button" class="card-close" data-card-close aria-label="' + t('card.close') + '">' + t('card.close') + '</button></div>' +
        '<div class="preview-body">' + bodyHtml +
        (more ? '<p class="card-more"><a href="' + esc(more.href) + '"' + (more.ext ? ' class="ext" rel="noopener"' : '') + (more.jump ? ' data-jump="' + more.jump + '"' : '') + '>' + more.label + '</a></p>' : '') + '</div>',
    };
  }
  function openPreview(trigger, how) {
    var key = trigger.getAttribute('data-preview'), card = cardOf(key);
    if (!card) return;
    clearTimeout(openT); clearTimeout(closeT);
    if (!pv) {
      pv = Lab.html('<div class="preview" role="dialog" hidden></div>');
      document.body.appendChild(pv);
      pv.addEventListener('pointerenter', function () { clearTimeout(closeT); });
      pv.addEventListener('pointerleave', function (ev) { if (pvMode === 'float' && pvHow === 'hover' && ev.pointerType !== 'touch' && !(pvFor && pvFor.contains(ev.relatedTarget))) closeSoon(); });
      pv.addEventListener('click', function (ev) {
        if (ev.target.closest('[data-card-close]')) { var back = pvFor; closePreview(); if (back) back.focus({ preventScroll: true }); return; }
        var say = ev.target.closest('[data-say]');
        if (say) { sayName(say); return; }
      });
    }
    if (pvFor && pvFor !== trigger) setExpanded(pvFor, false);
    var sheet = how === 'tap' || !hoverable();
    pvMode = sheet ? 'sheet' : 'float';
    pv.innerHTML = card.html;
    pv.setAttribute('aria-label', card.label);
    pv.setAttribute('data-for', key);
    pv.className = 'preview' + (sheet ? ' is-sheet' : '');
    pv.hidden = false;
    if (sheet) {
      main.style.paddingBottom = pv.offsetHeight + 'px';   // room to scroll the tapped words clear
      var sheetTop = window.innerHeight - pv.offsetHeight, r = trigger.getBoundingClientRect();
      if (r.bottom > sheetTop - 12) window.scrollBy(0, r.bottom - sheetTop + 28);
      else if (r.top < Lab.barH) window.scrollBy(0, r.top - Lab.barH - 16);
    } else {
      var r2 = trigger.getBoundingClientRect(), w = Math.min(420, window.innerWidth - 32);
      pv.style.left = Math.min(Math.max(16, r2.left), window.innerWidth - w - 16) + 'px';
      pv.style.top = '0px';
      var h = pv.offsetHeight, below = r2.bottom + 10;
      pv.style.top = (below + h < window.innerHeight - 8 ? below : Math.max(Lab.barH + 8, r2.top - h - 10)) + 'px';
    }
    requestAnimationFrame(function () { pv.classList.add('is-open'); });
    if (pvFor !== trigger && how !== 'hover') Lab.audio.cue('peek');
    pvFor = trigger;
    pvHow = how;
    setExpanded(trigger, true);
  }
  function setExpanded(el, on) { if (el.hasAttribute('aria-expanded')) el.setAttribute('aria-expanded', String(on)); }
  function closeSoon() { clearTimeout(closeT); closeT = setTimeout(closePreview, DISMISS); }
  function closePreview(now) {
    clearTimeout(openT); clearTimeout(closeT);
    if (pvFor) setExpanded(pvFor, false);
    pvFor = null;
    if (!pv) return;
    pv.classList.remove('is-open');
    pv.hidden = true;
    pv.removeAttribute('data-for');
    if (main) main.style.paddingBottom = '';
    if (now) pv.innerHTML = '';
  }
  Lab.preview = { open: openPreview, close: closePreview, el: function () { return pv; }, INTENT: INTENT, DISMISS: DISMISS };
  var triggerOf = function (el) { return el && el.closest && el.closest('[data-preview]'); };
  document.addEventListener('pointerdown', function (ev) {
    lastPointer = ev.pointerType || 'mouse';
    if (pv && !pv.hidden && !pv.contains(ev.target) && !(pvFor && pvFor.contains(ev.target))) closePreview();
  }, true);
  document.addEventListener('pointerover', function (ev) {
    var a = triggerOf(ev.target);
    if (!a || ev.pointerType === 'touch' || !hoverable() || (pv && pv.contains(a))) return;
    clearTimeout(closeT);
    if (pvFor === a) return;
    clearTimeout(openT);
    openT = setTimeout(function () { openPreview(a, 'hover'); }, INTENT);
  });
  document.addEventListener('pointerout', function (ev) {
    var a = triggerOf(ev.target);
    if (!a || ev.pointerType === 'touch' || a.contains(ev.relatedTarget)) return;
    clearTimeout(openT);
    if (pvFor === a && pvMode === 'float' && pvHow === 'hover' && !(pv && pv.contains(ev.relatedTarget))) closeSoon();
  });
  document.addEventListener('click', function (ev) {
    var j = ev.target.closest && ev.target.closest('a[data-jump]');
    var a = triggerOf(ev.target);
    if (a && !(pv && pv.contains(a))) {
      var touch = lastPointer === 'touch' || !hoverable();
      if (a.matches('button')) {                 // the name: a click or Enter opens (or keeps) its card; a second one closes it
        ev.preventDefault();
        if (pvFor === a && pvHow !== 'hover') closePreview();
        else { if (pvFor === a) pvHow = 'click'; else openPreview(a, touch ? 'tap' : 'click'); if (ev.detail === 0) focusCard(); }
        return;
      }
      if (touch && pvFor !== a) { ev.preventDefault(); openPreview(a, 'tap'); return; }   // first tap: the card
    }
    if (j) {                                     // in-page jumps never touch the hash router
      ev.preventDefault();
      var to = document.getElementById(j.getAttribute('data-jump'));
      closePreview();
      if (to) { to.scrollIntoView({ block: 'center', behavior: Lab.look.reduced() ? 'auto' : 'smooth' }); to.classList.add('is-target'); setTimeout(function () { to.classList.remove('is-target'); }, 1600); }
    }
  });
  /** Keyboard opens move focus into the card: play first, then the link further, then Close. */
  function focusCard() {
    if (!pv) return;
    var f = ['[data-say]', '.card-more a', '[data-card-close]'].map(function (s) { return pv.querySelector(s); }).find(Boolean);
    if (f) f.focus();
  }
  document.addEventListener('focusin', function (ev) {
    var a = triggerOf(ev.target);
    if (a && a.tagName === 'A' && a.matches(':focus-visible') && !(pv && pv.contains(a))) openPreview(a, 'focus');
  });
  document.addEventListener('focusout', function (ev) {
    if (!pv || pv.hidden || pvMode === 'sheet') return;
    var to = ev.relatedTarget;
    if (to && (pv.contains(to) || (pvFor && pvFor.contains(to)))) return;
    if (triggerOf(ev.target) === pvFor || pv.contains(ev.target)) closeSoon();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape' || !pv || pv.hidden) return;
    var back = pvFor, inside = pv.contains(document.activeElement);
    closePreview();
    if (back && inside) back.focus({ preventScroll: true });
  });
  window.addEventListener('scroll', function () { if (pv && !pv.hidden && pvMode === 'float') closePreview(); }, { passive: true });

  // ---------- the dot: reading progress with a face ----------
  var lastX = -1, lastStep = 0, idle = null, inFooter = false, footObs = null;
  function updateDot() {
    if (!dot || inFooter) return;
    var x0 = window.innerWidth <= 760 ? 104 : 120;
    if (Lab.look.reduced()) { dot.style.setProperty('--dot-x-still', x0 + 'px'); return; }
    var max = document.documentElement.scrollHeight - window.innerHeight;
    var p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
    var x = Math.round(x0 + p * (window.innerWidth - x0 - 16 - 22));
    dot.style.setProperty('--dot-x', x + 'px');
    var now = performance.now();
    if (lastX >= 0 && Math.abs(x - lastX) > 3 && now - lastStep > 320) {
      lastStep = now;
      dot.querySelector('svg').animate([{ transform: 'scale(1.16, .84)' }, { transform: 'scale(1)' }], { duration: 320, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' });
    }
    lastX = x;
  }
  function wake() {
    if (!dot) return;
    dot.classList.remove('is-asleep');
    clearTimeout(idle);
    if (!Lab.look.reduced()) idle = setTimeout(function () { dot.classList.add('is-asleep'); }, 20000);
  }
  function dotHome(toFooter) {
    if (!dot || toFooter === inFooter) return;
    var foot = main.querySelector('.foot');
    var from = dot.getBoundingClientRect();
    inFooter = toFooter && !!foot;
    if (inFooter) { dot.classList.add('in-footer'); foot.appendChild(dot); dot.style.setProperty('--dot-x', Math.max(0, foot.getBoundingClientRect().width - 22) + 'px'); }
    else { dot.classList.remove('in-footer'); bar.appendChild(dot); updateDot(); }
    if (!Lab.look.reduced()) {
      var to = dot.getBoundingClientRect();
      dot.animate([{ translate: (from.left - to.left) + 'px ' + (from.top - to.top) + 'px' }, { translate: '0 0' }], { duration: 450, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' });
    }
  }
  function observeFooter() {
    if (footObs) footObs.disconnect();
    if (!window.IntersectionObserver) return;
    var foot = main.querySelector('.foot');
    footObs = new IntersectionObserver(function (es) {
      var vis = es[0].isIntersecting && es[0].intersectionRatio > 0.6;
      var scrollable = document.documentElement.scrollHeight - window.innerHeight > 80;
      dotHome(vis && scrollable);
    }, { threshold: [0, 0.6, 1] });
    footObs.observe(foot);
  }
  document.addEventListener('pointermove', function (e) {
    wake();
    if (!dot || Lab.look.reduced()) return;
    var r = dot.getBoundingClientRect(), dx = e.clientX - (r.left + 11), dy = e.clientY - (r.top + 11), d = Math.hypot(dx, dy) || 1;
    dot.querySelector('.look-at').setAttribute('transform', 'translate(' + (dx / d * 1.1).toFixed(2) + ' ' + (dy / d * 1.1).toFixed(2) + ')');
  }, { passive: true });

  // ---------- scrolling: the bar's hairline, hide on scroll down (phone), the dot ----------
  var lastY = 0, ticking = false;
  window.addEventListener('scroll', function () {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      ticking = false;
      var y = window.scrollY;
      bar.classList.toggle('is-scrolled', y > 4);
      var phone = window.matchMedia('(max-width: 760px)').matches;
      if (phone && !Lab.player.open) bar.classList.toggle('is-hidden', y > lastY && y > 120);
      else bar.classList.remove('is-hidden');
      lastY = y;
      updateDot();
      wake();
    });
  }, { passive: true });
  window.addEventListener('resize', updateDot);

  // ---------- start ----------
  Lab.barH = 56;
  function start() {
    renderBar();
    main = Lab.html('<main class="lab-main" id="main"></main>');
    document.body.appendChild(main);
    window.addEventListener('hashchange', render);
    render();
    wake();
    root.setAttribute('data-ready', '1');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
