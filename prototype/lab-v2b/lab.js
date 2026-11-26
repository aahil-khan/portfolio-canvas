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
  var newestFirst = function (a, b) { return (b.updated || b.published || '').localeCompare(a.updated || a.published || ''); };
  var byPublished = function (a, b) { return (b.published || '').localeCompare(a.published || ''); };
  function featuredEntry() {
    var forced = q.get('feature') && byId[q.get('feature')];
    if (forced) return forced;
    var pub = publicEntries();
    return pub.find(function (e) { return e.pinned; }) || pub.sort(byPublished)[0];
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
  function featuredCard(e) {
    var lead = Lab.leadOf(e);
    var lede = Lab.ledeOf(e);
    var showLede = lead.name !== 'opening' && lead.name !== 'keyline';
    var card = Lab.html(
      '<section class="featured wide" aria-labelledby="featured-title">' +
        '<article class="box window">' +
          '<div class="window-bar"><span>' + Lab.kindWords(e) + '</span>' + Lab.date(e.updated || e.published) + '</div>' +
          '<div class="featured-body">' +
            '<div class="featured-lead" data-featured-lead data-lead-kind="' + lead.name + '"></div>' +
            '<div class="featured-text"><h2 id="featured-title">' + Lab.linkTo(e.id) + '</h2>' +
              (showLede ? '<p>' + esc(lede) + '</p>' : '') +
              (e.read ? '<p class="meta">' + t('read', { n: e.read }) + '</p>' : '') +
            '</div>' +
          '</div>' +
        '</article>' +
      '</section>');
    card.querySelector('[data-featured-lead]').appendChild(lead.render('card'));
    return card;
  }

  function home() {
    var feat = featuredEntry();
    var pub = publicEntries();
    var nowEntry = pub.slice().sort(function (a, b) { return newestFirst(a, b) || (b.nowKey ? 1 : 0) - (a.nowKey ? 1 : 0); })[0];
    var nowText = nowEntry.nowKey ? t(nowEntry.nowKey) : esc(Lab.kindWords(nowEntry) + ': ' + nowEntry.title);
    var page = Lab.html('<div class="page home"></div>');
    page.appendChild(Lab.html(
      '<section class="intro">' +
        '<p class="eyebrow">' + t('home.eyebrow') + '</p>' +
        '<h1 class="home-title">' + t('home.title') + '</h1>' +
        '<p class="intro-text">' + t('home.intro.a') + ' ' + esc(D.owner.short) + ' <button type="button" class="say" aria-label="' + t('say.label') + '">(' + t('say') + ')</button>' + t('home.intro.b') + ' ' + t('home.brand') + '</p>' +
        '<p class="nowline">' + Lab.date(nowEntry.updated || nowEntry.published) + '<a class="quiet" href="' + Lab.href(nowEntry) + '" data-preview="' + nowEntry.id + '">' + nowText + '</a></p>' +
      '</section>'));
    page.appendChild(featuredCard(feat));

    // In progress: every study and series not marked done
    var going = pub.filter(function (e) { return (e.kind === 'study' || e.kind === 'series') && !e.done; });
    if (going.length) {
      page.appendChild(Lab.html('<section class="block wide"><div class="block-head"><h2>' + t('home.inprogress') + '</h2></div><ul class="rows">' +
        going.map(function (e) {
          var words;
          if (e.kind === 'series') { var ch = Lab.childrenOf(e.id); words = t('progress.series', { done: ch.filter(isPublic).length, total: ch.length }); }
          else words = t('progress.study', e.progress);
          return '<li class="row progress-row"><span class="row-title">' + Lab.linkTo(e.id) + '</span><span class="meta">' + words + ' · ' + t('updated', { date: '' }).trim() + ' ' + Lab.date(e.updated || e.published) + '</span></li>';
        }).join('') + '</ul></section>'));
    }

    // Sections: one column per section that has public entries
    var secs = D.sections.filter(function (s) { return pub.some(function (e) { return e.section === s.id; }); });
    page.appendChild(Lab.html('<section class="block wide"><div class="block-head"><h2>' + t('home.sections') + '</h2></div><div class="sections">' +
      secs.map(function (s) {
        var es = pub.filter(function (e) { return e.section === s.id; }).sort(byPublished);
        var count = es.length === 1 ? t('count.one') : t('count.many', { n: es.length });
        return '<div><h3>' + esc(s.title) + '</h3><p>' + (s.thesisKey ? t(s.thesisKey) : esc(s.thesis)) + '</p><p class="meta">' + count + ' · ' + t('newest') + Lab.linkTo(es[0].id) + '</p></div>';
      }).join('') + '</div></section>'));

    // Everything, newest first, grouped by year
    var all = pub.slice().sort(byPublished);
    var shown = all.slice(0, 12), years = [], html = '';
    shown.forEach(function (e) { var y = e.published.slice(0, 4); if (years.indexOf(y) < 0) years.push(y); });
    years.forEach(function (y) {
      html += '<li class="year" aria-hidden="true">' + y + '</li>';
      shown.filter(function (e) { return e.published.slice(0, 4) === y; }).forEach(function (e) {
        html += '<li class="row">' + Lab.date(e.published) + '<span class="row-title">' + Lab.linkTo(e.id) + '</span><span class="row-kind">' + Lab.kindWords(e) + '</span></li>';
      });
    });
    page.appendChild(Lab.html('<section class="block wide"><div class="block-head"><h2>' + t('home.everything') + '</h2>' +
      (all.length > shown.length ? '<a class="meta" href="#/next?to=%2Flab%2Findex">' + t('home.all', { n: all.length }) + '</a>' : '') +
      '</div><ul class="rows">' + html + '</ul></section>'));

    var body = Lab.bodies[feat.id];
    if (body && body.pull) page.appendChild(Lab.html('<section class="block block-pull"><p class="pull" aria-hidden="true">' + esc(body.pull) + '</p></section>'));

    page.querySelector('.say').addEventListener('click', sayName);
    return page;
  }

  function entryPage(e) {
    var parent = e.parent && byId[e.parent];
    var siblings = parent ? Lab.childrenOf(parent.id) : [];
    var idx = siblings.indexOf(e);
    var pad = function (n) { return String(n).padStart(2, '0'); };
    var body = Lab.bodies[e.id] || { blocks: [] };
    var page = Lab.html('<article class="page entry"></article>');
    var series = parent && e.kind === 'chapter' ?
      '<details class="series"><summary aria-expanded="false">' + esc(parent.title) + ' · <span data-num>' + pad(e.order) + '</span> of <span data-num>' + pad(siblings.length) + '</span>' +
        '<span class="ticks" aria-hidden="true">' + siblings.map(function (s) { return '<i' + (s === e ? ' class="on"' : '') + '></i>'; }).join('') + '</span><span class="chev" aria-hidden="true"></span></summary>' +
        '<ol class="chapters">' + siblings.map(function (s) { return '<li><span data-num>' + pad(s.order) + '</span>' + (s === e ? '<span>' + esc(s.title) + '</span>' : Lab.linkTo(s.id)) + '</li>'; }).join('') + '</ol>' +
        '<p class="meta">' + Lab.linkTo(parent.id, t('chapters.all')) + '</p></details>' : '';
    page.appendChild(Lab.html('<div class="entry-head">' + series +
      (e.kind === 'chapter' ? '<span class="num" aria-hidden="true">' + pad(e.order) + '</span>' : '') +
      '<h1 class="entry-title">' + esc(e.title) + '</h1>' +
      '<p class="entry-meta meta">' + t('written') + ' ' + Lab.date(e.published) + (e.read ? ' · ' + t('read', { n: e.read }) : '') + '</p></div>'));
    var det = page.querySelector('.series');
    if (det) det.addEventListener('toggle', function () { det.querySelector('summary').setAttribute('aria-expanded', String(det.open)); });

    var lead = Lab.leadOf(e);
    var leadBox = Lab.html('<div class="lead-block wide" data-lead data-lead-kind="' + lead.name + '"></div>');
    if (lead.name === 'haggle') leadBox.appendChild(Lab.html('<p class="lead-intro">' + t('haggle.intro') + '</p>'));
    leadBox.appendChild(lead.render('full'));
    if (lead.name === 'haggle') leadBox.appendChild(Lab.html('<p class="caption">' + t('haggle.caption') + '</p>'));
    page.appendChild(leadBox);

    var prose = Lab.html('<div class="entry-body prose"><p class="lede">' + esc(Lab.ledeOf(e)) + '</p></div>');
    if (lead.name === 'haggle') prose.appendChild(Lab.html('<div class="side sidenote"><p><strong>' + t('haggle.note') + '</strong> ' + t('haggle.schedule') + '</p></div>'));
    var pulled = false;
    body.blocks.forEach(function (b) {
      if (b.h2) prose.appendChild(Lab.html('<h2>' + esc(b.h2.text) + '</h2>'));
      if (b.p) {
        prose.appendChild(Lab.html('<p>' + Lab.inline(b.p.text) + '</p>'));
        if (!pulled && body.pull && prose.querySelectorAll('h2').length === 1) { prose.appendChild(Lab.html('<div class="side"><p class="pull" aria-hidden="true">' + esc(body.pull) + '</p></div>')); pulled = true; }
      }
      if (b.figure) prose.appendChild(Lab.instruments[b.figure](e));
    });
    page.appendChild(prose);
    if (body.backlinks) page.appendChild(Lab.html('<p class="backlinks meta">' + t('backlinks') + ' ' + body.backlinks.map(function (id) { return Lab.linkTo(id); }).join(', ') + '</p>'));
    if (parent && idx >= 0) {
      var prev = siblings[idx - 1], next = siblings[idx + 1];
      page.appendChild(Lab.html('<nav class="nextprev" aria-label="Chapters">' +
        (prev ? '<a class="box" href="' + Lab.href(prev) + '" data-preview="' + prev.id + '"><span class="meta">' + t('prev') + ' · ' + pad(prev.order) + '</span><span class="np-title">' + esc(prev.title) + '</span></a>' : '<span></span>') +
        (next ? '<a class="box np-next" href="' + Lab.href(next) + '" data-preview="' + next.id + '"><span class="meta">' + t('nextch') + ' · ' + pad(next.order) + '</span><span class="np-title">' + esc(next.title) + '</span></a>' : '') +
        '</nav>'));
    }
    return page;
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

  // ---------- the name, said ----------
  function sayName(ev) {
    var b = ev.currentTarget;
    if (!('speechSynthesis' in window)) { b.title = Lab.raw('say.none'); return; }
    var u = new SpeechSynthesisUtterance(D.owner.name);
    u.lang = 'en-IN'; u.rate = 0.85;
    var voices = speechSynthesis.getVoices();
    var v = voices.find(function (x) { return /en-IN/i.test(x.lang); });
    if (v) u.voice = v;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  }

  // ---------- previews: mini canvas windows, desktop only ----------
  var pv = null, pvTimer = null, pvFor = null;
  var canPreview = function () { return window.matchMedia('(min-width: 800px) and (hover: hover)').matches; };
  function previewFor(e) {
    var body = Lab.bodies[e.id];
    var firstP = body && body.blocks.find(function (b) { return b.p; });
    var lede = Lab.ledeOf(e);
    return '<div class="window-bar"><span>' + Lab.kindWords(e) + '</span>' + Lab.date(e.updated || e.published) + '</div>' +
      '<div class="preview-body"><h3>' + esc(e.title) + '</h3>' + (lede ? '<p>' + esc(lede) + '</p>' : '') +
      (firstP ? '<p>' + esc(firstP.p.text.replace(/==|`|\[\[[\w-]+\|([^\]]+)\]\]/g, '$1')) + '</p>' : '') + '</div>';
  }
  function openPreview(a) {
    var e = byId[a.getAttribute('data-preview')];
    if (!e || !canPreview()) return;
    if (!pv) { pv = Lab.html('<div class="preview" role="tooltip" aria-hidden="true"></div>'); document.body.appendChild(pv); }
    pv.innerHTML = previewFor(e);
    pv.classList.remove('is-closing');
    var r = a.getBoundingClientRect(), w = Math.min(420, window.innerWidth - 32);
    var left = Math.min(Math.max(16, r.left), window.innerWidth - w - 16);
    pv.style.left = left + 'px';
    pv.style.top = '0px';
    var h = pv.offsetHeight;
    var below = r.bottom + 10;
    pv.style.top = (below + h < window.innerHeight - 8 ? below : Math.max(Lab.barH + 8, r.top - h - 10)) + 'px';
    requestAnimationFrame(function () { pv.classList.add('is-open'); });
    if (pvFor !== a) Lab.audio.cue('peek');
    pvFor = a;
  }
  function closePreview(now) {
    clearTimeout(pvTimer);
    pvFor = null;
    if (!pv) return;
    pv.classList.add('is-closing');
    pv.classList.remove('is-open');
    if (now) pv.innerHTML = '';
  }
  document.addEventListener('pointerover', function (ev) {
    var a = ev.target.closest && ev.target.closest('a[data-preview]');
    if (!a || ev.pointerType === 'touch') return;
    clearTimeout(pvTimer);
    pvTimer = setTimeout(function () { openPreview(a); }, 300);
  });
  document.addEventListener('pointerout', function (ev) {
    var a = ev.target.closest && ev.target.closest('a[data-preview]');
    if (a && !a.contains(ev.relatedTarget)) closePreview(false);
  });
  document.addEventListener('focusin', function (ev) { var a = ev.target.closest && ev.target.closest('a[data-preview]'); if (a && a.matches(':focus-visible')) openPreview(a); });
  document.addEventListener('focusout', function (ev) { if (ev.target.closest && ev.target.closest('a[data-preview]')) closePreview(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closePreview(false); });

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
